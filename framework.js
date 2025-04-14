// Depla Project Manager Framework

// Core modules
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const axios = require('axios');
const crypto = require('crypto');

// Project Management
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

// Single Project
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
      
      // In a real implementation, send the REQUIREMENTS.md and STEP-BY-STEP.prompt to WSL2 passthrough
      const requirementsPath = this.getRequirementsPath();
      const promptPath = path.join(this.path, this.templateFiles.stepByStep);
      
      if (!fs.existsSync(requirementsPath) || !fs.existsSync(promptPath)) {
        // Create template files if they don't exist
        this.initializeTemplates();
        throw new Error('Template files were missing and have been created. Please edit them and try again.');
      }
      
      const requirementsContent = fs.readFileSync(requirementsPath, 'utf8');
      const promptContent = fs.readFileSync(promptPath, 'utf8');
      
      // Make a request to the WSL2 server to generate steps
      const wsl2ServerUrl = `http://${this.config.wsl2.endpoint}:${this.config.wsl2.port}/generate-steps`;
      const response = await axios.post(wsl2ServerUrl, {
        repoUrl: this.config.repository,
        requirementsContent,
        promptContent
      });
      
      // This will be processing in the background, so return a placeholder
      // In a real implementation, you would wait for completion or add a webhook
      return `# Implementation Plan for ${this.config.name}\n\nGenerating via Slack... Please wait for completion.\n`;
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

  parseRequirements(content) {
    const requirements = [];
    const lines = content.split('\n');
    let currentCategory = 'General';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for categories (headers)
      if (trimmed.startsWith('##')) {
        currentCategory = trimmed.replace(/^#+\s*/, '').trim();
        continue;
      }
      
      // Check for bullet points with requirements
      if ((trimmed.startsWith('-') || trimmed.startsWith('*')) && trimmed.length > 2) {
        const text = trimmed.substring(1).trim();
        requirements.push({
          text,
          category: currentCategory,
          completed: false
        });
      }
    }
    
    return requirements;
  }

  getRequirementsPath() {
    return path.join(this.path, this.templateFiles.requirements);
  }

  initializeTemplates() {
    // Create basic template files if they don't exist
    const templatesDir = path.join(process.cwd(), 'templates');
    
    for (const [key, filename] of Object.entries(this.templateFiles)) {
      const targetPath = path.join(this.path, filename);
      if (!fs.existsSync(targetPath)) {
        const templatePath = path.join(templatesDir, filename);
        if (fs.existsSync(templatePath)) {
          fs.copyFileSync(templatePath, targetPath);
          console.log(`Created template file: ${filename}`);
        } else {
          // Create empty file
          fs.writeFileSync(targetPath, this.getDefaultTemplateContent(key));
          console.log(`Created empty template file: ${filename}`);
        }
      }
    }
  }

  getDefaultTemplateContent(templateType) {
    switch (templateType) {
      case 'requirements':
        return `# Requirements for ${this.config.name}

## Functional Requirements
- Add your functional requirements here

## Non-Functional Requirements
- Add your non-functional requirements here

## Technical Requirements
- Add your technical requirements here
`;
      case 'steps':
        return `# Implementation Plan for ${this.config.name}

This document will be automatically generated from your requirements.

### Phase 1: Setup (0/0 complete)
`;
      case 'stepByStep':
        return `Please analyze the REQUIREMENTS.md file and generate a detailed implementation plan with phases and steps.

Format your response as follows:

# Implementation Plan for [Project Name]

### Phase 1: [Phase Name] (0/x complete)
☐ [Component/Task 1]
☐ [Component/Task 2]

### Phase 2: [Phase Name] (0/y complete)
☐ [Component/Task 1]
☐ [Component/Task 2]
`;
      default:
        return `# ${templateType} for ${this.config.name}

This is a placeholder template. Please edit as needed.
`;
    }
  }

  async generateTemplatedMessage(component, template) {
    // Create a message from the component and template
    const templateName = template || 'default';
    const templatePath = path.join(process.cwd(), 'templates', `${templateName}.message.template`);
    
    let templateContent;
    if (fs.existsSync(templatePath)) {
      templateContent = fs.readFileSync(templatePath, 'utf8');
    } else {
      templateContent = `Create a ${component.name} component for the ${this.config.name} project based on the requirements.`;
    }
    
    // Replace placeholders
    templateContent = templateContent
      .replace(/\{component\}/g, component.name)
      .replace(/\{project\}/g, this.config.name);
    
    // Add requirements if available
    if (this.requirements.length > 0) {
      const relevantRequirements = this.requirements
        .filter(req => 
          component.name.toLowerCase().includes(req.text.toLowerCase()) ||
          req.text.toLowerCase().includes(component.name.toLowerCase())
        )
        .map(req => `- ${req.text}`)
        .join('\n');
      
      if (relevantRequirements) {
        templateContent += `\n\nRelevant requirements:\n${relevantRequirements}`;
      }
    }
    
    return {
      module_name: component.name,
      project_name: this.config.name,
      content: templateContent,
      phase: component.phase,
      template: templateName
    };
  }

  getPendingComponents() {
    const components = [];
    
    this.phases.forEach((phase, phaseIndex) => {
      phase.components.forEach(component => {
        if (!component.isComplete && component.send) {
          components.push({
            ...component,
            phase: phaseIndex + 1
          });
        }
      });
    });
    
    return components;
  }

  async createMessagesFromPhases(templateName) {
    const components = this.getPendingComponents();
    const messages = [];
    
    for (const component of components) {
      const message = await this.generateTemplatedMessage(component, templateName);
      messages.push(message);
    }
    
    // Add all messages
    messages.forEach(message => this.addMessage(message));
    
    console.log(`Created ${messages.length} messages from ${components.length} components`);
    return messages;
  }

  markComponentComplete(phaseName, componentName) {
    const phase = this.phases.find(p => p.name === phaseName);
    if (!phase) return false;
    
    const component = phase.components.find(c => c.name === componentName);
    if (!component) return false;
    
    component.isComplete = true;
    component.send = false;
    
    // Update the STEPS.md file
    this.updateStepsFile();
    this.recalculateProgress();
    
    return true;
  }

  updateStepsFile() {
    let content = `# Implementation Plan for ${this.config.name}\n\n`;
    
    for (let i = 0; i < this.phases.length; i++) {
      const phase = this.phases[i];
      const completed = phase.components.filter(c => c.isComplete).length;
      const total = phase.components.length;
      
      content += `### Phase ${i + 1}: ${phase.name} (${completed}/${total} complete)\n`;
      
      for (const component of phase.components) {
        const checkbox = component.isComplete ? '☑' : '☐';
        content += `${checkbox} ${component.name}\n`;
      }
      
      content += '\n';
    }
    
    fs.writeFileSync(path.join(this.path, this.templateFiles.steps), content);
  }

  pushChanges() {
    try {
      execSync('git add .', { cwd: this.path });
      execSync('git commit -m "Update requirements and steps"', { cwd: this.path });
      execSync('git push', { cwd: this.path });
      console.log(`Pushed changes for project ${this.config.name}`);
      return true;
    } catch (error) {
      console.error('Failed to push changes:', error);
      return false;
    }
  }

  createBranch(branchName) {
    try {
      execSync(`git checkout -b ${branchName}`, { cwd: this.path });
      console.log(`Created and switched to branch: ${branchName}`);
      return true;
    } catch (error) {
      console.error(`Failed to create branch ${branchName}:`, error);
      return false;
    }
  }

  checkoutBranch(branchName) {
    try {
      execSync(`git checkout ${branchName}`, { cwd: this.path });
      console.log(`Switched to branch: ${branchName}`);
      return true;
    } catch (error) {
      console.error(`Failed to checkout branch ${branchName}:`, error);
      return false;
    }
  }

  getCurrentBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { cwd: this.path }).toString().trim();
    } catch (error) {
      console.error('Failed to get current branch:', error);
      return null;
    }
  }

  getBranches() {
    try {
      const branches = execSync('git branch', { cwd: this.path })
        .toString()
        .split('\n')
        .map(b => b.trim())
        .filter(b => b.length > 0)
        .map(b => b.startsWith('*') ? { name: b.substring(1).trim(), current: true } : { name: b, current: false });
      
      return branches;
    } catch (error) {
      console.error('Failed to get branches:', error);
      return [];
    }
  }
}

