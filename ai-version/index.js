require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const { z } = require('zod');
const OpenAI = require('openai');

const app = express();
const port = Number(process.env.PORT || 3001);
const promptVersion = 'triage-v1';
const llmModel = process.env.LLM_MODEL || 'openai/gpt-oss-120b';
const llmDisabled = process.env.LLM_ENABLED === 'false' || process.env.LLM_KILL_SWITCH === 'true';
const promptText = fs.readFileSync(path.join(__dirname, 'prompts', 'triage-v1.md'), 'utf8');

const inputSchema = z.object({
  text: z.string().min(1).max(2000)
});

const outputSchema = z.object({
  category: z.enum(['billing', 'bug', 'feature', 'other']),
  urgency: z.enum(['low', 'normal', 'high']),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(200)
});

app.use(express.json());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatusCode(error) {
  if (!error) return null;
  const status = error.status ?? error.statusCode ?? error.response?.status ?? error.code;
  return Number(status) || null;
}

function logMetrics({ promptVersion, model, inputTokens = 0, outputTokens = 0, durationMs = 0, repairCount = 0, ok = true, error = null }) {
  console.log(JSON.stringify({
    prompt_version: promptVersion,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    duration_ms: durationMs,
    repair_count: repairCount,
    ok,
    error: error ? String(error) : null
  }));
}

async function callModelWithRetry({ messages, attempt = 0 }) {
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1',
    apiKey: process.env.LLM_API_KEY,
    timeout: 30000,
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

    return {
      content: completion?.choices?.[0]?.message?.content ?? '',
      usage: completion?.usage || {},
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    const status = getStatusCode(error);
    const shouldRetry = (status === 429 || (status >= 500 && status <= 599)) && attempt < 2;

    if (!shouldRetry) {
      throw error;
    }

    const backoffMs = 500 * (2 ** attempt) + Math.floor(Math.random() * 250);
    await sleep(backoffMs);
    return callModelWithRetry({ messages, attempt: attempt + 1 });
  }
}

function parseAndValidateModelResponse(rawText, repairCount) {
  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch (parseError) {
    const error = new Error(`JSON parse failed: ${parseError.message}`);
    error.rawOutput = rawText;
    throw error;
  }

  const validation = outputSchema.safeParse(parsed);
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

function fallbackResponse() {
  return {
    category: 'other',
    urgency: 'low',
    confidence: 0.0,
    reason: 'LLM triage is unavailable.'
  };
}

app.post('/triage', async (req, res) => {
  const parsedInput = inputSchema.safeParse(req.body);

  if (!parsedInput.success) {
    const issue = parsedInput.error.issues[0];
    const field = issue?.path?.[0] || 'body';
    return res.status(400).json({
      error: `Invalid ${field}`,
      details: issue?.message || 'Request body is invalid'
    });
  }

  if (llmDisabled) {
    logMetrics({
      promptVersion,
      model: llmModel,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      repairCount: 0,
      ok: false,
      error: 'LLM disabled'
    });
    return res.status(503).json(fallbackResponse());
  }

  let repairCount = 0;
  let rawOutput = '';

  try {
    const messages = [
      { role: 'system', content: promptText },
      { role: 'user', content: parsedInput.data.text }
    ];

    const initial = await callModelWithRetry({ messages });
    rawOutput = initial.content;
    const validated = parseAndValidateModelResponse(rawOutput, repairCount);

    logMetrics({
      promptVersion,
      model: llmModel,
      inputTokens: initial.usage?.prompt_tokens ?? 0,
      outputTokens: initial.usage?.completion_tokens ?? 0,
      durationMs: initial.durationMs,
      repairCount,
      ok: true
    });

    return res.status(200).json(validated);
  } catch (error) {
    const status = getStatusCode(error);

    if (status === 504 || status === 408 || error?.name === 'TimeoutError') {
      logMetrics({
        promptVersion,
        model: llmModel,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        repairCount,
        ok: false,
        error: 'Gateway Timeout'
      });
      return res.status(504).json({ error: 'Gateway Timeout while calling the model' });
    }

    if (repairCount === 0 && error.rawOutput) {
      repairCount += 1;

      try {
        const repairMessages = [
          { role: 'system', content: promptText },
          { role: 'user', content: parsedInput.data.text },
          { role: 'assistant', content: error.rawOutput },
          { role: 'user', content: `Your previous answer was rejected for this reason: ${error.zodError || error.message}. Return only corrected JSON matching the required schema.` }
        ];

        const repaired = await callModelWithRetry({ messages: repairMessages });
        rawOutput = repaired.content;
        const finalResult = parseAndValidateModelResponse(rawOutput, repairCount);

        logMetrics({
          promptVersion,
          model: llmModel,
          inputTokens: repaired.usage?.prompt_tokens ?? 0,
          outputTokens: repaired.usage?.completion_tokens ?? 0,
          durationMs: repaired.durationMs,
          repairCount,
          ok: true
        });

        return res.status(200).json(finalResult);
      } catch (repairError) {
        const quarantinePath = path.join(__dirname, 'logs', 'quarantine.jsonl');
        fs.mkdirSync(path.dirname(quarantinePath), { recursive: true });
        fs.appendFileSync(quarantinePath, `${JSON.stringify({
          timestamp: new Date().toISOString(),
          prompt_version: promptVersion,
          model: llmModel,
          raw_output: rawOutput,
          error: repairError?.message || String(repairError)
        })}\n`);

        logMetrics({
          promptVersion,
          model: llmModel,
          inputTokens: 0,
          outputTokens: 0,
          durationMs: 0,
          repairCount,
          ok: false,
          error: repairError?.message || String(repairError)
        });

        return res.status(422).json({ error: 'Model output was invalid and the repair attempt also failed.' });
      }
    }

    const quarantinePath = path.join(__dirname, 'logs', 'quarantine.jsonl');
    fs.mkdirSync(path.dirname(quarantinePath), { recursive: true });
    fs.appendFileSync(quarantinePath, `${JSON.stringify({
      timestamp: new Date().toISOString(),
      prompt_version: promptVersion,
      model: llmModel,
      raw_output: rawOutput,
      error: error?.message || String(error)
    })}\n`);

    logMetrics({
      promptVersion,
      model: llmModel,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      repairCount,
      ok: false,
      error: error?.message || String(error)
    });

    return res.status(422).json({ error: 'Model output could not be validated.' });
  }
});

app.listen(port, () => {
  console.log(`AI quarantined triage server listening on port ${port}`);
});
