const db = require('../config/db');

function getAllTasks() {
  const tasks = db.prepare('SELECT * FROM tasks').all();
  return tasks.map(task => ({ ...task, done: Boolean(task.done) }));
}

function getTaskById(id) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return null;
  return { ...task, done: Boolean(task.done) };
}

function createTask(title) {
  if (!title || title.trim() === '') {
    throw new Error('Title is required');
  }

  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  const result = insert.run(title, 0);

  return {
    id: result.lastInsertRowid,
    title: title,
    done: false
  };
}

function updateTask(id, updates) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!task) {
    throw new Error('Task not found');
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('Request body cannot be empty');
  }

  const { title, done } = updates;
  const updatedTitle = title !== undefined ? title : task.title;
  const updatedDone = done !== undefined ? (done ? 1 : 0) : task.done;

  db.prepare('UPDATE tasks SET title = ?, done = ? WHERE id = ?').run(updatedTitle, updatedDone, id);

  const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return { ...updatedTask, done: Boolean(updatedTask.done) };
}

function deleteTask(id) {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!task) {
    throw new Error('Task not found');
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return true;
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask
};