// Message Conveyor for WSL2/Slack interaction
class MessageConveyor {
  constructor(config) {
    this.config = config;
    this.connected = false;
    this.queue = [];
    this.sentMessages = [];
    this.batchHistory = [];
    this.activeTransmission = false;
    this.templates = {};
    this.loadMessageTemplates();
  }

  async connect() {
    try {
      // Try to connect to the WSL2 server
      const wsl2ServerUrl = `http://${this.config.wsl2.endpoint}:${this.config.wsl2.port}/health`;
      const response = await axios.get(wsl2ServerUrl, { timeout: 5000 });
      
      if (response.status === 200 && response.data.status === 'UP') {
        console.log(`Connected to WSL2 server at ${this.config.wsl2.endpoint}:${this.config.wsl2.port}`);
        this.connected = true;
        return true;
      } else {
        throw new Error('WSL2 server is not responding correctly');
      }
    } catch (error) {
      console.error('Failed to connect to WSL2:', error.message);
      this.connected = false;
      return false;
    }
  }

  async sendMessage(message) {
    if (!this.connected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Not connected to WSL2 server');
      }
    }
    
    try {
      // Send the message to the WSL2 server
      const wsl2ServerUrl = `http://${this.config.wsl2.endpoint}:${this.config.wsl2.port}/send-message`;
      const response = await axios.post(wsl2ServerUrl, message);
      
      if (response.status === 200) {
        console.log(`Message sent to WSL2 for Slack: ${message.module_name}`);
        
        // Update message status
        message.status = 'Sent';
        message.sentAt = new Date().toISOString();
        
        // Keep track of sent messages
        this.sentMessages.push({
          ...message,
          id: message.id || Date.now().toString(),
          sentAt: new Date().toISOString()
        });
        
        return true;
      } else {
        throw new Error(`Failed to send message: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error.message);
      return false;
    }
  }

  async sendBatch(messages, batchName = '', delay = null) {
    if (!this.connected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Not connected to WSL2 server');
      }
    }
    
    // Don't send a batch while another is in progress
    if (this.activeTransmission) {
      throw new Error('Another batch is currently being transmitted');
    }
    
    try {
      this.activeTransmission = true;
      
      const batchId = Date.now().toString();
      const messageDelay = delay || this.config.messageDelay || 5000;
      
      // Send the batch to the WSL2 server
      const wsl2ServerUrl = `http://${this.config.wsl2.endpoint}:${this.config.wsl2.port}/send-batch`;
      const response = await axios.post(wsl2ServerUrl, {
        messages,
        delay: messageDelay,
        batchId,
        batchName
      });
      
      if (response.status === 202) {
        console.log(`Batch of ${messages.length} messages sent to WSL2 for processing`);
        
        // Record the batch
        this.batchHistory.push({
          id: batchId,
          name: batchName || `Batch ${this.batchHistory.length + 1}`,
          messageCount: messages.length,
          delay: messageDelay,
          startedAt: new Date().toISOString(),
          status: 'In Progress'
        });
        
        // Start a timer to check for batch completion
        this.startBatchStatusCheck(batchId);
        
        return {
          batchId,
          status: 'Processing',
          messageCount: messages.length,
          estimatedTime: messages.length * (messageDelay / 1000)
        };
      } else {
        throw new Error(`Failed to send batch: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send batch:', error.message);
      this.activeTransmission = false;
      throw error;
    }
  }

  async startBatchStatusCheck(batchId) {
    const checkInterval = setInterval(async () => {
      try {
        const wsl2ServerUrl = `http://${this.config.wsl2.endpoint}:${this.config.wsl2.port}/batch-status`;
        const response = await axios.get(wsl2ServerUrl, { params: { batchId } });
        
        if (response.status === 200) {
          const { status, progress, completed, total } = response.data;
          
          // Update the batch status
          const batchIndex = this.batchHistory.findIndex(b => b.id === batchId);
          if (batchIndex !== -1) {
            this.batchHistory[batchIndex].status = status;
            this.batchHistory[batchIndex].progress = progress;
            this.batchHistory[batchIndex].completedMessages = completed;
            
            if (status === 'Completed') {
              this.batchHistory[batchIndex].completedAt = new Date().toISOString();
              this.activeTransmission = false;
              clearInterval(checkInterval);
              console.log(`Batch ${batchId} completed successfully`);
            } else if (status === 'Failed') {
              this.batchHistory[batchIndex].completedAt = new Date().toISOString();
              this.batchHistory[batchIndex].error = response.data.error;
              this.activeTransmission = false;
              clearInterval(checkInterval);
              console.error(`Batch ${batchId} failed: ${response.data.error}`);
            }
          }
        }
      } catch (error) {
        console.error('Error checking batch status:', error.message);
        // If can't reach the server, assume batch is completed after 10 failed attempts
        this.batchFailedChecks = (this.batchFailedChecks || 0) + 1;
        if (this.batchFailedChecks >= 10) {
          this.activeTransmission = false;
          clearInterval(checkInterval);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  async testConnection() {
    try {
      const wsl2ServerUrl = `http://${this.config.wsl2.endpoint}:${this.config.wsl2.port}/test`;
      const response = await axios.get(wsl2ServerUrl, { timeout: 5000 });
      
      if (response.status === 200 && response.data.status === 'OK') {
        console.log('WSL2 server test successful');
        this.connected = true;
        return { success: true, details: response.data };
      } else {
        throw new Error('WSL2 server test failed');
      }
    } catch (error) {
      console.error('Connection test failed:', error.message);
      this.connected = false;
      return { success: false, error: error.message };
    }
  }

  loadMessageTemplates() {
    try {
      const templatesDir = path.join(process.cwd(), 'templates');
      
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }
      
      const files = fs.readdirSync(templatesDir);
      const templateFiles = files.filter(file => file.endsWith('.message.template'));
      
      for (const file of templateFiles) {
        const templateName = file.replace('.message.template', '');
        const templateContent = fs.readFileSync(path.join(templatesDir, file), 'utf8');
        this.templates[templateName] = templateContent;
      }
      
      console.log(`Loaded ${Object.keys(this.templates).length} message templates`);
      
      // Create default template if none exist
      if (Object.keys(this.templates).length === 0) {
        this.createDefaultTemplate();
      }
      
      return this.templates;
    } catch (error) {
      console.error('Failed to load message templates:', error);
      this.createDefaultTemplate();
      return this.templates;
    }
  }

  createDefaultTemplate() {
    try {
      const defaultTemplate = `Implement the {component} for {project} project.

Please follow these guidelines:
- Ensure that the implementation matches the requirements
- Write clean, maintainable code
- Include appropriate tests
- Document your code appropriately

{project} is an important project, and this component is a key part of it.`;
      
      const templatesDir = path.join(process.cwd(), 'templates');
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(templatesDir, 'default.message.template'), defaultTemplate);
      this.templates.default = defaultTemplate;
      
      console.log('Created default message template');
    } catch (error) {
      console.error('Failed to create default template:', error);
    }
  }

  getTemplateNames() {
    return Object.keys(this.templates);
  }

  getTemplate(name) {
    return this.templates[name] || this.templates.default;
  }

  createTemplate(name, content) {
    try {
      const templatesDir = path.join(process.cwd(), 'templates');
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }
      
      const fileName = `${name}.message.template`;
      fs.writeFileSync(path.join(templatesDir, fileName), content);
      this.templates[name] = content;
      
      console.log(`Created message template: ${name}`);
      return true;
    } catch (error) {
      console.error(`Failed to create template ${name}:`, error);
      return false;
    }
  }

  updateTemplate(name, content) {
    if (!this.templates[name]) {
      return this.createTemplate(name, content);
    }
    
    try {
      const templatesDir = path.join(process.cwd(), 'templates');
      const fileName = `${name}.message.template`;
      fs.writeFileSync(path.join(templatesDir, fileName), content);
      this.templates[name] = content;
      
      console.log(`Updated message template: ${name}`);
      return true;
    } catch (error) {
      console.error(`Failed to update template ${name}:`, error);
      return false;
    }
  }

  deleteTemplate(name) {
    if (name === 'default') {
      console.error('Cannot delete the default template');
      return false;
    }
    
    if (!this.templates[name]) {
      console.error(`Template ${name} does not exist`);
      return false;
    }
    
    try {
      const templatesDir = path.join(process.cwd(), 'templates');
      const fileName = `${name}.message.template`;
      fs.unlinkSync(path.join(templatesDir, fileName));
      delete this.templates[name];
      
      console.log(`Deleted message template: ${name}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete template ${name}:`, error);
      return false;
    }
  }

  async sendTemplatedMessage(project, component, templateName = 'default') {
    try {
      // Get the template content
      const template = this.getTemplate(templateName);
      
      // Replace placeholders
      let messageContent = template
        .replace(/\{component\}/g, component.name)
        .replace(/\{project\}/g, project.config.name);
      
      // Get the requirements if available
      if (project.requirements && project.requirements.length > 0) {
        const relevantRequirements = project.requirements
          .filter(req => 
            component.name.toLowerCase().includes(req.text.toLowerCase()) ||
            req.text.toLowerCase().includes(component.name.toLowerCase())
          )
          .map(req => `- ${req.text}`)
          .join('\n');
        
        if (relevantRequirements) {
          messageContent += `\n\nRelevant requirements:\n${relevantRequirements}`;
        }
      }
      
      // Create the message object
      const message = {
        module_name: component.name,
        project_name: project.config.name,
        content: messageContent,
        template: templateName
      };
      
      // Send the message
      return await this.sendMessage(message);
    } catch (error) {
      console.error('Failed to send templated message:', error);
      return false;
    }
  }

  async createComponentBatch(project, phase) {
    try {
      const components = [];
      
      // If a specific phase is provided, only get components from that phase
      if (phase) {
        const phaseIndex = parseInt(phase) - 1;
        if (phaseIndex >= 0 && phaseIndex < project.phases.length) {
          const phaseObj = project.phases[phaseIndex];
          phaseObj.components.forEach(comp => {
            if (!comp.isComplete && comp.send) {
              components.push({
                ...comp,
                phase: phaseIndex + 1,
                phaseName: phaseObj.name
              });
            }
          });
        }
      } else {
        // Get components from all phases
        project.phases.forEach((phaseObj, phaseIndex) => {
          phaseObj.components.forEach(comp => {
            if (!comp.isComplete && comp.send) {
              components.push({
                ...comp,
                phase: phaseIndex + 1,
                phaseName: phaseObj.name
              });
            }
          });
        });
      }
      
      console.log(`Found ${components.length} components to include in batch`);
      return components;
    } catch (error) {
      console.error('Failed to create component batch:', error);
      return [];
    }
  }

  getCompletedBatches() {
    return this.batchHistory.filter(batch => batch.status === 'Completed');
  }

  getActiveBatch() {
    return this.batchHistory.find(batch => batch.status === 'In Progress');
  }

  getFlattenedBatchMessages() {
    const sentByBatch = {};
    
    for (const message of this.sentMessages) {
      if (message.batchId) {
        if (!sentByBatch[message.batchId]) {
          sentByBatch[message.batchId] = [];
        }
        sentByBatch[message.batchId].push(message);
      }
    }
    
    return sentByBatch;
  }
}

// GitHub Integration
class GitHubIntegration {
  constructor(config) {
    this.config = config;
    this.authenticated = false;
    this.octokit = null;
    this.webhooks = [];
    this.prAnalysisQueue = [];
  }

  async authenticate() {
    try {
      const { Octokit } = require("@octokit/rest");
      
      if (!this.config.github || !this.config.github.token) {
        throw new Error('GitHub token not configured. Please set up your token in settings.');
      }
      
      this.octokit = new Octokit({ 
        auth: this.config.github.token,
        userAgent: 'Depla-Project-Manager'
      });
      
      // Verify authentication by getting user data
      const { data: user } = await this.octokit.users.getAuthenticated();
      
      console.log(`Authenticated with GitHub as ${user.login}`);
      this.authenticated = true;
      
      // Store username if not already set
      if (!this.config.github.username) {
        this.config.github.username = user.login;
      }
      
      return user;
    } catch (error) {
      console.error('Failed to authenticate with GitHub:', error.message);
      this.authenticated = false;
      throw error;
    }
  }

  async getRepositories() {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    try {
      const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });
      
      return repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        description: repo.description,
        isPrivate: repo.private,
        hasWebhook: this.webhooks.includes(repo.id),
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at
      }));
    } catch (error) {
      console.error('Failed to fetch repositories:', error.message);
      throw error;
    }
  }
  
  async createRepository(name, isPrivate = false, description = '') {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    try {
      const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: true // Initialize with README
      });
      
      console.log(`Created repository: ${repo.full_name}`);
      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        description: repo.description,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch
      };
    } catch (error) {
      console.error(`Failed to create repository "${name}":`, error.message);
      throw error;
    }
  }
  
  async setupWebhook(repoFullName, webhookUrl) {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      const { data: webhook } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: this.config.github.webhookSecret || ''
        },
        events: ['push', 'pull_request', 'create', 'delete'],
        active: true
      });
      
      console.log(`Webhook created for ${repoFullName}`);
      this.webhooks.push(repo.id);
      return webhook;
    } catch (error) {
      console.error(`Failed to create webhook for ${repoFullName}:`, error.message);
      throw error;
    }
  }
  
  async getPullRequests(repoFullName, state = 'open') {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      const { data: pullRequests } = await this.octokit.pulls.list({
        owner,
        repo,
        state, // 'open', 'closed', or 'all'
        sort: 'updated',
        direction: 'desc',
        per_page: 50
      });
      
      return pullRequests.map(pr => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        closedAt: pr.closed_at,
        mergedAt: pr.merged_at,
        authorLogin: pr.user?.login,
        authorAvatar: pr.user?.avatar_url,
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref
      }));
    } catch (error) {
      console.error(`Failed to fetch PRs for ${repoFullName}:`, error.message);
      throw error;
    }
  }
  
  async analyzePullRequest(repoFullName, prNumber, requirementsPath) {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      // Get PR details
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Get PR files
      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Get PR commits
      const { data: commits } = await this.octokit.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Get requirements from file
      let requirements = [];
      if (requirementsPath) {
        const fs = require('fs');
        if (fs.existsSync(requirementsPath)) {
          const content = fs.readFileSync(requirementsPath, 'utf8');
          requirements = this.parseRequirements(content);
        }
      }
      
      // Analyze PR against requirements
      const analysis = {
        prNumber,
        title: pr.title,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        changedFiles: files.length,
        commits: commits.length,
        additions: pr.additions,
        deletions: pr.deletions,
        requirements: requirements,
        score: 0,
        feedback: [],
        status: 'pending'
      };
      
      // Score the PR based on requirements
      if (requirements.length > 0) {
        let totalScore = 0;
        
        for (const req of requirements) {
          // Simple matching based on PR title and file names
          let isImplemented = pr.title.toLowerCase().includes(req.text.toLowerCase());
          
          // Check if any files match the requirement
          for (const file of files) {
            if (file.filename.toLowerCase().includes(req.text.toLowerCase())) {
              isImplemented = true;
              break;
            }
          }
          
          if (isImplemented) {
            totalScore += 1;
            analysis.feedback.push(`✅ Requirement "${req.text}" appears to be implemented`);
          } else {
            analysis.feedback.push(`❌ Requirement "${req.text}" may not be implemented`);
          }
        }
        
        analysis.score = Math.round((totalScore / requirements.length) * 100);
        analysis.status = analysis.score >= 80 ? 'pass' : 'needs-review';
      } else {
        analysis.feedback.push('⚠️ No requirements found for comparison');
      }
      
      console.log(`PR #${prNumber} analysis complete with score: ${analysis.score}%`);
      return analysis;
    } catch (error) {
      console.error(`Failed to analyze PR #${prNumber}:`, error.message);
      throw error;
    }
  }
  
  parseRequirements(content) {
    // Simple requirement parsing - can be enhanced
    const requirements = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Look for markdown list items or headers
      const trimmed = line.trim();
      if ((trimmed.startsWith('-') || trimmed.startsWith('*')) && trimmed.length > 2) {
        const text = trimmed.substring(1).trim();
        requirements.push({ text, type: 'feature' });
      } else if (trimmed.startsWith('#') && trimmed.includes(':')) {
        const text = trimmed.substring(trimmed.indexOf(':') + 1).trim();
        requirements.push({ text, type: 'header' });
      }
    }
    
    return requirements;
  }
  
  async createComment(repoFullName, prNumber, body) {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      const { data: comment } = await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body
      });
      
      console.log(`Comment created on PR #${prNumber}`);
      return comment;
    } catch (error) {
      console.error(`Failed to create comment on PR #${prNumber}:`, error.message);
      throw error;
    }
  }
  
  async queuePRForAnalysis(project, prNumber) {
    this.prAnalysisQueue.push({
      project,
      prNumber,
      status: 'queued',
      timestamp: new Date().toISOString()
    });
    
    console.log(`PR #${prNumber} queued for analysis`);
    return this.prAnalysisQueue.length;
  }
  
  async processAnalysisQueue() {
    if (this.prAnalysisQueue.length === 0) {
      return [];
    }
    
    const results = [];
    
    for (const item of this.prAnalysisQueue) {
      if (item.status === 'queued') {
        try {
          item.status = 'processing';
          
          // Get the project's repository full name
          const repoFullName = item.project.config.repository.includes('/')
            ? item.project.config.repository
            : `${this.config.github.username}/${item.project.config.name}`;
            
          // Get the requirements path
          const requirementsPath = item.project.getRequirementsPath();
          
          // Analyze the PR
          const analysis = await this.analyzePullRequest(
            repoFullName,
            item.prNumber,
            requirementsPath
          );
          
          // Create a comment with the analysis
          if (this.config.github.autoComment) {
            const comment = `## 🔍 Depla Analysis Results
              
**Score**: ${analysis.score}% (${analysis.status === 'pass' ? '✅ Pass' : '⚠️ Needs Review'})

**Feedback**:
${analysis.feedback.map(f => `- ${f}`).join('\n')}

---
*This analysis was automatically generated by Depla Project Manager.*
`;
            
            await this.createComment(repoFullName, item.prNumber, comment);
          }
          
          item.status = 'completed';
          item.result = analysis;
          results.push(analysis);
          
          console.log(`PR #${item.prNumber} analysis completed`);
        } catch (error) {
          console.error(`Error analyzing PR #${item.prNumber}:`, error.message);
          item.status = 'error';
          item.error = error.message;
        }
      }
    }
    
    // Remove completed and error items
    this.prAnalysisQueue = this.prAnalysisQueue.filter(
      item => item.status !== 'completed' && item.status !== 'error'
    );
    
    return results;
  }
}

