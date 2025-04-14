/**
 * MessageQueueManager.js
 * Manages message queues for automated input with priority levels
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class MessageQueueManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
    // Default configuration
    this.config = {
      priorityLevels: ['high', 'normal', 'low'],
      maxConcurrentMessages: config.messaging?.maxConcurrentMessages || 3,
      maxRetries: config.messaging?.maxRetries || 3,
      defaultDelay: config.messaging?.defaultDelay || 2000,
      defaultInputPosition: config.messaging?.defaultInputPosition || 'default'
    };
    
    // Override with provided config
    if (config.messaging) {
      this.config = {
        ...this.config,
        ...config.messaging
      };
    }
    
    // Initialize queues for each priority level
    this.queues = {};
    for (const priority of this.config.priorityLevels) {
      this.queues[priority] = [];
    }
    
    // Initialize state
    this.activeMessages = 0;
    this.processingPaused = false;
    
    // Initialize statistics
    this.stats = {
      enqueued: 0,
      processed: 0,
      failed: 0,
      retried: 0
    };
    
    // Get cursor automation (will be injected)
    this.cursorAutomation = null;
    
    logger.info('MessageQueueManager initialized');
  }
  
  /**
   * Set cursor automation instance
   * @param {Object} automation - Cursor automation instance
   */
  setCursorAutomation(automation) {
    this.cursorAutomation = automation;
    logger.info('Cursor automation set');
  }
  
  /**
   * Add a message to the queue
   * @param {Object} message - Message to enqueue
   * @param {string} priority - Priority level (high, normal, low)
   * @returns {string} Message ID
   */
  enqueueMessage(message, priority = 'normal') {
    try {
      // Validate priority
      if (!this.queues[priority]) {
        throw new Error(`Invalid priority: ${priority}`);
      }
      
      // Create message object
      const queuedMessage = {
        id: uuidv4(),
        content: message.content,
        templateName: message.templateName,
        templateData: message.templateData,
        inputPosition: message.inputPosition || this.config.defaultInputPosition,
        delay: message.delay || this.config.defaultDelay,
        metadata: message.metadata || {},
        priority,
        status: 'queued',
        attempts: 0,
        addedAt: new Date().toISOString()
      };
      
      // Add to appropriate queue
      this.queues[priority].push(queuedMessage);
      
      // Update stats
      this.stats.enqueued++;
      
      logger.info(`Enqueued message ${queuedMessage.id} with priority ${priority}`);
      
      // Emit event
      this.emit('messageEnqueued', queuedMessage);
      
      // Start processing if not already running
      setImmediate(() => this.processQueue());
      
      return queuedMessage.id;
    } catch (error) {
      logger.error(`Failed to enqueue message: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Add multiple messages to the queue
   * @param {Array<Object>} messages - Array of message objects
   * @param {string} priority - Priority level (high, normal, low)
   * @returns {Array<string>} Array of message IDs
   */
  enqueueMessages(messages, priority = 'normal') {
    try {
      const messageIds = [];
      
      for (const message of messages) {
        const id = this.enqueueMessage(message, priority);
        messageIds.push(id);
      }
      
      logger.info(`Enqueued ${messageIds.length} messages with priority ${priority}`);
      return messageIds;
    } catch (error) {
      logger.error(`Failed to enqueue multiple messages: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Process the next message in the queue
   */
  async processQueue() {
    // If processing is paused or max concurrent messages reached, do nothing
    if (this.processingPaused || this.activeMessages >= this.config.maxConcurrentMessages) {
      return;
    }
    
    // Get the next message from the highest priority queue
    const nextMessage = this.getNextMessage();
    
    if (!nextMessage) {
      // No messages in queue
      return;
    }
    
    // Increment active messages counter
    this.activeMessages++;
    
    try {
      // Update message status
      nextMessage.status = 'processing';
      nextMessage.processingStartedAt = new Date().toISOString();
      
      // Emit event
      this.emit('messageProcessingStarted', nextMessage);
      
      logger.info(`Processing message ${nextMessage.id} (priority: ${nextMessage.priority})`);
      
      // Process the message
      const success = await this.processMessage(nextMessage);
      
      if (success) {
        // Message processed successfully
        nextMessage.status = 'completed';
        nextMessage.completedAt = new Date().toISOString();
        
        // Update stats
        this.stats.processed++;
        
        // Emit event
        this.emit('messageProcessed', nextMessage);
        
        logger.info(`Successfully processed message ${nextMessage.id}`);
      } else {
        // Message processing failed
        nextMessage.attempts++;
        
        if (nextMessage.attempts < this.config.maxRetries) {
          // Retry the message
          nextMessage.status = 'queued';
          
          // Re-add to appropriate queue
          this.queues[nextMessage.priority].push(nextMessage);
          
          // Update stats
          this.stats.retried++;
          
          // Emit event
          this.emit('messageRetried', nextMessage);
          
          logger.warn(`Retrying message ${nextMessage.id} (attempt ${nextMessage.attempts}/${this.config.maxRetries})`);
        } else {
          // Max retries reached, mark as failed
          nextMessage.status = 'failed';
          nextMessage.failedAt = new Date().toISOString();
          
          // Update stats
          this.stats.failed++;
          
          // Emit event
          this.emit('messageFailed', nextMessage);
          
          logger.error(`Failed to process message ${nextMessage.id} after ${nextMessage.attempts} attempts`);
        }
      }
    } catch (error) {
      // Error during processing
      logger.error(`Error processing message ${nextMessage.id}: ${error.message}`);
      
      // Mark as failed
      nextMessage.status = 'failed';
      nextMessage.failedAt = new Date().toISOString();
      nextMessage.error = error.message;
      
      // Update stats
      this.stats.failed++;
      
      // Emit event
      this.emit('messageFailed', nextMessage);
    } finally {
      // Decrement active messages counter
      this.activeMessages--;
      
      // Continue processing queue
      setImmediate(() => this.processQueue());
    }
  }
  
  /**
   * Get the next message from the highest priority queue
   * @returns {Object|null} Next message or null if queues are empty
   */
  getNextMessage() {
    // Check queues in priority order
    for (const priority of this.config.priorityLevels) {
      if (this.queues[priority].length > 0) {
        return this.queues[priority].shift();
      }
    }
    
    return null;
  }
  
  /**
   * Process a single message
   * @param {Object} message - Message to process
   * @returns {Promise<boolean>} Success status
   */
  async processMessage(message) {
    try {
      // Ensure cursor automation is available
      if (!this.cursorAutomation) {
        throw new Error('Cursor automation not set');
      }
      
      // Get input position name
      const positionName = message.inputPosition || this.config.defaultInputPosition;
      
      if (!positionName) {
        throw new Error('No input position specified for message');
      }
      
      // Prepare message content
      let content = '';
      
      if (typeof message.content === 'string') {
        content = message.content;
      } else if (message.templateName && message.templateData) {
        // In a real implementation, this would use the template engine
        content = `Template ${message.templateName} with data (placeholder)`;
      } else {
        throw new Error('No content or template specified for message');
      }
      
      // Send the message using cursor automation
      const success = await this.cursorAutomation.sendTextToPosition(positionName, content);
      
      if (!success) {
        throw new Error(`Failed to send text to position ${positionName}`);
      }
      
      // Simulate delay between messages (in a real implementation this would be more sophisticated)
      const delay = message.delay || this.config.defaultDelay;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return true;
    } catch (error) {
      logger.error(`Error processing message ${message.id}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Pause message processing
   */
  pauseProcessing() {
    this.processingPaused = true;
    logger.info('Message processing paused');
    this.emit('processingPaused');
  }
  
  /**
   * Resume message processing
   */
  resumeProcessing() {
    this.processingPaused = false;
    logger.info('Message processing resumed');
    this.emit('processingResumed');
    
    // Restart processing
    setImmediate(() => this.processQueue());
  }
  
  /**
   * Clear all queues
   */
  clearQueues() {
    for (const priority of this.config.priorityLevels) {
      this.queues[priority] = [];
    }
    
    logger.info('All message queues cleared');
    this.emit('queuesCleared');
  }
  
  /**
   * Get queue statistics
   * @returns {Object} Queue statistics
   */
  getQueueStats() {
    const queueLengths = {};
    
    for (const priority of this.config.priorityLevels) {
      queueLengths[priority] = this.queues[priority].length;
    }
    
    return {
      queued: Object.values(queueLengths).reduce((total, count) => total + count, 0),
      queuesByPriority: queueLengths,
      activeMessages: this.activeMessages,
      processing: !this.processingPaused,
      processed: this.stats.processed,
      failed: this.stats.failed,
      retried: this.stats.retried,
      totalEnqueued: this.stats.enqueued
    };
  }
  
  /**
   * Find a queued message by ID
   * @param {string} messageId - Message ID to find
   * @returns {Object|null} Message or null if not found
   */
  findQueuedMessage(messageId) {
    for (const priority of this.config.priorityLevels) {
      const message = this.queues[priority].find(m => m.id === messageId);
      if (message) {
        return message;
      }
    }
    
    return null;
  }
  
  /**
   * Remove a message from the queue
   * @param {string} messageId - Message ID to remove
   * @returns {boolean} Success status
   */
  removeMessage(messageId) {
    for (const priority of this.config.priorityLevels) {
      const index = this.queues[priority].findIndex(m => m.id === messageId);
      if (index !== -1) {
        this.queues[priority].splice(index, 1);
        logger.info(`Removed message ${messageId} from ${priority} queue`);
        this.emit('messageRemoved', messageId);
        return true;
      }
    }
    
    logger.warn(`Message ${messageId} not found in any queue`);
    return false;
  }
  
  /**
   * Change the priority of a queued message
   * @param {string} messageId - Message ID to change
   * @param {string} newPriority - New priority level
   * @returns {boolean} Success status
   */
  changeMessagePriority(messageId, newPriority) {
    // Ensure new priority is valid
    if (!this.queues[newPriority]) {
      logger.error(`Invalid priority: ${newPriority}`);
      return false;
    }
    
    // Find and remove the message from its current queue
    let message = null;
    
    for (const priority of this.config.priorityLevels) {
      const index = this.queues[priority].findIndex(m => m.id === messageId);
      if (index !== -1) {
        message = this.queues[priority].splice(index, 1)[0];
        break;
      }
    }
    
    if (!message) {
      logger.warn(`Message ${messageId} not found in any queue`);
      return false;
    }
    
    // Update priority and add to new queue
    message.priority = newPriority;
    this.queues[newPriority].push(message);
    
    logger.info(`Changed priority of message ${messageId} to ${newPriority}`);
    this.emit('messagePriorityChanged', message);
    
    return true;
  }
}

module.exports = MessageQueueManager;
