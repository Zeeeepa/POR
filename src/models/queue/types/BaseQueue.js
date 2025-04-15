/**
 * BaseQueue.js
 * Base queue implementation with common functionality
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../../utils/logger');
const { 
  QueueError, 
  MessageNotFoundError, 
  QueueRateLimitError,
  QueueFullError,
  MessageSerializationError
} = require('../../../utils/errors/QueueErrors');

/**
 * Base queue implementation with common functionality
 */
class BaseQueue extends EventEmitter {
  /**
   * Initialize the queue
   * @param {string} name - Queue name
   * @param {Object} options - Queue options
   * @param {Object} storage - Storage adapter
   */
  constructor(name, options = {}, storage) {
    super();
    
    // Ensure this class is not instantiated directly
    if (this.constructor === BaseQueue) {
      throw new Error('BaseQueue is an abstract class and cannot be instantiated directly');
    }
    
    this.name = name;
    this.options = {
      maxSize: options.maxSize || 10000,
      visibilityTimeout: options.visibilityTimeout || 30000, // 30 seconds
      retentionPeriod: options.retentionPeriod || 86400000, // 24 hours
      maxRetries: options.maxRetries || 3,
      rateLimitPerSecond: options.rateLimitPerSecond || 0, // 0 means no rate limit
      ...options
    };
    
    this.storage = storage;
    this.messages = new Map();
    this.processingMessages = new Map();
    this.deadLetterQueue = null;
    this.stats = {
      totalReceived: 0,
      totalSent: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalAcknowledged: 0,
      totalRejected: 0,
      totalExpired: 0,
      totalDeadLettered: 0,
      oldestMessageTimestamp: null,
      newestMessageTimestamp: null,
      lastAccessTimestamp: Date.now()
    };
    
    // Rate limiting
    this.rateLimitWindow = {
      timestamp: Date.now(),
      count: 0
    };
    
    // Initialize the queue
    this._initialize();
  }

  /**
   * Initialize the queue
   * @private
   */
  async _initialize() {
    try {
      // Load queue data from storage if available
      const queueData = await this.storage.loadQueue(this.name);
      
      if (queueData) {
        // Restore queue stats
        this.stats = { ...this.stats, ...queueData.stats };
        
        // Load messages
        const messageIds = await this.storage.listMessages(this.name);
        for (const messageId of messageIds) {
          const messageData = await this.storage.loadMessage(this.name, messageId);
          if (messageData) {
            this.messages.set(messageId, messageData);
          }
        }
        
        logger.info(`Queue ${this.name} loaded with ${this.messages.size} messages`);
      } else {
        // Save initial queue data
        await this._persistQueueData();
        logger.info(`Queue ${this.name} initialized`);
      }
    } catch (error) {
      logger.logError(`Failed to initialize queue ${this.name}`, error);
    }
  }