// Configuration Management
class ConfigManager {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
      
      // Default config
      const defaultConfig = {
        wsl2: {
          endpoint: 'localhost',
          port: 8080
        },
        slack: {
          channel: '#project-development'
        },
        github: {
          username: '',
          token: '',
          webhookSecret: '',
          autoComment: true
        },
        messageDelay: 5000,
        webhooks: {
          enabled: false,
          port: 3200,
          url: '',
          secret: ''
        },
        automation: {
          enabled: false,
          interval: 3600000, // 1 hour
          autoStartNextPhase: false,
          analyzePRs: true
        },
        notifications: {
          email: {
            enabled: false,
            recipients: [],
            smtpConfig: {}
          },
          desktop: {
            enabled: true
          }
        },
        templates: {
          defaultLocation: 'templates',
          messageTemplates: 'templates/messages',
          projectTemplates: 'templates/projects'
        },
        server: {
          port: 3000,
          sessionSecret: crypto.randomBytes(16).toString('hex')
        }
      };
      
      this.saveConfig(defaultConfig);
      return defaultConfig;
    } catch (error) {
      console.error('Failed to load config:', error);
      return {};
    }
  }

  saveConfig(config) {
    this.config = config;
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  getConfig() {
    return this.config;
  }

  updateConfig(newConfig) {
    this.saveConfig({ ...this.config, ...newConfig });
  }

  // Update a specific section of the config
  updateConfigSection(section, values) {
    const updatedSection = { ...this.config[section], ...values };
    this.config[section] = updatedSection;
    this.saveConfig(this.config);
    return this.config;
  }

  // Reset config to defaults
  resetConfig() {
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
    }
    this.config = this.loadConfig();
    return this.config;
  }

  // Get value from config by dot notation path
  getValue(path, defaultValue = null) {
    const keys = path.split('.');
    let current = this.config;
    
    for (const key of keys) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current !== undefined ? current : defaultValue;
  }

  // Set value in config by dot notation path
  setValue(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    let current = this.config;
    
    for (const key of keys) {
      if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[lastKey] = value;
    this.saveConfig(this.config);
  }
}

