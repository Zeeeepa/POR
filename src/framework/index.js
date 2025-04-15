/**
 * Unified framework module
 * This exports all framework components from a single entry point
 */

const ConfigManager = require('./ConfigManager');
const DeplaManager = require('./DeplaManager');
const ProjectManager = require('./ProjectManager');
const GitHubEnhanced = require('../utils/GitHubEnhanced');
const MessageQueueManager = require('../models/MessageQueueManager');
const WorkflowManager = require('../models/WorkflowManager');
const MultiProjectManager = require('../models/MultiProjectManager');

// Export all framework components
module.exports = {
  ConfigManager,
  DeplaManager,
  ProjectManager,
  GitHubEnhanced,
  MessageQueueManager,
  WorkflowManager,
  MultiProjectManager
  // Remove DeplaEnhanced from here to break circular dependency
};
