// Depla Project Manager Framework

// Core modules
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const axios = require('axios');
const crypto = require('crypto');
const logger = require('./src/utils/logger');

// Import enhanced components
const DeplaEnhanced = require('./src/models/DeplaEnhanced');
const ConfigManager = require('./src/framework/ConfigManager');
const ProjectManager = require('./src/framework/ProjectManager');
const WorkflowManager = require('./src/models/WorkflowManager');
const MessageQueueManager = require('./src/models/MessageQueueManager');
const GitHubEnhanced = require('./src/utils/GitHubEnhanced');

// Project Management
class Project {
  constructor(projectPath, config) {
    this.path = projectPath;
    this.config = config;
    this.messages = [];
    this.phases = [];
    this.requirements = [];
    this.templateFiles = {
      requirements: 'REQUIREMENTS.md',
      steps: 'STEPS.md',
      stepByStep: 'STEP-BY-STEP.prompt',
      uiMockup: 'uimockupGenerate.prompt'
    };
    this.loadMessages();
    this.loadSteps();
    this.loadRequirements();
  }

  loadSteps() {
    try {
      // Read STEPS.md
      const stepsPath = path.join(this.path, this.templateFiles.steps);
      if (fs.existsSync(stepsPath)) {
        const stepsContent = fs.readFileSync(stepsPath, 'utf8');
        // Parse the phases from STEPS.md
        this.phases = this.parseSteps(stepsContent);
        this.recalculateProgress();
      }
      return this.phases;
    } catch (error) {
      console.error('Failed to load steps:', error);
      return [];
    }
  }

  parseSteps(stepsContent) {
    // Parse STEPS.md content to extract phases and components
    const phases = [];
    const phaseRegex = /### Phase \d+: ([^(]+)\((\d+)\/(\d+) complete\)/g;
    let match;
    
    while ((match = phaseRegex.exec(stepsContent)) !== null) {
      const phaseName = match[1].trim();
      const completedSteps = parseInt(match[2], 10);
      const totalSteps = parseInt(match[3], 10);
      
      // Find all components in this phase
      const componentSection = stepsContent.slice(match.index + match[0].length);
      const nextPhaseIndex = componentSection.indexOf('### Phase');
      const currentPhaseContent = nextPhaseIndex !== -1 
        ? componentSection.slice(0, nextPhaseIndex)
        : componentSection;
      
      // Extract components
      const components = [];
      const componentLines = currentPhaseContent.split('\n')
        .filter(line => line.trim().startsWith('☑') || line.trim().startsWith('☐'));
      
      for (const line of componentLines) {
        const isComplete = line.includes('☑');
        const nameMatch = line.match(/[☑☐]\s+(.*?)(?:\[|$)/);
        if (nameMatch) {
          const name = nameMatch[1].trim();
          components.push({
            name,
            isComplete,
            view: false,
            send: !isComplete
          });
        }
      }
      
      phases.push({
        name: phaseName,
        completedSteps,
        totalSteps,
        components
      });
    }
    
    return phases;
  }

  recalculateProgress() {
    let totalSteps = 0;
    let completedSteps = 0;
    
    for (const phase of this.phases) {
      totalSteps += phase.components.length;
      completedSteps += phase.components.filter(c => c.isComplete).length;
    }
    
    this.config.totalSteps = totalSteps;
    this.config.completedSteps = completedSteps;
    this.saveConfig();
  }

  saveConfig() {
    fs.writeFileSync(
      path.join(this.path, 'project.json'),
      JSON.stringify(this.config, null, 2)
    );
  }

  loadMessages() {
    try {
      const messagesPath = path.join(this.path, 'messages.json');
      if (fs.existsSync(messagesPath)) {
        this.messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
      }
      return this.messages;
    } catch (error) {
      console.error('Failed to load messages:', error);
      return [];
    }
  }

  saveMessages() {
    fs.writeFileSync(
      path.join(this.path, 'messages.json'),
      JSON.stringify(this.messages, null, 2)
    );
  }

  addMessage(message) {
    this.messages.push({
      ...message,
      id: Date.now().toString(),
      status: 'Ready to Send',
      createdAt: new Date().toISOString()
    });
    this.saveMessages();
  }

  updateMessage(messageId, updatedMessage) {
    const index = this.messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      this.messages[index] = { ...this.messages[index], ...updatedMessage };
      this.saveMessages();
      return true;
    }
    return false;
  }

