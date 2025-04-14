/**
 * DeplaManager.js
 * Core manager for Depla project operations
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../utils/logger');
const ConfigManager = require('./ConfigManager');

class DeplaManager {
  constructor(config = {}) {
    this.configManager = new ConfigManager();
    this.config = this.configManager.getConfig();
    
    // Override with provided config
    if (Object.keys(config).length > 0) {
      this.configManager.updateConfig(config);
      this.config = this.configManager.getConfig();
    }
    
    this.projectsDir = path.join(process.cwd(), 'projects');
    this.projects = {};
    
    // Ensure projects directory exists
    fs.ensureDirSync(this.projectsDir);
  }
  
  /**
   * Initialize the manager
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    try {
      logger.info('Initializing DeplaManager');
      
      // Load existing projects
      await this.loadProjects();
      
      logger.info('DeplaManager initialized successfully');
      return { success: true };
    } catch (error) {
      logger.error(`Initialization failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Load existing projects
   * @returns {Promise<void>}
   */
  async loadProjects() {
    try {
      const projectDirs = await fs.readdir(this.projectsDir);
      
      for (const dir of projectDirs) {
        const projectPath = path.join(this.projectsDir, dir);
        const stat = await fs.stat(projectPath);
        
        if (stat.isDirectory()) {
          const configPath = path.join(projectPath, 'project.json');
          
          if (await fs.pathExists(configPath)) {
            try {
              const projectConfig = await fs.readJson(configPath);
              
              // Create project object
              this.projects[projectConfig.name] = {
                config: projectConfig,
                path: projectPath,
                steps: await this.loadProjectSteps(projectPath)
              };
              
              logger.info(`Loaded project: ${projectConfig.name}`);
            } catch (error) {
              logger.error(`Failed to load project ${dir}: ${error.message}`);
            }
          }
        }
      }
      
      logger.info(`Loaded ${Object.keys(this.projects).length} projects`);
    } catch (error) {
      logger.error(`Failed to load projects: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Load project steps
   * @param {string} projectPath - Path to project directory
   * @returns {Promise<Array>} Project steps
   */
  async loadProjectSteps(projectPath) {
    try {
      const stepsPath = path.join(projectPath, 'STEPS.md');
      
      if (await fs.pathExists(stepsPath)) {
        const content = await fs.readFile(stepsPath, 'utf8');
        
        // Parse steps from markdown (simplified for now)
        const steps = [];
        const lines = content.split('\n');
        let currentStep = null;
        
        for (const line of lines) {
          if (line.startsWith('## Step ')) {
            if (currentStep) {
              steps.push(currentStep);
            }
            
            const stepMatch = line.match(/## Step (\d+): (.+)/);
            if (stepMatch) {
              currentStep = {
                number: parseInt(stepMatch[1]),
                title: stepMatch[2],
                description: '',
                components: []
              };
            }
          } else if (line.startsWith('### Components:') && currentStep) {
            // Next lines will be components
          } else if (line.startsWith('- ') && currentStep) {
            const componentMatch = line.match(/- (.+)/);
            if (componentMatch) {
              currentStep.components.push({
                name: componentMatch[1],
                status: 'pending'
              });
            }
          } else if (currentStep && !line.startsWith('#')) {
            currentStep.description += line + '\n';
          }
        }
        
        if (currentStep) {
          steps.push(currentStep);
        }
        
        return steps;
      }
      
      return [];
    } catch (error) {
      logger.error(`Failed to load project steps: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get a project by name
   * @param {string} projectName - Project name
   * @returns {Object} Project object
   */
  getProject(projectName) {
    return this.projects[projectName];
  }
  
  /**
   * Get all projects
   * @returns {Object} All projects
   */
  getAllProjects() {
    return { ...this.projects };
  }
  
  /**
   * Create a new project
   * @param {string} projectName - Project name
   * @param {Object} projectConfig - Project configuration
   * @returns {Promise<Object>} Created project
   */
  async createProject(projectName, projectConfig = {}) {
    try {
      if (this.projects[projectName]) {
        throw new Error(`Project ${projectName} already exists`);
      }
      
      const projectPath = path.join(this.projectsDir, projectName);
      
      // Create project directory
      await fs.ensureDir(projectPath);
      
      // Create project configuration
      const config = {
        name: projectName,
        description: projectConfig.description || '',
        repository: projectConfig.repository || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save project configuration
      await fs.writeJson(path.join(projectPath, 'project.json'), config, { spaces: 2 });
      
      // Create project object
      this.projects[projectName] = {
        config,
        path: projectPath,
        steps: []
      };
      
      logger.info(`Created project: ${projectName}`);
      
      return this.projects[projectName];
    } catch (error) {
      logger.error(`Failed to create project: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clone a repository to create a new project
   * @param {string} repoUrl - Repository URL
   * @param {string} projectName - Optional project name (defaults to repo name)
   * @returns {Promise<Object>} Created project
   */
  async cloneRepository(repoUrl, projectName = '') {
    try {
      // Extract repo name from URL if not provided
      if (!projectName) {
        const repoMatch = repoUrl.match(/\/([^\/]+)(\.git)?$/);
        if (repoMatch) {
          projectName = repoMatch[1];
        } else {
          throw new Error('Could not determine project name from repository URL');
        }
      }
      
      if (this.projects[projectName]) {
        throw new Error(`Project ${projectName} already exists`);
      }
      
      const projectPath = path.join(this.projectsDir, projectName);
      
      // Clone repository
      logger.info(`Cloning repository: ${repoUrl}`);
      await execAsync(`git clone ${repoUrl} "${projectPath}"`);
      
      // Create project configuration
      const config = {
        name: projectName,
        description: '',
        repository: repoUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save project configuration
      await fs.writeJson(path.join(projectPath, 'project.json'), config, { spaces: 2 });
      
      // Create project object
      this.projects[projectName] = {
        config,
        path: projectPath,
        steps: []
      };
      
      logger.info(`Created project from repository: ${projectName}`);
      
      return this.projects[projectName];
    } catch (error) {
      logger.error(`Failed to clone repository: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Delete a project
   * @param {string} projectName - Project name
   * @returns {Promise<boolean>} Success status
   */
  async deleteProject(projectName) {
    try {
      if (!this.projects[projectName]) {
        throw new Error(`Project ${projectName} not found`);
      }
      
      const projectPath = this.projects[projectName].path;
      
      // Remove project directory
      await fs.remove(projectPath);
      
      // Remove from projects object
      delete this.projects[projectName];
      
      logger.info(`Deleted project: ${projectName}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to delete project: ${error.message}`);
      return false;
    }
  }
}

module.exports = DeplaManager;