// Main Application
class DeplaManager {
  constructor() {
    this.configManager = new ConfigManager();
    this.config = this.configManager.getConfig();
    
    this.projectManager = new ProjectManager(this.config);
    this.messageConveyor = new MessageConveyor(this.config);
    this.gitHubIntegration = new GitHubIntegration(this.config);
    
    this.automationQueue = [];
    this.webhookServer = null;
    this.isProcessingQueue = false;
    this.nextProcessTime = null;
    
    // Set up automated processing
    if (this.config.automation && this.config.automation.enabled) {
      this.setupAutomation();
    }
  }

  async initialize() {
    // Load projects
    await this.projectManager.loadProjects();
    
    // Connect to services
    await this.messageConveyor.connect();
    await this.gitHubIntegration.authenticate();
    
    // Start webhook server if enabled
    if (this.config.webhooks && this.config.webhooks.enabled) {
      this.startWebhookServer();
    }
    
    return {
      projects: this.projectManager.projects,
      config: this.config
    };
  }

  async addProject(repoUrl) {
    return await this.projectManager.addProject(repoUrl);
  }

  getProject(projectName) {
    return this.projectManager.getProject(projectName);
  }

  async getRepositories() {
    return await this.gitHubIntegration.getRepositories();
  }

  async sendMessage(projectName, messageId) {
    const project = this.getProject(projectName);
    if (project) {
      const message = project.messages.find(m => m.id === messageId);
      if (message) {
        const result = await this.messageConveyor.sendMessage(message);
        if (result) {
          project.updateMessage(messageId, { 
            status: 'Sent',
            sentAt: new Date().toISOString()
          });
        }
        return result;
      }
    }
    return false;
  }

