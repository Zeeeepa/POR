/**
 * MessageQueueManager.js
 * Unified message queue manager that handles message templating and delivery
 * This replaces both root MessageConveyor.js and src/models/MessageQueueManager.js
 */

const path = require('path');
const fs = require('fs-extra');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class MessageQueueManager extends EventEmitter {
  /**
   * Initialize the MessageQueueManager
   * @param {Object} config - Global configuration
   */
  constructor(config = {}) {
    super();
    this.config = config;
    this.cursorAutomation = null;
    this.templates = {};
    this.sentMessages = [];
    this.batchHistory = [];
    this.activeTransmission = false;
    this.isPaused = false;
    
    // Initialize queues with different priorities
    this.queues = {
      high: [],
      normal: [],
      low: []
    };
    
    // Processing state
    this.isProcessing = false;
    this.processingTimer = null;
    
    // Load message templates
    this.loadMessageTemplates();
  }

  /**
   * Set the cursor automation instance
   * @param {Object} cursorAutomation - Cursor automation instance
   */
  setCursorAutomation(cursorAutomation) {
    this.cursorAutomation = cursorAutomation;
    logger.info('Cursor automation set for message queue manager');
  }

  /**
   * Enqueue a message with priority
   * @param {Object} message - Message to enqueue
   * @param {string} priority - Priority level (high, normal, low)
   * @returns {string} Message ID
   */
  enqueueMessage(message, priority = 'normal') {
    if (!this.queues[priority]) {
      throw new Error(`Invalid priority: ${priority}`);
    }
    
    // Create message object with unique ID
    const queuedMessage = {
      id: message.id || Date.now().toString(),
      content: message.content,
      inputPosition: message.inputPosition || this.config.defaultInputPosition,
      metadata: message.metadata || {},
      priority,
      status: 'queued',
      enqueuedAt: new Date().toISOString()
    };
    
    // Add to appropriate queue
    this.queues[priority].push(queuedMessage);
    
    logger.info(`Message enqueued with ${priority} priority: ${queuedMessage.id}`);
    
    // Start processing if not already running
    setImmediate(() => this.processQueue());
    
    return queuedMessage.id;
  }

  /**
   * Enqueue multiple messages with the same priority
   * @param {Array<Object>} messages - Messages to enqueue
   * @param {string} priority - Priority level (high, normal, low)
   * @returns {Array<string>} Message IDs
   */
  enqueueMessages(messages, priority = 'normal') {
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array');
    }
    
    const messageIds = [];
    
    for (const message of messages) {
      const messageId = this.enqueueMessage(message, priority);
      messageIds.push(messageId);
    }
    
    logger.info(`Enqueued ${messageIds.length} messages with ${priority} priority`);
    
    return messageIds;
  }

  /**
   * Process the message queue
   * @returns {Promise<void>}
   */
  async processQueue() {
    // Don't process if paused or already processing
    if (this.isPaused || this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // Process queues in priority order
      for (const priority of ['high', 'normal', 'low']) {
        const queue = this.queues[priority];
        
        if (queue.length > 0) {
          const message = queue.shift();
          await this.processMessage(message);
          
          // After processing one message, exit to allow other operations
          break;
        }
      }
      
      // If there are still messages in the queue, schedule next processing
      const totalMessages = this.getTotalQueuedMessages();
      if (totalMessages > 0) {
        const delay = this.config.messageDelay || 5000;
        this.processingTimer = setTimeout(() => this.processQueue(), delay);
      }
    } catch (error) {
      logger.logError('Error processing message queue', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single message
   * @param {Object} message - Message to process
   * @returns {Promise<boolean>} Success status
   */
  async processMessage(message) {
    try {
      logger.info(`Processing message: ${message.id}`);
      
      // Update message status
      message.status = 'processing';
      message.processingStartedAt = new Date().toISOString();
      
      // Get input position name
      const positionName = message.inputPosition || this.config.defaultInputPosition;
      
      // Check if cursor automation is available
      if (!this.cursorAutomation) {
        throw new Error('Cursor automation not set');
      }
      
      // Send the message using cursor automation
      const content = typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content);
      
      const success = await this.cursorAutomation.sendTextToPosition(positionName, content);
      
      // Update message status
      message.status = success ? 'completed' : 'failed';
      message.completedAt = new Date().toISOString();
      
      // Keep track of sent messages
      this.sentMessages.push({
        ...message,
        sentAt: new Date().toISOString()
      });
      
      // Emit event
      this.emit('messageProcessed', message);
      
      logger.info(`Message processed: ${message.id}`);
      
      return success;
    } catch (error) {
      logger.logError(`Failed to process message: ${message.id}`, error);
      
      // Update message status
      message.status = 'failed';
      message.failedAt = new Date().toISOString();
      message.error = error.message;
      
      // Emit event
      this.emit('messageFailed', message);
      
      return false;
    }
  }

  /**
   * Pause message processing
   */
  pauseProcessing() {
    this.isPaused = true;
    
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
    
    logger.info('Message processing paused');
  }

  /**
   * Resume message processing
   */
  resumeProcessing() {
    this.isPaused = false;
    
    // Start processing if there are messages in the queue
    if (this.getTotalQueuedMessages() > 0) {
      setImmediate(() => this.processQueue());
    }
    
    logger.info('Message processing resumed');
  }

  /**
   * Get the total number of queued messages
   * @returns {number} Total queued messages
   */
  getTotalQueuedMessages() {
    return Object.values(this.queues).reduce((total, queue) => total + queue.length, 0);
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getQueueStats() {
    return {
      high: this.queues.high.length,
      normal: this.queues.normal.length,
      low: this.queues.low.length,
      total: this.getTotalQueuedMessages(),
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      sentMessages: this.sentMessages.length,
      batches: this.batchHistory.length
    };
  }

  /**
   * Send a batch of messages
   * @param {Array<Object>} messages - Messages to send
   * @param {string} batchName - Name for this batch
   * @param {number} delay - Delay between messages in ms
   * @returns {Promise<Object>} Batch result
   */
  async sendBatch(messages, batchName = '', delay = null) {
    // Don't send a batch while another is in progress
    if (this.activeTransmission) {
      throw new Error('Another batch is currently being transmitted');
    }
    
    try {
      this.activeTransmission = true;
      const batchId = Date.now().toString();
      
      // Record the batch
      this.batchHistory.push({
        id: batchId,
        name: batchName || `Batch ${this.batchHistory.length + 1}`,
        messageCount: messages.length,
        delay: delay || this.config.messageDelay || 5000,
        startedAt: new Date().toISOString(),
        status: 'In Progress'
      });
      
      // Enqueue messages in the batch
      const messageIds = [];
      for (const message of messages) {
        const messageId = this.enqueueMessage({
          ...message,
          batchId: batchId
        }, 'normal');
        
        messageIds.push(messageId);
      }
      
      // Mark batch as queued
      const batchIndex = this.batchHistory.findIndex(b => b.id === batchId);
      if (batchIndex !== -1) {
        this.batchHistory[batchIndex].status = 'queued';
        this.batchHistory[batchIndex].messageIds = messageIds;
      }
      
      this.activeTransmission = false;
      logger.info(`Batch ${batchId} queued with ${messageIds.length} messages`);
      
      return {
        batchId: batchId,
        status: 'queued',
        messageCount: messages.length,
        messageIds,
        estimatedTime: messages.length * ((delay || this.config.messageDelay || 5000) / 1000)
      };
    } catch (error) {
      logger.logError('Failed to send batch', error);
      this.activeTransmission = false;
      throw error;
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
      
      logger.info(`Loaded ${Object.keys(this.templates).length} message templates`);
      
      // Create default template if none exist
      if (Object.keys(this.templates).length === 0) {
        this.createDefaultTemplate();
      }
      
      return this.templates;
    } catch (error) {
      logger.logError('Failed to load message templates', error);
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
      
      logger.info('Created default message template');
    } catch (error) {
      logger.logError('Failed to create default template', error);
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
      
      logger.info(`Created message template: ${name}`);
      return true;
    } catch (error) {
      logger.logError(`Failed to create template ${name}`, error);
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
      
      logger.info(`Updated message template: ${name}`);
      return true;
    } catch (error) {
      logger.logError(`Failed to update template ${name}`, error);
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
      logger.error('Cannot delete the default template');
      return false;
    }
    
    if (!this.templates[name]) {
      logger.error(`Template ${name} does not exist`);
      return false;
    }
    
    try {
      const templatesDir = path.join(process.cwd(), 'templates');
      const fileName = `${name}.message.template`;
      fs.unlinkSync(path.join(templatesDir, fileName));
      delete this.templates[name];
      
      logger.info(`Deleted message template: ${name}`);
      return true;
    } catch (error) {
      logger.logError(`Failed to delete template ${name}`, error);
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
        content: messageContent,
        inputPosition: this.config.defaultInputPosition,
        metadata: {
          projectId: project.config.name,
          component: component.name,
          template: templateName
        }
      };
      
      // Enqueue the message
      const messageId = this.enqueueMessage(message, 'normal');
      
      return true;
    } catch (error) {
      logger.logError('Failed to send templated message', error);
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
      if (phase !== undefined) {
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
      
      logger.info(`Found ${components.length} components to include in batch`);
      return components;
    } catch (error) {
      logger.logError('Failed to create component batch', error);
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

module.exports = MessageQueueManager;
