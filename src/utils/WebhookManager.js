/**
 * WebhookManager.js
 * Manages GitHub webhooks for repositories.
 * Ensures all repositories have webhooks configured and keeps them updated.
 */

const { Octokit } = require('@octokit/rest');
const crypto = require('crypto');
const logger = require('./logger');
const config = require('../config');

/**
 * WebhookManager class for managing GitHub webhooks
 */
class WebhookManager {
  /**
   * Initialize the webhook manager
   * @param {string} githubToken - GitHub personal access token
   * @param {string} webhookUrl - URL for the webhook
   * @param {string} [webhookSecret] - Secret for webhook verification
   */
  constructor(githubToken, webhookUrl, webhookSecret) {
    if (!githubToken) {
      throw new Error('GitHub token is required');
    }
    
    if (!webhookUrl) {
      throw new Error('Webhook URL is required');
    }
    
    this.octokit = new Octokit({ auth: githubToken });
    this.webhookUrl = webhookUrl;
    this.webhookSecret = webhookSecret || config.github?.webhookSecret;
  }

  /**
   * Get all repositories accessible by the GitHub token
   * @returns {Promise<Array>} List of Repository objects
   * @throws {Error} If repositories cannot be fetched
   */
  async getAllRepositories() {
    try {
      logger.info("Fetching all accessible repositories");
      
      // Get all repositories accessible by the token
      const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });
      