  /**
   * Persist queue data to storage
   * @private
   */
  async _persistQueueData() {
    try {
      const queueData = {
        name: this.name,
        type: this.constructor.name,
        options: this.options,
        stats: this.stats,
        createdAt: this.stats.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await this.storage.saveQueue(this.name, queueData);
    } catch (error) {
      logger.logError(`Failed to persist queue data for ${this.name}`, error);
    }
  }

  /**
   * Update queue statistics
   * @param {string} statName - Name of the stat to update
   * @param {number} [value=1] - Value to increment by
   * @private
   */
  _updateStats(statName, value = 1) {
    if (this.stats[statName] !== undefined) {
      this.stats[statName] += value;
    }
    
    this.stats.lastAccessTimestamp = Date.now();
    
    // Persist stats periodically (to avoid too many writes)
    if (Math.random() < 0.1) { // ~10% chance to persist on each update
      this._persistQueueData().catch(error => {
        logger.logError(`Failed to persist stats for queue ${this.name}`, error);
      });
    }
  }

  /**
   * Check if the queue is rate limited
   * @returns {boolean} True if rate limited
   * @private
   */
  _checkRateLimit() {
    const { rateLimitPerSecond } = this.options;
    
    // No rate limit
    if (!rateLimitPerSecond || rateLimitPerSecond <= 0) {
      return false;
    }
    
    const now = Date.now();
    const windowSize = 1000; // 1 second window
    
    // Reset window if it's expired
    if (now - this.rateLimitWindow.timestamp > windowSize) {
      this.rateLimitWindow = {
        timestamp: now,
        count: 0
      };
      return false;
    }
    
    // Check if we've exceeded the rate limit
    if (this.rateLimitWindow.count >= rateLimitPerSecond) {
      return true;
    }
    
    // Increment the counter
    this.rateLimitWindow.count++;
    return false;
  }

  /**
   * Serialize a message for storage
   * @param {*} message - Message to serialize
   * @returns {string} Serialized message
   * @private
   */
  _serializeMessage(message) {
    try {
      if (typeof message === 'string') {
        return message;
      }
      
      return JSON.stringify(message);
    } catch (error) {
      throw new MessageSerializationError('serialize', error);
    }
  }

  /**
   * Deserialize a message from storage
   * @param {string} serializedMessage - Serialized message
   * @param {boolean} [parseJson=true] - Whether to parse JSON
   * @returns {*} Deserialized message
   * @private
   */
  _deserializeMessage(serializedMessage, parseJson = true) {
    try {
      if (!parseJson || typeof serializedMessage !== 'string') {
        return serializedMessage;
      }
      
      // Try to parse as JSON, but return the original string if it fails
      try {
        return JSON.parse(serializedMessage);
      } catch (e) {
        return serializedMessage;
      }
    } catch (error) {
      throw new MessageSerializationError('deserialize', error);
    }
  }

  /**
   * Set the dead letter queue for this queue
   * @param {BaseQueue} queue - Dead letter queue
   */
  setDeadLetterQueue(queue) {
    this.deadLetterQueue = queue;
    logger.info(`Dead letter queue set for ${this.name}: ${queue.name}`);
  }

  /**
   * Send a message to the queue
   * @param {*} message - Message to send
   * @param {Object} [options={}] - Message options
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(message, options = {}) {
    // Check if queue is full
    if (this.messages.size >= this.options.maxSize) {
      throw new QueueFullError(this.name, this.options.maxSize);
    }
    
    // Check rate limit
    if (this._checkRateLimit()) {
      throw new QueueRateLimitError(
        this.name, 
        this.rateLimitWindow.count, 
        this.options.rateLimitPerSecond
      );
    }
    
    // Create message object
    const messageId = options.messageId || uuidv4();
    const now = new Date();
    
    const messageData = {
      id: messageId,
      body: this._serializeMessage(message),
      attributes: options.attributes || {},
      metadata: {
        sentAt: now.toISOString(),
        receivedCount: 0,
        retryCount: 0,
        visibleAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + this.options.retentionPeriod).toISOString(),
        ...options.metadata
      }
    };
    
    // Add to queue
    this.messages.set(messageId, messageData);
    
    // Update stats
    this._updateStats('totalSent');
    if (!this.stats.oldestMessageTimestamp) {
      this.stats.oldestMessageTimestamp = now.toISOString();
    }
    this.stats.newestMessageTimestamp = now.toISOString();
    
    // Persist message
    await this.storage.saveMessage(this.name, messageId, messageData);
    
    // Emit event
    this.emit('messageSent', { queue: this.name, messageId, message: messageData });
    
    logger.info(`Message sent to queue ${this.name}: ${messageId}`);
    return messageId;
  }

  /**
   * Receive messages from the queue
   * @param {Object} [options={}] - Receive options
   * @param {number} [options.maxMessages=1] - Maximum number of messages to receive
   * @param {number} [options.visibilityTimeout] - Visibility timeout in milliseconds
   * @returns {Promise<Array<Object>>} Received messages
   */
  async receiveMessages(options = {}) {
    const maxMessages = options.maxMessages || 1;
    const visibilityTimeout = options.visibilityTimeout || this.options.visibilityTimeout;
    const receivedMessages = [];
    
    // Get available messages
    const now = new Date();
    const availableMessages = Array.from(this.messages.entries())
      .filter(([_, msg]) => new Date(msg.metadata.visibleAt) <= now)
      .sort((a, b) => new Date(a[1].metadata.sentAt) - new Date(b[1].metadata.sentAt));
    
    // Process up to maxMessages
    for (let i = 0; i < Math.min(maxMessages, availableMessages.length); i++) {
      const [messageId, messageData] = availableMessages[i];
      
      // Update message metadata
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
        receiptHandle: messageId, // Use message ID as receipt handle
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
        messages: receivedMessages.map(m => ({ id: m.id, metadata: m.metadata }))
      });
      
      logger.info(`Received ${receivedMessages.length} messages from queue ${this.name}`);
    }
    
