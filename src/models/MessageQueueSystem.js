/**
 * MessageQueueSystem.js
 * Comprehensive message queue system with support for multiple queue types,
 * persistence, acknowledgment, monitoring, and more.
 */

const EventEmitter = require('events');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { StorageFactory } = require('./queue/storage');
const { FifoQueue, PriorityQueue, DelayedQueue } = require('./queue/types');
const { 
  QueueError, 
  QueueNotFoundError,
  MessageNotFoundError,
  QueueValidationError
} = require('../utils/errors/QueueErrors');

/**
 * Message Queue System
 * Manages multiple queues with different types and configurations
 */
class MessageQueueSystem extends EventEmitter {
  /**
   * Initialize the message queue system
   * @param {Object} [options={}] - System options
   * @param {string} [options.storageType='memory'] - Storage type ('memory', 'file')
   * @param {Object} [options.storageOptions={}] - Storage-specific options
   * @param {number} [options.maintenanceInterval=60000] - Interval for maintenance tasks in ms
   * @param {boolean} [options.autoStart=true] - Whether to automatically start maintenance
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      storageType: options.storageType || 'memory',
      storageOptions: options.storageOptions || {},
      maintenanceInterval: options.maintenanceInterval || 60000, // 1 minute
      autoStart: options.autoStart !== undefined ? options.autoStart : true,
      ...options
    };
    
    // Initialize storage
    this.storage = StorageFactory.createStorage(
      this.options.storageType,
      this.options.storageOptions
    );
    
    // Track queues
    this.queues = new Map();
    
    // Maintenance timer
    this.maintenanceTimer = null;
    
    // Initialize the system
    this._initialize();
  }

  /**
   * Initialize the message queue system
   * @private
   */
  async _initialize() {
    try {
      // Check if storage is available
      const storageAvailable = await this.storage.isAvailable();
      
      if (!storageAvailable) {
        throw new Error(`Storage is not available: ${this.options.storageType}`);
      }
      
      // Load existing queues
      const queueNames = await this.storage.listQueues();
      
      for (const queueName of queueNames) {
        const queueData = await this.storage.loadQueue(queueName);
        
        if (queueData) {
          await this._loadQueue(queueName, queueData);
        }
      }
      
      logger.info(`MessageQueueSystem initialized with ${this.queues.size} queues`);
      
      // Start maintenance if auto-start is enabled
      if (this.options.autoStart) {
        this.startMaintenance();
      }
    } catch (error) {
      logger.logError('Failed to initialize MessageQueueSystem', error);
      throw error;
    }
  }

  /**
   * Load a queue from storage
   * @param {string} queueName - Name of the queue to load
   * @param {Object} queueData - Queue data from storage
   * @private
   */
  async _loadQueue(queueName, queueData) {
    try {
      // Create queue instance based on type
      let queue;
      
      switch (queueData.type) {
        case 'FifoQueue':
          queue = new FifoQueue(queueName, queueData.options, this.storage);
          break;
        case 'PriorityQueue':
          queue = new PriorityQueue(queueName, queueData.options, this.storage);
          break;
        case 'DelayedQueue':
          queue = new DelayedQueue(queueName, queueData.options, this.storage);
          break;
        default:
          // Default to FIFO queue
          queue = new FifoQueue(queueName, queueData.options, this.storage);
      }
      
      // Add to queues map
      this.queues.set(queueName, queue);
      
      // Forward queue events
      this._forwardQueueEvents(queue);
      
      logger.info(`Loaded queue: ${queueName} (${queueData.type})`);
    } catch (error) {
      logger.logError(`Failed to load queue ${queueName}`, error);
    }
  }

  /**
   * Forward events from a queue to the system
   * @param {BaseQueue} queue - Queue to forward events from
   * @private
   */
  _forwardQueueEvents(queue) {
    const events = [
      'messageSent',
      'messagesReceived',
      'messageAcknowledged',
      'messageDeadLettered',
      'messageFailed',
      'messageExpired',
      'messageRequeued',
      'queuePurged',
      'queueAttributesUpdated',
      'messagesVisible',
      'messageDelayChanged'
    ];
    
    for (const event of events) {
      queue.on(event, (data) => {
        this.emit(event, { ...data, queueName: queue.name });
      });
    }
  }

  /**
   * Start the maintenance timer
   */
  startMaintenance() {
    if (this.maintenanceTimer) {
      return;
    }
    
    this.maintenanceTimer = setInterval(() => {
      this._performMaintenance().catch(error => {
        logger.logError('Error during queue maintenance', error);
      });
    }, this.options.maintenanceInterval);
    
    // Ensure timer doesn't prevent process from exiting
    this.maintenanceTimer.unref();
    
    logger.info(`Queue maintenance started (interval: ${this.options.maintenanceInterval}ms)`);
  }

