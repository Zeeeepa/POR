/**
 * Storage module index
 * Exports all storage-related classes
 */

const BaseStorage = require('./BaseStorage');
const MemoryStorage = require('./MemoryStorage');
const FileStorage = require('./FileStorage');
const StorageFactory = require('./StorageFactory');

module.exports = {
  BaseStorage,
  MemoryStorage,
  FileStorage,
  StorageFactory
};
