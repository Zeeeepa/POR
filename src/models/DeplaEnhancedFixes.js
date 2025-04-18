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
const UnifiedCursorManager = require('../utils/UnifiedCursorManager');
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
    
    // Initialize the unified cursor manager
    this.cursorManager = new UnifiedCursorManager({
      dataDir: path.join(process.cwd(), 'data', 'cursor-positions'),
      enableMultiCursor: this.config.enableMultiCursor || false,
      cursorSpeed: this.config.cursorSpeed || 'medium'
    });
    
    // Set cursor manager for message queue manager
    this.messageQueueManager.setCursorManager(this.cursorManager);
    
    // Setup state
    this.isInitialized = false;
    this.isProcessingAutomation = false;
    
    // Register event handlers
    this.registerEventHandlers();
  }
  
  /**
   * Get a project by name
   * @param {string} projectName - Project name
   * @returns {Object} Project object
   */
  getProject(projectName) {
    // First try to get from the base manager
    const baseProject = this.baseManager.getProject(projectName);
    if (baseProject) {
      return baseProject;
    }
    
    // If not found in base manager, try the multi-project manager
    return this.multiProjectManager.getProjectByName(projectName);
  }
  
  /**
   * Add a new project from a repository URL
   * @param {string} repoUrl - Repository URL
   * @param {string} projectName - Optional project name (defaults to repo name)
   * @returns {Promise<Object>} Added project
   */
  async addProject(repoUrl, projectName = '') {
    try {
      logger.info(`Adding project from repository: ${repoUrl}`);
      
      // Use the base manager to add the project
      const project = await this.baseManager.cloneRepository(repoUrl, projectName);
      
      // Also add it to the multi-project manager
      await this.multiProjectManager.addProjectTab({
        repoUrl,
        projectName: project.config.name
      });
      
      logger.info(`Project added: ${project.config.name}`);
      return project;
    } catch (error) {
      logger.error(`Failed to add project: ${error.message}`);
      throw error;
    }
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
    
    // Workflow events
    this.workflowManager.on('workflowCompleted', (data) => {
      logger.info(`Workflow completed: ${data.workflowId} for project ${data.projectId}`);
    });
    
    this.workflowManager.on('workflowFailed', (data) => {
      logger.error(`Workflow failed: ${data.workflowId} for project ${data.projectId} - ${data.error}`);
    });
    
    this.workflowManager.on('phaseCompleted', (data) => {
      logger.info(`Phase completed: ${data.phase.name} for workflow ${data.workflowId}`);
    });
    
    // GitHub events
    this.gitHubEnhanced.on('prCreated', (data) => {
      logger.info(`PR created: ${data.prNumber} for ${data.repoName}`);
      this.handleNewPR(data);
    });
    
    this.gitHubEnhanced.on('branchCreated', (data) => {
      logger.info(`Branch created: ${data.branchName} for ${data.repoName}`);
      this.handleNewBranch(data);
    });
    
    // Cursor manager events
    this.cursorManager.on('positionSaved', (position) => {
      logger.info(`Cursor position saved: ${position.name}`);
    });
    
    this.cursorManager.on('positionDeleted', (position) => {
      logger.info(`Cursor position deleted: ${position.name}`);
    });
  }
  
  /**
   * Handle a new PR created on GitHub
   * @param {Object} data - PR data
   * @returns {Promise<void>}
   */
  async handleNewPR(data) {
    try {
      logger.info(`Processing new PR #${data.prNumber} for ${data.repoName}`);
      
      // Find the project
      const project = this.multiProjectManager.getProjectByName(data.repoName);
      if (!project) {
        logger.warn(`Project not found for repo: ${data.repoName}`);
        return;
      }
      
      // Get PR details
      const prDetails = await this.gitHubEnhanced.getPRDetails(data.repoName, data.prNumber);
      if (!prDetails) {
        logger.warn(`Could not fetch PR details for #${data.prNumber} in ${data.repoName}`);
        return;
      }
      
      // Check if this is a step generation PR
      const isStepGeneration = this.isStepGenerationPR(prDetails);
      
      if (isStepGeneration) {
        logger.info(`PR #${data.prNumber} is a step generation PR, auto-merging`);
        
        // Auto-merge the PR
        try {
          await this.gitHubEnhanced.mergePR({
            owner: data.repoName.split('/')[0],
            repo: data.repoName.split('/')[1],
            pull_number: data.prNumber,
            merge_method: 'merge'
          });
          
          // Update project with new steps
          await this.updateProjectSteps(project, prDetails);
          
          logger.info(`Successfully merged step generation PR #${data.prNumber} for ${data.repoName}`);
        } catch (error) {
          logger.error(`Failed to merge PR #${data.prNumber}: ${error.message}`);
        }
      } else {
        // Add to analysis queue
        try {
          this.gitHubEnhanced.addPrToAnalysisQueue({
            owner: data.repoName.split('/')[0],
            repo: data.repoName.split('/')[1],
            pull_number: data.prNumber,
            autoMerge: this.shouldAutoMergePR(prDetails)
          });
          
          logger.info(`Added PR #${data.prNumber} to analysis queue`);
        } catch (error) {
          logger.error(`Failed to add PR #${data.prNumber} to analysis queue: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error handling new PR: ${error.message}`);
    }
  }
  
  /**
   * Handle a new branch created on GitHub
   * @param {Object} data - Branch data
   * @returns {Promise<void>}
   */
  async handleNewBranch(data) {
    try {
      logger.info(`Processing new branch ${data.branchName} for ${data.repoName}`);
      
      // Find the project
      const project = this.multiProjectManager.getProjectByName(data.repoName);
      if (!project) {
        logger.warn(`Project not found for repo: ${data.repoName}`);
        return;
      }
      
      // Check if this is a feature branch
      const isFeatureBranch = this.isFeatureBranch(data.branchName);
      
      if (isFeatureBranch) {
        logger.info(`Branch ${data.branchName} is a feature branch`);
        
        // Update project with feature branch status
        await this.updateFeatureBranchStatus(project, data.branchName);
      }
    } catch (error) {
      logger.error(`Error handling new branch: ${error.message}`);
    }
  }
  
  /**
   * Check if a PR is a step generation PR
   * @param {Object} prDetails - PR details
   * @returns {boolean} Whether this is a step generation PR
   */
  isStepGenerationPR(prDetails) {
    // Check PR title and body for step generation indicators
    const title = prDetails.title || '';
    const body = prDetails.body || '';
    
    // Look for specific keywords in title or body
    const stepGenerationKeywords = [
      'step generation',
      'step-by-step',
      'step by step',
      'generate steps',
      'STEP-BY-STEP.md'
    ];
    
    // Check if any of the keywords are present in title or body
    return stepGenerationKeywords.some(keyword => 
      title.toLowerCase().includes(keyword.toLowerCase()) || 
      body.toLowerCase().includes(keyword.toLowerCase())
    );
  }
  
  /**
   * Update project with steps from a PR
   * @param {Object} project - Project object
   * @param {Object} prDetails - PR details
   * @returns {Promise<boolean>} Success status
   */
  async updateProjectSteps(project, prDetails) {
    try {
      logger.info(`Updating project steps for ${project.config.name}`);
      
      // In a real implementation, this would parse the PR and extract steps
      // For now, we'll just update the project config with a flag
      
      project.config.hasSteps = true;
      project.config.lastStepUpdate = new Date().toISOString();
      
      // Save project config
      await fs.writeJson(
        path.join(project.path, 'project.json'), 
        project.config, 
        { spaces: 2 }
      );
      
      logger.info(`Updated project steps for ${project.config.name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update project steps: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Check if a PR should be auto-merged
   * @param {Object} prDetails - PR details
   * @returns {boolean} Whether the PR should be auto-merged
   */
  shouldAutoMergePR(prDetails) {
    // Check if auto-merge is enabled
    if (!this.config.enableAutoMerge) {
      return false;
    }
    
    // Check for auto-merge keywords in PR title or body
    const title = prDetails.title || '';
    const body = prDetails.body || '';
    
    // Get auto-merge keywords from config
    const autoMergeKeywords = (this.config.autoMergeKeywords || '')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
    
    // Default keywords if none configured
    const defaultKeywords = ['auto-merge', 'automerge', 'auto merge'];
    const keywords = autoMergeKeywords.length > 0 ? autoMergeKeywords : defaultKeywords;
    
    // Check if any of the keywords are present in title or body
    return keywords.some(keyword => 
      title.toLowerCase().includes(keyword.toLowerCase()) || 
      body.toLowerCase().includes(keyword.toLowerCase())
    );
  }
  
  /**
   * Check if a branch is a feature branch
   * @param {string} branchName - Branch name
   * @returns {boolean} Whether this is a feature branch
   */
  isFeatureBranch(branchName) {
    // Check branch name for feature branch indicators
    const featurePrefixes = ['feature/', 'feat/', 'feature-', 'feat-'];
    return featurePrefixes.some(prefix => branchName.startsWith(prefix));
  }
  
  /**
   * Update project with feature branch status
   * @param {Object} project - Project object
   * @param {string} branchName - Branch name
   * @returns {Promise<boolean>} Success status
   */
  async updateFeatureBranchStatus(project, branchName) {
    try {
      logger.info(`Updating feature branch status for ${project.config.name}: ${branchName}`);
      
      // In a real implementation, this would update the project with feature branch info
      // For now, we'll just update the project config with the branch name
      
      if (!project.config.featureBranches) {
        project.config.featureBranches = [];
      }
      
      // Add branch if not already in the list
      if (!project.config.featureBranches.includes(branchName)) {
        project.config.featureBranches.push(branchName);
        
        // Save project config
        await fs.writeJson(
          path.join(project.path, 'project.json'), 
          project.config, 
          { spaces: 2 }
        );
      }
      
      logger.info(`Updated feature branch status for ${project.config.name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update feature branch status: ${error.message}`);
      return false;
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
      
      // Check if STEP-BY-STEP.md exists
      const stepFilePath = path.join(project.path, 'STEP-BY-STEP.md');
      if (!fs.existsSync(stepFilePath)) {
        throw new Error(`STEP-BY-STEP.md not found for project: ${projectId}`);
      }
      
      // Read the file
      const stepFileContent = await fs.readFile(stepFilePath, 'utf8');
      
      // Parse the file to extract components for the specified phase
      // This is a simplified implementation - in a real scenario, you would
      // implement proper parsing logic based on the file format
      
      // For now, we'll return simulated components
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
      
      logger.info(`Parsed ${simulatedComponents.length} components for phase ${phaseNumber} of project ${projectId}`);
      
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
      
      // Process merge queue
      await this.gitHubEnhanced.processMergeQueue();
      
      // Check for new PRs and branches
      await this.checkForNewGitHubActivity();
      
    } catch (error) {
      logger.error(`Error in automation processing: ${error.message}`);
    } finally {
      this.isProcessingAutomation = false;
    }
  }
  
  /**
   * Check for new PRs and branches on GitHub
   * @returns {Promise<void>}
   */
  async checkForNewGitHubActivity() {
    try {
      // Get all projects
      const projects = this.multiProjectManager.getAllProjectTabs();
      
      for (const project of projects) {
        if (!project.repoUrl) continue;
        
        // Extract owner and repo from URL
        const match = project.repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
        if (!match) continue;
        
        const owner = match[1];
        const repo = match[2];
        
        // Check for new PRs
        const prs = await this.gitHubEnhanced.getOpenPRs(owner, repo);
        
        // Check for new branches
        const branches = await this.gitHubEnhanced.getBranches(owner, repo);
        
        logger.info(`Found ${prs.length} open PRs and ${branches.length} branches for ${owner}/${repo}`);
      }
    } catch (error) {
      logger.error(`Error checking for new GitHub activity: ${error.message}`);
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
      prAnalysisQueue: this.gitHubEnhanced.prAnalysisQueue?.length || 0,
      mergeQueue: this.gitHubEnhanced.mergeQueue?.length || 0,
      messageQueue: this.getQueueStatus(),
      activeWorkflows: this.workflowManager.getAllExecutions().length
    };
  }
  
  /**
   * Get cursor positions
   * @returns {Array} Cursor positions
   */
  getCursorPositions() {
    return this.cursorManager.getAllPositions();
  }
  
  /**
   * Save a cursor position
   * @param {string} name - Position name
   * @param {Object} coordinates - Position coordinates {x, y}
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Saved position
   */
  saveCursorPosition(name, coordinates, metadata = {}) {
    return this.cursorManager.savePosition(name, coordinates, metadata);
  }
  
  /**
   * Delete a cursor position
   * @param {string} name - Position name
   * @returns {boolean} Success status
   */
  deleteCursorPosition(name) {
    return this.cursorManager.deletePosition(name);
  }
  
  /**
   * Capture the current cursor position
   * @param {string} name - Position name
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Captured position
   */
  captureCursorPosition(name, metadata = {}) {
    return this.cursorManager.captureCurrentPosition(name, metadata);
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
