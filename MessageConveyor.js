/**
 * MessageConveyor - Handles message templating and delivery to the WSL2 server
 * 
 * This class is part of the client-side architecture and implements the
 * application-specific logic for message management, while delegating the
 * actual communication to the WSL2Client.
 */

const path = require('path');
const fs = require('fs');
const WSL2Client = require('./wsl2-client');

class MessageConveyor {
  /**
   * Initialize the MessageConveyor
   * @param {Object} config - Global configuration
   */
  constructor(config) {
    this.config = config;
    this.wsl2Client = new WSL2Client(config.wsl2);
    this.connected = false;
    this.templates = {};
    this.sentMessages = [];
    this.batchHistory = [];
    this.activeTransmission = false;
    
    // Load message templates
    this.loadMessageTemplates();
  }

  /**
   * Connect to the WSL2 server
   * @returns {Promise<boolean>} Connection success
   */
  async connect() {
    try {
      const health = await this.wsl2Client.checkHealth();
      this.connected = health.connected;
      return this.connected;
    } catch (error) {
      console.error('Failed to connect to WSL2:', error.message);
      this.connected = false;
      return false;
    }
  }

  /**
   * Send a message to Slack via the WSL2 server
   * @param {Object} message - Message to send
   * @returns {Promise<boolean>} Sending success
   */
  async sendMessage(message) {
    if (!this.connected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Not connected to WSL2 server');
      }
    }
    
    try {
      const result = await this.wsl2Client.sendMessage(message);
      
      if (result.success) {
        message.status = 'Sent';
        message.sentAt = new Date().toISOString();
        
        // Keep track of sent messages
        this.sentMessages.push({
          ...message,
          id: message.id || Date.now().toString(),
          messageId: result.messageId,
          sentAt: new Date().toISOString()
        });
        
        return true;
      } else {
        throw new Error(`Failed to send message: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error.message);
      return false;
    }
  }

  /**
   * Send a batch of messages to Slack
   * @param {Array<Object>} messages - Messages to send
   * @param {string} batchName - Name for this batch
   * @param {number} delay - Delay between messages in ms
   * @returns {Promise<Object>} Batch result
   */
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
      
      const result = await this.wsl2Client.sendBatch(messages, batchName, delay);
      
      if (result.success) {
        // Record the batch
        this.batchHistory.push({
          id: result.batchId,
          name: batchName || `Batch ${this.batchHistory.length + 1}`,
          messageCount: messages.length,
          delay: delay || this.config.messageDelay || 5000,
          startedAt: new Date().toISOString(),
          status: 'In Progress'
        });
        
        // Start a timer to check for batch completion
        this.startBatchStatusCheck(result.batchId);
        
        return {
          batchId: result.batchId,
          status: result.status,
          messageCount: result.messageCount,
          estimatedTime: messages.length * ((delay || this.config.messageDelay || 5000) / 1000)
        };
      } else {
        throw new Error(`Failed to send batch: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to send batch:', error.message);
      this.activeTransmission = false;
      throw error;
    }
  }

  /**
   * Start checking the status of a batch
   * @param {string} batchId - Batch ID to check
   */
  async startBatchStatusCheck(batchId) {
    const checkInterval = setInterval(async () => {
      try {
        const status = await this.wsl2Client.getBatchStatus(batchId);
        
        // Update the batch status
        const batchIndex = this.batchHistory.findIndex(b => b.id === batchId);
        if (batchIndex !== -1) {
          this.batchHistory[batchIndex].status = status.status;
          this.batchHistory[batchIndex].progress = status.progress;
          this.batchHistory[batchIndex].completedMessages = status.completed;
          
          if (status.status === 'completed') {
            this.batchHistory[batchIndex].completedAt = new Date().toISOString();
            this.activeTransmission = false;
            clearInterval(checkInterval);
            console.log(`Batch ${batchId} completed successfully`);
          } else if (status.status === 'failed') {
            this.batchHistory[batchIndex].completedAt = new Date().toISOString();
            this.batchHistory[batchIndex].error = status.error;
            this.activeTransmission = false;
            clearInterval(checkInterval);
            console.error(`Batch ${batchId} failed: ${status.error}`);
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

  /**
   * Test the connection to the WSL2 server
   * @returns {Promise<Object>} Test results
   */
  async testConnection() {
    try {
      const result = await this.wsl2Client.testConnection();
      this.connected = result.success;
      return result;
    } catch (error) {
      console.error('Connection test failed:', error.message);
      this.connected = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Load message templates from the templates directory
   * @returns {Object} Loaded templates
   */
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

  /**
   * Create a default message template
   */
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

  /**
   * Get the list of template names
   * @returns {Array<string>} Template names
   */
  getTemplateNames() {
    return Object.keys(this.templates);
  }

  /**
   * Get a specific template content
   * @param {string} name - Template name
   * @returns {string} Template content
   */
  getTemplate(name) {
    return this.templates[name] || this.templates.default;
  }

  /**
   * Create a new template
   * @param {string} name - Template name
   * @param {string} content - Template content
   * @returns {boolean} Success
   */
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

  /**
   * Update an existing template
   * @param {string} name - Template name
   * @param {string} content - New template content
   * @returns {boolean} Success
   */
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

  /**
   * Delete a template
   * @param {string} name - Template name
   * @returns {boolean} Success
   */
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

  /**
   * Send a message using a template
   * @param {Object} project - Project object
   * @param {Object} component - Component to implement
   * @param {string} templateName - Template to use
   * @returns {Promise<boolean>} Success
   */
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

  /**
   * Create a batch of messages for components from a project phase
   * @param {Object} project - Project object
   * @param {number} phase - Phase index to create messages for
   * @returns {Array<Object>} Generated messages
   */
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

  /**
   * Get the list of completed batches
   * @returns {Array<Object>} Completed batches
   */
  getCompletedBatches() {
    return this.batchHistory.filter(batch => batch.status === 'completed');
  }

  /**
   * Get the currently active batch if any
   * @returns {Object|null} Active batch or null
   */
  getActiveBatch() {
    return this.batchHistory.find(batch => batch.status === 'In Progress');
  }

  /**
   * Get sent messages organized by batch
   * @returns {Object} Messages by batch
   */
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

module.exports = MessageConveyor; 