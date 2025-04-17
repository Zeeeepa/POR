/**
 * Project Initializer Service
 * Handles project initialization with templates
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const templateEngine = require('./utils/templateEngine');
const logger = require('./utils/logger');
const { Octokit } = require('@octokit/rest');

class ProjectInitializer {
  constructor() {
    this.templatesDir = path.join(process.cwd(), 'templates');
    this.projectsDir = path.join(process.cwd(), 'projects');
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
  }
  
  /**
   * Initialize a new project with templates
   * @param {Object} projectData - Project data including name, repo URL, etc.
   * @returns {Promise<Object>} Result of initialization
   */
  async initializeProject(projectData) {
    try {
      logger.info(`Initializing project: ${projectData.name}`);
      
      // 1. Clone or create repository
      const projectDir = await this.cloneOrCreateRepo(projectData);
      
      // 2. Copy and process template files
      await this.initializeTemplateFiles(projectDir, projectData);
      
      // 3. Commit changes
      await this.commitInitialFiles(projectDir);
      
      // 4. Send initialization message to Slack (if configured)
      if (projectData.notifySlack !== false) {
        await this.sendInitializationMessage(projectData);
      }
      
      logger.info(`Project initialized successfully: ${projectData.name}`);
      return { success: true, projectDir };
    } catch (error) {
      logger.error(`Project initialization failed: ${error.message}`, { error });
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get list of GitHub repositories for the authenticated user
   * @returns {Promise<Array>} List of repositories
   */
  async getGitHubRepositories() {
    try {
      const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        direction: 'desc',
        per_page: 100
      });

      return repos.map(repo => ({
        id: repo.id,
        name: repo.full_name,
        url: repo.html_url,
        description: repo.description,
        language: repo.language,
        private: repo.private,
        updated_at: repo.updated_at
      }));
    } catch (error) {
      logger.error(`Failed to fetch GitHub repositories: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clone repository or create new directory for project
   * @param {Object} projectData - Project data
   * @returns {Promise<string>} Path to project directory
   */
  async cloneOrCreateRepo(projectData) {
    const projectDir = path.join(this.projectsDir, projectData.name);
    
    // Create projects directory if it doesn't exist
    await fs.ensureDir(this.projectsDir);
    
    // Check if repository URL is provided
    if (projectData.repositoryUrl) {
      try {
        logger.info(`Cloning repository: ${projectData.repositoryUrl}`);
        
        // Remove directory if it exists
        if (await fs.pathExists(projectDir)) {
          await fs.remove(projectDir);
        }
        
        // Clone repository
        await execAsync(`git clone ${projectData.repositoryUrl} ${projectDir}`);
        
        return projectDir;
      } catch (error) {
        logger.error(`Failed to clone repository: ${error.message}`);
        throw new Error(`Failed to clone repository: ${error.message}`);
      }
    } else {
      // Create new directory
      logger.info(`Creating new project directory: ${projectDir}`);
      await fs.ensureDir(projectDir);
      
      // Initialize git repository
      try {
        await execAsync('git init', { cwd: projectDir });
      } catch (error) {
        logger.warn(`Failed to initialize git repository: ${error.message}`);
        // Continue even if git init fails
      }
      
      return projectDir;
    }
  }
  
  /**
   * Initialize template files in project directory
   * @param {string} projectDir - Project directory path
   * @param {Object} projectData - Project data
   */
  async initializeTemplateFiles(projectDir, projectData) {
    logger.info(`Initializing template files in ${projectDir}`);
    
    // 1. Copy step.prompt and uimockup.prompt (static files)
    await fs.copy(
      path.join(this.templatesDir, 'project_initialization/step.prompt'),
      path.join(projectDir, '.step.prompt')
    );
    
    await fs.copy(
      path.join(this.templatesDir, 'project_initialization/uimockup.prompt'),
      path.join(projectDir, '.uimockup.prompt')
    );
    
    // 2. Create dynamic README.md based on project type
    const readmeTemplate = this.getReadmeTemplate(projectData.type);
    const readmeContent = templateEngine.render(readmeTemplate, {
      projectName: projectData.name,
      description: projectData.description || `${projectData.name} - A new project`,
      features: projectData.features || [],
      technologies: projectData.technologies || [],
      requirements: projectData.requirements || '',
      repositoryUrl: projectData.repositoryUrl || ''
    });
    
    await fs.writeFile(
      path.join(projectDir, 'README.md'),
      readmeContent
    );
    
    logger.info('Template files initialized');
  }
  
  /**
   * Get the appropriate README template based on project type
   * @param {string} projectType - Type of project
   * @returns {string} Path to README template
   */
  getReadmeTemplate(projectType) {
    const templatePath = path.join(
      this.templatesDir,
      'project_initialization/readme',
      `${projectType || 'node_base'}.md`
    );
    
    // Check if template exists, otherwise use default
    if (!fs.existsSync(templatePath)) {
      return path.join(this.templatesDir, 'project_initialization/readme/node_base.md');
    }
    
    return templatePath;
  }
  
  /**
   * Commit initial files to repository
   * @param {string} projectDir - Project directory path
   */
  async commitInitialFiles(projectDir) {
    try {
      logger.info('Committing initial files');
      
      // Add files
      await execAsync('git add .', { cwd: projectDir });
      
      // Commit
      await execAsync('git commit -m "Initial project setup with templates"', {
        cwd: projectDir
      });
      
      logger.info('Initial files committed');
      return true;
    } catch (error) {
      logger.warn(`Failed to commit initial files: ${error.message}`);
      // Continue even if git commit fails
      return false;
    }
  }
  
  /**
   * Send initialization message to Slack
   * @param {Object} projectData - Project data
   */
  async sendInitializationMessage(projectData) {
    try {
      logger.info('Sending initialization message to Slack');
      
      // Import SlackService dynamically to avoid circular dependencies
      const slackService = require('./slackService');
      
      // Prepare message data
      const messageData = {
        projectName: projectData.name,
        repositoryUrl: projectData.repositoryUrl || 'Local repository',
        initializedBy: projectData.owner || 'System',
        timestamp: new Date().toISOString()
      };
      
      // Send message
      await slackService.sendProjectInitializedMessage(messageData);
      
      logger.info('Slack message sent');
    } catch (error) {
      logger.error(`Failed to send Slack message: ${error.message}`);
      // Continue even if slack message fails
    }
  }
}

module.exports = new ProjectInitializer();
