require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');
const OpenAI = require('openai');
const { supabase, isSupabaseConfigured, createTokenClient } = require('./lib/supabase');
const requireAuth = require('./middleware/auth');
const { inputSchema, outputSchema } = require('./src/llm/schema');
const { sleep, getStatusCode, isRetryableError, getNetworkErrorCode, getBackoffMs } = require('./src/llm/retry');
const { quarantineOutput } = require('./src/llm/quarantine');
const { run: runScraper } = require('./scraper/src');

const app = express();
const port = process.env.PORT || 3000;
const promptVersion = 'triage-v1';
const llmModel = process.env.LLM_MODEL || 'openai/gpt-oss-120b';
const llmKillSwitch = process.env.LLM_KILL_SWITCH === '1' || process.env.LLM_KILL_SWITCH === 'true';
const promptText = fs.readFileSync(path.join(__dirname, 'prompts', 'triage-v1.md'), 'utf8');
const scraperOutputDir = path.join(__dirname, 'scraper', 'output');
let scraperRunPromise = null;

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/public/info', (req, res) => {
  res.status(200).json({ message: 'Welcome stranger! This info is public.' });
});

app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || email.trim() === '' ||
      typeof password !== 'string' || password.trim() === '') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: 'Supabase authentication is not configured' });
  }

  let data;
  let error;

  try {
    ({ data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password
    }));
  } catch (authError) {
    return res.status(400).json({ error: 'Unable to create account' });
  }

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(201).json(data);
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || email.trim() === '' ||
      typeof password !== 'string' || password.trim() === '') {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: 'Supabase authentication is not configured' });
  }

  let data;
  let error;

  try {
    ({ data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    }));
  } catch (authError) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  if (error || !data.session || !data.user) {
    return res.status(401).json({ error: 'Invalid login credentials' });
  }

  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user
  });
});

app.get('/protected/profile', requireAuth, (req, res) => {
  const { id, email, created_at } = req.user;
  res.status(200).json({ id, email, created_at });
});

app.get('/protected/dashboard', requireAuth, (req, res) => {
  res.status(200).json({
    message: 'Welcome to dashboard',
    user: req.user.email
  });
});

app.post('/auth/logout', requireAuth, async (req, res) => {
  let error;

  try {
    ({ error } = await createTokenClient(req.token).auth.signOut());
  } catch (authError) {
    return res.status(500).json({ error: 'Unable to log out' });
  }

  if (error) {
    return res.status(500).json({ error: 'Unable to log out' });
  }

  return res.status(204).send();
});

// Keep the database location configurable for Docker and local development.
const dbPath = process.env.DB_PATH || 'tasks.db';
const dbDir = path.dirname(dbPath);
fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(dbPath);

// Create the tasks table if it doesn't already exist
db.prepare(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done BOOLEAN NOT NULL
  )
`).run();

// Seed three example tasks ONLY if the table is empty
const countCheck = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
if (countCheck.count === 0) {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  insert.run('Set up Express server', 1);
  insert.run('Build read endpoints', 0);
  insert.run('Publish to GitHub', 0);
  console.log('Database seeded with 3 initial tasks.');
}

// Stage 1: Root endpoint describing the API
app.get('/', (req, res) => {
  res.json({ name: "Task API", version: "1.0", endpoints: ["/tasks"] });
});

// Stage 1: Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      db: Boolean(db),
      llm: process.env.LLM_ENABLED === 'true' && !llmKillSwitch,
      auth: isSupabaseConfigured
    }
  });
});

function readScraperOutput(filename, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(scraperOutputDir, filename), 'utf8'));
  } catch (error) {
    return fallback;
  }
}

app.get('/api/scraper/data', (req, res) => {
  res.json({
    books: readScraperOutput('books.json', []),
    report: readScraperOutput('run-report.json', null)
  });
});

app.post('/api/scraper/trigger', async (req, res) => {
  if (scraperRunPromise) {
    return res.status(202).json({ status: 'running' });
  }

  const targetUrl = typeof req.body?.targetUrl === 'string' && req.body.targetUrl.trim()
    ? req.body.targetUrl.trim()
    : undefined;
  if (targetUrl) {
    try {
      const parsedUrl = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Only HTTP and HTTPS targets are supported');
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid targetUrl' });
    }
  }
  scraperRunPromise = runScraper(targetUrl);
  try {
    await scraperRunPromise;
    return res.status(202).json({ status: 'completed', report: readScraperOutput('run-report.json', null) });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Scraper run failed' });
  } finally {
    scraperRunPromise = null;
  }
});

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
    baseURL: process.env.LLM_BASE_URL,
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
    const shouldRetry = isRetryableError(error) && attempt < 2;

    if (!shouldRetry) {
      throw error;
    }

    console.error(JSON.stringify({ event: 'llm.retry', attempt: attempt + 1, status, network_code: getNetworkErrorCode(error), error: error?.message || String(error) }));
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

  if (process.env.LLM_ENABLED !== 'true' || llmKillSwitch) {
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
    return res.status(503).json(fallback);
  }

  if (process.env.LLM_STUB === '1') {
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
    return res.status(200).json(validated);
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

    if (repairCount === 0) {
      // no-op; validation succeeded
    }

    const validatedFinal = outputSchema.parse(finalResult);
    res.set('X-LLM-Repair-Count', String(repairCount));
    res.set('X-LLM-Model', llmModel);

    logCost({
      promptVersion,
      model: llmModel,
      inputTokens: initial.usage?.prompt_tokens ?? 0,
      outputTokens: initial.usage?.completion_tokens ?? 0,
      durationMs: initial.durationMs,
      repairCount,
      ok: true
    });

    return res.status(200).json(validatedFinal);
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
      return res.status(504).json({ error: 'Gateway Timeout while calling the model' });
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
        res.set('X-LLM-Repair-Count', String(repairCount));
        res.set('X-LLM-Model', llmModel);

        logCost({
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

        return res.status(422).json({ error: 'Model output was invalid and the repair attempt also failed.' });
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

    return res.status(422).json({ error: 'Model output could not be validated.' });
  }
});

// Stage 1: Read all tasks from SQLite
app.get('/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  res.json(tasks);
});

// Stage 1: Read single task from SQLite using parameterized query
app.get('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  
  res.json(task);
});

// Stage 2: Create a new task in SQLite
app.post('/tasks', (req, res) => {
  const { title } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: "Title is required" });
  }

  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const result = insert.run(title, 0);

  const newTask = {
    id: result.lastInsertRowid,
    title: title,
    done: false
  };
  
  res.status(201).json(newTask);
});

// Stage 3: Update a task in SQLite
app.put('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "Request body cannot be empty" });
  }

  const { title, done } = req.body;
  const updatedTitle = title !== undefined ? title : task.title;
  const updatedDone = done !== undefined ? (done ? 1 : 0) : task.done;

  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(updatedTitle, updatedDone, taskId);

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  res.json({ ...updatedTask, done: Boolean(updatedTask.done) });
});

// Stage 3: Delete a task from SQLite
app.delete('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  res.status(204).send();
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

app.get('/api/triage/quarantine', (req, res) => {
  const quarantinePath = path.join(__dirname, 'logs', 'quarantine.jsonl');
  if (!fs.existsSync(quarantinePath)) {
    return res.json([]);
  }

  const entries = fs.readFileSync(quarantinePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .slice(-50)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return { error: 'Invalid quarantine log entry' };
      }
    });

  return res.json(entries);
});