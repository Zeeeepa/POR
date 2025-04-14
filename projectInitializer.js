/**
 * Project Initializer Service
 * Handles project initialization with templates
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const templateEngine = require('../utils/templateEngine');
const logger = require('../utils/logger');

class ProjectInitializer {
  constructor() {
    this.templatesDir = path.join(process.cwd(), 'templates');
    this.projectsDir = path.join(process.cwd(), 'projects');
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
  
  /**
   * Generate Steps.md file from README requirements
   * @param {string} projectName - Name of the project
   * @returns {Promise<Object>} Result of steps generation
   */
  async generateStepsFile(projectName) {
    try {
      logger.info(`Generating Steps.md for project: ${projectName}`);
      
      const projectDir = path.join(this.projectsDir, projectName);
      
      // Check if project exists
      if (!await fs.pathExists(projectDir)) {
        throw new Error(`Project directory does not exist: ${projectDir}`);
      }
      
      // Check if README.md exists
      const readmePath = path.join(projectDir, 'README.md');
      if (!await fs.pathExists(readmePath)) {
        throw new Error('README.md does not exist in project directory');
      }
      
      // This would typically call an AI service to generate Steps.md
      // For now, we'll create a simple template-based version
      const stepsContent = `# Implementation Steps for ${projectName}

## Summary
- Total Steps: 5
- Estimated Time: 8 hours
- Key Technologies: Node.js, Express, MongoDB

## Step 1: Project Setup
**Estimated time:** 1 hour
**Complexity:** Low

### Objective
Initialize the project structure and install dependencies.

### Implementation Details
1. Create directory structure
2. Initialize package.json
3. Install core dependencies
4. Configure basic environment

### Verification
Project structure is created and npm dependencies are installed.

---

## Step 2: Database Setup
**Estimated time:** 1.5 hours
**Complexity:** Medium

### Objective
Set up database connection and models.

### Implementation Details
1. Configure MongoDB connection
2. Create data models
3. Set up validation schemas

### Verification
Database connection is established and models are defined.

---

## Step 3: API Routes
**Estimated time:** 2 hours
**Complexity:** Medium

### Objective
Implement API routes and controllers.

### Implementation Details
1. Define route structure
2. Implement controllers
3. Add input validation

### Verification
API routes respond correctly to requests.

---

## Step 4: Frontend Integration
**Estimated time:** 2.5 hours
**Complexity:** Medium

### Objective
Connect frontend to backend API.

### Implementation Details
1. Set up frontend structure
2. Implement API service
3. Create UI components

### Verification
Frontend successfully communicates with the API.

---

## Step 5: Testing and Deployment
**Estimated time:** 1 hour
**Complexity:** Low

### Objective
Write tests and prepare for deployment.

### Implementation Details
1. Write unit tests
2. Set up CI pipeline
3. Prepare deployment configuration

### Verification
Tests pass and application is ready for deployment.
`;
      
      // Write Steps.md to project directory
      await fs.writeFile(
        path.join(projectDir, 'Steps.md'),
        stepsContent
      );
      
      // Commit the file
      try {
        await execAsync('git add Steps.md', { cwd: projectDir });
        await execAsync('git commit -m "Add implementation steps"', { cwd: projectDir });
      } catch (error) {
        logger.warn(`Failed to commit Steps.md: ${error.message}`);
      }
      
      logger.info(`Steps.md generated for project: ${projectName}`);
      
      // Send message to Slack if enabled
      try {
        const slackService = require('./slackService');
        await slackService.sendStepsCreatedMessage({
          projectName,
          stepsCount: 5,
          estimatedTime: '8 hours',
          summary: 'Implementation plan with 5 steps covering setup, database, API, frontend, and testing.'
        });
      } catch (error) {
        logger.error(`Failed to send steps created message: ${error.message}`);
      }
      
      return {
        success: true,
        stepsCount: 5,
        estimatedTime: '8 hours'
      };
    } catch (error) {
      logger.error(`Failed to generate Steps.md: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ProjectInitializer();