  removeMessage(messageId) {
    const index = this.messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      this.messages.splice(index, 1);
      this.saveMessages();
      return true;
    }
    return false;
  }

  async generateSteps() {
    try {
      console.log('Generating steps for project', this.config.name);
      
      // Get the DeplaEnhanced instance
      const deplaEnhanced = new DeplaEnhanced();
      
      // Initialize if not already initialized
      if (!deplaEnhanced.isInitialized) {
        await deplaEnhanced.initialize();
      }
      
      const requirementsPath = this.getRequirementsPath();
      const promptPath = path.join(this.path, this.templateFiles.stepByStep);
      
      if (!fs.existsSync(requirementsPath) || !fs.existsSync(promptPath)) {
        // Create template files if they don't exist
        this.initializeTemplates();
        throw new Error('Template files were missing and have been created. Please edit them and try again.');
      }
      
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf8');
      const promptContent = fs.readFileSync(promptPath, 'utf8');
      
      // Use DeplaEnhanced to generate steps
      const result = await deplaEnhanced.sendMessage({
        type: 'generate-steps',
        projectName: this.config.name,
        requirementsContent,
        promptContent,
        repository: this.config.repository
      }, 'high');
      
      logger.info(`Steps generation queued with message ID: ${result.messageId}`);
      
      // This will be processing in the background, so return a placeholder
      return `# Implementation Plan for ${this.config.name}\n\nGenerating... Please wait for completion.\n`;
    } catch (error) {
      console.error('Failed to generate steps:', error);
      return `# Implementation Plan for ${this.config.name}\n\n## Error\nFailed to generate steps: ${error.message}\n`;
    }
  }

  updateRequirements(content) {
    const requirementsPath = this.getRequirementsPath();
    fs.writeFileSync(requirementsPath, content);
    console.log(`Updated requirements file at ${requirementsPath}`);
    this.loadRequirements();
  }

  loadRequirements() {
    try {
      const requirementsPath = this.getRequirementsPath();
      if (fs.existsSync(requirementsPath)) {
        const content = fs.readFileSync(requirementsPath, 'utf8');
        this.requirements = this.parseRequirements(content);
      }
      return this.requirements;
    } catch (error) {
      console.error('Failed to load requirements:', error);
      return [];
    }
  }

  getRequirementsPath() {
    return path.join(this.path, this.templateFiles.requirements);
  }

  parseRequirements(content) {
    // Simple parsing of requirements from markdown
    const requirements = [];
    const lines = content.split('\n');
    
    let currentSection = null;
    let currentRequirement = null;
    
    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSection = line.substring(3).trim();
        requirements.push({
          section: currentSection,
          items: []
        });
      } else if (line.startsWith('- ') && currentSection) {
        const item = line.substring(2).trim();
        const currentSectionObj = requirements.find(r => r.section === currentSection);
        if (currentSectionObj) {
          currentSectionObj.items.push(item);
        }
      }
    }
    
    return requirements;
  }

  initializeTemplates() {
    try {
      const templatesDir = path.join(process.cwd(), 'templates');
      
      // Create templates directory if it doesn't exist
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }
      
      // Template files to initialize
      const templates = [
        {
          name: this.templateFiles.requirements,
          content: '# Project Requirements\n\n## Functional Requirements\n\n- User authentication and authorization\n- Dashboard for project management\n- API integration with external services\n\n## Technical Requirements\n\n- React frontend\n- Node.js backend\n- MongoDB database\n\n## Non-Functional Requirements\n\n- Performance optimization\n- Security best practices\n- Responsive design'
        },
        {
          name: this.templateFiles.stepByStep,
          content: 'Please analyze the project requirements and create a detailed step-by-step implementation plan. Break down the development into logical phases, with each phase containing specific components that can be developed concurrently.\n\nFor each component, provide:\n1. A clear name and description\n2. Implementation details\n3. Dependencies on other components\n4. Estimated complexity\n\nOrganize the plan into phases where each phase builds upon the previous one, allowing for incremental development and testing.'
        },
        {
          name: this.templateFiles.uiMockup,
          content: 'Based on the project requirements, create UI mockups for the key screens of the application. Include detailed descriptions of each UI element, interactions, and data displayed.'
        }
      ];
      
      // Create each template file if it doesn't exist
      for (const template of templates) {
        const filePath = path.join(this.path, template.name);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, template.content);
          console.log(`Created template file: ${template.name}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize templates:', error);
      return false;
    }
  }

  updateStepsFile() {
    try {
      // Generate STEPS.md content from phases
      let content = `# Implementation Plan for ${this.config.name}\n\n`;
      
      for (let i = 0; i < this.phases.length; i++) {
        const phase = this.phases[i];
        const completedComponents = phase.components.filter(c => c.isComplete).length;
        const totalComponents = phase.components.length;
        
        content += `### Phase ${i + 1}: ${phase.name} (${completedComponents}/${totalComponents} complete)\n\n`;
        
        for (const component of phase.components) {
          const checkbox = component.isComplete ? '☑' : '☐';
          content += `${checkbox} ${component.name}\n`;
        }
        
        content += '\n';
      }
      
      // Write to STEPS.md
      const stepsPath = path.join(this.path, this.templateFiles.steps);
      fs.writeFileSync(stepsPath, content);
      console.log(`Updated steps file at ${stepsPath}`);
      
      return true;
    } catch (error) {
      console.error('Failed to update steps file:', error);
      return false;
    }
  }

  pushChanges() {
    try {
      // Check if there are changes to commit
      const status = execSync('git status --porcelain', { cwd: this.path }).toString();
      
      if (!status) {
        console.log('No changes to commit');
        return true;
      }
      
      // Add all changes
      execSync('git add .', { cwd: this.path });
      
      // Commit changes
      execSync(`git commit -m "Update project files"`, { cwd: this.path });
      
      // Push changes
      execSync('git push', { cwd: this.path });
      
      console.log('Pushed changes to repository');
      return true;
    } catch (error) {
      console.error('Failed to push changes:', error);
      return false;
    }
  }
}

