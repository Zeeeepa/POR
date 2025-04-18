/**
 * Core module - Unified entry point for the POR application
 * This replaces the redundant adapter files in the root directory
 */

// Import core components
const ConfigManager = require('../framework/ConfigManager');
const ConfigurationSystem = require('../framework/ConfigurationSystem');
const DeplaManager = require('../framework/DeplaManager');
const ProjectManager = require('../framework/ProjectManager');
const GitHubEnhanced = require('../utils/GitHubEnhanced');
const GitHubService = require('../utils/GitHubService');
const MessageQueueManager = require('../models/MessageQueueManager');
const WorkflowManager = require('../models/WorkflowManager');
const MultiProjectManager = require('../models/MultiProjectManager');
const DeplaEnhanced = require('../models/DeplaEnhanced');
const logger = require('../utils/logger');
const templateEngine = require('../utils/templateEngine');
const CursorAutomation = require('../utils/CursorAutomation');
const UnifiedCursorManager = require('../utils/UnifiedCursorManager');
const TemplateManager = require('../models/TemplateManager');
const PhaseConfigManager = require('../models/PhaseConfigManager');

// Create singleton instances
const configManager = new ConfigManager();
const messageQueueManager = new MessageQueueManager();
const workflowManager = new WorkflowManager();
const gitHubEnhanced = new GitHubEnhanced();
const deplaManager = new DeplaManager();
const multiProjectManager = new MultiProjectManager();
const cursorAutomation = new CursorAutomation();
const templateManager = new TemplateManager();
const phaseConfigManager = new PhaseConfigManager();

// Export all components
module.exports = {
  // Classes
  ConfigManager,
  ConfigurationSystem,
  DeplaManager,
  ProjectManager,
  GitHubEnhanced,
  GitHubService,
  MessageQueueManager,
  WorkflowManager,
  MultiProjectManager,
  DeplaEnhanced,
  CursorAutomation,
  UnifiedCursorManager,
  TemplateManager,
  PhaseConfigManager,
  
  // Singleton instances
  configManager,
  messageQueueManager,
  workflowManager,
  gitHubEnhanced,
  deplaManager,
  multiProjectManager,
  cursorAutomation,
  templateManager,
  phaseConfigManager,
  
  // Utilities
  logger,
  templateEngine
};
