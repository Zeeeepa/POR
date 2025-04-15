/**
 * PriorityQueue.js
 * Priority queue implementation
 */

const BaseQueue = require('./BaseQueue');
const logger = require('../../../utils/logger');

/**
 * Priority queue implementation
 * Messages are processed based on their priority level
 */
class PriorityQueue extends BaseQueue {
  /**
   * Initialize the priority queue
   * @param {string} name - Queue name
   * @param {Object} options - Queue options
   * @param {Object} storage - Storage adapter
   */
  constructor(name, options = {}, storage) {
    super(name, options, storage);
    
    // Priority-specific options
    this.options.priorityLevels = options.priorityLevels || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    this.options.defaultPriority = options.defaultPriority || 5;
    
    // Track messages by priority
    this.priorityGroups = new Map();
    this.options.priorityLevels.forEach(level => {
      this.priorityGroups.set(level, []);
    });
    
    // Initialize priority groups from existing messages
    this._initializePriorityGroups();
    
    logger.info(`Priority queue ${name} initialized with ${this.options.priorityLevels.length} priority levels`);
  }

  /**
   * Initialize priority groups from existing messages
   * @private
   */
  async _initializePriorityGroups() {
    try {
      // Group existing messages by priority
      for (const [messageId, messageData] of this.messages.entries()) {
        const priority = messageData.attributes.priority || this.options.defaultPriority;
        
        if (!this.priorityGroups.has(priority)) {
          this.priorityGroups.set(priority, []);
        }
        
        this.priorityGroups.get(priority).push(messageId);
      }
    } catch (error) {
      logger.logError(`Failed to initialize priority groups for queue ${this.name}`, error);
    }
  }

  /**
   * Send a message to the queue
   * @param {*} message - Message to send
   * @param {Object} [options={}] - Message options
   * @param {number} [options.priority] - Message priority (higher number = higher priority)
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(message, options = {}) {
    const priority = options.priority || this.options.defaultPriority;
    
    // Validate priority
    if (!this.options.priorityLevels.includes(priority)) {
      throw new Error(`Invalid priority level: ${priority}. Valid levels are: ${this.options.priorityLevels.join(', ')}`);
    }
    
    // Add priority-specific attributes
    const priorityOptions = {
      ...options,
      attributes: {
        ...options.attributes,
        priority
      }
    };
    
    // Send message using base implementation
    const messageId = await super.sendMessage(message, priorityOptions);
    
    // Track message in its priority group
    if (!this.priorityGroups.has(priority)) {
      this.priorityGroups.set(priority, []);
    }
    this.priorityGroups.get(priority).push(messageId);
    
    return messageId;
  }

  /**
   * Receive messages from the queue
   * @param {Object} [options={}] - Receive options
   * @param {number} [options.maxMessages=1] - Maximum number of messages to receive
   * @param {number} [options.visibilityTimeout] - Visibility timeout in milliseconds
   * @param {number} [options.minPriority] - Minimum priority level to receive
   * @param {number} [options.maxPriority] - Maximum priority level to receive
   * @returns {Promise<Array<Object>>} Received messages
   */
  async receiveMessages(options = {}) {
    const maxMessages = options.maxMessages || 1;
    const minPriority = options.minPriority || Math.min(...this.options.priorityLevels);
    const maxPriority = options.maxPriority || Math.max(...this.options.priorityLevels);
    
    // Get all priority levels in descending order (highest priority first)
    const priorityLevels = this.options.priorityLevels
      .filter(level => level >= minPriority && level <= maxPriority)
      .sort((a, b) => b - a);
    
    const receivedMessages = [];
    
    // Process messages in priority order
    for (const priority of priorityLevels) {
      if (receivedMessages.length >= maxMessages) {
        break;
      }
      
      const priorityMessages = await this._receiveMessagesFromPriority(
        priority,
        maxMessages - receivedMessages.length,
        options
      );
      
      receivedMessages.push(...priorityMessages);
    }
    
    return receivedMessages;
  }

