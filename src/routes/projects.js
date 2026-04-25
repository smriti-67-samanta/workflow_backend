const express = require('express');
const Project = require('../models/Project');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Generate invite token
const generateInviteToken = (projectId) => {
  return jwt.sign({ projectId, type: 'invite' }, process.env.INVITE_TOKEN_SECRET, {
    expiresIn: '30m'
  });
};

// Get all projects for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('projects.projectId');
    const projects = user.projects.map(p => p.projectId);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const project = new Project({
      name,
      description,
      ownerId: req.userId
    });
    
    await project.save();
    
    await User.findByIdAndUpdate(req.userId, {
      $push: { projects: { projectId: project._id, role: 'owner' } }
    });
    
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate invite token
router.post('/:projectId/invite', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (project.ownerId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only project owner can generate invites' });
    }
    
    const token = generateInviteToken(project._id);
    res.json({ inviteToken: token, expiresIn: '30 minutes' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join project with invite token
router.post('/join', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    const decoded = jwt.verify(token, process.env.INVITE_TOKEN_SECRET);
    
    const project = await Project.findById(decoded.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const user = await User.findById(req.userId);
    const alreadyJoined = user.projects.some(p => p.projectId.toString() === project._id.toString());
    
    if (alreadyJoined) {
      return res.status(400).json({ error: 'Already a member of this project' });
    }
    
    await User.findByIdAndUpdate(req.userId, {
      $push: { projects: { projectId: project._id, role: 'collaborator' } }
    });
    
    res.json({ project, message: 'Successfully joined project' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid or expired invite token' });
  }
});

// Get single project
router.get('/:projectId', authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;