  async sendAllMessages(projectName) {
    const project = this.getProject(projectName);
    if (project) {
      const pendingMessages = project.messages.filter(m => m.status === 'Ready to Send');
      if (pendingMessages.length > 0) {
        const batchName = `${projectName} Batch ${new Date().toLocaleTimeString()}`;
        const result = await this.messageConveyor.sendBatch(pendingMessages, batchName);
        if (result) {
          for (const message of pendingMessages) {
            project.updateMessage(message.id, {
              status: 'Sent',
              sentAt: new Date().toISOString(),
              batchId: result.batchId
            });
          }
        }
        return result;
      }
    }
    return false;
  }

  async sendPhaseMessages(projectName, phaseIndex) {
    const project = this.getProject(projectName);
    if (project && project.phases.length > phaseIndex) {
      const phase = project.phases[phaseIndex];
      const components = phase.components.filter(c => !c.isComplete && c.send);
      
      if (components.length > 0) {
        // Create messages for the components
        const messages = [];
        
        for (const component of components) {
          const message = await project.generateTemplatedMessage({
            ...component,
            phase: phaseIndex + 1
          });
          
          messages.push(message);
        }
        
        // Add messages to the project
        for (const message of messages) {
          project.addMessage(message);
        }
        
        // Send the batch
        const batchName = `${projectName} Phase ${phaseIndex + 1} Batch`;
        const result = await this.messageConveyor.sendBatch(messages, batchName);
        
        if (result) {
          for (const message of messages) {
            const messageObj = project.messages.find(m => m.module_name === message.module_name && m.status === 'Ready to Send');
            if (messageObj) {
              project.updateMessage(messageObj.id, {
                status: 'Sent',
                sentAt: new Date().toISOString(),
                batchId: result.batchId
              });
            }
          }
        }
        
        return {
          ...result,
          phaseIndex: phaseIndex + 1,
          phaseName: phase.name,
          componentCount: components.length
        };
      }
    }
    return false;
  }

