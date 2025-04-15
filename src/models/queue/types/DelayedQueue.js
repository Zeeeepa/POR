/**
 * DelayedQueue.js
 * Delayed queue implementation
 */

const BaseQueue = require('./BaseQueue');
const logger = require('../../../utils/logger');

/**
 * Delayed queue implementation
 * Messages are not visible for processing until after a specified delay
 */
class DelayedQueue extends BaseQueue {
  /**
   * Initialize the delayed queue
   * @param {string} name - Queue name
   * @param {Object} options - Queue options
   * @param {Object} storage - Storage adapter
   */
  constructor(name, options = {}, storage) {
    super(name, options, storage);
    
    // Delayed-specific options
    this.options.defaultDelay = options.defaultDelay || 0; // milliseconds
    this.options.maxDelay = options.maxDelay || 900000; // 15 minutes
    
    // Track delayed messages
    this.delayedMessages = new Map();
    
    // Initialize delayed messages from existing messages
    this._initializeDelayedMessages();
    
    // Start the timer to check for messages becoming visible
    this._startDelayTimer();
    
    logger.info(`Delayed queue ${name} initialized`);
  }

  /**
   * Initialize delayed messages from existing messages
   * @private
   */
  async _initializeDelayedMessages() {
    try {
      // Find messages that are still delayed
      const now = new Date();
      
      for (const [messageId, messageData] of this.messages.entries()) {
        const visibleAt = new Date(messageData.metadata.visibleAt);
        
        if (visibleAt > now) {
          this.delayedMessages.set(messageId, {
            visibleAt,
            messageData
          });
        }
      }
      
      logger.info(`Initialized ${this.delayedMessages.size} delayed messages for queue ${this.name}`);
    } catch (error) {
      logger.logError(`Failed to initialize delayed messages for queue ${this.name}`, error);
    }
  }

  /**
   * Start the timer to check for messages becoming visible
   * @private
   */
  _startDelayTimer() {
    // Check every second for messages becoming visible
    this.delayTimer = setInterval(() => {
      this._checkDelayedMessages().catch(error => {
        logger.logError(`Error checking delayed messages for queue ${this.name}`, error);
      });
    }, 1000);
    
    // Ensure timer doesn't prevent process from exiting
    this.delayTimer.unref();
  }

  /**
   * Check for delayed messages that have become visible
   * @private
   */
  async _checkDelayedMessages() {
    const now = new Date();
    const visibleMessages = [];
    
    // Find messages that have become visible
    for (const [messageId, { visibleAt }] of this.delayedMessages.entries()) {
      if (visibleAt <= now) {
        visibleMessages.push(messageId);
      }
    }
    
    // Remove from delayed messages
    for (const messageId of visibleMessages) {
      this.delayedMessages.delete(messageId);
    }
    
    if (visibleMessages.length > 0) {
      logger.info(`${visibleMessages.length} delayed messages became visible in queue ${this.name}`);
      
      // Emit event
      this.emit('messagesVisible', { 
        queue: this.name, 
        count: visibleMessages.length,
        messageIds: visibleMessages
      });
    }
  }

  /**
   * Send a message to the queue
   * @param {*} message - Message to send
   * @param {Object} [options={}] - Message options
   * @param {number} [options.delaySeconds] - Delay in seconds before the message is visible
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(message, options = {}) {
    const delaySeconds = options.delaySeconds !== undefined ? 
      options.delaySeconds : 
      this.options.defaultDelay / 1000;
    
    // Validate delay
    if (delaySeconds < 0 || delaySeconds > this.options.maxDelay / 1000) {
      throw new Error(`Invalid delay: ${delaySeconds}. Must be between 0 and ${this.options.maxDelay / 1000} seconds`);
    }
    
    // Calculate visibility time
    const now = new Date();
    const visibleAt = new Date(now.getTime() + (delaySeconds * 1000));
    
    // Add delay-specific attributes and metadata
    const delayOptions = {
      ...options,
      attributes: {
        ...options.attributes,
        delaySeconds
      },
      metadata: {
        ...options.metadata,
        visibleAt: visibleAt.toISOString()
      }
    };
    
    // Send message using base implementation
    const messageId = await super.sendMessage(message, delayOptions);
    
    // Track delayed message if it has a delay
    if (delaySeconds > 0) {
      this.delayedMessages.set(messageId, {
        visibleAt,
        messageData: this.messages.get(messageId)
      });
      
      logger.info(`Message ${messageId} added to delayed queue ${this.name} with ${delaySeconds}s delay`);
    }
    
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
    // Only visible messages can be received, so we use the base implementation
    return super.receiveMessages(options);
  }

  /**
   * Change the delay of a message
   * @param {string} messageId - ID of the message
   * @param {number} delaySeconds - New delay in seconds
   * @returns {Promise<boolean>} Success status
   */
  async changeMessageDelay(messageId, delaySeconds) {
    // Check if message exists
    if (!this.messages.has(messageId)) {
      throw new Error(`Message not found: ${messageId}`);
    }
    
    // Validate delay
    if (delaySeconds < 0 || delaySeconds > this.options.maxDelay / 1000) {
      throw new Error(`Invalid delay: ${delaySeconds}. Must be between 0 and ${this.options.maxDelay / 1000} seconds`);
    }
    
    // Get message data
    const messageData = this.messages.get(messageId);
    
    // Calculate new visibility time
    const now = new Date();
    const visibleAt = new Date(now.getTime() + (delaySeconds * 1000));
    
    // Update message metadata
    messageData.metadata.visibleAt = visibleAt.toISOString();
    messageData.attributes.delaySeconds = delaySeconds;
    
    // Update in storage
    await this.storage.saveMessage(this.name, messageId, messageData);
    
    // Update delayed messages tracking
    if (delaySeconds > 0) {
      this.delayedMessages.set(messageId, {
        visibleAt,
        messageData
      });
    } else {
      this.delayedMessages.delete(messageId);
    }
    
    // Emit event
    this.emit('messageDelayChanged', { 
      queue: this.name, 
      messageId, 
      delaySeconds,
      visibleAt: visibleAt.toISOString()
    });
    
    logger.info(`Changed delay for message ${messageId} in queue ${this.name} to ${delaySeconds}s`);
    return true;
  }

  /**
   * Get queue attributes and statistics
   * @returns {Promise<Object>} Queue attributes
   */
  async getQueueAttributes() {
    const attributes = await super.getQueueAttributes();
    
    return {
      ...attributes,
      stats: {
        ...attributes.stats,
        delayedMessageCount: this.delayedMessages.size
      }
    };
  }

  /**
   * Clean up resources when the queue is no longer needed
   */
  cleanup() {
    if (this.delayTimer) {
      clearInterval(this.delayTimer);
      this.delayTimer = null;
    }
  }
}

module.exports = DelayedQueue;