  /**
   * Stop the maintenance timer
   */
  stopMaintenance() {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
      logger.info('Queue maintenance stopped');
    }
  }

  /**
   * Perform maintenance tasks on all queues
   * @private
   */
  async _performMaintenance() {
    const results = {};
    
    for (const [queueName, queue] of this.queues.entries()) {
      try {
        results[queueName] = await queue.maintenance();
      } catch (error) {
        logger.logError(`Maintenance failed for queue ${queueName}`, error);
        results[queueName] = { error: error.message };
      }
    }
    
    // Emit maintenance event
    this.emit('maintenanceCompleted', { results });
    
    return results;
  }

  /**
   * Create a new queue
   * @param {string} name - Queue name
   * @param {Object} [options={}] - Queue options
   * @param {string} [options.type='fifo'] - Queue type ('fifo', 'priority', 'delayed')
   * @returns {Promise<Object>} Created queue
   */
  async createQueue(name, options = {}) {
    // Check if queue already exists
    if (this.queues.has(name)) {
      throw new QueueValidationError(`Queue already exists: ${name}`);
    }
    
    // Validate queue name
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new QueueValidationError('Queue name must be a non-empty string');
    }
    
    // Normalize queue name
    const queueName = name.trim();
    
    // Determine queue type
    const queueType = (options.type || 'fifo').toLowerCase();
    
    // Create queue instance
    let queue;
    
    switch (queueType) {
      case 'fifo':
        queue = new FifoQueue(queueName, options, this.storage);
        break;
      case 'priority':
        queue = new PriorityQueue(queueName, options, this.storage);
        break;
      case 'delayed':
        queue = new DelayedQueue(queueName, options, this.storage);
        break;
      default:
        throw new QueueValidationError(`Invalid queue type: ${queueType}`);
    }
    
    // Add to queues map
    this.queues.set(queueName, queue);
    
    // Forward queue events
    this._forwardQueueEvents(queue);
    
    // Emit event
    this.emit('queueCreated', { 
      queueName, 
      type: queueType,
      options
    });
    
    logger.info(`Created queue: ${queueName} (${queueType})`);
    
    return queue;
  }

  /**
   * Delete a queue
   * @param {string} name - Name of the queue to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteQueue(name) {
    // Check if queue exists
    if (!this.queues.has(name)) {
      throw new QueueNotFoundError(name);
    }
    
    // Get queue
    const queue = this.queues.get(name);
    
    // Clean up resources
    if (typeof queue.cleanup === 'function') {
      queue.cleanup();
    }
    
    // Delete from storage
    await this.storage.deleteQueue(name);
    
    // Remove from queues map
    this.queues.delete(name);
    
    // Emit event
    this.emit('queueDeleted', { queueName: name });
    
    logger.info(`Deleted queue: ${name}`);
    
    return true;
  }

  /**
   * Send a message to a queue
   * @param {string} queueName - Name of the queue
   * @param {*} message - Message to send
   * @param {Object} [options={}] - Message options
   * @returns {Promise<string>} Message ID
   */
  async sendMessage(queueName, message, options = {}) {
    // Check if queue exists
    if (!this.queues.has(queueName)) {
      throw new QueueNotFoundError(queueName);
    }
    
    // Get queue
    const queue = this.queues.get(queueName);
    
    // Send message
    return await queue.sendMessage(message, options);
  }

  /**
   * Receive messages from a queue
   * @param {string} queueName - Name of the queue
   * @param {Object} [options={}] - Receive options
   * @returns {Promise<Array<Object>>} Received messages
   */
  async receiveMessages(queueName, options = {}) {
    // Check if queue exists
    if (!this.queues.has(queueName)) {
      throw new QueueNotFoundError(queueName);
    }
    
    // Get queue
    const queue = this.queues.get(queueName);
    
    // Receive messages
    return await queue.receiveMessages(options);
  }

  /**
   * Acknowledge a message as processed
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message to acknowledge
   * @returns {Promise<boolean>} Success status
   */
  async acknowledgeMessage(queueName, messageId) {
    // Check if queue exists
    if (!this.queues.has(queueName)) {
      throw new QueueNotFoundError(queueName);
    }
    
    // Get queue
    const queue = this.queues.get(queueName);
    
    // Acknowledge message
    return await queue.acknowledgeMessage(messageId);
  }

  /**
   * Move a message to the dead letter queue
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message
   * @param {string} reason - Reason for moving to dead letter queue
   * @returns {Promise<boolean>} Success status
   */
  async deadLetterMessage(queueName, messageId, reason) {
    // Check if queue exists
    if (!this.queues.has(queueName)) {
      throw new QueueNotFoundError(queueName);
    }
    
    // Get queue
    const queue = this.queues.get(queueName);
    
    // Move to dead letter queue
    return await queue.deadLetterMessage(messageId, reason);
  }

  /**
   * Purge all messages from a queue
   * @param {string} queueName - Name of the queue
   * @returns {Promise<number>} Number of messages purged
   */
  async purgeQueue(queueName) {
    // Check if queue exists
    if (!this.queues.has(queueName)) {
      throw new QueueNotFoundError(queueName);
    }
    
    // Get queue
    const queue = this.queues.get(queueName);
    
    // Purge queue
    return await queue.purgeQueue();
  }

  /**
   * Get queue attributes and statistics
   * @param {string} queueName - Name of the queue
   * @returns {Promise<Object>} Queue attributes
   */
  async getQueueAttributes(queueName) {
    // Check if queue exists
    if (!this.queues.has(queueName)) {
      throw new QueueNotFoundError(queueName);
    }
    
    // Get queue
    const queue = this.queues.get(queueName);
    
    // Get attributes
    return await queue.getQueueAttributes();
  }

  /**
   * Set queue attributes
   * @param {string} queueName - Name of the queue
   * @param {Object} attributes - Queue attributes to set
   * @returns {Promise<Object>} Updated queue attributes
   */
  async setQueueAttributes(queueName, attributes) {
    // Check if queue exists
    if (!this.queues.has(queueName)) {
      throw new QueueNotFoundError(queueName);
    }
    
    // Get queue
    const queue = this.queues.get(queueName);
    
    // Set attributes
    return await queue.setQueueAttributes(attributes);
  }

  /**
   * List all queues
   * @param {string} [prefix] - Optional prefix to filter queues
   * @returns {Promise<Array<string>>} List of queue names
   */
  async listQueues(prefix) {
    // Get queue names from storage
    const queueNames = await this.storage.listQueues(prefix);
    
    // Filter by prefix if provided
    if (prefix) {
      return queueNames.filter(name => name.startsWith(prefix));
    }
    
    return queueNames;
  }

  /**
   * Set up a dead letter queue for a source queue
   * @param {string} sourceQueueName - Name of the source queue
   * @param {string} deadLetterQueueName - Name of the dead letter queue
   * @returns {Promise<boolean>} Success status
   */
  async setDeadLetterQueue(sourceQueueName, deadLetterQueueName) {
    // Check if source queue exists
    if (!this.queues.has(sourceQueueName)) {
      throw new QueueNotFoundError(sourceQueueName);
    }
    
    // Check if dead letter queue exists
    if (!this.queues.has(deadLetterQueueName)) {
      throw new QueueNotFoundError(deadLetterQueueName);
    }
    
    // Get queues
    const sourceQueue = this.queues.get(sourceQueueName);
    const deadLetterQueue = this.queues.get(deadLetterQueueName);
    
    // Set dead letter queue
    sourceQueue.setDeadLetterQueue(deadLetterQueue);
    
    // Emit event
    this.emit('deadLetterQueueSet', { 
      sourceQueueName, 
      deadLetterQueueName
    });
    
    logger.info(`Set dead letter queue for ${sourceQueueName}: ${deadLetterQueueName}`);
    
    return true;
  }

  /**
   * Change the delay of a message in a delayed queue
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message
   * @param {number} delaySeconds - New delay in seconds
   * @returns {Promise<boolean>} Success status
   */
  async changeMessageDelay(queueName, messageId, delaySeconds) {
    // Check if queue exists
    if (!this.queues.has(queueName)) {
      throw new QueueNotFoundError(queueName);
    }
    
    // Get queue
    const queue = this.queues.get(queueName);
    
    // Check if queue supports changing delay
    if (typeof queue.changeMessageDelay !== 'function') {
      throw new QueueError(`Queue ${queueName} does not support changing message delay`);
    }
    
    // Change message delay
    return await queue.changeMessageDelay(messageId, delaySeconds);
  }

  /**
   * Get system statistics
   * @returns {Promise<Object>} System statistics
   */
  async getSystemStats() {
    const queueStats = {};
    let totalMessageCount = 0;
    let totalProcessingCount = 0;
    
    // Get stats for each queue
    for (const [queueName, queue] of this.queues.entries()) {
      const attributes = await queue.getQueueAttributes();
      queueStats[queueName] = attributes.stats;
      
      totalMessageCount += attributes.stats.messageCount || 0;
      totalProcessingCount += attributes.stats.processingCount || 0;
    }
    
    return {
      queueCount: this.queues.size,
      totalMessageCount,
      totalProcessingCount,
      queueStats,
      storageType: this.options.storageType,
      maintenanceInterval: this.options.maintenanceInterval,
      maintenanceActive: !!this.maintenanceTimer
    };
  }

  /**
   * Clean up resources when the system is no longer needed
   */
  cleanup() {
    // Stop maintenance
    this.stopMaintenance();
    
    // Clean up queues
    for (const [queueName, queue] of this.queues.entries()) {
      if (typeof queue.cleanup === 'function') {
        queue.cleanup();
      }
    }
    
    logger.info('MessageQueueSystem cleaned up');
  }
}

module.exports = MessageQueueSystem;