  async testWsl2Connection() {
    return await this.messageConveyor.testConnection();
  }

  updateConfig(newConfig) {
    this.configManager.updateConfig(newConfig);
    this.config = this.configManager.getConfig();
    
    // Update components with new config
    this.messageConveyor.config = this.config;
    this.gitHubIntegration.config = this.config;
    
    // Handle automation settings change
    if (newConfig.automation && newConfig.automation.enabled !== this.config.automation?.enabled) {
      if (newConfig.automation.enabled) {
        this.setupAutomation();
      } else {
        this.stopAutomation();
      }
    }
    
    // Handle webhook settings change
    if (newConfig.webhooks && newConfig.webhooks.enabled !== this.config.webhooks?.enabled) {
      if (newConfig.webhooks.enabled) {
        this.startWebhookServer();
      } else {
        this.stopWebhookServer();
      }
    }
    
    return this.config;
  }

  async createGitHubRepository(name, isPrivate = false, description = '') {
    if (!this.gitHubIntegration.authenticated) {
      await this.gitHubIntegration.authenticate();
    }
    
    const repo = await this.gitHubIntegration.createRepository(name, isPrivate, description);
    
    // Add the repository to our projects
    const project = await this.projectManager.addProject(repo.cloneUrl);
    
    // Initialize with template files
    project.initializeTemplates();
    
    // Push changes
    project.pushChanges();
    
    return project;
  }

