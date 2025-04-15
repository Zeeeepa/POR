/**
 * BaseStorage.js
 * Base storage adapter for message queue persistence
 */

/**
 * Abstract base class for queue storage adapters
 */
class BaseStorage {
  /**
   * Initialize the storage adapter
   * @param {Object} options - Storage options
   */
  constructor(options = {}) {
    this.options = options;
    
    // Ensure this class is not instantiated directly
    if (this.constructor === BaseStorage) {
      throw new Error('BaseStorage is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Save a queue to storage
   * @param {string} queueName - Name of the queue
   * @param {Object} queueData - Queue data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveQueue(queueName, queueData) {
    throw new Error('Method saveQueue() must be implemented by subclass');
  }

  /**
   * Load a queue from storage
   * @param {string} queueName - Name of the queue to load
   * @returns {Promise<Object|null>} Queue data or null if not found
   */
  async loadQueue(queueName) {
    throw new Error('Method loadQueue() must be implemented by subclass');
  }

  /**
   * Delete a queue from storage
   * @param {string} queueName - Name of the queue to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteQueue(queueName) {
    throw new Error('Method deleteQueue() must be implemented by subclass');
  }

  /**
   * List all queues in storage
   * @param {string} [prefix] - Optional prefix to filter queues
   * @returns {Promise<Array<string>>} List of queue names
   */
  async listQueues(prefix) {
    throw new Error('Method listQueues() must be implemented by subclass');
  }

  /**
   * Save a message to storage
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message
   * @param {Object} messageData - Message data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveMessage(queueName, messageId, messageData) {
    throw new Error('Method saveMessage() must be implemented by subclass');
  }

  /**
   * Load a message from storage
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message to load
   * @returns {Promise<Object|null>} Message data or null if not found
   */
  async loadMessage(queueName, messageId) {
    throw new Error('Method loadMessage() must be implemented by subclass');
  }

  /**
   * Delete a message from storage
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteMessage(queueName, messageId) {
    throw new Error('Method deleteMessage() must be implemented by subclass');
  }

  /**
   * List all messages in a queue
   * @param {string} queueName - Name of the queue
   * @returns {Promise<Array<string>>} List of message IDs
   */
  async listMessages(queueName) {
    throw new Error('Method listMessages() must be implemented by subclass');
  }

  /**
   * Check if storage is available
   * @returns {Promise<boolean>} True if storage is available
   */
  async isAvailable() {
    throw new Error('Method isAvailable() must be implemented by subclass');
  }

  /**
   * Clear all data from storage
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    throw new Error('Method clear() must be implemented by subclass');
  }
}

module.exports = BaseStorage;
