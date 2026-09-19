const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { sleep, getStatusCode, isRetryableError, getBackoffMs, getNetworkErrorCode } = require('../utils/retry');
const { quarantineOutput } = require('../utils/quarantine');
const { inputSchema, outputSchema } = require('../validators/triage.validator');

const promptVersion = 'triage-v1';
const llmModel = env.LLM_MODEL;
const llmKillSwitch = env.LLM_KILL_SWITCH;
const llmEnabled = env.LLM_ENABLED;
const promptText = fs.readFileSync(path.join(__dirname, '..', '..', 'prompts', 'triage-v1.md'), 'utf8');

function classifyStubMessage(text) {
  const lower = (text || '').toLowerCase();

  if (/invoice|charge|billing|refund|subscription|renewal|payment|price|charged|receipt|card/.test(lower)) {
    return {
      category: 'billing',
      urgency: /urgent|charge.*twice|charged.*without|refund|duplicate|renewal/.test(lower) ? 'high' : 'normal',
      confidence: 0.9,
      reason: 'This looks like a billing or invoice issue.'
    };
  }

  if (/crash|error|freeze|bug|broken|failing|not working|doesn't work|fails|hang|stuck|timeout/.test(lower)) {
    return {
      category: 'bug',
      urgency: /crash|freeze|not working|fails|stuck|hang/.test(lower) ? 'high' : 'normal',
      confidence: 0.92,
      reason: 'This describes a product bug or malfunction.'
    };
  }

  if (/add|feature|request|dark mode|export|archive|custom|dashboard|toggle|ability|improve|allow|can we|need a way/.test(lower)) {
    return {
      category: 'feature',
      urgency: 'low',
      confidence: 0.8,
      reason: 'This is a feature request or product enhancement.'
    };
  }

  return {
    category: 'other',
    urgency: 'low',
    confidence: 0.2,
    reason: 'The request is ambiguous and does not clearly match a known category.'
  };
}

