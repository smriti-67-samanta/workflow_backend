const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  priority: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  estimatedHours: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Running', 'Completed', 'Failed', 'Blocked'],
    default: 'Pending'
  },
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  resourceTag: {
    type: String,
    required: true
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  retryCount: {
    type: Number,
    default: 0
  },
  versionNumber: {
    type: Number,
    default: 1
  },
  versionHistory: [{
    version: Number,
    data: Object,
    updatedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

taskSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isModified('description') || 
      this.isModified('priority') || this.isModified('estimatedHours') ||
      this.isModified('dependencies') || this.isModified('resourceTag') ||
      this.isModified('maxRetries')) {
    
    const historyEntry = {
      version: this.versionNumber,
      data: {
        title: this.title,
        description: this.description,
        priority: this.priority,
        estimatedHours: this.estimatedHours,
        dependencies: this.dependencies,
        resourceTag: this.resourceTag,
        maxRetries: this.maxRetries
      }
    };
    this.versionHistory.push(historyEntry);
    this.versionNumber += 1;
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);