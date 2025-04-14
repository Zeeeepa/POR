/**
 * WebhookManager.js
 * Manages GitHub webhooks for repositories.
 * Ensures all repositories have webhooks configured and keeps them updated.
 */

const { Octokit } = require('@octokit/rest');
const logger = require('./logger');
const config = require('./config');
const validation = require('./validation');
const errorHandler = require('./errorHandler');

class WebhookManager {
  /**
   * Initialize the webhook manager
   * @param {string} [githubToken] - GitHub personal access token
   * @param {string} [webhookUrl] - URL for the webhook
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
        throw errorHandler.authenticationError('GitHub token is required to fetch repositories');
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
      if (error.name === errorHandler.ErrorTypes.AUTHENTICATION) {
        throw error;
      }
      
      const enhancedError = errorHandler.externalServiceError(
        'Error fetching repositories from GitHub',
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
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
      validation.isRepoName(repoFullName, 'repoFullName');
      
      const [owner, repo] = repoFullName.split('/');
      
      logger.info(`Listing webhooks for ${repoFullName}`);
      
      const { data: hooks } = await this.octokit.repos.listWebhooks({
        owner,
        repo
      });
      
      return hooks;
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      if (error.status === 404) {
        logger.warn(`Repository not found or no access to webhooks for ${repoFullName}`);
        return [];
      }
      
      logger.error(`Error listing webhooks for ${repoFullName}`, { error: error.stack });
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
      validation.isRepoName(repoFullName, 'repoFullName');
      
      const hooks = await this.listWebhooks(repoFullName);
      
      for (const hook of hooks) {
        if (hook.config && hook.config.url && hook.config.url.includes('/webhook')) {
          return hook;
        }
      }
      
      return null;
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      logger.error(`Error finding PR review webhook for ${repoFullName}`, { error: error.stack });
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
      validation.isRepoName(repoFullName, 'repoFullName');
      
      if (!this.webhookUrl) {
        throw errorHandler.validationError('Webhook URL is required to create a webhook');
      }
      
      const [owner, repo] = repoFullName.split('/');
      
      logger.info(`Creating webhook for ${repoFullName}`);
      
      const webhookConfig = {
        url: this.webhookUrl,
        content_type: 'json',
        insecure_ssl: '0'
      };
      
      // Add secret if provided
      if (options.secret || config.github.webhookSecret) {
        webhookConfig.secret = options.secret || config.github.webhookSecret;
      }
      
      const { data: hook } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: webhookConfig,
        events: options.events || ['pull_request', 'repository'],
        active: true
      });
      
      logger.info(`Webhook created successfully for ${repoFullName}`);
      return hook;
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
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
      validation.isRepoName(repoFullName, 'repoFullName');
      validation.isNumber(hookId, 'hookId', { min: 1 });
      validation.isUrl(newUrl, 'newUrl');
      
      const [owner, repo] = repoFullName.split('/');
      
      logger.info(`Updating webhook URL for ${repoFullName}`);
      
      // First, get existing webhook
      const { data: hook } = await this.octokit.repos.getWebhook({
        owner,
        repo,
        hook_id: hookId
      });
      
      // Create a new config with the updated URL
      const webhookConfig = {
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
        config: webhookConfig,
        events: hook.events,
        active: true
      });
      
      logger.info(`Webhook URL updated successfully for ${repoFullName}`);
      return true;
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      logger.error(`Error updating webhook URL for ${repoFullName}`, { error: error.stack });
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
      validation.isRepoName(repoFullName, 'repoFullName');
      
      if (!this.webhookUrl) {
        throw errorHandler.validationError('Webhook URL is required to ensure webhook exists');
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
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        return { 
          success: false, 
          message: error.message 
        };
      }
      
      logger.error(`Error ensuring webhook for ${repoFullName}`, { error: error.stack });
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
        throw errorHandler.validationError('Webhook URL is required to set up webhooks');
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
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      logger.error('Error setting up webhooks for all repositories', { error: error.stack });
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
      validation.isRepoName(repoName, 'repoName');
      
      if (!this.webhookUrl) {
        throw errorHandler.validationError('Webhook URL is required to handle repository creation');
      }
      
      return await this.ensureWebhookExists(repoName, options);
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        return { 
          success: false, 
          message: error.message 
        };
      }
      
      logger.error(`Error handling repository creation for ${repoName}`, { error: error.stack });
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
      return validation.isValidWebhookSignature(signature, body, secret);
    } catch (error) {
      logger.error('Error verifying webhook signature', { error: error.stack });
      return false;
    }
  }
  
  /**
   * Set the webhook URL
   * @param {string} url - New webhook URL
   * @throws {Error} If URL is invalid
   */
  setWebhookUrl(url) {
    try {
      validation.isUrl(url, 'url');
      
      this.webhookUrl = url;
      logger.info(`Webhook URL set to: ${url}`);
    } catch (error) {
      throw errorHandler.validationError(error.message);
    }
  }
}

module.exports = WebhookManager;