      logger.info(`Found ${repos.length} repositories`);
      return repos;
    } catch (error) {
      logger.error(`Error fetching repositories: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all webhooks for a repository
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @returns {Promise<Array>} List of webhook objects
   */
  async listWebhooks(repoFullName) {
    try {
      if (!repoFullName || !repoFullName.includes('/')) {
        throw new Error('Invalid repository name format. Expected "owner/repo"');
      }
      
      const [owner, repo] = repoFullName.split('/');
      
      logger.info(`Listing webhooks for ${repoFullName}`);
      
      const { data: hooks } = await this.octokit.repos.listWebhooks({
        owner,
        repo
      });
      
      return hooks;
    } catch (error) {
      if (error.status === 404) {
        logger.error(`Repository not found or no access to webhooks for ${repoFullName}`);
        return [];
      }
      
      logger.error(`Error listing webhooks for ${repoFullName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Find an existing PR review webhook in the repository
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @returns {Promise<Object|null>} Webhook object if found, null otherwise
   */
  async findPRReviewWebhook(repoFullName) {
    const hooks = await this.listWebhooks(repoFullName);
    
    for (const hook of hooks) {
      if (hook.config && hook.config.url && hook.config.url.includes('/webhook')) {
        return hook;
      }
    }
    
    return null;
  }

  /**
   * Create a new webhook for PR reviews in the repository
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @returns {Promise<Object|null>} Created webhook object if successful, null otherwise
   */
  async createWebhook(repoFullName) {
    try {
      if (!repoFullName || !repoFullName.includes('/')) {
        throw new Error('Invalid repository name format. Expected "owner/repo"');
      }
      
      const [owner, repo] = repoFullName.split('/');
      
      logger.info(`Creating webhook for ${repoFullName}`);
      
      const config = {
        url: this.webhookUrl,
        content_type: 'json',
        insecure_ssl: '0'
      };
      
      // Add secret if available
      if (this.webhookSecret) {
        config.secret = this.webhookSecret;
      }
      
      const { data: hook } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config,
        events: ['pull_request', 'repository'],
        active: true
      });
      
      logger.info(`Webhook created successfully for ${repoFullName}`);
      return hook;
    } catch (error) {
      const errorMessage = `Error creating webhook for ${repoFullName}: ${error.message}`;
      logger.error(errorMessage);
      
      if (error.status === 404) {
        logger.error(`Repository ${repoFullName}: Permission denied. Make sure your token has 'admin:repo_hook' scope.`);
      } else if (error.status === 422) {
        logger.error(`Repository ${repoFullName}: Invalid webhook URL or configuration. Make sure your webhook URL is publicly accessible.`);
      }
      
      return null;
    }
  }

  /**
   * Update a webhook URL
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @param {number} hookId - Webhook ID
   * @param {string} newUrl - New webhook URL
   * @returns {Promise<boolean>} Success status
   */
  async updateWebhookUrl(repoFullName, hookId, newUrl) {
    try {
      if (!repoFullName || !repoFullName.includes('/')) {
        throw new Error('Invalid repository name format. Expected "owner/repo"');
      }
      
      if (!hookId) {
        throw new Error('Webhook ID is required');
      }
      
      if (!newUrl) {
        throw new Error('New URL is required');
      }
      
      const [owner, repo] = repoFullName.split('/');
      
      logger.info(`Updating webhook URL for ${repoFullName}`);
      
      // First, get existing webhook
      const { data: hook } = await this.octokit.repos.getWebhook({
        owner,
        repo,
        hook_id: hookId
      });
      
      // Create a new config with the updated URL
      const config = {
        url: newUrl,
        content_type: 'json',
        insecure_ssl: '0',
        secret: hook.config.secret || ''
      };
      
      // Update the webhook
      await this.octokit.repos.updateWebhook({
        owner,
        repo,
        hook_id: hookId,
        config,
        events: hook.events,
        active: true
      });
      
      logger.info(`Webhook URL updated successfully for ${repoFullName}`);
      return true;
    } catch (error) {
      logger.error(`Error updating webhook URL for ${repoFullName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Ensure a webhook exists for the repository
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @returns {Promise<{success: boolean, message: string}>} Result with success flag and message
   */
  async ensureWebhookExists(repoFullName) {
    try {
      // Check if webhook already exists
      const existingHook = await this.findPRReviewWebhook(repoFullName);
      
      if (existingHook) {
        // Check if URL needs updating
        if (existingHook.config.url !== this.webhookUrl) {
          const success = await this.updateWebhookUrl(
            repoFullName, 
            existingHook.id, 
            this.webhookUrl
          );
          
          if (success) {
            return { 
              success: true, 
              message: `Updated webhook URL for ${repoFullName}` 
            };
          } else {
            return { 
              success: false, 
              message: `Failed to update webhook URL for ${repoFullName}` 
            };
          }
        } else {
          return { 
            success: true, 
            message: `Webhook already exists with correct URL for ${repoFullName}` 
          };
        }
      } else {
        // Create new webhook
        const newHook = await this.createWebhook(repoFullName);
        
        if (newHook) {
          return { 
            success: true, 
            message: `Created new webhook for ${repoFullName}` 
          };
        } else {
          return { 
            success: false, 
            message: `Failed to create webhook for ${repoFullName}` 
          };
        }
      }
    } catch (error) {
      logger.error(`Error ensuring webhook for ${repoFullName}: ${error.message}`);
      return { 
        success: false, 
        message: `Error: ${error.message}` 
      };
    }
  }

  /**
   * Set up webhooks for all accessible repositories
   * @returns {Promise<Object>} Dictionary mapping repository names to status messages
   */
  async setupWebhooksForAllRepos() {
    logger.info("Setting up webhooks for all repositories");
    const results = {};
    
    const repos = await this.getAllRepositories();
    logger.info(`Found ${repos.length} repositories`);
    
    for (const repo of repos) {
      const repoFullName = repo.full_name;
      const { success, message } = await this.ensureWebhookExists(repoFullName);
      
      results[repoFullName] = message;
      logger.info(`Repository ${repoFullName}: ${message}`);
    }
    
    return results;
  }

  /**
   * Handle repository creation event
   * @param {string} repoName - Repository name in format "owner/repo"
   * @returns {Promise<{success: boolean, message: string}>} Result with success flag and message
   */
  async handleRepositoryCreated(repoName) {
    logger.info(`Handling repository creation for ${repoName}`);
    
    try {
      return await this.ensureWebhookExists(repoName);
    } catch (error) {
      logger.error(`Error handling repository creation for ${repoName}: ${error.message}`);
      return { 
        success: false, 
        message: `Error: ${error.message}` 
      };
    }
  }

  /**
   * Verify GitHub webhook signature
   * @param {string} signature - X-Hub-Signature-256 header
   * @param {string} body - Raw request body
   * @param {string} secret - Webhook secret
   * @returns {boolean} Whether the signature is valid
   */
  verifyWebhookSignature(signature, body, secret) {
    try {
      if (!signature || !body || !secret) {
        return false;
      }
      
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(body).digest('hex');
      
      // Use timingSafeEqual to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(digest),
        Buffer.from(signature)
      );
    } catch (error) {
      logger.error(`Error verifying webhook signature: ${error.message}`);
      return false;
    }
  }
}

module.exports = WebhookManager;
