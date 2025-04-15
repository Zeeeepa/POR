/**
 * WebhookServer.js
 * Server for handling GitHub webhook events
 */

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const logger = require('../utils/logger');
const validation = require('../utils/validation');
const errorHandler = require('../utils/errorHandler');
const NgrokManager = require('../utils/NgrokManager');
const webhookUtils = require('../utils/github/webhookUtils');

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
      logger.error('Failed to initialize WebhookServer', { error: error.stack });
      throw errorHandler.internalError('Failed to initialize WebhookServer', { originalError: error.message });
    }
  }
  
  /**
   * Verify the GitHub webhook payload signature
   * @private
   */
  _verifyPayload(req, res, buf, encoding) {
    try {
      // Always require signature verification if webhook secret is provided
      if (!this.webhookSecret) {
        logger.warn('Webhook secret not provided, skipping signature verification');
        return;
      }
      
      const signature = req.headers['x-hub-signature-256'];
      if (!signature) {
        const error = errorHandler.authorizationError('Missing X-Hub-Signature-256 header');
        error.status = 403;
        throw error;
      }
      
      const isValid = webhookUtils.verifySignature(signature, buf.toString(), this.webhookSecret);
      
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
      
      logger.info(`Received GitHub webhook: ${event} (${deliveryId})`);
      
      if (!event || !payload) {
        return res.status(400).json(
          errorHandler.handleError(
            errorHandler.validationError('Missing event or payload')
          ).error
        );
      }
      
      // Acknowledge receipt immediately
      res.status(202).json({ status: 'processing' });
      
      // Process the event asynchronously
      this._processEvent(event, payload).catch(error => {
        const enhancedError = errorHandler.webhookError(
          `Error processing webhook event ${event}`,
          { originalError: error.message }
        );
        logger.error(enhancedError.message, { error: error.stack });
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
      const enhancedError = errorHandler.webhookError(
        `Error in ${event} event handler`,
        { originalError: error.message }
      );
      logger.error(enhancedError.message, { error: error.stack });
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
      logger.error(`Failed to register event handler for ${event}:`, { error: error.stack });
      throw error;
    }
  }
  
  /**
   * Start the webhook server
   * @param {boolean} [useNgrok=false] - Whether to expose the server using ngrok
   * @returns {Promise<Object>} Server info including URL
   */
  async start(useNgrok = false) {
    try {
      if (this.server) {
        logger.warn('WebhookServer is already running');
        return {
          server: this.server,
          port: this.port,
          url: this.ngrokUrl ? `${this.ngrokUrl}${this.path}` : `http://localhost:${this.port}${this.path}`,
          useNgrok: !!this.ngrokUrl,
          ngrokUrl: this.ngrokUrl
        };
      }
      
      // Start the server
      this.server = await new Promise((resolve, reject) => {
        const server = this.app.listen(this.port, () => {
          logger.info(`Webhook server listening on port ${this.port}`);
          resolve(server);
        });
        
        server.on('error', (error) => {
          const enhancedError = errorHandler.internalError(
            `Server error: ${error.message}`,
            { originalError: error.message }
          );
          logger.error(enhancedError.message, { error: error.stack });
          reject(enhancedError);
        });
      });
      
      let url = `http://localhost:${this.port}${this.path}`;
      
      // Start ngrok if requested
      if (useNgrok) {
        try {
          this.ngrokUrl = await this.ngrokManager.startTunnel(this.port);
          url = `${this.ngrokUrl}${this.path}`;
          logger.info(`ngrok tunnel established at ${this.ngrokUrl}`);
        } catch (ngrokError) {
          logger.error('Failed to start ngrok:', { error: ngrokError.stack });
          // Continue without ngrok
        }
      }
      
      return {
        server: this.server,
        port: this.port,
        url,
        useNgrok,
        ngrokUrl: this.ngrokUrl
      };
    } catch (error) {
      const enhancedError = errorHandler.internalError(
        `Failed to start server: ${error.message}`,
        { originalError: error.message }
      );
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Stop the webhook server and ngrok tunnel
   */
  async stop() {
    try {
      // Close ngrok tunnel first
      if (this.ngrokUrl) {
        try {
          await this.ngrokManager.stopTunnel();
          logger.info('ngrok tunnel closed');
        } catch (error) {
          logger.error('Error closing ngrok tunnel:', { error: error.stack });
        }
        this.ngrokUrl = null;
      }
      
      // Then close the server
      if (this.server) {
        await new Promise((resolve, reject) => {
          this.server.close((err) => {
            if (err) {
              logger.error('Error closing webhook server:', { error: err.stack });
              reject(err);
            } else {
              logger.info('Webhook server stopped');
              this.server = null;
              resolve();
            }
          });
        });
      }
    } catch (error) {
      const enhancedError = errorHandler.internalError(
        `Failed to stop server: ${error.message}`,
        { originalError: error.message }
      );
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Configure a GitHub repository webhook
   * @param {Object} options - Webhook configuration options
   * @param {string} options.owner - Repository owner
   * @param {string} options.repo - Repository name
   * @param {string[]} [options.events=['push']] - GitHub events to subscribe to
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
      
      if (!this.githubToken) {
        throw errorHandler.authenticationError('GitHub token required to set up webhook');
      }
      
      if (!this.ngrokUrl && !options.url) {
        throw errorHandler.validationError('Server must be started with ngrok or custom URL provided');
      }
      
      const { owner, repo, events = ['push'] } = options;
      const url = options.url || `${this.ngrokUrl}${this.path}`;
      
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
      
      // Add secret if available (always add if available for security)
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
   */
  async _getRepositoryWebhooks(owner, repo) {
    try {
      validation.isString(owner, 'owner');
      validation.isString(repo, 'repo');
      validation.exists(this.githubToken, 'githubToken');
      
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
