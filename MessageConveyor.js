/**
 * MessageConveyor adapter for backward compatibility
 * This file re-exports the unified MessageQueueManager from src/models/MessageQueueManager.js
 */

// Import the unified MessageQueueManager
const MessageQueueManager = require('./src/models/MessageQueueManager');

// Create an instance with default config
const messageConveyor = new MessageQueueManager();

// Export the instance
module.exports = messageConveyor;