    return receivedMessages;
  }

  /**
   * Acknowledge a message as processed
   * @param {string} messageId - ID of the message to acknowledge
   * @returns {Promise<boolean>} Success status
   */
  async acknowledgeMessage(messageId) {
    // Check if message exists
    if (!this.messages.has(messageId)) {
      throw new MessageNotFoundError(messageId, this.name);
    }
    
    // Remove from queue and processing
    this.messages.delete(messageId);
    this.processingMessages.delete(messageId);
    
    // Delete from storage
    await this.storage.deleteMessage(this.name, messageId);
    
    // Update stats
    this._updateStats('totalAcknowledged');
    this._updateStats('totalProcessed');
    
    // Emit event
    this.emit('messageAcknowledged', { queue: this.name, messageId });
    
    logger.info(`Message acknowledged in queue ${this.name}: ${messageId}`);
    return true;
  }

  /**
   * Move a message to the dead letter queue
   * @param {string} messageId - ID of the message
   * @param {string} reason - Reason for moving to dead letter queue
   * @returns {Promise<boolean>} Success status
   */
  async deadLetterMessage(messageId, reason) {
    // Check if message exists
    if (!this.messages.has(messageId)) {
      throw new MessageNotFoundError(messageId, this.name);
    }
    
    // Check if dead letter queue is configured
    if (!this.deadLetterQueue) {
      logger.warn(`No dead letter queue configured for ${this.name}, message ${messageId} will be deleted`);
      return this.acknowledgeMessage(messageId);
    }
    
    // Get message data
    const messageData = this.messages.get(messageId);
    
    // Add to dead letter queue
    try {
      await this.deadLetterQueue.sendMessage(
        this._deserializeMessage(messageData.body),
        {
          attributes: {
            ...messageData.attributes,
            originalQueue: this.name,
            deadLetterReason: reason
          },
          metadata: {
            ...messageData.metadata,
            deadLetteredAt: new Date().toISOString(),
            deadLetterReason: reason
          }
        }
      );
      
      // Remove from original queue
      await this.acknowledgeMessage(messageId);
      
      // Update stats
      this._updateStats('totalDeadLettered');
      
      // Emit event
      this.emit('messageDeadLettered', { 
        queue: this.name, 
        messageId, 
        reason,
        deadLetterQueue: this.deadLetterQueue.name
      });
      
      logger.info(`Message moved to dead letter queue from ${this.name}: ${messageId}`);
      return true;
    } catch (error) {
      logger.logError(`Failed to move message to dead letter queue: ${messageId}`, error);
      throw new QueueError(`Failed to move message to dead letter queue: ${error.message}`);
    }
  }

  /**
   * Purge all messages from the queue
   * @returns {Promise<number>} Number of messages purged
   */
  async purgeQueue() {
    const messageCount = this.messages.size;
    
    // Clear in-memory messages
    this.messages.clear();
    this.processingMessages.clear();
    
    // Clear messages from storage
    const messageIds = await this.storage.listMessages(this.name);
    for (const messageId of messageIds) {
      await this.storage.deleteMessage(this.name, messageId);
    }
    
    // Reset relevant stats
    this.stats.oldestMessageTimestamp = null;
    this.stats.newestMessageTimestamp = null;
    
    // Emit event
    this.emit('queuePurged', { queue: this.name, messageCount });
    
    logger.info(`Purged ${messageCount} messages from queue ${this.name}`);
    return messageCount;
  }

  /**
   * Get queue attributes and statistics
   * @returns {Promise<Object>} Queue attributes
   */
  async getQueueAttributes() {
    // Update message count stats
    const messageCount = this.messages.size;
    const processingCount = this.processingMessages.size;
    
    // Get additional stats from storage
    const messageIds = await this.storage.listMessages(this.name);
    
    return {
      name: this.name,
      type: this.constructor.name,
      options: this.options,
      stats: {
        ...this.stats,
        messageCount,
        processingCount,
        storedMessageCount: messageIds.length
      },
      deadLetterQueue: this.deadLetterQueue ? this.deadLetterQueue.name : null
    };
  }

  /**
   * Set queue attributes
   * @param {Object} attributes - Queue attributes to set
   * @returns {Promise<Object>} Updated queue attributes
   */
  async setQueueAttributes(attributes) {
    // Update options
    if (attributes.options) {
      this.options = {
        ...this.options,
        ...attributes.options
      };
    }
    
    // Persist queue data
    await this._persistQueueData();
    
    // Emit event
    this.emit('queueAttributesUpdated', { 
      queue: this.name, 
      attributes: { options: this.options }
    });
    
    logger.info(`Updated attributes for queue ${this.name}`);
    return this.getQueueAttributes();
  }

  /**
   * Check for expired messages and handle them
   * @private
   */
  async _processExpiredMessages() {
    const now = new Date();
    const expiredMessages = Array.from(this.messages.entries())
      .filter(([_, msg]) => new Date(msg.metadata.expiresAt) <= now);
    
    for (const [messageId, messageData] of expiredMessages) {
      // Remove from queue
      this.messages.delete(messageId);
      this.processingMessages.delete(messageId);
      
      // Delete from storage
      await this.storage.deleteMessage(this.name, messageId);
      
      // Update stats
      this._updateStats('totalExpired');
      
      // Emit event
      this.emit('messageExpired', { queue: this.name, messageId, message: messageData });
      
      logger.info(`Message expired in queue ${this.name}: ${messageId}`);
    }
    
    return expiredMessages.length;
  }

  /**
   * Check for messages that have exceeded visibility timeout and make them visible again
   * @private
   */
  async _processVisibilityTimeouts() {
    const now = new Date();
    const timedOutMessages = Array.from(this.processingMessages.entries())
      .filter(([_, msg]) => new Date(msg.metadata.processingExpiresAt) <= now);
    
    for (const [messageId, messageData] of timedOutMessages) {
      // Check if we should retry or dead letter
      if (messageData.metadata.retryCount >= this.options.maxRetries) {
        // Move to dead letter queue if configured
        if (this.deadLetterQueue) {
          await this.deadLetterMessage(messageId, 'Exceeded maximum retry count');
        } else {
          // Just remove the message
          this.messages.delete(messageId);
          this.processingMessages.delete(messageId);
          await this.storage.deleteMessage(this.name, messageId);
          
          // Update stats
          this._updateStats('totalFailed');
          
          // Emit event
          this.emit('messageFailed', { 
            queue: this.name, 
            messageId, 
            reason: 'Exceeded maximum retry count'
          });
        }
      } else {
        // Make visible again with incremented retry count
        messageData.metadata.retryCount++;
        messageData.metadata.visibleAt = now.toISOString();
        this.messages.set(messageId, messageData);
        this.processingMessages.delete(messageId);
        
        // Update in storage
        await this.storage.saveMessage(this.name, messageId, messageData);
        
        // Emit event
        this.emit('messageRequeued', { 
          queue: this.name, 
          messageId, 
          retryCount: messageData.metadata.retryCount
        });
        
        logger.info(`Message requeued in ${this.name}: ${messageId} (retry ${messageData.metadata.retryCount}/${this.options.maxRetries})`);
      }
    }
    
    return timedOutMessages.length;
  }

  /**
   * Maintenance method to handle expired messages and visibility timeouts
   * Should be called periodically
   * @returns {Promise<Object>} Maintenance results
   */
  async maintenance() {
    const expiredCount = await this._processExpiredMessages();
    const timedOutCount = await this._processVisibilityTimeouts();
    
    return {
      expiredMessagesProcessed: expiredCount,
      timedOutMessagesProcessed: timedOutCount
    };
  }
}

module.exports = BaseQueue;
