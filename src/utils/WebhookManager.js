/**
 * WebhookManager.js
 * Manages GitHub webhooks for repositories.
 * Ensures all repositories have webhooks configured and keeps them updated.
 */

const { Octokit } = require('@octokit/rest');
const logger = require('./logger');
const config = require('./config');
const crypto = require('crypto');

class WebhookManager {
  /**
   * Initialize the webhook manager
   * @param {string} [githubToken] - GitHub personal access token
   * @param {string} [webhookUrl] - URL for the webhook
   * @throws {Error} If required parameters are missing
   */
  constructor(githubToken, webhookUrl) {
    this.githubToken = githubToken || config.github.token;
    this.webhookUrl = webhookUrl;
    
    if (!this.githubToken) {
      logger.warn('No GitHub token provided. Limited functionality available.');
    }
    
    this.octokit = new Octokit({ 
      auth: this.githubToken,
      baseUrl: config.github.apiUrl
    });
  }

  /**
   * Get all repositories accessible by the GitHub token
   * @returns {Promise<Array>} List of Repository objects
   * @throws {Error} If fetching repositories fails
   */
  async getAllRepositories() {
    try {
      if (!this.githubToken) {
        throw new Error('GitHub token is required to fetch repositories');
      }
      
      logger.info("Fetching all accessible repositories");
      
      // Get all repositories accessible by the token
      const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });
      
