/**
 * StorageFactory.js
 * Factory for creating storage adapters
 */

const MemoryStorage = require('./MemoryStorage');
const FileStorage = require('./FileStorage');
const { QueueValidationError } = require('../../../utils/errors/QueueErrors');

/**
 * Factory for creating storage adapters
 */
class StorageFactory {
  /**
   * Create a storage adapter
   * @param {string} type - Storage type ('memory', 'file')
   * @param {Object} options - Storage options
   * @returns {BaseStorage} Storage adapter instance
   */
  static createStorage(type, options = {}) {
    switch (type.toLowerCase()) {
      case 'memory':
        return new MemoryStorage(options);
      case 'file':
        return new FileStorage(options);
      default:
        throw new QueueValidationError(`Unsupported storage type: ${type}`);
    }
  }
}

module.exports = StorageFactory;
