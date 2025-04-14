/**
 * ProjectManager.js
 * Manages individual project operations and file handling
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../utils/logger');

class ProjectManager {
  constructor(config = {}) {
    this.config = config;
    this.projectsDir = path.join(process.cwd(), 'projects');
    this.templatesDir = path.join(process.cwd(), 'templates');
    
    // Ensure directories exist
    fs.ensureDirSync(this.projectsDir);
    fs.ensureDirSync(this.templatesDir);
  }
  
  /**
   * Add a project from a repository URL
   * @param {string} repoUrl - Repository URL
   * @param {string} projectName - Optional project name (defaults to repo name)
   * @returns {Promise<Object>} Project object
   */
  async addProject(repoUrl, projectName = '') {
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
      
      const projectPath = path.join(this.projectsDir, projectName);
      
      // Check if project directory already exists
      if (await fs.pathExists(projectPath)) {
        // If it exists, check if it's a git repository
        try {
          await execAsync('git status', { cwd: projectPath });
          logger.info(`Project ${projectName} already exists and is a git repository`);
          
          // Pull latest changes
          await execAsync('git pull', { cwd: projectPath });
          logger.info(`Pulled latest changes for ${projectName}`);
        } catch (error) {
          // Not a git repository or other error
          logger.error(`Error with existing project: ${error.message}`);
          throw new Error(`Project directory exists but is not a valid git repository: ${projectPath}`);
        }
      } else {
        // Clone the repository
        logger.info(`Cloning repository: ${repoUrl}`);
        await execAsync(`git clone ${repoUrl} "${projectPath}"`);
        logger.info(`Repository cloned to: ${projectPath}`);
      }
      
      // Create or update project configuration
      const configPath = path.join(projectPath, 'project.json');
      let config = {
        name: projectName,
        description: '',
        repository: repoUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (await fs.pathExists(configPath)) {
        try {
          const existingConfig = await fs.readJson(configPath);
          config = {
            ...existingConfig,
            repository: repoUrl,
            updatedAt: new Date().toISOString()
          };
        } catch (error) {
          logger.warn(`Could not read existing project config: ${error.message}`);
        }
      }
      
      // Save project configuration
      await fs.writeJson(configPath, config, { spaces: 2 });
      
      // Create project object
      const project = {
        config,
        path: projectPath
      };
      
      // Check for STEPS.md
      project.steps = await this.loadProjectSteps(projectPath);
      
      return project;
    } catch (error) {
      logger.error(`Failed to add project: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Load project steps from STEPS.md
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
   * Initialize project with template files
   * @param {string} projectPath - Path to project directory
   * @returns {Promise<boolean>} Success status
   */
  async initializeTemplates(projectPath) {
    try {
      // Copy template files to project
      const templateFiles = [
        'GenerateSTRUCTURE\'current\'.promptp',
        'generateSTRUCTURE\'suggested\'.prompt',
        'GenerateSTEP.prompt',
        'GenerateREADMERules.prompt'
      ];
      
      for (const file of templateFiles) {
        const sourcePath = path.join(this.templatesDir, file);
        const destPath = path.join(projectPath, file);
        
        // Check if template exists
        if (await fs.pathExists(sourcePath)) {
          await fs.copy(sourcePath, destPath);
          logger.info(`Copied template: ${file}`);
        } else {
          // Create default template
          await this.createDefaultTemplate(file, destPath);
          logger.info(`Created default template: ${file}`);
        }
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to initialize templates: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Create a default template file
   * @param {string} templateName - Template name
   * @param {string} destPath - Destination path
   * @returns {Promise<void>}
   */
  async createDefaultTemplate(templateName, destPath) {
    let content = '';
    
    switch (templateName) {
      case 'GenerateSTRUCTURE\'current\'.promptp':
        content = 'Analyze the current project structure and provide a detailed overview of the codebase organization, key components, and architecture.';
        break;
      case 'generateSTRUCTURE\'suggested\'.prompt':
        content = 'Based on the current project structure, suggest improvements and additional features that would enhance the application.';
        break;
      case 'GenerateSTEP.prompt':
        content = 'Create a step-by-step implementation plan for the project, breaking down the development into manageable phases with concurrent components.';
        break;
      case 'GenerateREADMERules.prompt':
        content = 'Generate a comprehensive README.md file for the project, including installation instructions, usage examples, and contribution guidelines.';
        break;
      default:
        content = `Default template content for ${templateName}`;
    }
    
    await fs.writeFile(destPath, content);
  }
  
  /**
   * Push changes to the repository
   * @param {string} projectPath - Path to project directory
   * @param {string} message - Commit message
   * @returns {Promise<boolean>} Success status
   */
  async pushChanges(projectPath, message = 'Update project files') {
    try {
      // Check if there are changes to commit
      const { stdout } = await execAsync('git status --porcelain', { cwd: projectPath });
      
      if (!stdout.trim()) {
        logger.info('No changes to commit');
        return true;
      }
      
      // Add all changes
      await execAsync('git add .', { cwd: projectPath });
      
      // Commit changes
      await execAsync(`git commit -m "${message}"`, { cwd: projectPath });
      
      // Push changes
      await execAsync('git push', { cwd: projectPath });
      
      logger.info(`Changes pushed to repository: ${message}`);
      return true;
    } catch (error) {
      logger.error(`Failed to push changes: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get project by name
   * @param {string} projectName - Project name
   * @returns {Promise<Object>} Project object
   */
  async getProjectByName(projectName) {
    try {
      const projectPath = path.join(this.projectsDir, projectName);
      
      if (!await fs.pathExists(projectPath)) {
        throw new Error(`Project not found: ${projectName}`);
      }
      
      const configPath = path.join(projectPath, 'project.json');
      let config;
      
      if (await fs.pathExists(configPath)) {
        config = await fs.readJson(configPath);
      } else {
        config = {
          name: projectName,
          description: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
      
      const project = {
        config,
        path: projectPath,
        steps: await this.loadProjectSteps(projectPath)
      };
      
      return project;
    } catch (error) {
      logger.error(`Failed to get project: ${error.message}`);
      throw error;
    }
  }
}

module.exports = ProjectManager;
