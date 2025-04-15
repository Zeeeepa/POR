/**
 * FileStorage.js
 * File-based storage adapter for message queue persistence
 */

const fs = require('fs-extra');
const path = require('path');
const BaseStorage = require('./BaseStorage');
const { StorageError } = require('../../../utils/errors/QueueErrors');

/**
 * File-based storage adapter for queue persistence
 */
class FileStorage extends BaseStorage {
  /**
   * Initialize the file storage
   * @param {Object} options - Storage options
   * @param {string} [options.directory='./data/queues'] - Directory to store queue data
   */
  constructor(options = {}) {
    super(options);
    this.directory = options.directory || path.join(process.cwd(), 'data', 'queues');
    this.queuesDir = path.join(this.directory, 'queues');
    this.messagesDir = path.join(this.directory, 'messages');
    
    // Ensure directories exist
    this._ensureDirectories();
  }

  /**
   * Ensure required directories exist
   * @private
   */
  _ensureDirectories() {
    try {
      fs.ensureDirSync(this.directory);
      fs.ensureDirSync(this.queuesDir);
      fs.ensureDirSync(this.messagesDir);
    } catch (error) {
      throw new StorageError('ensureDirectories', error);
    }
  }

  /**
   * Get the file path for a queue
   * @param {string} queueName - Name of the queue
   * @returns {string} File path
   * @private
   */
  _getQueuePath(queueName) {
    return path.join(this.queuesDir, `${queueName}.json`);
  }

  /**
   * Get the directory path for queue messages
   * @param {string} queueName - Name of the queue
   * @returns {string} Directory path
   * @private
   */
  _getQueueMessagesDir(queueName) {
    return path.join(this.messagesDir, queueName);
  }

  /**
   * Get the file path for a message
   * @param {string} queueName - Name of the queue
   * @param {string} messageId - ID of the message
   * @returns {string} File path
   * @private
   */
  _getMessagePath(queueName, messageId) {
    return path.join(this._getQueueMessagesDir(queueName), `${messageId}.json`);
  }

  /**
   * Save a queue to storage
   * @param {string} queueName - Name of the queue
   * @param {Object} queueData - Queue data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveQueue(queueName, queueData) {
    try {
      const queuePath = this._getQueuePath(queueName);
      await fs.writeJson(queuePath, queueData, { spaces: 2 });
      
      // Ensure message directory exists for this queue
      const messagesDir = this._getQueueMessagesDir(queueName);
      await fs.ensureDir(messagesDir);
      
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
      const queuePath = this._getQueuePath(queueName);
      
      if (await fs.pathExists(queuePath)) {
        return await fs.readJson(queuePath);
      }
      
      return null;
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
      const queuePath = this._getQueuePath(queueName);
      const messagesDir = this._getQueueMessagesDir(queueName);
      
      // Check if queue exists
      const queueExists = await fs.pathExists(queuePath);
      
      if (queueExists) {
        // Delete queue file
        await fs.remove(queuePath);
        
        // Delete all messages for this queue
        if (await fs.pathExists(messagesDir)) {
          await fs.remove(messagesDir);
        }
        
        return true;
      }
      
      return false;
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
      // Ensure directory exists
      await fs.ensureDir(this.queuesDir);
      
      // Get all queue files
      const files = await fs.readdir(this.queuesDir);
      
      // Extract queue names from filenames
      const queueNames = files
        .filter(file => file.endsWith('.json'))
        .map(file => file.slice(0, -5)); // Remove .json extension
      
      // Filter by prefix if provided
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
      const queuePath = this._getQueuePath(queueName);
      if (!(await fs.pathExists(queuePath))) {
        return false;
      }
      
      // Ensure message directory exists
      const messagesDir = this._getQueueMessagesDir(queueName);
      await fs.ensureDir(messagesDir);
      
      // Save message
      const messagePath = this._getMessagePath(queueName, messageId);
      await fs.writeJson(messagePath, messageData, { spaces: 2 });
      
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
      const messagePath = this._getMessagePath(queueName, messageId);
      
      if (await fs.pathExists(messagePath)) {
        return await fs.readJson(messagePath);
      }
      
      return null;
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
      const messagePath = this._getMessagePath(queueName, messageId);
      
      if (await fs.pathExists(messagePath)) {
        await fs.remove(messagePath);
        return true;
      }
      
      return false;
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
      const messagesDir = this._getQueueMessagesDir(queueName);
      
      // Check if directory exists
      if (!(await fs.pathExists(messagesDir))) {
        return [];
      }
      
      // Get all message files
      const files = await fs.readdir(messagesDir);
      
      // Extract message IDs from filenames
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.slice(0, -5)); // Remove .json extension
    } catch (error) {
      throw new StorageError('listMessages', error);
    }
  }

  /**
   * Check if storage is available
   * @returns {Promise<boolean>} True if storage is available
   */
  async isAvailable() {
    try {
      // Check if we can write to the directory
      const testFile = path.join(this.directory, '.test');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all data from storage
   * @returns {Promise<boolean>} Success status
   */
  async clear() {
    try {
      // Remove and recreate directories
      await fs.remove(this.queuesDir);
      await fs.remove(this.messagesDir);
      await fs.ensureDir(this.queuesDir);
      await fs.ensureDir(this.messagesDir);
      return true;
    } catch (error) {
      throw new StorageError('clear', error);
    }
  }
}

module.exports = FileStorage;
