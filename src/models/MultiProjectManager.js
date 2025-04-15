/**
 * MultiProjectManager.js
 * Manages multiple projects with tabbed interface and batch operations
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const ProjectManager = require('../framework/ProjectManager');

class MultiProjectManager {
  constructor(config = {}) {
    this.configDir = path.join(process.cwd(), 'config');
    this.projectsConfigPath = path.join(this.configDir, 'multi_projects.json');
    
    // Ensure config directory exists
    fs.ensureDirSync(this.configDir);
    
    this.config = config;
    this.projectManager = new ProjectManager(config);
    this.projectTabs = [];
    this.activeTabIndex = 0;
    
    this.loadProjectTabs();
  }
  
  /**
   * Load saved project tabs configuration
   */
  loadProjectTabs() {
    try {
      if (fs.existsSync(this.projectsConfigPath)) {
        const data = fs.readJsonSync(this.projectsConfigPath);
        this.projectTabs = data.tabs || [];
        this.activeTabIndex = data.activeTabIndex || 0;
        logger.info(`Loaded ${this.projectTabs.length} project tabs`);
      } else {
        logger.info('No project tabs configuration found, creating new one');
        this.saveProjectTabs();
      }
    } catch (error) {
      logger.error(`Failed to load project tabs: ${error.message}`);
      this.projectTabs = [];
      this.activeTabIndex = 0;
    }
  }
  
  /**
   * Save project tabs configuration
   */
  saveProjectTabs() {
    try {
      fs.writeJsonSync(this.projectsConfigPath, {
        tabs: this.projectTabs,
        activeTabIndex: this.activeTabIndex,
        updatedAt: new Date().toISOString()
      }, { spaces: 2 });
      logger.info(`Saved ${this.projectTabs.length} project tabs`);
      return true;
    } catch (error) {
      logger.error(`Failed to save project tabs: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Add a new project tab
   * @param {Object} projectData - Project data including repository URL
   * @returns {Object} New tab data
   */
  async addProjectTab(projectData) {
    try {
      // Create a unique ID for the tab
      const tabId = uuidv4();
      
      // Add the project using the ProjectManager
      const project = await this.projectManager.addProject(projectData.repoUrl);
      
      // Create the tab object
      const tab = {
        id: tabId,
        projectName: project.config.name,
        projectId: project.config.name, // Use name as ID for simplicity
        repoUrl: projectData.repoUrl,
        workflowId: projectData.workflowId || null,
        isInitialized: false, // Default to not initialized
        addedAt: new Date().toISOString(),
        status: 'added'
      };
      
      // Add to tabs array
      this.projectTabs.push(tab);
      
      // Set as active tab
      this.activeTabIndex = this.projectTabs.length - 1;
      
      // Save configuration
      this.saveProjectTabs();
      
      logger.info(`Added project tab: ${project.config.name}`);
      return tab;
    } catch (error) {
      logger.error(`Failed to add project tab: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add multiple project tabs in batch
   * @param {Array<Object>} projectsData - Array of project data objects
   * @returns {Array<Object>} Added tabs
   */
  async addMultipleProjectTabs(projectsData) {
    try {
      const addedTabs = [];
      
      for (const projectData of projectsData) {
        try {
          const tab = await this.addProjectTab(projectData);
          addedTabs.push(tab);
        } catch (error) {
          logger.error(`Failed to add project: ${projectData.repoUrl}`, error);
          // Continue with other projects even if one fails
        }
      }
      
      logger.info(`Added ${addedTabs.length} of ${projectsData.length} project tabs`);
      return addedTabs;
    } catch (error) {
      logger.error(`Batch project add failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Remove a project tab
   * @param {string} tabId - ID of tab to remove
   * @returns {boolean} Success status
   */
  removeProjectTab(tabId) {
    try {
      const tabIndex = this.projectTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) {
        throw new Error(`Tab not found: ${tabId}`);
      }
      
      // Remove tab
      this.projectTabs.splice(tabIndex, 1);
      
      // Adjust active tab index if needed
      if (this.activeTabIndex >= this.projectTabs.length) {
        this.activeTabIndex = Math.max(0, this.projectTabs.length - 1);
      }
      
      // Save configuration
      this.saveProjectTabs();
      
      logger.info(`Removed project tab: ${tabId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove project tab: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Set the active project tab
   * @param {string} tabId - ID of tab to activate
   * @returns {boolean} Success status
   */
  setActiveTab(tabId) {
    try {
      const tabIndex = this.projectTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) {
        throw new Error(`Tab not found: ${tabId}`);
      }
      
      this.activeTabIndex = tabIndex;
      this.saveProjectTabs();
      
      logger.info(`Set active tab: ${tabId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set active tab: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get all project tabs
   * @returns {Array<Object>} Project tabs
   */
  getAllProjectTabs() {
    return [...this.projectTabs];
  }
  
  /**
   * Get the active project tab
   * @returns {Object} Active tab or null if none
   */
  getActiveTab() {
    if (this.projectTabs.length === 0) {
      return null;
    }
    return this.projectTabs[this.activeTabIndex];
  }
  
  /**
   * Initialize a project with template files
   * @param {string} tabId - ID of the tab to initialize
   * @returns {boolean} Success status
   */
  async initializeProject(tabId) {
    try {
      const tabIndex = this.projectTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) {
        throw new Error(`Tab not found: ${tabId}`);
      }
      
      const tab = this.projectTabs[tabIndex];
      const project = this.projectManager.getProject(tab.projectName);
      
      if (!project) {
        throw new Error(`Project not found: ${tab.projectName}`);
      }
      
      // Initialize templates
      project.initializeTemplates();
      
      // Push changes
      await project.pushChanges();
      
      // Update tab status
      tab.isInitialized = true;
      tab.status = 'initialized';
      tab.initializedAt = new Date().toISOString();
      
      // Save configuration
      this.saveProjectTabs();
      
      logger.info(`Initialized project: ${tab.projectName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to initialize project: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Initialize multiple projects in batch
   * @param {Array<string>} tabIds - IDs of tabs to initialize
   * @returns {Object} Results object with success and failures
   */
  async initializeMultipleProjects(tabIds) {
    try {
      const results = {
        success: [],
        failure: []
      };
      
      for (const tabId of tabIds) {
        try {
          const success = await this.initializeProject(tabId);
          if (success) {
            results.success.push(tabId);
          } else {
            results.failure.push({ tabId, error: 'Initialization failed' });
          }
        } catch (error) {
          logger.error(`Failed to initialize project (tab ${tabId}): ${error.message}`);
          results.failure.push({ tabId, error: error.message });
        }
      }
      
      logger.info(`Initialized ${results.success.length} of ${tabIds.length} projects`);
      return results;
    } catch (error) {
      logger.error(`Batch project initialization failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Apply a workflow to a project
   * @param {string} tabId - ID of the tab
   * @param {string} workflowId - ID of the workflow to apply
   * @returns {boolean} Success status
   */
  async applyWorkflowToProject(tabId, workflowId) {
    try {
      const tabIndex = this.projectTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) {
        throw new Error(`Tab not found: ${tabId}`);
      }
      
      const tab = this.projectTabs[tabIndex];
      
      // Update tab with workflow ID
      tab.workflowId = workflowId;
      tab.workflowAppliedAt = new Date().toISOString();
      
      // Save configuration
      this.saveProjectTabs();
      
      logger.info(`Applied workflow ${workflowId} to project: ${tab.projectName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to apply workflow: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Apply a workflow to multiple projects in batch
   * @param {Array<string>} tabIds - IDs of tabs
   * @param {string} workflowId - ID of the workflow to apply
   * @returns {Object} Results object with success and failures
   */
  async applyWorkflowToMultipleProjects(tabIds, workflowId) {
    try {
      const results = {
        success: [],
        failure: []
      };
      
      for (const tabId of tabIds) {
        try {
          const success = await this.applyWorkflowToProject(tabId, workflowId);
          if (success) {
            results.success.push(tabId);
          } else {
            results.failure.push({ tabId, error: 'Workflow application failed' });
          }
        } catch (error) {
          logger.error(`Failed to apply workflow to project (tab ${tabId}): ${error.message}`);
          results.failure.push({ tabId, error: error.message });
        }
      }
      
      logger.info(`Applied workflow to ${results.success.length} of ${tabIds.length} projects`);
      return results;
    } catch (error) {
      logger.error(`Batch workflow application failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Check if a project has required template files
   * @param {string} tabId - ID of the tab
   * @returns {Object} Check result with details
   */
  async checkProjectInitialization(tabId) {
    try {
      const tabIndex = this.projectTabs.findIndex(tab => tab.id === tabId);
      if (tabIndex === -1) {
        throw new Error(`Tab not found: ${tabId}`);
      }
      
      const tab = this.projectTabs[tabIndex];
      const project = this.projectManager.getProject(tab.projectName);
      
      if (!project) {
        throw new Error(`Project not found: ${tab.projectName}`);
      }
      
      // List of template files to check for
      const requiredTemplates = [
        'GenerateSTRUCTURE\'current\'.promptp',
        'generateSTRUCTURE\'suggested\'.prompt',
        'GenerateSTEP.prompt',
        'GenerateREADMERules.prompt'
      ];
      
      // Check if each template exists in the project
      const checkResults = {};
      let allTemplatesExist = true;
      
      for (const template of requiredTemplates) {
        const templatePath = path.join(project.path, template);
        const exists = await fs.pathExists(templatePath);
        checkResults[template] = exists;
        if (!exists) {
          allTemplatesExist = false;
        }
      }
      
      // Update tab status
      if (allTemplatesExist) {
        tab.isInitialized = true;
        tab.status = 'initialized';
        if (!tab.initializedAt) {
          tab.initializedAt = new Date().toISOString();
        }
        this.saveProjectTabs();
      }
      
      return {
        isInitialized: allTemplatesExist,
        details: checkResults
      };
    } catch (error) {
      logger.error(`Failed to check project initialization: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get the status of all projects
   * @returns {Array<Object>} Status of all project tabs
   */
  async getProjectsStatus() {
    try {
      const statusResults = [];
      
      for (const tab of this.projectTabs) {
        try {
          // Get project instance
          const project = this.projectManager.getProject(tab.projectName);
          
          // Check initialization status if not already initialized
          let initializationStatus = { isInitialized: tab.isInitialized };
          if (!tab.isInitialized) {
            initializationStatus = await this.checkProjectInitialization(tab.id);
          }
          
          // Get workflow status if workflow is assigned
          let workflowStatus = null;
          if (tab.workflowId) {
            // In a real implementation, this would get actual workflow status
            workflowStatus = {
              id: tab.workflowId,
              status: 'pending' // Placeholder
            };
          }
          
          statusResults.push({
            tab: { ...tab },
            project: project ? {
              name: project.config.name,
              path: project.path,
              hasSteps: !!project.steps
            } : null,
            initialization: initializationStatus,
            workflow: workflowStatus
          });
        } catch (error) {
          logger.error(`Failed to get status for project ${tab.projectName}: ${error.message}`);
          statusResults.push({
            tab: { ...tab },
            error: error.message
          });
        }
      }
      
      return statusResults;
    } catch (error) {
      logger.error(`Failed to get projects status: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MultiProjectManager;
