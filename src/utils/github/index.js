/**
 * Unified GitHub integration module
 * This exports all GitHub-related functionality from a single entry point
 */

const GitHubEnhanced = require('../GitHubEnhanced');
const GitHubService = require('../GitHubService');
const webhookUtils = require('./webhookUtils');

// Export all GitHub-related components
module.exports = {
  GitHubEnhanced,
  GitHubService,
  webhookUtils
};
