const express = require('express');
const Task = require('../models/Task');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Compute execution plan
router.post('/projects/:projectId/compute-execution', authMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ projectId: req.params.projectId });
    
    if (tasks.length === 0) {
      return res.json({
        executionOrder: [],
        selectedTasks: [],
        blockedTasks: [],
        skippedTasks: [],
        message: 'No tasks in this project'
      });
    }
    
    // Simple sorting by priority
    const pendingTasks = tasks.filter(t => t.status === 'Pending');
    const sortedTasks = pendingTasks.sort((a, b) => b.priority - a.priority);
    
    res.json({
      executionOrder: sortedTasks.map(t => t._id),
      selectedTasks: sortedTasks.map(t => t._id),
      blockedTasks: tasks.filter(t => t.status === 'Blocked').map(t => t._id),
      skippedTasks: tasks.filter(t => t.status === 'Completed').map(t => t._id)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update task status
router.put('/tasks/:taskId/status', authMiddleware, async (req, res) => {
  try {
    const { status, versionNumber } = req.body;
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (task.versionNumber !== versionNumber) {
      return res.status(409).json({
        error: 'Version mismatch',
        latestVersion: task.versionNumber
      });
    }
    
    // Check resource constraint before moving to Running
    if (status === 'Running') {
      const runningTasksWithSameResource = await Task.findOne({
        projectId: task.projectId,
        resourceTag: task.resourceTag,
        status: 'Running',
        _id: { $ne: task._id }
      });
      
      if (runningTasksWithSameResource) {
        return res.status(400).json({ 
          error: `Resource "${task.resourceTag}" is already in use by another running task` 
        });
      }
      
      // Check dependencies
      if (task.dependencies.length > 0) {
        const incompleteDeps = await Task.find({
          _id: { $in: task.dependencies },
          status: { $ne: 'Completed' }
        });
        
        if (incompleteDeps.length > 0) {
          return res.status(400).json({ 
            error: 'Cannot start task: dependencies not completed' 
          });
        }
      }
    }
    
    // Handle failure and retry logic
    if (status === 'Failed' && task.retryCount < task.maxRetries) {
      task.retryCount += 1;
      task.status = 'Pending';
      await task.save();
      return res.json({ 
        task, 
        message: `Task failed but will retry (${task.retryCount}/${task.maxRetries})` 
      });
    } else if (status === 'Failed') {
      task.status = 'Failed';
      await task.save();
      
      // Block dependent tasks
      await Task.updateMany(
        { dependencies: task._id, status: { $in: ['Pending', 'Running'] } },
        { status: 'Blocked' }
      );
      
      return res.json({ task, message: 'Task failed and dependent tasks blocked' });
    }
    
    task.status = status;
    if (status === 'Completed') {
      task.retryCount = 0;
    }
    
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;