  async setupWebhookForRepository(projectName) {
    const project = this.getProject(projectName);
    if (!project) return false;
    
    if (!this.gitHubIntegration.authenticated) {
      await this.gitHubIntegration.authenticate();
    }
    
    // Get the repository full name
    const repoName = project.config.repository;
    const repoFullName = repoName.includes('/') 
      ? repoName 
      : `${this.config.github.username}/${repoName}`;
    
    // Set up the webhook
    const webhookUrl = this.config.webhooks.url || `http://localhost:${this.config.webhooks.port || 3200}/webhook`;
    
    const webhook = await this.gitHubIntegration.setupWebhook(repoFullName, webhookUrl);
    
    return webhook;
  }

  async analyzePullRequest(projectName, prNumber) {
    const project = this.getProject(projectName);
    if (!project) return false;
    
    if (!this.gitHubIntegration.authenticated) {
      await this.gitHubIntegration.authenticate();
    }
    
    // Queue the PR for analysis
    await this.gitHubIntegration.queuePRForAnalysis(project, prNumber);
    
    // Process the queue
    const results = await this.gitHubIntegration.processAnalysisQueue();
    
    return results.find(r => r.prNumber === parseInt(prNumber));
  }

  setupAutomation() {
    if (!this.config.automation || !this.config.automation.enabled) {
      return false;
    }
    
    const interval = this.config.automation.interval || 3600000; // Default: 1 hour
    
    // Clear existing timer
    if (this.automationTimer) {
      clearInterval(this.automationTimer);
    }
    
    // Set up new timer
    this.automationTimer = setInterval(() => {
      this.processAutomationQueue();
    }, interval);
    
    // Immediately process queue once
    this.processAutomationQueue();
    
    console.log(`Automation set up to run every ${interval / 60000} minutes`);
    return true;
  }

  stopAutomation() {
    if (this.automationTimer) {
      clearInterval(this.automationTimer);
      this.automationTimer = null;
      console.log('Automation stopped');
    }
    return true;
  }