// Enhanced Project Manager
class ProjectManager {
  constructor(config) {
    this.config = config;
    this.projects = [];
    this.loadProjects();
  }

  loadProjects() {
    try {
      const projectsDir = path.join(process.cwd(), 'projects');
      if (!fs.existsSync(projectsDir)) {
        fs.mkdirSync(projectsDir, { recursive: true });
      }
      
      const dirs = fs.readdirSync(projectsDir);
      this.projects = dirs
        .filter(dir => fs.statSync(path.join(projectsDir, dir)).isDirectory())
        .map(dir => {
          const projectPath = path.join(projectsDir, dir);
          const configPath = path.join(projectPath, 'project.json');
          if (fs.existsSync(configPath)) {
            const projectConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return new Project(projectPath, projectConfig);
          }
          return null;
        })
        .filter(Boolean);
      
      return this.projects;
    } catch (error) {
      console.error('Failed to load projects:', error);
      return [];
    }
  }

  async addProject(repoUrl) {
    try {
      const repoName = repoUrl.split('/').pop().replace('.git', '');
      const projectPath = path.join(process.cwd(), 'projects', repoName);
      
      if (fs.existsSync(projectPath)) {
        throw new Error(`Project ${repoName} already exists`);
      }
      
      // Clone repository
      execSync(`git clone ${repoUrl} ${projectPath}`, { stdio: 'inherit' });
      
      // Initialize project
      const projectConfig = {
        name: repoName,
        repository: repoUrl,
        status: 'Ready',
        createdAt: new Date().toISOString(),
        steps: [],
        totalSteps: 0,
        completedSteps: 0
      };
      
      // Copy template files if they don't exist
      const templateFiles = ['STEP-BY-STEP.prompt', 'uimockupGenerate.prompt', 'REQUIREMENTS.md'];
      for (const file of templateFiles) {
        const targetPath = path.join(projectPath, file);
        if (!fs.existsSync(targetPath)) {
          const templatePath = path.join(process.cwd(), 'templates', file);
          if (fs.existsSync(templatePath)) {
            fs.copyFileSync(templatePath, targetPath);
          }
        }
      }
      
      // Save project config
      fs.writeFileSync(
        path.join(projectPath, 'project.json'),
        JSON.stringify(projectConfig, null, 2)
      );
      
      const project = new Project(projectPath, projectConfig);
      this.projects.push(project);
      return project;
    } catch (error) {
      console.error('Failed to add project:', error);
      throw error;
    }
  }

  getProject(projectName) {
    return this.projects.find(p => p.config.name === projectName);
  }

