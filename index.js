const express = require('express');
const Database = require('better-sqlite3');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');
const { supabase, isSupabaseConfigured, createTokenClient } = require('./lib/supabase');
const requireAuth = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

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

const path = require('path');
const fs = require('fs');

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
  res.json({ status: "ok" });
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