      logger.info(`Found ${repos.length} repositories`);
      return repos;
    } catch (error) {
      logger.logError('Error fetching repositories', error);
      throw error;
    }
  }

  /**
   * List all webhooks for a repository
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @returns {Promise<Array>} List of webhook objects
   * @throws {Error} If repository name is invalid
   */
  async listWebhooks(repoFullName) {
    try {
      if (!repoFullName || typeof repoFullName !== 'string' || !repoFullName.includes('/')) {
        throw new Error('Invalid repository name format. Expected "owner/repo"');
      }
      
      const [owner, repo] = repoFullName.split('/');
      
      if (!owner || !repo) {
        throw new Error('Invalid repository name format. Expected "owner/repo"');
      }
      
      logger.info(`Listing webhooks for ${repoFullName}`);
      
      const { data: hooks } = await this.octokit.repos.listWebhooks({
        owner,
        repo
      });
      
      return hooks;
    } catch (error) {
      if (error.status === 404) {
        logger.warn(`Repository not found or no access to webhooks for ${repoFullName}`);
        return [];
      }
      
      logger.logError(`Error listing webhooks for ${repoFullName}`, error);
      return [];
    }
  }

  /**
   * Find an existing PR review webhook in the repository
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @returns {Promise<Object|null>} Webhook object if found, null otherwise
   */
  async findPRReviewWebhook(repoFullName) {
    try {
      const hooks = await this.listWebhooks(repoFullName);
      
      for (const hook of hooks) {
        if (hook.config && hook.config.url && hook.config.url.includes('/webhook')) {
          return hook;
        }
      }
      
      return null;
    } catch (error) {
      logger.logError(`Error finding PR review webhook for ${repoFullName}`, error);
      return null;
    }
  }

  /**
   * Create a new webhook for PR reviews in the repository
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @param {Object} [options] - Additional webhook options
   * @param {Array<string>} [options.events] - Events to subscribe to
   * @param {string} [options.secret] - Webhook secret
   * @returns {Promise<Object|null>} Created webhook object if successful, null otherwise
   * @throws {Error} If repository name is invalid
   */
  async createWebhook(repoFullName, options = {}) {
    try {
      if (!repoFullName || typeof repoFullName !== 'string' || !repoFullName.includes('/')) {
        throw new Error('Invalid repository name format. Expected "owner/repo"');
      }
      
      if (!this.webhookUrl) {
        throw new Error('Webhook URL is required to create a webhook');
      }
      
      const [owner, repo] = repoFullName.split('/');
      
      if (!owner || !repo) {
        throw new Error('Invalid repository name format. Expected "owner/repo"');
      }
      
      logger.info(`Creating webhook for ${repoFullName}`);
      
      const config = {
        url: this.webhookUrl,
        content_type: 'json',
        insecure_ssl: '0'
      };
      
      // Add secret if provided
      if (options.secret || config.github.webhookSecret) {
        config.secret = options.secret || config.github.webhookSecret;
      }
      
      const { data: hook } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config,
        events: options.events || ['pull_request', 'repository'],
        active: true
      });
      
      logger.info(`Webhook created successfully for ${repoFullName}`);
      return hook;
    } catch (error) {
      const errorMessage = `Error creating webhook for ${repoFullName}: ${error.message}`;
      logger.error(errorMessage);
      
      if (error.status === 404) {
        logger.warn(`Repository ${repoFullName}: Permission denied. Make sure your token has 'admin:repo_hook' scope.`);
      } else if (error.status === 422) {
        logger.warn(`Repository ${repoFullName}: Invalid webhook URL or configuration. Make sure your webhook URL is publicly accessible.`);
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
   * @throws {Error} If parameters are invalid
   */
  async updateWebhookUrl(repoFullName, hookId, newUrl) {
    try {
      if (!repoFullName || typeof repoFullName !== 'string' || !repoFullName.includes('/')) {
        throw new Error('Invalid repository name format. Expected "owner/repo"');
      }
      
      if (!hookId || typeof hookId !== 'number') {
        throw new Error('Invalid hook ID');
      }
      
      if (!newUrl || typeof newUrl !== 'string') {
        throw new Error('Invalid webhook URL');
      }
      
      const [owner, repo] = repoFullName.split('/');
      
      if (!owner || !repo) {
        throw new Error('Invalid repository name format. Expected "owner/repo"');
      }
      
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
      logger.logError(`Error updating webhook URL for ${repoFullName}`, error);
      return false;
    }
  }

  /**
   * Ensure a webhook exists for the repository
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @param {Object} [options] - Additional webhook options
   * @returns {Promise<{success: boolean, message: string}>} Result with success flag and message
   */
  async ensureWebhookExists(repoFullName, options = {}) {
    try {
      if (!this.webhookUrl) {
        throw new Error('Webhook URL is required to ensure webhook exists');
      }
      
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
        const newHook = await this.createWebhook(repoFullName, options);
        
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
      logger.logError(`Error ensuring webhook for ${repoFullName}`, error);
      return { 
        success: false, 
        message: `Error: ${error.message}` 
      };
    }
  }

  /**
   * Set up webhooks for all accessible repositories
   * @param {Object} [options] - Additional webhook options
   * @returns {Promise<Object>} Dictionary mapping repository names to status messages
   */
  async setupWebhooksForAllRepos(options = {}) {
    logger.info("Setting up webhooks for all repositories");
    const results = {};
    
    try {
      if (!this.webhookUrl) {
        throw new Error('Webhook URL is required to set up webhooks');
      }
      
      const repos = await this.getAllRepositories();
      logger.info(`Found ${repos.length} repositories`);
      
      for (const repo of repos) {
        const repoFullName = repo.full_name;
        const { success, message } = await this.ensureWebhookExists(repoFullName, options);
        
        results[repoFullName] = message;
        logger.info(`Repository ${repoFullName}: ${message}`);
      }
      
      return results;
    } catch (error) {
      logger.logError('Error setting up webhooks for all repositories', error);
      return { error: error.message };
    }
  }

  /**
   * Handle repository creation event
   * @param {string} repoName - Repository name in format "owner/repo"
   * @param {Object} [options] - Additional webhook options
   * @returns {Promise<{success: boolean, message: string}>} Result with success flag and message
   */
  async handleRepositoryCreated(repoName, options = {}) {
    logger.info(`Handling repository creation for ${repoName}`);
    
    try {
      if (!this.webhookUrl) {
        throw new Error('Webhook URL is required to handle repository creation');
      }
      
      return await this.ensureWebhookExists(repoName, options);
    } catch (error) {
      logger.logError(`Error handling repository creation for ${repoName}`, error);
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
        logger.warn('Missing required parameters for webhook signature verification');
        return false;
      }
      
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(body).digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(digest),
        Buffer.from(signature)
      );
    } catch (error) {
      logger.logError('Error verifying webhook signature', error);
      return false;
    }
  }
  
  /**
   * Set the webhook URL
   * @param {string} url - New webhook URL
   */
  setWebhookUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid webhook URL');
    }
    
    this.webhookUrl = url;
    logger.info(`Webhook URL set to: ${url}`);
  }
}

module.exports = WebhookManager;
