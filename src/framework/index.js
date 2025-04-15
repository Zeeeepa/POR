/**
 * Unified framework module
 * This exports all framework components from a single entry point
 */

const ConfigManager = require('./ConfigManager');
const ConfigurationSystem = require('./ConfigurationSystem');
const DeplaManager = require('./DeplaManager');
const ProjectManager = require('./ProjectManager');
const GitHubEnhanced = require('../utils/GitHubEnhanced');
const GitHubService = require('../utils/GitHubService');
const MessageQueueManager = require('../models/MessageQueueManager');
const WorkflowManager = require('../models/WorkflowManager');
const MultiProjectManager = require('../models/MultiProjectManager');

// Export all framework components
module.exports = {
  ConfigManager,
  ConfigurationSystem,
  DeplaManager,
  ProjectManager,
  GitHubEnhanced,
  GitHubService,
  MessageQueueManager,
  WorkflowManager,
  MultiProjectManager
  // Remove DeplaEnhanced from here to break circular dependency
};