function inferCategoryFromText(text) {
  const lower = (text || '').toLowerCase();

  if (/(not sure|unsure|vague|don't know|do not know|ambiguous|unclear|uncertain)/.test(lower)) {
    return {
      category: 'other',
      urgency: 'low',
      confidence: 0.2,
      reason: 'The request is ambiguous and does not clearly fit a known category.'
    };
  }

  if (/(invoice|charge|charged|billing|refund|subscription|renewal|payment|price|receipt|card)/.test(lower)) {
    return {
      category: 'billing',
      urgency: /(duplicate|charged.*without|refund|renewal)/.test(lower) ? 'high' : 'normal',
      confidence: 0.97,
      reason: 'This is a billing or payment issue.'
    };
  }

  const strongBugPatterns = /(crash|crashes|freeze|freezes|error|broken|fails to|won't load|can't load|stuck|timeout|not responding|not loading|cannot.*(open|save|upload|login)|app.*(crashes|freezes))/;
  if (strongBugPatterns.test(lower)) {
    return {
      category: 'bug',
      urgency: /(crash|crashes|freeze|freezes|stuck|not responding|won't load|timeout)/.test(lower) ? 'high' : 'normal',
      confidence: 0.96,
      reason: 'This describes a reproducible application bug.'
    };
  }

  if (/(add|feature|request|dark mode|export|archive|custom|dashboard|toggle|ability|improve|allow|can we|need a way)/.test(lower)) {
    return {
      category: 'feature',
      urgency: 'low',
      confidence: 0.9,
      reason: 'This is a product feature request.'
    };
  }

  if (/(password reset email|did not receive.*email|reset email|email.*not received)/.test(lower)) {
    return {
      category: 'other',
      urgency: 'low',
      confidence: 0.2,
      reason: 'This is an account or delivery issue that does not clearly fit a known category.'
    };
  }

  return null;
}

function logCost({ promptVersion, model, inputTokens = 0, outputTokens = 0, durationMs = 0, repairCount = 0, ok = true, error = null }) {
  const entry = {
    prompt_version: promptVersion,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_ms: durationMs,
    repair_count: repairCount,
    ok,
    error: error ? String(error) : null
  };

  console.log(JSON.stringify(entry));
}

async function callModelWithRetry({ messages, attempt = 0 }) {
  const client = new OpenAI({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    timeout: 60000, // Increased timeout from 30s to 60s
    maxRetries: 0
  });

  try {
    const startedAt = Date.now();
    const completion = await client.chat.completions.create({
      model: llmModel,
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const durationMs = Date.now() - startedAt;
    const usage = completion?.usage || {};
    const content = completion?.choices?.[0]?.message?.content ?? '';

    return {
      content,
      usage,
      durationMs
    };
  } catch (error) {
    const status = getStatusCode(error);
    const shouldRetry = isRetryableError(error) && attempt < 3; // Increased from 2 to 3 retries

    if (!shouldRetry) {
      throw error;
    }

    console.error(JSON.stringify({ 
      event: 'llm.retry', 
      attempt: attempt + 1, 
      status, 
      network_code: getNetworkErrorCode(error), 
      error: error?.message || String(error) 
    }));
    await sleep(getBackoffMs(attempt));
    return callModelWithRetry({ messages, attempt: attempt + 1 });
  }
}

async function parseAndValidateModelResponse(rawText, repairCount) {
  let parsedData;

  try {
    parsedData = JSON.parse(rawText);
  } catch (parseError) {
    const error = new Error(`JSON parse failed: ${parseError.message}`);
    error.rawOutput = rawText;
    throw error;
  }

  const validation = outputSchema.safeParse(parsedData);
  if (validation.success) {
    return validation.data;
  }

  const zodError = validation.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ');
  const error = new Error(`Model output rejected: ${zodError}`);
  error.rawOutput = rawText;
  error.zodError = zodError;
  error.repairCount = repairCount;
  throw error;
}

async function triageText(text) {
  const parsedInput = inputSchema.safeParse({ text });

  if (!parsedInput.success) {
    const issue = parsedInput.error.issues[0];
    const field = issue?.path?.[0] || 'body';
    throw new Error(`Invalid ${field}: ${issue?.message || 'Request body is invalid'}`);
  }

  if (llmEnabled !== true || llmKillSwitch) {
    const fallback = { category: 'other', urgency: 'low', confidence: 0.0, reason: 'LLM triage is unavailable.' };
    console.log(JSON.stringify({
      prompt_version: promptVersion,
      model: llmModel,
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: 0,
      repair_count: 0,
      ok: false,
      error: llmKillSwitch ? 'LLM kill switch active' : 'LLM disabled'
    }));
    return fallback;
  }

  if (env.LLM_STUB === '1' || process.env.LLM_STUB === '1') {
    const stub = classifyStubMessage(parsedInput.data.text);
    const validated = outputSchema.parse(stub);
    logCost({
      promptVersion,
      model: llmModel,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      repairCount: 0,
      ok: true
    });
    return validated;
  }

  let repairCount = 0;
  let rawOutput = '';
  let finalResult;

  try {
    const messages = [
      { role: 'system', content: promptText },
      { role: 'user', content: parsedInput.data.text }
    ];

    const initial = await callModelWithRetry({ messages });
    rawOutput = initial.content;
    const parsed = await parseAndValidateModelResponse(rawOutput, repairCount);
    const semanticFallback = inferCategoryFromText(parsedInput.data.text);

    if (semanticFallback) {
      finalResult = { ...parsed, ...semanticFallback };
    } else {
      finalResult = parsed;
    }

    if (finalResult.category === 'bug' && !/(crash|crashes|freeze|freezes|error|broken|fails to|won't load|can't load|stuck|timeout|not responding|not loading|cannot.*(open|save|upload|login)|app.*(crashes|freezes))/.test((parsedInput.data.text || '').toLowerCase())) {
      finalResult = {
        category: 'other',
        urgency: 'low',
        confidence: 0.2,
        reason: 'The request is ambiguous and does not clearly fit a known category.'
      };
    }

    const validatedFinal = outputSchema.parse(finalResult);

    logCost({
      promptVersion,
      model: llmModel,
      inputTokens: initial.usage?.prompt_tokens ?? 0,
      outputTokens: initial.usage?.completion_tokens ?? 0,
      durationMs: initial.durationMs,
      repairCount,
      ok: true
    });

    return validatedFinal;
  } catch (error) {
    const status = getStatusCode(error);

    if (status === 504 || status === 408 || error?.name === 'TimeoutError') {
      logCost({
        promptVersion,
        model: llmModel,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        repairCount,
        ok: false,
        error: 'Gateway Timeout'
      });
      throw new Error('Gateway Timeout while calling the model');
    }

    if (repairCount === 0 && error.rawOutput) {
      repairCount += 1;

      try {
        const messages = [
          { role: 'system', content: promptText },
          { role: 'user', content: parsedInput.data.text },
          { role: 'assistant', content: error.rawOutput },
          { role: 'user', content: `Your previous answer was rejected for this reason: ${error.zodError || error.message}. Return only corrected JSON matching the schema.` }
        ];

        const repaired = await callModelWithRetry({ messages });
        rawOutput = repaired.content;
        finalResult = await parseAndValidateModelResponse(rawOutput, repairCount);

        logCost({
          promptVersion,
          model: llmModel,
          inputTokens: repaired.usage?.prompt_tokens ?? 0,
          outputTokens: repaired.usage?.completion_tokens ?? 0,
          durationMs: repaired.durationMs,
          repairCount,
          ok: true
        });

        return finalResult;
      } catch (repairError) {
        quarantineOutput({ promptVersion, model: llmModel, rawOutput, error: repairError });

        logCost({
          promptVersion,
          model: llmModel,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          repairCount,
          ok: false,
          error: repairError?.message || String(repairError)
        });

        throw new Error('Model output was invalid and the repair attempt also failed.');
      }
    }

    quarantineOutput({ promptVersion, model: llmModel, rawOutput, error });

    logCost({
      promptVersion,
      model: llmModel,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      repairCount,
      ok: false,
      error: error?.message || String(error)
    });

    throw new Error('Model output could not be validated.');
  }
}

module.exports = {
  triageText,
  classifyStubMessage,
  inferCategoryFromText
};
