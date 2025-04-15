/**
 * DeplaEnhanced.js
 * Enhanced version of DeplaManager with multi-project support, workflow management,
 * and improved message handling for concurrent development
 */

// Import DeplaManager directly from its file, not from framework
const DeplaManager = require('../framework/DeplaManager');
const WorkflowManager = require('./WorkflowManager');
const MultiProjectManager = require('./MultiProjectManager');
const MessageQueueManager = require('./MessageQueueManager');
const GitHubEnhanced = require('../utils/GitHubEnhanced');
const CursorAutomation = require('../utils/CursorAutomation');
const ConfigManager = require('../framework/ConfigManager');
const logger = require('../utils/logger');
const fs = require('fs-extra');
const path = require('path');

class DeplaEnhanced {
  constructor() {
    // Load configuration
    this.configManager = new ConfigManager();
    this.config = this.configManager.getConfig();
    
    // Initialize base manager
    this.baseManager = new DeplaManager();
    
    // Initialize enhanced components
    this.workflowManager = new WorkflowManager(this.config);
    this.multiProjectManager = new MultiProjectManager(this.config);
    this.messageQueueManager = new MessageQueueManager(this.config);
    this.gitHubEnhanced = new GitHubEnhanced(this.config);
    
    // Set cursor automation for message queue manager
    this.messageQueueManager.setCursorAutomation(CursorAutomation);
    
    // Setup state
    this.isInitialized = false;
    this.isProcessingAutomation = false;
    
    // Register event handlers
    this.registerEventHandlers();
  }
  
  /**
   * Initialize the enhanced manager
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        return { success: true, message: 'Already initialized' };
      }
      
      logger.info('Initializing DeplaEnhanced');
      
      // Initialize base manager
      await this.baseManager.initialize();
      
      // Initialize GitHub integration
      if (this.config.github && this.config.github.token) {
        try {
          await this.gitHubEnhanced.authenticate();
          logger.info('GitHub integration authenticated');
        } catch (error) {
          logger.warn(`GitHub authentication failed: ${error.message}. Continuing with limited functionality.`);
          // Don't throw error, continue with limited functionality
        }
      } else {
        logger.info('GitHub token not configured. GitHub integration will be limited.');
        // Try to authenticate with user prompt
        try {
          const success = await this.gitHubEnhanced.authenticate();
          if (success) {
            // Save the token to the config
            this.updateConfig({
              ...this.config,
              github: {
                ...this.config.github,
                token: process.env.GITHUB_TOKEN
              }
            });
            logger.info('GitHub integration authenticated via user prompt');
          }
        } catch (error) {
          logger.warn('GitHub authentication failed after prompt. Continuing with limited functionality.');
        }
      }
      
      // If workflow templates don't exist, create defaults
      if (Object.keys(this.workflowManager.getAllTemplates()).length === 0) {
        this.workflowManager.createDefaultTemplates();
      }
      
      // Set initialization flag
      this.isInitialized = true;
      
      // If automation is enabled, start it
      if (this.config.automation && this.config.automation.enabled) {
        this.setupAutomation();
      }
      
      logger.info('DeplaEnhanced initialized successfully');
      
      return {
        success: true,
        projects: await this.multiProjectManager.getProjectsStatus(),
        workflows: this.workflowManager.getAllWorkflows(),
        templates: this.workflowManager.getAllTemplates(),
        automationStatus: this.getAutomationStatus()
      };
    } catch (error) {
      logger.error(`Initialization failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  // Rest of the methods remain the same...
}
