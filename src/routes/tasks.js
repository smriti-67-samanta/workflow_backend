const express = require('express');
const Task = require('../models/Task');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Get all tasks for a project
router.get('/project/:projectId', authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ projectId: req.params.projectId });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task version history
router.get('/:taskId/history', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task.versionHistory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create task
router.post('/', authMiddleware, async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update task with version check
router.put('/:taskId', authMiddleware, async (req, res) => {
  try {
    const { versionNumber, ...updateData } = req.body;
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Optimistic concurrency check
    if (task.versionNumber !== versionNumber) {
      return res.status(409).json({ 
        error: 'Version mismatch. Task has been updated by another user.',
        latestVersion: task.versionNumber,
        latestTask: task
      });
    }
    
    Object.assign(task, updateData);
    await task.save();
    
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete task
router.delete('/:taskId', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;