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
    // Check PR title and files
    const title = prDetails.title.toLowerCase();
    const body = prDetails.body.toLowerCase();
    
    // Check for step generation indicators
    const stepKeywords = [
      'generate steps', 
      'step generation', 
      'implementation plan',
      'steps.md',
      'step-by-step'
    ];
    
    // Check title and body for keywords
    for (const keyword of stepKeywords) {
      if (title.includes(keyword) || body.includes(keyword)) {
        return true;
      }
    }
    
    // Check if PR modifies STEPS.md
    if (prDetails.files && prDetails.files.some(file => 
      file.filename.toLowerCase() === 'steps.md' || 
      file.filename.toLowerCase().endsWith('/steps.md'))) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if a PR should be auto-merged
   * @param {Object} prDetails - PR details
   * @returns {boolean} Whether this PR should be auto-merged
   */
  shouldAutoMergePR(prDetails) {
    // Auto-merge logic based on PR content and project configuration
    // This is a simplified implementation
    
    // Don't auto-merge if PR has conflicts
    if (prDetails.mergeable === false) {
      return false;
    }
    
    // Check for auto-merge indicators in title or body
    const title = prDetails.title.toLowerCase();
    const body = prDetails.body.toLowerCase();
    
    const autoMergeKeywords = [
      'auto-merge',
      'automerge',
      'auto merge',
      'automated pr'
    ];
    
    // Check title and body for keywords
    for (const keyword of autoMergeKeywords) {
      if (title.includes(keyword) || body.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if a branch is a feature branch
   * @param {string} branchName - Branch name
   * @returns {boolean} Whether this is a feature branch
   */
  isFeatureBranch(branchName) {
    // Feature branch detection logic
    // This is a simplified implementation
    
    const featurePrefixes = [
      'feature/',
      'feat/',
      'component/',
      'implement/'
    ];
    
    for (const prefix of featurePrefixes) {
      if (branchName.startsWith(prefix)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Update project with new steps from a PR
   * @param {Object} project - Project object
   * @param {Object} prDetails - PR details
   * @returns {Promise<boolean>} Success status
   */
  async updateProjectSteps(project, prDetails) {
    try {
      logger.info(`Updating project steps for ${project.config.name}`);
      
      // Find STEPS.md file in PR
      const stepsFile = prDetails.files.find(file => 
        file.filename.toLowerCase() === 'steps.md' || 
        file.filename.toLowerCase().endsWith('/steps.md')
      );
      
      if (!stepsFile) {
        logger.warn('No STEPS.md file found in PR');
        return false;
      }
      
      // Get file content
      const [owner, repo] = prDetails.base.repo.full_name.split('/');
      const stepsContent = await this.gitHubEnhanced.getFileContent(
        owner,
        repo,
        stepsFile.filename,
        prDetails.head.sha
      );
      
      if (!stepsContent) {
        logger.warn('Could not fetch STEPS.md content');
        return false;
      }
      
      // Update project steps
      const stepsPath = path.join(project.path, 'STEPS.md');
      fs.writeFileSync(stepsPath, stepsContent, 'utf8');
      
      // Reload steps in project
      project.loadSteps();
      
      logger.info(`Updated steps for project ${project.config.name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update project steps: ${error.message}`);
      return false;
    }
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
      
      // Extract feature name from branch
      const featureName = this.extractFeatureNameFromBranch(branchName);
      
      // Update project config with feature branch
      if (!project.config.featureBranches) {
        project.config.featureBranches = [];
      }
      
      // Check if branch already exists
      const existingIndex = project.config.featureBranches.findIndex(
        branch => branch.name === branchName
      );
      
      if (existingIndex !== -1) {
        // Update existing branch
        project.config.featureBranches[existingIndex].updatedAt = new Date().toISOString();
      } else {
        // Add new branch
        project.config.featureBranches.push({
          name: branchName,
          feature: featureName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active'
        });
      }
      
      // Save project config
      project.saveConfig();
      
      logger.info(`Updated feature branch status for ${project.config.name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to update feature branch status: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Extract feature name from branch name
   * @param {string} branchName - Branch name
   * @returns {string} Feature name
   */
  extractFeatureNameFromBranch(branchName) {
    // Remove prefix
    let featureName = branchName;
    
    const prefixes = ['feature/', 'feat/', 'component/', 'implement/'];
    for (const prefix of prefixes) {
      if (branchName.startsWith(prefix)) {
        featureName = branchName.substring(prefix.length);
        break;
      }
    }
    
    // Convert kebab-case to title case
    return featureName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  /**
   * Create a new project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Creation result
   */
  async createProject(projectData) {
    try {
      logger.info(`Creating new project: ${projectData.name}`);
      
      const result = await this.multiProjectManager.createProject(projectData);
      
      if (result.success) {
        logger.info(`Project created: ${projectData.name}`);
      } else {
        logger.error(`Failed to create project: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Failed to create project: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Generate steps for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Generation result
   */
  async generateSteps(projectId) {
    try {
      logger.info(`Generating steps for project: ${projectId}`);
      
      const project = this.multiProjectManager.getProject(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      
      // Get requirements and prompt content
      const requirementsPath = project.getRequirementsPath();
      const promptPath = path.join(project.path, project.templateFiles.stepByStep);
      
      if (!fs.existsSync(requirementsPath)) {
        throw new Error(`Requirements file not found: ${requirementsPath}`);
      }
      
      if (!fs.existsSync(promptPath)) {
        throw new Error(`Prompt file not found: ${promptPath}`);
      }
      
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf8');
      const promptContent = fs.readFileSync(promptPath, 'utf8');
      
      // Send message to generate steps
      const result = await this.sendMessage({
        type: 'generate-steps',
        projectName: project.config.name,
        requirementsContent,
        promptContent,
        repository: project.config.repository
      }, 'high');
      
      logger.info(`Steps generation initiated for project: ${projectId}`);
      
      return {
        success: true,
        message: `Implementation Plan for ${project.config.name}\n\nGenerating... Please wait for completion.\n`,
        messageId: result.messageId
      };
    } catch (error) {
      logger.error(`Failed to generate steps: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Capture cursor position for automation
   * @param {string} name - Position name
   * @returns {Promise<Object>} Captured position
   */
  async captureCursorPosition(name) {
    try {
      const position = CursorAutomation.captureCurrentPosition(name);
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
      prAnalysisQueue: this.gitHubEnhanced.prAnalysisQueue.length,
      mergeQueue: this.gitHubEnhanced.mergeQueue.length,
      messageQueue: this.getQueueStatus(),
      activeWorkflows: this.workflowManager.getAllExecutions().length
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
