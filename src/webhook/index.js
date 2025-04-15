/**
 * Webhook Module Index
 * Exports all webhook module components
 */

const WebhookManager = require('./WebhookManager');
const WebhookServer = require('./webhookServer');
const setupDashboard = require('./dashboard');

/**
 * Create a new webhook manager
 * @param {Object} options - Configuration options
 * @returns {WebhookManager} New webhook manager instance
 */
function createWebhookManager(options = {}) {
  return new WebhookManager(options);
}

/**
 * Create a new webhook server
 * @param {Object} options - Configuration options
 * @returns {WebhookServer} New webhook server instance
 */
function createWebhookServer(options = {}) {
  return new WebhookServer(options);
}

// Export all components
module.exports = {
  // Main exports
  WebhookManager,
  WebhookServer,
  setupDashboard,
  
  // Factory functions
  createWebhookManager,
  createWebhookServer,
  
  // Example implementations
  examples: {
    consolidated: require('./example-consolidated'),
    traditional: require('./example')
  }
};
