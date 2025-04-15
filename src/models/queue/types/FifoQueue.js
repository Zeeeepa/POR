/**
 * FifoQueue.js
 * First-In-First-Out queue implementation
 */

const BaseQueue = require('./BaseQueue');
const logger = require('../../../utils/logger');

/**
 * First-In-First-Out queue implementation
 * Messages are processed in the exact order they were sent
 */
class FifoQueue extends BaseQueue {
  /**
   * Initialize the FIFO queue
   * @param {string} name - Queue name
   * @param {Object} options - Queue options
   * @param {Object} storage - Storage adapter
   */
  constructor(name, options = {}, storage) {
    super(name, options, storage);
    
    // FIFO-specific options
    this.options.deduplicationScope = options.deduplicationScope || 'messageGroup';
    this.options.contentBasedDeduplication = options.contentBasedDeduplication || false;
    
    // Track message groups for ordering
    this.messageGroups = new Map();
    
    logger.info(`FIFO queue ${name} initialized`);
  }

  /**
   * Send a message to the queue
   * @param {*} message - Message to send
   * @param {Object} [options={}] - Message options
   * @param {string} [options.messageGroupId='default'] - Message group ID for ordering
   * @param {string} [options.messageDeduplicationId] - Deduplication ID
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(message, options = {}) {
    const messageGroupId = options.messageGroupId || 'default';
    const messageDeduplicationId = options.messageDeduplicationId || this._generateDeduplicationId(message);
    
    // Check for duplicate messages if deduplication is enabled
    if (this.options.contentBasedDeduplication || options.messageDeduplicationId) {
      const isDuplicate = await this._checkForDuplicate(messageGroupId, messageDeduplicationId);
      if (isDuplicate) {
        logger.info(`Duplicate message detected in FIFO queue ${this.name}: ${messageDeduplicationId}`);
        return messageDeduplicationId;
      }
    }
    
    // Add FIFO-specific attributes
    const fifoOptions = {
      ...options,
      attributes: {
        ...options.attributes,
        messageGroupId,
        messageDeduplicationId
      }
    };
    
    // Send message using base implementation
    const messageId = await super.sendMessage(message, fifoOptions);
    
    // Track message in its group
    if (!this.messageGroups.has(messageGroupId)) {
      this.messageGroups.set(messageGroupId, []);
    }
    this.messageGroups.get(messageGroupId).push(messageId);
    
    return messageId;
  }

  /**
   * Receive messages from the queue
   * @param {Object} [options={}] - Receive options
   * @param {number} [options.maxMessages=1] - Maximum number of messages to receive
   * @param {number} [options.visibilityTimeout] - Visibility timeout in milliseconds
   * @param {string} [options.messageGroupId] - Specific message group to receive from
   * @returns {Promise<Array<Object>>} Received messages
   */
  async receiveMessages(options = {}) {
    const maxMessages = options.maxMessages || 1;
    const messageGroupId = options.messageGroupId;
    
    // If a specific message group is requested, only get messages from that group
    if (messageGroupId) {
      return this._receiveMessagesFromGroup(messageGroupId, maxMessages, options);
    }
    
    // Otherwise, try to get messages from any group, maintaining FIFO order within groups
    const receivedMessages = [];
    const activeGroups = Array.from(this.messageGroups.keys());
    
    // Round-robin through groups to get messages
    for (let i = 0; receivedMessages.length < maxMessages && i < activeGroups.length; i++) {
      const groupMessages = await this._receiveMessagesFromGroup(
        activeGroups[i], 
        maxMessages - receivedMessages.length, 
        options
      );
      
      receivedMessages.push(...groupMessages);
    }
    
    return receivedMessages;
  }

  /**
   * Receive messages from a specific message group
   * @param {string} messageGroupId - Message group ID
   * @param {number} maxMessages - Maximum number of messages to receive
   * @param {Object} options - Receive options
   * @returns {Promise<Array<Object>>} Received messages
   * @private
   */
  async _receiveMessagesFromGroup(messageGroupId, maxMessages, options) {
    // Get all messages
    const allMessages = Array.from(this.messages.entries());
    
    // Filter messages by group and sort by sent time
    const groupMessages = allMessages
      .filter(([_, msg]) => {
        return msg.attributes.messageGroupId === messageGroupId &&
               new Date(msg.metadata.visibleAt) <= new Date();
      })
      .sort((a, b) => new Date(a[1].metadata.sentAt) - new Date(b[1].metadata.sentAt));
    
    // Process messages in order
    const receivedMessages = [];
    
    for (let i = 0; i < Math.min(maxMessages, groupMessages.length); i++) {
      const [messageId, messageData] = groupMessages[i];
      
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
        messageGroupId,
        messages: receivedMessages.map(m => ({ id: m.id, metadata: m.metadata }))
      });
      
      logger.info(`Received ${receivedMessages.length} messages from FIFO queue ${this.name} (group: ${messageGroupId})`);
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
    
    // Get message group
    const messageGroupId = messageData.attributes.messageGroupId;
    
    // Remove from base queue
    const result = await super.acknowledgeMessage(messageId);
    
    // Remove from message group
    if (this.messageGroups.has(messageGroupId)) {
      const groupMessages = this.messageGroups.get(messageGroupId);
      const index = groupMessages.indexOf(messageId);
      
      if (index !== -1) {
        groupMessages.splice(index, 1);
      }
      
      // Clean up empty groups
      if (groupMessages.length === 0) {
        this.messageGroups.delete(messageGroupId);
      }
    }
    
    return result;
  }

  /**
   * Generate a deduplication ID for a message
   * @param {*} message - Message to generate ID for
   * @returns {string} Deduplication ID
   * @private
   */
  _generateDeduplicationId(message) {
    if (typeof message === 'string') {
      return require('crypto').createHash('md5').update(message).digest('hex');
    }
    
    return require('crypto').createHash('md5').update(JSON.stringify(message)).digest('hex');
  }

  /**
   * Check if a message is a duplicate
   * @param {string} messageGroupId - Message group ID
   * @param {string} deduplicationId - Deduplication ID
   * @returns {Promise<boolean>} True if duplicate
   * @private
   */
  async _checkForDuplicate(messageGroupId, deduplicationId) {
    // Check in-memory messages
    for (const [_, messageData] of this.messages.entries()) {
      if (messageData.attributes.messageDeduplicationId === deduplicationId) {
        if (this.options.deduplicationScope === 'queue' || 
            (this.options.deduplicationScope === 'messageGroup' && 
             messageData.attributes.messageGroupId === messageGroupId)) {
          return true;
        }
      }
    }
    
    return false;
  }
}

module.exports = FifoQueue;
