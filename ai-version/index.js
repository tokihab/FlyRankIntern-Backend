const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../openapi.json');

const app = express();
const port = process.env.PORT || 3001;
const tasks = [];
let nextId = 1;

app.use(express.json());
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/tasks', (req, res) => {
  res.status(200).json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const task = tasks.find((item) => item.id === Number(req.params.id));

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  return res.status(200).json(task);
});

app.post('/tasks', (req, res) => {
  const { title } = req.body;

  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  const task = {
    id: nextId,
    title,
    done: false
  };

  nextId += 1;
  tasks.push(task);
  return res.status(201).json(task);
});

app.put('/tasks/:id', (req, res) => {
  const task = tasks.find((item) => item.id === Number(req.params.id));

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Request body cannot be empty' });
  }

  if (req.body.title !== undefined) {
    if (typeof req.body.title !== 'string' || req.body.title.trim() === '') {
      return res.status(400).json({ error: 'Title must be a non-empty string' });
    }
    task.title = req.body.title;
  }

  if (req.body.done !== undefined) {
    if (typeof req.body.done !== 'boolean') {
      return res.status(400).json({ error: 'Done must be a boolean' });
    }
    task.done = req.body.done;
  }

  return res.status(200).json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const taskIndex = tasks.findIndex((item) => item.id === Number(req.params.id));

  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }

  tasks.splice(taskIndex, 1);
  return res.status(204).send();
});

app.listen(port, () => {
  console.log(`AI task API listening on port ${port}`);
});