  /**
   * Receive messages from a specific priority level
   * @param {number} priority - Priority level
   * @param {number} maxMessages - Maximum number of messages to receive
   * @param {Object} options - Receive options
   * @returns {Promise<Array<Object>>} Received messages
   * @private
   */
  async _receiveMessagesFromPriority(priority, maxMessages, options) {
    // Get all messages
    const allMessages = Array.from(this.messages.entries());
    
    // Filter messages by priority and visibility
    const priorityMessages = allMessages
      .filter(([_, msg]) => {
        return msg.attributes.priority === priority &&
               new Date(msg.metadata.visibleAt) <= new Date();
      })
      .sort((a, b) => new Date(a[1].metadata.sentAt) - new Date(b[1].metadata.sentAt));
    
    // Process messages
    const receivedMessages = [];
    
    for (let i = 0; i < Math.min(maxMessages, priorityMessages.length); i++) {
      const [messageId, messageData] = priorityMessages[i];
      
      // Update message visibility
      const visibilityTimeout = options.visibilityTimeout || this.options.visibilityTimeout;
      const now = new Date();
      
      messageData.metadata.receivedCount++;
      messageData.metadata.visibleAt = new Date(now.getTime() + visibilityTimeout).toISOString();
      messageData.metadata.lastReceivedAt = now.toISOString();
      
      // Add to processing messages
      this.processingMessages.set(messageId, {
        ...messageData,
        metadata: {
          ...messageData.metadata,
          processingStartedAt: now.toISOString(),
          processingExpiresAt: new Date(now.getTime() + visibilityTimeout).toISOString()
        }
      });
      
      // Update message in storage
      await this.storage.saveMessage(this.name, messageId, messageData);
      
      // Add to received messages
      receivedMessages.push({
        id: messageId,
        body: this._deserializeMessage(messageData.body),
        attributes: messageData.attributes,
        receiptHandle: messageId,
        metadata: messageData.metadata
      });
      
      // Update stats
      this._updateStats('totalReceived');
    }
    
    // Emit event if messages were received
    if (receivedMessages.length > 0) {
      this.emit('messagesReceived', { 
        queue: this.name, 
        count: receivedMessages.length,
        priority,
        messages: receivedMessages.map(m => ({ id: m.id, metadata: m.metadata }))
      });
      
      logger.info(`Received ${receivedMessages.length} messages from priority queue ${this.name} (priority: ${priority})`);
    }
    
    return receivedMessages;
  }

  /**
   * Acknowledge a message as processed
   * @param {string} messageId - ID of the message to acknowledge
   * @returns {Promise<boolean>} Success status
   */
  async acknowledgeMessage(messageId) {
    // Get message data before deleting
    const messageData = this.messages.get(messageId);
    
    if (!messageData) {
      return super.acknowledgeMessage(messageId);
    }
    
    // Get message priority
    const priority = messageData.attributes.priority || this.options.defaultPriority;
    
    // Remove from base queue
    const result = await super.acknowledgeMessage(messageId);
    
    // Remove from priority group
    if (this.priorityGroups.has(priority)) {
      const priorityMessages = this.priorityGroups.get(priority);
      const index = priorityMessages.indexOf(messageId);
      
      if (index !== -1) {
        priorityMessages.splice(index, 1);
      }
    }
    
    return result;
  }

  /**
   * Get queue attributes and statistics
   * @returns {Promise<Object>} Queue attributes
   */
  async getQueueAttributes() {
    const attributes = await super.getQueueAttributes();
    
    // Add priority-specific stats
    const priorityStats = {};
    for (const [priority, messages] of this.priorityGroups.entries()) {
      priorityStats[`priority_${priority}`] = messages.length;
    }
    
    return {
      ...attributes,
      stats: {
        ...attributes.stats,
        priorityStats
      }
    };
  }
}

module.exports = PriorityQueue;
