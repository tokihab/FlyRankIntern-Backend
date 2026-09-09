const express = require('express');
const app = express();
const port = 3000;

// In-memory database
const tasks = [
  { id: 1, title: "Set up Express server", done: true },
  { id: 2, title: "Build read endpoints", done: false },
  { id: 3, title: "Publish to GitHub", done: false }
];

// Stage 1: Root endpoint describing the API
app.get('/', (req, res) => {
  res.json({ name: "Task API", version: "1.0", endpoints: ["/tasks"] });
});

// Stage 1: Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

// Stage 2: Read all tasks
app.get('/tasks', (req, res) => {
  res.json(tasks);
});

// Stage 2: Read single task
app.get('/tasks/:id', (req, res) => {
  // req.params.id is always a string from the URL, so we parse it to a number
  const taskId = parseInt(req.params.id);
  const task = tasks.find(t => t.id === taskId);
  
  // Early return if task doesn't exist
  if (!task) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }
  
  res.json(task);
});

// Stage 0: Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});