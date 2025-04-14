/**
 * DeplaEnhanced.js
 * Enhanced version of DeplaManager with multi-project support, workflow management,
 * and improved message handling for concurrent development
 */

const { DeplaManager } = require('../framework');
const WorkflowManager = require('./WorkflowManager');
const MultiProjectManager = require('./MultiProjectManager');
const MessageQueueManager = require('./MessageQueueManager');
const GitHubEnhanced = require('../utils/GitHubEnhanced');
const ConfigManager = require('../framework').ConfigManager;
const logger = require('../utils/logger');

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
          logger.error(`GitHub authentication failed: ${error.message}`);
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
  
  /**
   * Register event handlers for components
   */
  registerEventHandlers() {
    // Message queue events
    this.messageQueueManager.on('messageProcessed', (message) => {
      logger.info(`Message processed: ${message.id}`);
    });
    
    this.messageQueueManager.on('messageFailed', (message) => {
      logger.error(`Message failed: ${message.id}`);
    });
    
    // GitHub events (would typically be handled by webhook server)
    // Just placeholders for demonstration
  }
  
  /**
   * Add a new project
   * @param {Object} projectData - Project data including repo URL
   * @returns {Promise<Object>} Added project
   */
  async addProject(projectData) {
    try {
      // Add project using the multi-project manager
      const tab = await this.multiProjectManager.addProjectTab(projectData);
      logger.info(`Added project: ${tab.projectName}`);
      return { success: true, tab };
    } catch (error) {
      logger.error(`Failed to add project: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Add multiple projects in batch
   * @param {Array<Object>} projectsData - Array of project data objects
   * @returns {Promise<Object>} Added projects result
   */
  async addMultipleProjects(projectsData) {
    try {
      // Add projects using the multi-project manager
      const tabs = await this.multiProjectManager.addMultipleProjectTabs(projectsData);
      logger.info(`Added ${tabs.length} projects`);
      return { success: true, tabs };
    } catch (error) {
      logger.error(`Failed to add multiple projects: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Initialize a project with template files
   * @param {string} tabId - ID of the project tab
   * @returns {Promise<Object>} Initialization result
   */
  async initializeProject(tabId) {
    try {
      const success = await this.multiProjectManager.initializeProject(tabId);
      return { success };
    } catch (error) {
      logger.error(`Failed to initialize project: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Apply a workflow to a project
   * @param {string} tabId - ID of the project tab
   * @param {string} workflowId - ID of the workflow to apply
   * @returns {Promise<Object>} Result of applying workflow
   */
  async applyWorkflowToProject(tabId, workflowId) {
    try {
      // Apply workflow using multi-project manager
      const success = await this.multiProjectManager.applyWorkflowToProject(tabId, workflowId);
      
      if (success) {
        // Get tab and start workflow execution
        const tab = this.multiProjectManager.getAllProjectTabs().find(t => t.id === tabId);
        
        if (tab) {
          // Start workflow execution
          const executionId = this.workflowManager.startWorkflowExecution(
            workflowId,
            tab.projectId,
            {
              projectName: tab.projectName,
              repoUrl: tab.repoUrl
            }
          );
          
          logger.info(`Started workflow execution: ${executionId} for project ${tab.projectName}`);
          
          return { 
            success: true, 
            executionId, 
            message: `Workflow ${workflowId} applied to project ${tab.projectName}` 
          };
        }
      }
      
      return { success };
    } catch (error) {
      logger.error(`Failed to apply workflow: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a new workflow
   * @param {string} name - Workflow name
   * @param {Object} data - Initial workflow data
   * @returns {Promise<Object>} Created workflow
   */
  async createWorkflow(name, data = {}) {
    try {
      const workflowId = this.workflowManager.createWorkflow(name, data);
      return { 
        success: true, 
        workflowId, 
        workflow: this.workflowManager.getWorkflow(workflowId) 
      };
    } catch (error) {
      logger.error(`Failed to create workflow: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Add a phase to a workflow
   * @param {string} workflowId - Workflow ID
   * @param {Object} phaseData - Phase configuration
   * @returns {Promise<Object>} Added phase result
   */
  async addPhaseToWorkflow(workflowId, phaseData) {
    try {
      const phaseIndex = this.workflowManager.addPhaseToWorkflow(workflowId, phaseData);
      return { 
        success: true, 
        phaseIndex,
        workflow: this.workflowManager.getWorkflow(workflowId)
      };
    } catch (error) {
      logger.error(`Failed to add phase: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a new template
   * @param {string} templateName - Template name
   * @param {Object} templateData - Template configuration
   * @returns {Promise<Object>} Template creation result
   */
  async createTemplate(templateName, templateData) {
    try {
      const success = this.workflowManager.saveTemplate(templateName, templateData);
      return { 
        success, 
        template: this.workflowManager.getTemplate(templateName)
      };
    } catch (error) {
      logger.error(`Failed to create template: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Capture a cursor position for input
   * @param {string} name - Name for this position
   * @returns {Promise<Object>} Captured position
   */
  async captureCursorPosition(name) {
    try {
      const position = this.messageQueueManager.cursorAutomation.captureCurrentPosition(name);
      return { success: true, position };
    } catch (error) {
      logger.error(`Failed to capture cursor position: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send a message to the specified cursor position
   * @param {Object} message - Message to send
   * @param {string} priority - Message priority
   * @returns {Promise<Object>} Message enqueue result
   */
  async sendMessage(message, priority = 'normal') {
    try {
      const messageId = this.messageQueueManager.enqueueMessage(message, priority);
      return { success: true, messageId };
    } catch (error) {
      logger.error(`Failed to send message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send a batch of messages
   * @param {Array<Object>} messages - Messages to send
   * @param {string} priority - Message priority
   * @returns {Promise<Object>} Batch send result
   */
  async sendMessageBatch(messages, priority = 'normal') {
    try {
      const messageIds = this.messageQueueManager.enqueueMessages(messages, priority);
      return { success: true, messageIds };
    } catch (error) {
      logger.error(`Failed to send message batch: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get the status of the message queue
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    return this.messageQueueManager.getQueueStats();
  }
  
  /**
   * Pause message processing
   * @returns {Object} Result
   */
  pauseMessageProcessing() {
    try {
      this.messageQueueManager.pauseProcessing();
      return { success: true, message: 'Message processing paused' };
    } catch (error) {
      logger.error(`Failed to pause message processing: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Resume message processing
   * @returns {Object} Result
   */
  resumeMessageProcessing() {
    try {
      this.messageQueueManager.resumeProcessing();
      return { success: true, message: 'Message processing resumed' };
    } catch (error) {
      logger.error(`Failed to resume message processing: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Parse a STEP-BY-STEP.md file to extract components for concurrent development
   * @param {string} projectId - Project ID
   * @param {string} phaseNumber - Phase number to parse
   * @returns {Promise<Object>} Parsed components
   */
  async parseStepByStepComponents(projectId, phaseNumber) {
    try {
      const project = this.baseManager.getProject(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      
      // In a real implementation, this would parse the file and extract components
      // For now, we'll just return a simulated result
      
      const simulatedComponents = [
        {
          name: 'Authentication Module',
          description: 'Handles user authentication and authorization',
          dependencies: [],
          path: 'src/auth',
          template: 'feature-implementation'
        },
        {
          name: 'User Dashboard UI',
          description: 'User dashboard interface components',
          dependencies: ['Authentication Module'],
          path: 'src/components/dashboard',
          template: 'feature-implementation'
        },
        {
          name: 'API Integration Layer',
          description: 'Handles API communication',
          dependencies: [],
          path: 'src/api',
          template: 'feature-implementation'
        }
      ];
      
      return { 
        success: true, 
        phase: phaseNumber,
        components: simulatedComponents,
        totalComponents: simulatedComponents.length
      };
    } catch (error) {
      logger.error(`Failed to parse step by step components: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create messages for components from a phase
   * @param {string} projectId - Project ID
   * @param {string} phaseNumber - Phase number
   * @param {string} inputPosition - Name of input position for messages
   * @returns {Promise<Object>} Created messages result
   */
  async createComponentMessages(projectId, phaseNumber, inputPosition) {
    try {
      // First parse the components
      const parseResult = await this.parseStepByStepComponents(projectId, phaseNumber);
      
      if (!parseResult.success) {
        throw new Error(`Failed to parse components: ${parseResult.error}`);
      }
      
      // Get the project info
      const project = this.baseManager.getProject(projectId);
      const projectInfo = {
        name: project.config.name,
        path: project.path,
        url: project.config.repository || ''
      };
      
      // Create messages for each component
      const messages = parseResult.components.map(component => ({
        content: `In accordance to best developmental methods and considering all correspondent code context -> Implement ${component.name}\n\n${component.description}\n\nhave in mind that there are other concurrently developed correspondent features therefore you should carefully align with requirements of the feature`,
        inputPosition: inputPosition,
        metadata: {
          projectId,
          phase: phaseNumber,
          component: component.name,
          path: component.path
        }
      }));
      
      // Enqueue messages
      const messageIds = await this.sendMessageBatch(messages, 'normal');
      
      return {
        success: true,
        messageIds,
        phaseNumber,
        componentCount: messages.length,
        queueStatus: this.getQueueStatus()
      };
    } catch (error) {
      logger.error(`Failed to create component messages: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Setup automation for processing PRs and messages
   */
  setupAutomation() {
    if (this.automationInterval) {
      clearInterval(this.automationInterval);
    }
    
    // Set up interval for processing automation tasks
    this.automationInterval = setInterval(() => {
      this.processAutomationQueue();
    }, this.config.automation?.interval || 60000); // Default to 1 minute
    
    logger.info('Automation setup completed');
  }
  
  /**
   * Stop automation
   */
  stopAutomation() {
    if (this.automationInterval) {
      clearInterval(this.automationInterval);
      this.automationInterval = null;
    }
    
    logger.info('Automation stopped');
  }
  
  /**
   * Process automation queue (PR analysis, etc.)
   */
  async processAutomationQueue() {
    // Avoid concurrent processing
    if (this.isProcessingAutomation) {
      return;
    }
    
    this.isProcessingAutomation = true;
    
    try {
      // Process PR analysis queue
      await this.gitHubEnhanced.processAnalysisQueue();
      
      // In a real implementation, we might do other automated tasks here
      
    } catch (error) {
      logger.error(`Error in automation processing: ${error.message}`);
    } finally {
      this.isProcessingAutomation = false;
    }
  }
  
  /**
   * Get the current automation status
   * @returns {Object} Automation status
   */
  getAutomationStatus() {
    return {
      enabled: !!this.automationInterval,
      isProcessing: this.isProcessingAutomation,
      prAnalysisQueue: this.gitHubEnhanced.prAnalysisQueue.length,
      mergeQueue: this.gitHubEnhanced.mergeQueue.length,
      messageQueue: this.getQueueStatus()
    };
  }
  
  /**
   * Update system configuration
   * @param {Object} newConfig - New configuration
   * @returns {Object} Update result
   */
  updateConfig(newConfig) {
    try {
      this.configManager.updateConfig(newConfig);
      this.config = this.configManager.getConfig();
      
      // Update components with new config
      // In a real implementation, we'd need to update all components
      
      // Handle automation settings change
      if (newConfig.automation && newConfig.automation.enabled !== this.config.automation?.enabled) {
        if (newConfig.automation.enabled) {
          this.setupAutomation();
        } else {
          this.stopAutomation();
        }
      }
      
      logger.info('Configuration updated');
      return { success: true, config: this.config };
    } catch (error) {
      logger.error(`Failed to update configuration: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = DeplaEnhanced; 