  removeProject(projectName) {
    const index = this.projects.findIndex(p => p.config.name === projectName);
    if (index !== -1) {
      // Don't delete the files, just remove from memory
      this.projects.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Depla Manager - Main class that integrates all components
class DeplaManager {
  constructor(config = {}) {
    // Load configuration
    this.configManager = new ConfigManager();
    this.config = this.configManager.getConfig();
    
    // Override with provided config
    if (Object.keys(config).length > 0) {
      this.configManager.updateConfig(config);
      this.config = this.configManager.getConfig();
    }
    
    // Initialize components
    this.projectManager = new ProjectManager(this.config);
    this.deplaEnhanced = new DeplaEnhanced();
    
    // Setup state
    this.isProcessingQueue = false;
    this.nextProcessTime = null;
    this.webhookServer = null;
    
    // Initialize enhanced functionality
    this.initialize();
  }
  
  async initialize() {
    try {
      // Initialize DeplaEnhanced
      await this.deplaEnhanced.initialize();
      
      // Setup automation if enabled
      if (this.config.automation && this.config.automation.enabled) {
        this.setupAutomation();
      }
      
      // Start webhook server if enabled
      if (this.config.webhooks && this.config.webhooks.enabled) {
        this.startWebhookServer();
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to initialize DeplaManager:', error);
      return { success: false, error: error.message };
    }
  }
  
  async sendPhaseMessages(projectName, phaseIndex) {
    try {
      const project = this.projectManager.getProject(projectName);
      if (!project) {
        throw new Error(`Project ${projectName} not found`);
      }
      
      const phase = project.phases[phaseIndex];
      if (!phase) {
        throw new Error(`Phase ${phaseIndex} not found in project ${projectName}`);
      }
      
      // Create messages for each component in the phase
      const messages = [];
      
      for (const component of phase.components) {
        if (!component.isComplete && component.send) {
          // Create a message for this component
          const message = {
            type: 'component',
            project_name: projectName,
            phase_name: phase.name,
            phase_index: phaseIndex,
            module_name: component.name,
            content: `Implement ${component.name} for project ${projectName} phase ${phase.name}`
          };
          
          messages.push(message);
          
          // Mark as sent
          component.send = false;
        }
      }
      
      // Update the project
      project.updateStepsFile();
      
      // Send messages using DeplaEnhanced
      if (messages.length > 0) {
        const result = await this.deplaEnhanced.sendMessageBatch(messages);
        return { success: true, messageIds: result.messageIds };
      }
      
      return { success: true, messageIds: [] };
    } catch (error) {
      console.error('Failed to send phase messages:', error);
      return { success: false, error: error.message };
    }
  }
  
  setupAutomation() {
    // Clear existing interval if any
    if (this.automationInterval) {
      clearInterval(this.automationInterval);
    }
    
    // Set up interval for processing automation tasks
    const interval = this.config.automation?.interval || 60000; // Default to 1 minute
    this.automationInterval = setInterval(() => {
      this.processAutomationQueue();
    }, interval);
    
    this.nextProcessTime = new Date(Date.now() + interval);
    
    console.log(`Automation setup with interval: ${interval}ms`);
  }
  
  async processAutomationQueue() {
    // Avoid concurrent processing
    if (this.isProcessingQueue) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      // Process automation tasks using DeplaEnhanced
      await this.deplaEnhanced.processAutomationQueue();
      
      // Update next process time
      const interval = this.config.automation?.interval || 60000;
      this.nextProcessTime = new Date(Date.now() + interval);
    } catch (error) {
      console.error('Error in automation processing:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }
  
  startWebhookServer() {
    if (!this.config.webhooks || !this.config.webhooks.enabled) {
      return false;
    }
    
    if (this.webhookServer) {
      // Already running
      return true;
    }
    
    const express = require('express');
    const bodyParser = require('body-parser');
    
    const app = express();
    const port = this.config.webhooks.port || 3200;
    
    // Middleware to parse JSON and verify webhook signatures
    app.use(bodyParser.json({
      verify: (req, res, buf, encoding) => {
        if (req.headers['x-hub-signature'] && this.config.webhooks.secret) {
          const signature = req.headers['x-hub-signature'];
          const hmac = crypto.createHmac('sha1', this.config.webhooks.secret);
          const digest = 'sha1=' + hmac.update(buf).digest('hex');
          
          req.verifiedWebhook = signature === digest;
        } else {
          req.verifiedWebhook = false;
        }
      }
    }));
    
    // Webhook endpoint
    app.post('/webhook', async (req, res) => {
      try {
        // Verify signature if secret is configured
        if (this.config.webhooks.secret && !req.verifiedWebhook) {
          console.error('Invalid webhook signature');
          return res.status(403).send('Invalid signature');
        }
        
        const event = req.headers['x-github-event'];
        const payload = req.body;
        
        console.log(`Received GitHub ${event} event for ${payload.repository?.full_name || 'unknown repository'}`);
        
        // Handle different event types using DeplaEnhanced
        await this.deplaEnhanced.gitHubEnhanced.handleWebhookEvent(event, payload);
        
        res.status(200).send('Webhook received');
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send('Error processing webhook');
      }
    });
    
    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString()
      });
    });
    
    // Start the server
    this.webhookServer = app.listen(port, () => {
      console.log(`Webhook server running on port ${port}`);
    });
    
    return true;
  }
  
  stopWebhookServer() {
    if (this.webhookServer) {
      this.webhookServer.close();
      this.webhookServer = null;
      console.log('Webhook server stopped');
    }
    return true;
  }
  
  getAutomationStatus() {
    return {
      enabled: this.config.automation?.enabled || false,
      isProcessing: this.isProcessingQueue,
      nextRunTime: this.nextProcessTime,
      queueStatus: this.deplaEnhanced.getQueueStatus(),
      webhooksEnabled: this.config.webhooks?.enabled || false,
      webhookServer: this.webhookServer ? 'running' : 'stopped'
    };
  }
}

// Message Conveyor - Simplified version that uses DeplaEnhanced
class MessageConveyor {
  constructor(config = {}) {
    this.config = config;
    this.deplaEnhanced = new DeplaEnhanced();
    this.templatesDir = path.join(process.cwd(), 'templates', 'messages');
    
    // Ensure templates directory exists
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
  }
  
  getTemplateNames() {
    try {
      const files = fs.readdirSync(this.templatesDir);
      return files.filter(file => file.endsWith('.md')).map(file => file.replace('.md', ''));
    } catch (error) {
      console.error('Failed to get template names:', error);
      return [];
    }
  }
  
  getTemplate(name) {
    try {
      const templatePath = path.join(this.templatesDir, `${name}.md`);
      if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf8');
      }
      return null;
    } catch (error) {
      console.error(`Failed to get template ${name}:`, error);
      return null;
    }
  }
  
  createTemplate(name, content) {
    try {
      const templatePath = path.join(this.templatesDir, `${name}.md`);
      fs.writeFileSync(templatePath, content);
      return true;
    } catch (error) {
      console.error(`Failed to create template ${name}:`, error);
      return false;
    }
  }
  
  updateTemplate(name, content) {
    return this.createTemplate(name, content);
  }
  
  deleteTemplate(name) {
    try {
      const templatePath = path.join(this.templatesDir, `${name}.md`);
      if (fs.existsSync(templatePath)) {
        fs.unlinkSync(templatePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete template ${name}:`, error);
      return false;
    }
  }
  
  async sendMessage(message, priority = 'normal') {
    try {
      return await this.deplaEnhanced.sendMessage(message, priority);
    } catch (error) {
      console.error('Failed to send message:', error);
      return { success: false, error: error.message };
    }
  }
}

// GitHub Integration - Simplified version that uses DeplaEnhanced
class GitHubIntegration {
  constructor(config = {}) {
    this.config = config;
    this.deplaEnhanced = new DeplaEnhanced();
    this.authenticated = false;
  }
  
  async authenticate() {
    try {
      // Initialize DeplaEnhanced if not already initialized
      if (!this.deplaEnhanced.isInitialized) {
        await this.deplaEnhanced.initialize();
      }
      
      this.authenticated = this.deplaEnhanced.gitHubEnhanced.isAuthenticated();
      return this.authenticated;
    } catch (error) {
      console.error('Failed to authenticate with GitHub:', error);
      this.authenticated = false;
      return false;
    }
  }
  
  async getRepositories() {
    try {
      if (!this.authenticated) {
        await this.authenticate();
      }
      
      return await this.deplaEnhanced.gitHubEnhanced.getRepositories();
    } catch (error) {
      console.error('Failed to get repositories:', error);
      return [];
    }
  }
  
  async queuePRForAnalysis(project, prNumber) {
    try {
      return await this.deplaEnhanced.gitHubEnhanced.queuePRForAnalysis(project.config.name, prNumber);
    } catch (error) {
      console.error('Failed to queue PR for analysis:', error);
      return { success: false, error: error.message };
    }
  }
  
  async processAnalysisQueue() {
    try {
      return await this.deplaEnhanced.gitHubEnhanced.processAnalysisQueue();
    } catch (error) {
      console.error('Failed to process analysis queue:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  DeplaManager,
  ProjectManager,
  Project,
  MessageConveyor,
  GitHubIntegration,
  ConfigManager
};