  async processAutomationQueue() {
    if (this.isProcessingQueue) {
      console.log('Already processing automation queue, skipping...');
      return false;
    }
    
    this.isProcessingQueue = true;
    try {
      console.log('Processing automation queue...');
      
      // Process GitHub PR analysis queue
      await this.gitHubIntegration.processAnalysisQueue();
      
      // Check for completed message batches and process next phases
      this.checkCompletedBatches();
      
      // Check for any new repositories to analyze
      await this.checkForNewRepositories();
      
      console.log('Automation queue processing complete');
      this.nextProcessTime = new Date(Date.now() + (this.config.automation.interval || 3600000));
    } catch (error) {
      console.error('Error processing automation queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async checkCompletedBatches() {
    const completedBatches = this.messageConveyor.getCompletedBatches();
    
    // Process each completed batch that hasn't been processed yet
    for (const batch of completedBatches) {
      if (!batch.processed) {
        console.log(`Processing completed batch: ${batch.name}`);
        
        // Find the project this batch belongs to
        const projectName = batch.name.split(' ')[0];  // Assumes format: "ProjectName Batch ..."
        const project = this.getProject(projectName);
        
        if (project) {
          // Update the components as completed
          const batchMessages = this.messageConveyor.sentMessages.filter(m => m.batchId === batch.id);
          
          for (const message of batchMessages) {
            if (message.module_name) {
              // Find the phase this component belongs to
              for (const phase of project.phases) {
                const component = phase.components.find(c => c.name === message.module_name);
                if (component) {
                  component.isComplete = true;
                  component.send = false;
                  break;
                }
              }
            }
          }
          
          // Update the project steps file
          project.updateStepsFile();
          project.recalculateProgress();
          
          // Push changes to GitHub
          project.pushChanges();
          
          // Mark batch as processed
          batch.processed = true;
        }
      }
    }
  }

  async checkForNewRepositories() {
    if (!this.gitHubIntegration.authenticated) {
      await this.gitHubIntegration.authenticate();
    }
    
    // Get all repositories
    const repositories = await this.gitHubIntegration.getRepositories();
    
    // Find repositories not already in our projects
    const existingProjectRepos = this.projectManager.projects.map(p => p.config.repository);
    
    const newRepos = repositories.filter(repo => 
      !existingProjectRepos.includes(repo.fullName) && 
      !existingProjectRepos.includes(repo.name)
    );
    
    if (newRepos.length > 0) {
      console.log(`Found ${newRepos.length} new repositories to add`);
      
      for (const repo of newRepos) {
        // Add the repository
        const project = await this.projectManager.addProject(repo.cloneUrl);
        console.log(`Added project: ${project.config.name}`);
        
        // Initialize templates
        project.initializeTemplates();
        
        // Push changes
        project.pushChanges();
        
        // Set up webhook if enabled
        if (this.config.webhooks && this.config.webhooks.enabled) {
          await this.setupWebhookForRepository(project.config.name);
        }
      }
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
    const crypto = require('crypto');
    
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
        
        // Handle different event types
        switch (event) {
          case 'pull_request':
            this.handlePullRequestWebhook(payload);
            break;
          case 'push':
            this.handlePushWebhook(payload);
            break;
          case 'create':
            this.handleCreateWebhook(payload);
            break;
        }
        
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

  async handlePullRequestWebhook(payload) {
    const action = payload.action;
    const prNumber = payload.pull_request.number;
    const repoName = payload.repository.name;
    
    console.log(`Processing pull request #${prNumber} (${action}) for ${repoName}`);
    
    // Only process opened or synchronized PRs
    if (action !== 'opened' && action !== 'synchronize') {
      return;
    }
    
    // Find the project
    const project = this.projectManager.getProject(repoName);
    if (!project) {
      console.log(`Project ${repoName} not found`);
      return;
    }
    
    // Queue PR for analysis
    await this.gitHubIntegration.queuePRForAnalysis(project, prNumber);
    
    // If automation is enabled, process the queue immediately
    if (this.config.automation && this.config.automation.enabled) {
      await this.gitHubIntegration.processAnalysisQueue();
    }
  }

  async handlePushWebhook(payload) {
    const repoName = payload.repository.name;
    const branch = payload.ref.replace('refs/heads/', '');
    
    console.log(`Processing push to ${branch} for ${repoName}`);
    
    // Find the project
    const project = this.projectManager.getProject(repoName);
    if (!project) {
      console.log(`Project ${repoName} not found`);
      return;
    }
    
    // Check if it's a push to main/master branch
    if (branch === 'main' || branch === 'master') {
      // Reload project data from GitHub
      const updatedProject = await this.projectManager.refreshProject(repoName);
      
      // If automation is enabled and it's configured to start next phase automatically
      if (this.config.automation && this.config.automation.enabled && this.config.automation.autoStartNextPhase) {
        // Find the current active phase
        const currentPhaseIndex = updatedProject.phases.findIndex(p => 
          p.components.some(c => !c.isComplete)
        );
        
        if (currentPhaseIndex !== -1) {
          // Check if most components in this phase are complete
          const phase = updatedProject.phases[currentPhaseIndex];
          const completeCount = phase.components.filter(c => c.isComplete).length;
          const totalCount = phase.components.length;
          
          if (completeCount / totalCount >= 0.8) {  // 80% complete
            // Start next phase
            const nextPhaseIndex = currentPhaseIndex + 1;
            if (nextPhaseIndex < updatedProject.phases.length) {
              await this.sendPhaseMessages(repoName, nextPhaseIndex);
              console.log(`Automatically started phase ${nextPhaseIndex + 1} for ${repoName}`);
            }
          }
        }
      }
    }
  }

  async handleCreateWebhook(payload) {
    const repoName = payload.repository.name;
    const refType = payload.ref_type;  // "branch" or "tag"
    const ref = payload.ref;  // The branch or tag name
    
    console.log(`Processing ${refType} creation: ${ref} for ${repoName}`);
    
    // Find the project
    const project = this.projectManager.getProject(repoName);
    if (!project) {
      console.log(`Project ${repoName} not found`);
      return;
    }
    
    // If it's a new branch based on the naming convention for a component
    if (refType === 'branch') {
      // Check if this is a feature branch
      const isFeatureBranch = ref.startsWith('feature/') || ref.includes('-feature-');
      
      if (isFeatureBranch) {
        // Extract feature name from branch
        let featureName = ref.startsWith('feature/') 
          ? ref.substring('feature/'.length) 
          : ref.split('-feature-')[1];
          
        featureName = featureName.replace(/-/g, ' ');
        
        // Find components that match this feature
        for (const phase of project.phases) {
          for (const component of phase.components) {
            if (component.name.toLowerCase().includes(featureName.toLowerCase())) {
              // Mark this component as in progress
              component.inProgress = true;
              project.updateStepsFile();
              
              console.log(`Marked component "${component.name}" as in progress`);
              break;
            }
          }
        }
      }
    }
  }

  getMessageTemplates() {
    return this.messageConveyor.getTemplateNames();
  }

  getMessageTemplate(name) {
    return this.messageConveyor.getTemplate(name);
  }

  createMessageTemplate(name, content) {
    return this.messageConveyor.createTemplate(name, content);
  }

  updateMessageTemplate(name, content) {
    return this.messageConveyor.updateTemplate(name, content);
  }

  deleteMessageTemplate(name) {
    return this.messageConveyor.deleteTemplate(name);
  }

  getAutomationStatus() {
    return {
      enabled: this.config.automation?.enabled || false,
      isProcessing: this.isProcessingQueue,
      nextRunTime: this.nextProcessTime,
      queueLength: this.gitHubIntegration.prAnalysisQueue.length,
      webhooksEnabled: this.config.webhooks?.enabled || false,
      webhookServer: this.webhookServer ? 'running' : 'stopped'
    };
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