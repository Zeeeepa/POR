/**
 * DeplaEnhanced.js
 * Enhanced version of DeplaManager with multi-project support, workflow management,
 * and improved message handling for concurrent development
 */

const DeplaManager = require('../framework/DeplaManager');
const WorkflowManager = require('./WorkflowManager');
const MultiProjectManager = require('./MultiProjectManager');
const MessageQueueManager = require('./MessageQueueManager');
const GitHubEnhanced = require('../utils/GitHubEnhanced');
const CursorAutomation = require('../utils/CursorAutomation');
const ConfigManager = require('../framework/ConfigManager');
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
      
      // Check if this is a step generation PR
      const isStepGeneration = this.isStepGenerationPR(prDetails);
      
      if (isStepGeneration) {
        logger.info(`PR #${data.prNumber} is a step generation PR, auto-merging`);
        
        // Auto-merge the PR
        await this.gitHubEnhanced.mergePR({
          owner: data.repoName.split('/')[0],
          repo: data.repoName.split('/')[1],
          pull_number: data.prNumber,
          merge_method: 'merge'
        });
        
        // Update project with new steps
        await this.updateProjectSteps(project, prDetails);
        
        logger.info(`Successfully merged step generation PR #${data.prNumber} for ${data.repoName}`);
      } else {
        // Add to analysis queue
        this.gitHubEnhanced.addPrToAnalysisQueue({
          owner: data.repoName.split('/')[0],
          repo: data.repoName.split('/')[1],
          pull_number: data.prNumber,
          autoMerge: this.shouldAutoMergePR(prDetails)
        });
        
        logger.info(`Added PR #${data.prNumber} to analysis queue`);
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
      'automated update',
      'step generation'
    ];
    
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
    // Check branch naming patterns
    const featurePrefixes = [
      'feature/',
      'feat/',
      'component/',
      'implement-'
    ];
    
    for (const prefix of featurePrefixes) {
      if (branchName.startsWith(prefix)) {
        return true;
      }
    }
    
    // Check for feature indicators in branch name
    const featureKeywords = [
      '-feature-',
      '-component-',
      '-implementation-'
    ];
    
    for (const keyword of featureKeywords) {
      if (branchName.includes(keyword)) {
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
      logger.info(`Updating steps for project ${project.name} from PR #${prDetails.number}`);
      
      // Get the STEPS.md content from the PR
      const stepsFile = prDetails.files.find(file => 
        file.filename.toLowerCase() === 'steps.md' || 
        file.filename.toLowerCase().endsWith('/steps.md')
      );
      
      if (!stepsFile) {
        logger.warn(`No STEPS.md file found in PR #${prDetails.number}`);
        return false;
      }
      
      // Get file content
      const fileContent = await this.gitHubEnhanced.getFileContent(
        prDetails.head.repo.owner.login,
        prDetails.head.repo.name,
        stepsFile.filename,
        prDetails.head.sha
      );
      
      if (!fileContent) {
        logger.warn(`Failed to get content for ${stepsFile.filename}`);
        return false;
      }
      
      // Update project steps
      await project.updateSteps(fileContent);
      
      logger.info(`Successfully updated steps for project ${project.name}`);
      return true;
    } catch (error) {
      logger.error(`Error updating project steps: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Update feature branch status in project
   * @param {Object} project - Project object
   * @param {string} branchName - Branch name
   * @returns {Promise<boolean>} Success status
   */
  async updateFeatureBranchStatus(project, branchName) {
    try {
      logger.info(`Updating feature branch status for ${branchName} in project ${project.name}`);
      
      // Extract feature name from branch
      let featureName = branchName;
      
      // Remove prefixes
      const prefixes = ['feature/', 'feat/', 'component/', 'implement-'];
      for (const prefix of prefixes) {
        if (featureName.startsWith(prefix)) {
          featureName = featureName.substring(prefix.length);
          break;
        }
      }
      
      // Convert dashes to spaces
      featureName = featureName.replace(/-/g, ' ');
      
      // Find matching component in project phases
      let found = false;
      
      for (const phase of project.phases) {
        for (const component of phase.components) {
          // Check if component name matches feature name (case insensitive partial match)
          if (component.name.toLowerCase().includes(featureName.toLowerCase()) ||
              featureName.toLowerCase().includes(component.name.toLowerCase())) {
            
            // Mark component as in progress
            component.inProgress = true;
            found = true;
            
            logger.info(`Marked component "${component.name}" as in progress`);
          }
        }
      }
      
      if (found) {
        // Save updated project
        await project.save();
        return true;
      } else {
        logger.warn(`No matching component found for branch ${branchName}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error updating feature branch status: ${error.message}`);
      return false;
    }
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
