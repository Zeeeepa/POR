/**
 * WebhookServer.js
 * Server for handling GitHub webhook events
 */

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const ngrok = require('ngrok');
const logger = require('../utils/logger');
const validation = require('../utils/validation');
const errorHandler = require('../utils/errorHandler');
const NgrokManager = require('../utils/NgrokManager');

/**
 * WebhookServer class for handling GitHub webhooks with ngrok support
 */
class WebhookServer {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.port=3000] - Port to listen on
   * @param {string} [options.path='/webhook'] - Path for the webhook endpoint
   * @param {string} options.webhookSecret - GitHub webhook secret
   * @param {string} options.githubToken - GitHub personal access token
   * @param {Object} [options.ngrokOptions] - ngrok configuration options
   */
  constructor(options = {}) {
    try {
      validation.isObject(options, 'options');
      
      this.port = options.port || 3000;
      this.path = options.path || '/webhook';
      this.webhookSecret = options.webhookSecret;
      this.githubToken = options.githubToken;
      this.ngrokOptions = options.ngrokOptions || {};
      
      this.app = express();
      this.eventHandlers = {};
      this.server = null;
      this.ngrokUrl = null;
      this.ngrokManager = new NgrokManager(this.ngrokOptions);
      
      // Validate required options
      if (!this.webhookSecret) {
        logger.warn('No webhook secret provided. Payload verification will be disabled.');
      }
      
      if (!this.githubToken) {
        logger.warn('No GitHub token provided. GitHub API operations will be disabled.');
      }
      
      // Set up Express middleware
      this.app.use(bodyParser.json({
        verify: this._verifyPayload.bind(this)
      }));
      
      // Create webhook endpoint
      this.app.post(this.path, this._handleWebhook.bind(this));
      
      // Add a health check endpoint
      this.app.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok' });
      });
      
      logger.info('WebhookServer initialized');
    } catch (error) {
      const enhancedError = errorHandler.internalError(
        `Failed to initialize WebhookServer: ${error.message}`,
        { originalError: error.message }
      );
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Verify the GitHub webhook payload signature
   * @private
   */
  _verifyPayload(req, res, buf, encoding) {
    if (!this.webhookSecret) {
      return;
    }
    
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
      logger.warn('No X-Hub-Signature-256 header found');
      return;
    }
    
    try {
      const isValid = validation.isValidWebhookSignature(signature, buf.toString(), this.webhookSecret);
      
      if (!isValid) {
        const error = errorHandler.authorizationError('Invalid webhook signature');
        error.status = 403;
        throw error;
      }
      
      // Store the verification result
      req.webhookVerified = true;
    } catch (error) {
      logger.error('Webhook signature verification failed', { error: error.stack });
      throw error;
    }
  }
  
  /**
   * Handle incoming webhook requests
   * @private
   */
  async _handleWebhook(req, res) {
    try {
      // Require signature verification if webhook secret is provided
      if (this.webhookSecret && !req.webhookVerified) {
        logger.warn('Received unverified webhook payload');
        return res.status(403).json(
          errorHandler.handleError(
            errorHandler.authorizationError('Invalid signature')
          ).error
        );
      }
      
      const event = req.headers['x-github-event'];
      const payload = req.body;
      const deliveryId = req.headers['x-github-delivery'];
      
      // Validate required headers
      if (!event) {
        return res.status(400).json(
          errorHandler.handleError(
            errorHandler.validationError('Missing X-GitHub-Event header')
          ).error
        );
      }
      
      if (!deliveryId) {
        logger.warn('Missing X-GitHub-Delivery header');
      }
      
      if (!payload) {
        return res.status(400).json(
          errorHandler.handleError(
            errorHandler.validationError('Missing payload')
          ).error
        );
      }
      
      logger.info(`Received GitHub webhook: ${event} (${deliveryId || 'unknown'})`);
      
      // Acknowledge receipt immediately
      res.status(202).json({ status: 'processing' });
      
      // Process the event asynchronously
      this._processEvent(event, payload).catch(error => {
        logger.error(`Error processing webhook event ${event}:`, { error: error.stack });
      });
    } catch (error) {
      logger.error('Error handling webhook:', { error: error.stack });
      
      // Only send error response if one hasn't been sent yet
      if (!res.headersSent) {
        const errorResponse = errorHandler.handleError(error);
        res.status(errorResponse.error.statusCode || 500).json(errorResponse.error);
      }
    }
  }
  
  /**
   * Process a webhook event
   * @private
   */
  async _processEvent(event, payload) {
    const handler = this.eventHandlers[event];
    
    if (!handler) {
      logger.info(`No handler registered for event: ${event}`);
      return;
    }
    
    try {
      logger.info(`Processing ${event} event`);
      await handler(payload);
      logger.info(`Successfully processed ${event} event`);
    } catch (error) {
      const enhancedError = errorHandler.internalError(
        `Error in ${event} event handler: ${error.message}`,
        { originalError: error.message }
      );
      logger.error(`Error in ${event} event handler:`, { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Register a handler for a specific GitHub event
   * @param {string} event - GitHub event name
   * @param {Function} handler - Event handler function
   */
  registerEventHandler(event, handler) {
    try {
      validation.isString(event, 'event');
      
      if (typeof handler !== 'function') {
        throw errorHandler.validationError(`Event handler for ${event} must be a function`);
      }
      
      this.eventHandlers[event] = handler;
      logger.info(`Registered handler for ${event} event`);
    } catch (error) {
      const enhancedError = errorHandler.validationError(
        `Failed to register event handler for ${event}: ${error.message}`,
        { originalError: error.message }
      );
      logger.error(`Failed to register event handler for ${event}:`, { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Start the webhook server
   * @param {boolean} [useNgrok=false] - Whether to expose the server using ngrok
   * @returns {Promise<Object>} Server info including URL
   */
  async start(useNgrok = false) {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, async () => {
          logger.info(`Webhook server listening on port ${this.port}`);
          
          let url = `http://localhost:${this.port}${this.path}`;
          
          if (useNgrok) {
            try {
              this.ngrokUrl = await this.ngrokManager.startTunnel(this.port);
              url = this.ngrokUrl + this.path;
              logger.info(`ngrok tunnel established at ${this.ngrokUrl}`);
            } catch (ngrokError) {
              logger.error('Failed to start ngrok:', { error: ngrokError.stack });
              // Continue without ngrok
            }
          }
          
          const serverInfo = {
            server: this.server,
            port: this.port,
            url,
            useNgrok,
            ngrokUrl: this.ngrokUrl
          };
          
          resolve(serverInfo);
        });
        
        this.server.on('error', (error) => {
          const enhancedError = errorHandler.internalError(
            `Server error: ${error.message}`,
            { originalError: error.message }
          );
          logger.error(enhancedError.message, { error: error.stack });
          reject(enhancedError);
        });
      } catch (error) {
        const enhancedError = errorHandler.internalError(
          `Failed to start server: ${error.message}`,
          { originalError: error.message }
        );
        logger.error(enhancedError.message, { error: error.stack });
        reject(enhancedError);
      }
    });
  }
  
  /**
   * Stop the webhook server and ngrok tunnel
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      const cleanup = async () => {
        if (this.ngrokUrl) {
          try {
            await this.ngrokManager.stopTunnel();
            logger.info('ngrok tunnel closed');
          } catch (error) {
            logger.error('Error closing ngrok tunnel:', { error: error.stack });
          }
          this.ngrokUrl = null;
        }
        resolve();
      };
      
      if (this.server) {
        this.server.close(async () => {
          logger.info('Webhook server stopped');
          await cleanup();
        });
      } else {
        cleanup();
      }
    });
  }
  
  /**
   * Configure a GitHub repository webhook
   * @param {Object} options - Webhook configuration options
   * @param {string} options.owner - Repository owner
   * @param {string} options.repo - Repository name
   * @param {string[]} [options.events=['push']] - GitHub events to subscribe to
   * @param {string} [options.url] - Custom webhook URL (overrides ngrok URL)
   * @returns {Promise<Object>} Webhook creation response
   */
  async setupWebhook(options) {
    try {
      validation.isObject(options, 'options', { requiredProps: ['owner', 'repo'] });
      validation.isString(options.owner, 'options.owner');
      validation.isString(options.repo, 'options.repo');
      
      if (options.events) {
        validation.isArray(options.events, 'options.events');
      }
      
      if (options.url) {
        validation.isUrl(options.url, 'options.url');
      }
      
      if (!this.githubToken) {
        throw errorHandler.authenticationError('GitHub token required to set up webhook');
      }
      
      if (!this.ngrokUrl && !options.url) {
        throw errorHandler.validationError('Server must be started with ngrok or custom URL provided');
      }
      
      const { owner, repo, events = ['push'] } = options;
      const url = options.url || (this.ngrokUrl + this.path);
      
      // Check existing webhooks to avoid duplicates
      const existingWebhooks = await this._getRepositoryWebhooks(owner, repo);
      const duplicate = existingWebhooks.find(hook => hook.config.url === url);
      
      if (duplicate) {
        logger.info(`Webhook already exists with URL ${url}`);
        return duplicate;
      }
      
      // Create new webhook
      const webhookData = {
        name: 'web',
        active: true,
        events,
        config: {
          url,
          content_type: 'json',
          insecure_ssl: '0'
        }
      };
      
      // Add secret if available
      if (this.webhookSecret) {
        webhookData.config.secret = this.webhookSecret;
      }
      
      const response = await axios({
        method: 'post',
        url: `https://api.github.com/repos/${owner}/${repo}/hooks`,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${this.githubToken}`,
          'User-Agent': 'GitHub-Webhook-Server'
        },
        data: webhookData
      });
      
      logger.info(`Webhook created for ${owner}/${repo}`);
      return response.data;
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION || 
          error.name === errorHandler.ErrorTypes.AUTHENTICATION) {
        throw error;
      }
      
      if (error.response) {
        if (error.response.status === 404) {
          throw errorHandler.notFoundError(`Repository ${options.owner}/${options.repo} not found or no access`);
        } else if (error.response.status === 422) {
          throw errorHandler.validationError(`Invalid webhook configuration: ${error.response.data.message || error.message}`);
        } else if (error.response.status === 401) {
          throw errorHandler.authenticationError(`GitHub token is invalid or lacks permissions`);
        }
      }
      
      const enhancedError = errorHandler.externalServiceError(
        `Failed to set up webhook: ${error.message}`,
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Get existing webhooks for a repository
   * @private
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of webhooks
   */
  async _getRepositoryWebhooks(owner, repo) {
    try {
      validation.isString(owner, 'owner');
      validation.isString(repo, 'repo');
      
      const response = await axios({
        method: 'get',
        url: `https://api.github.com/repos/${owner}/${repo}/hooks`,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${this.githubToken}`,
          'User-Agent': 'GitHub-Webhook-Server'
        }
      });
      
      return response.data;
    } catch (error) {
      // If 404, the repo might not exist or token doesn't have access
      if (error.response && error.response.status === 404) {
        logger.warn(`Repository ${owner}/${repo} not found or no access`);
        return [];
      }
      
      if (error.response && error.response.status === 401) {
        throw errorHandler.authenticationError(`GitHub token is invalid or lacks permissions`);
      }
      
      const enhancedError = errorHandler.externalServiceError(
        `Failed to get repository webhooks: ${error.message}`,
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }
}

module.exports = WebhookServer;
