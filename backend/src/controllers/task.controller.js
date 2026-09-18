const { getAllTasks, getTaskById, createTask, updateTask, deleteTask } = require('../services/task.service');

function getAll(req, res) {
  const tasks = getAllTasks();
  res.json(tasks);
}

function getById(req, res) {
  const taskId = parseInt(req.params.id);
  const task = getTaskById(taskId);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  res.json(task);
}

function create(req, res) {
  const { title } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const newTask = createTask(title);
    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function update(req, res) {
  const taskId = parseInt(req.params.id);

  try {
    const updatedTask = updateTask(taskId, req.body);
    res.json(updatedTask);
  } catch (error) {
    if (error.message === 'Task not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
}

function remove(req, res) {
  const taskId = parseInt(req.params.id);

  try {
    deleteTask(taskId);
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};
