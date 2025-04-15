/**
 * MemoryStorage.js
 * In-memory storage adapter for message queue persistence
 */

const BaseStorage = require('./BaseStorage');
const { StorageError } = require('../../../utils/errors/QueueErrors');

/**
 * In-memory storage adapter for queue persistence
 */
class MemoryStorage extends BaseStorage {
  /**
   * Initialize the in-memory storage
   * @param {Object} options - Storage options
   */
  constructor(options = {}) {
    super(options);
    this.queues = new Map();
    this.messages = new Map();
  }

  /**
   * Save a queue to storage
   * @param {string} queueName - Name of the queue
   * @param {Object} queueData - Queue data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveQueue(queueName, queueData) {
    try {
      this.queues.set(queueName, { ...queueData });
      
      // Initialize message storage for this queue if it doesn't exist
      if (!this.messages.has(queueName)) {
        this.messages.set(queueName, new Map());
      }
      
      return true;
    } catch (error) {
      throw new StorageError('saveQueue', error);
    }
  }

  /**
   * Load a queue from storage
   * @param {string} queueName - Name of the queue to load
   * @returns {Promise<Object|null>} Queue data or null if not found
   */
  async loadQueue(queueName) {
    try {
      const queueData = this.queues.get(queueName);
      return queueData ? { ...queueData } : null;
    } catch (error) {
      throw new StorageError('loadQueue', error);
    }
  }

  /**
   * Delete a queue from storage
   * @param {string} queueName - Name of the queue to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteQueue(queueName) {
    try {
      const deleted = this.queues.delete(queueName);
      
      // Also delete all messages for this queue
      this.messages.delete(queueName);
      
      return deleted;
    } catch (error) {
      throw new StorageError('deleteQueue', error);
    }
  }

  /**
   * List all queues in storage
   * @param {string} [prefix] - Optional prefix to filter queues
   * @returns {Promise<Array<string>>} List of queue names
   */
  async listQueues(prefix = '') {
    try {
      const queueNames = Array.from(this.queues.keys());
      
      if (prefix) {
        return queueNames.filter(name => name.startsWith(prefix));
      }
      
      return queueNames;
    } catch (error) {
      throw new StorageError('listQueues', error);
    }
  }

  /**
   * Save a message to storage
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message
   * @param {Object} messageData - Message data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveMessage(queueName, messageId, messageData) {
    try {
      // Ensure queue exists
      if (!this.queues.has(queueName)) {
        return false;
      }
      
      // Ensure message storage for this queue exists
      if (!this.messages.has(queueName)) {
        this.messages.set(queueName, new Map());
      }
      
      // Save the message
      this.messages.get(queueName).set(messageId, { ...messageData });
      
      return true;
    } catch (error) {
      throw new StorageError('saveMessage', error);
    }
  }

  /**
   * Load a message from storage
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message to load
   * @returns {Promise<Object|null>} Message data or null if not found
   */
  async loadMessage(queueName, messageId) {
    try {
      // Ensure queue and message storage exist
      if (!this.queues.has(queueName) || !this.messages.has(queueName)) {
        return null;
      }
      
      const messageData = this.messages.get(queueName).get(messageId);
      return messageData ? { ...messageData } : null;
    } catch (error) {
      throw new StorageError('loadMessage', error);
    }
  }

  /**
   * Delete a message from storage
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteMessage(queueName, messageId) {
    try {
      // Ensure queue and message storage exist
      if (!this.queues.has(queueName) || !this.messages.has(queueName)) {
        return false;
      }
      
      return this.messages.get(queueName).delete(messageId);
    } catch (error) {
      throw new StorageError('deleteMessage', error);
    }
  }

  /**
   * List all messages in a queue
   * @param {string} queueName - Name of the queue
   * @returns {Promise<Array<string>>} List of message IDs
   */
  async listMessages(queueName) {
    try {
      // Ensure queue and message storage exist
      if (!this.queues.has(queueName) || !this.messages.has(queueName)) {
        return [];
      }
      
      return Array.from(this.messages.get(queueName).keys());
    } catch (error) {
      throw new StorageError('listMessages', error);
    }
  }

  /**
   * Check if storage is available
   * @returns {Promise<boolean>} True if storage is available
   */
  async isAvailable() {
    return true; // In-memory storage is always available
  }

  /**
   * Clear all data from storage
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    try {
      this.queues.clear();
      this.messages.clear();
      return true;
    } catch (error) {
      throw new StorageError('clear', error);
    }
  }
}

module.exports = MemoryStorage;
