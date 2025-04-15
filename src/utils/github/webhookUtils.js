/**
 * webhookUtils.js
 * Utility functions for GitHub webhook handling
 */

const crypto = require('crypto');
const logger = require('../logger');
const validation = require('../validation');
const errorHandler = require('../errorHandler');

/**
 * Verify a GitHub webhook signature
 * @param {string} signature - X-Hub-Signature-256 header
 * @param {string} body - Raw request body
 * @param {string} secret - Webhook secret
 * @returns {boolean} Whether the signature is valid
 */
function verifySignature(signature, body, secret) {
  try {
    // Validate parameters
    validation.isString(signature, 'signature');
    validation.isString(body, 'body');
    validation.isString(secret, 'secret');
    
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(body).digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature)
    );
  } catch (error) {
    logger.error(`Webhook signature validation failed: ${error.message}`, { error: error.stack });
    return false;
  }
}

/**
 * Generate a summary of a webhook event
 * @param {string} event - Event type
 * @param {Object} payload - Event payload
 * @returns {string} Event summary
 */
function generateEventSummary(event, payload) {
  try {
    switch (event) {
      case 'push':
        return `${payload.commits?.length || 0} commits to ${payload.ref}`;
      case 'pull_request':
        return `${payload.action} PR #${payload.number || payload.pull_request?.number}: ${payload.pull_request?.title}`;
      case 'issues':
        return `${payload.action} issue #${payload.issue?.number}: ${payload.issue?.title}`;
      case 'issue_comment':
        return `Comment on #${payload.issue?.number}`;
      case 'workflow_run':
        return `Workflow ${payload.workflow_run?.name} ${payload.workflow_run?.status}`;
      case 'repository':
        return `Repository ${payload.action}: ${payload.repository?.full_name}`;
      default:
        return `${event} event received`;
    }
  } catch (error) {
    logger.error('Error generating event summary', { error: error.stack });
    return `${event} event received`;
  }
}

/**
 * Extract repository information from a webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object} Repository information
 */
function extractRepositoryInfo(payload) {
  try {
    const repository = payload.repository || {};
    
    return {
      name: repository.name || '',
      fullName: repository.full_name || '',
      owner: repository.owner?.login || '',
      private: repository.private || false,
      url: repository.html_url || '',
      defaultBranch: repository.default_branch || 'main'
    };
  } catch (error) {
    logger.error('Error extracting repository info', { error: error.stack });
    return {
      name: '',
      fullName: '',
      owner: '',
      private: false,
      url: '',
      defaultBranch: 'main'
    };
  }
}

/**
 * Extract sender information from a webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object} Sender information
 */
function extractSenderInfo(payload) {
  try {
    const sender = payload.sender || {};
    
    return {
      login: sender.login || '',
      id: sender.id || 0,
      type: sender.type || '',
      url: sender.html_url || ''
    };
  } catch (error) {
    logger.error('Error extracting sender info', { error: error.stack });
    return {
      login: '',
      id: 0,
      type: '',
      url: ''
    };
  }
}

module.exports = {
  verifySignature,
  generateEventSummary,
  extractRepositoryInfo,
  extractSenderInfo
};
