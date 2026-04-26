const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage
let users = [];
let projects = [];
let tasks = [];

// ============ AUTH ROUTES ============

// Signup
app.post('/api/auth/signup', async (req, res) => {
  console.log('Signup request received:', req.body);
  
  try {
    const { email, password, name } = req.body;
    
    // Check if user exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = {
      id: Date.now().toString(),
      email,
      name,
      password: hashedPassword
    };
    users.push(user);
    
    // Create token
    const token = jwt.sign({ userId: user.id }, 'secret123', {
      expiresIn: '7d'
    });
    
    console.log('User created successfully:', user.email);
    
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  console.log('Login request received:', req.body.email);
  
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create token
    const token = jwt.sign({ userId: user.id }, 'secret123', {
      expiresIn: '7d'
    });
    
    console.log('User logged in:', user.email);
    
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ============ PROJECT ROUTES ============

// Get all projects
app.get('/api/projects', (req, res) => {
  console.log('Fetching projects');
  const authHeader = req.headers.authorization;
  console.log('Auth header:', authHeader);
  
  // For demo, return all projects
  res.json(projects);
});

// Create project
app.post('/api/projects', (req, res) => {
  console.log('Create project request:', req.body);
  
  const { name, description } = req.body;
  
  const project = {
    _id: Date.now().toString(),
    name,
    description,
    createdAt: new Date().toISOString(),
    ownerId: 'current'
  };
  projects.push(project);
  console.log('Project created:', project.name);
  res.status(201).json(project);
});

// Join project
app.post('/api/projects/join', (req, res) => {
  console.log('Join project request:', req.body);
  
  const project = {
    _id: Date.now().toString(),
    name: 'Joined Project',
    description: 'Project joined via invite',
    createdAt: new Date().toISOString()
  };
  projects.push(project);
  res.json({ project });
});

// Generate invite
app.post('/api/projects/:projectId/invite', (req, res) => {
  console.log('Generate invite for project:', req.params.projectId);
  res.json({ inviteToken: 'invite-token-' + Date.now() });
});

// ============ TASK ROUTES ============

// Get tasks
app.get('/api/tasks/project/:projectId', (req, res) => {
  console.log('Fetching tasks for project:', req.params.projectId);
  const projectTasks = tasks.filter(t => t.projectId === req.params.projectId);
  res.json(projectTasks);
});

// Create task
app.post('/api/tasks', (req, res) => {
  console.log('Create task request:', req.body);
  
  const task = {
    ...req.body,
    _id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    versionNumber: 1,
    retryCount: 0
  };
  tasks.push(task);
  res.status(201).json(task);
});

// Update task
app.put('/api/tasks/:taskId', (req, res) => {
  console.log('Update task:', req.params.taskId);
  
  const index = tasks.findIndex(t => t._id === req.params.taskId);
  if (index !== -1) {
    tasks[index] = {
      ...tasks[index],
      ...req.body,
      versionNumber: tasks[index].versionNumber + 1
    };
    res.json(tasks[index]);
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

// Delete task
app.delete('/api/tasks/:taskId', (req, res) => {
  console.log('Delete task:', req.params.taskId);
  
  const index = tasks.findIndex(t => t._id === req.params.taskId);
  if (index !== -1) {
    tasks.splice(index, 1);
    res.json({ message: 'Task deleted' });
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

// Task history
app.get('/api/tasks/:taskId/history', (req, res) => {
  res.json([]);
});

// ============ EXECUTION ROUTES ============

// Execution plan
app.post('/api/execution/projects/:projectId/compute-execution', (req, res) => {
  console.log('Computing execution plan for project:', req.params.projectId);
  
  const projectTasks = tasks.filter(t => t.projectId === req.params.projectId);
  const pendingTasks = projectTasks.filter(t => t.status === 'Pending');
  const sortedTasks = pendingTasks.sort((a, b) => b.priority - a.priority);
  
  res.json({
    executionOrder: sortedTasks.map(t => t._id),
    selectedTasks: sortedTasks.map(t => t._id),
    blockedTasks: projectTasks.filter(t => t.status === 'Blocked').map(t => t._id),
    skippedTasks: projectTasks.filter(t => t.status === 'Completed').map(t => t._id)
  });
});

// Update status
app.put('/api/execution/tasks/:taskId/status', (req, res) => {
  console.log('Update task status:', req.params.taskId, req.body.status);
  
  const { status } = req.body;
  const index = tasks.findIndex(t => t._id === req.params.taskId);
  
  if (index !== -1) {
    tasks[index].status = status;
    tasks[index].versionNumber += 1;
    res.json({ task: tasks[index] });
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

// ============ TEST ROUTE ============
app.get('/', (req, res) => {
  res.json({ 
    message: 'Workflow API is running!',
    status: 'OK',
    endpoints: {
      signup: 'POST /api/auth/signup',
      login: 'POST /api/auth/login'
    }
  });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`\n=================================`);
  console.log(`✅ Server is running!`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`📝 Test signup: POST http://localhost:${PORT}/api/auth/signup`);
  console.log(`=================================\n`);
});