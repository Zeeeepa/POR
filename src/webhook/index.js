/**
 * Webhook Module Index
 * Exports all webhook module components
 */

const WebhookServerManager = require('./WebhookManager');
const WebhookServer = require('./webhookServer');
const setupDashboard = require('./dashboard');
const GitHubWebhookManager = require('../utils/WebhookManager');

/**
 * Create a new webhook server manager
 * @param {Object} options - Configuration options
 * @returns {WebhookServerManager} New webhook server manager instance
 */
function createWebhookServerManager(options = {}) {
  return new WebhookServerManager(options);
}

/**
 * Create a new webhook server
 * @param {Object} options - Configuration options
 * @returns {WebhookServer} New webhook server instance
 */
function createWebhookServer(options = {}) {
  return new WebhookServer(options);
}

/**
 * Create a new GitHub webhook manager
 * @param {string} [githubToken] - GitHub personal access token
 * @param {string} [webhookUrl] - URL for the webhook
 * @returns {GitHubWebhookManager} New GitHub webhook manager instance
 */
function createGitHubWebhookManager(githubToken, webhookUrl) {
  return new GitHubWebhookManager(githubToken, webhookUrl);
}

// Export all components
module.exports = {
  // Main exports
  WebhookServerManager,
  WebhookServer,
  GitHubWebhookManager,
  setupDashboard,
  
  // Factory functions
  createWebhookServerManager,
  createWebhookServer,
  createGitHubWebhookManager,
  
  // Example implementations
  examples: {
    consolidated: require('./example-consolidated'),
    traditional: require('./example')
  }
};
