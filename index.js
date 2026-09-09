const express = require('express');
const app = express();
app.use(express.json());
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

// Stage 3: Create a new task
app.post('/tasks', (req, res) => {
  const { title } = req.body;

  // Validation: check if title is missing or empty
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: "Title is required" });
  }

  // Find the highest existing ID and add 1
  const nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;

  const newTask = {
    id: nextId,
    title: title,
    done: false
  };

  tasks.push(newTask);
  
  // 201 Created
  res.status(201).json(newTask);
});

// Stage 4: Update a task
app.put('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const task = tasks.find(t => t.id === taskId);

  // 404 if task doesn't exist
  if (!task) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

  // 400 if body is entirely empty
  if (Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: "Request body cannot be empty" });
  }

  const { title, done } = req.body;

  // Update properties if they were provided
  if (title !== undefined) {
    task.title = title;
  }
  if (done !== undefined) {
    task.done = done;
  }

  // 200 OK by default
  res.json(task);
});

// Stage 4: Delete a task
app.delete('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  // 404 if task doesn't exist
  if (taskIndex === -1) {
    return res.status(404).json({ error: `Task ${taskId} not found` });
  }

  // Remove the task from the array
  tasks.splice(taskIndex, 1);
  
  // 204 No Content
  res.status(204).send();
});

// Stage 0: Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});