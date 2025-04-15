/**
 * Unified webhook module
 * This exports all webhook-related functionality from a single entry point
 */

const WebhookManager = require('./WebhookManager');
const webhookServer = require('./webhookServer');
const dashboard = require('./dashboard');

// Export all webhook-related components
module.exports = {
  WebhookManager,
  webhookServer,
  dashboard
};
