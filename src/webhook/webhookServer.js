/**
 * WebhookServer.js
 * Server for handling GitHub webhook events with improved security and error handling
 */

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');
const ngrok = require('ngrok');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

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
   * @param {boolean} [options.enableRequestLogging=false] - Enable HTTP request logging
   * @param {number} [options.requestTimeout=10000] - Timeout for GitHub API requests in ms
   */
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.path = options.path || '/webhook';
    this.webhookSecret = options.webhookSecret;
    this.githubToken = options.githubToken;
    this.ngrokOptions = options.ngrokOptions || {};
    this.enableRequestLogging = options.enableRequestLogging || false;
    this.requestTimeout = options.requestTimeout || 10000;
    
    this.app = express();
    this.eventHandlers = {};
    this.server = null;
    this.ngrokUrl = null;
    
    // Validate required options
    if (!this.webhookSecret) {
      logger.warn('No webhook secret provided. Payload verification will be disabled.');
    }
    
    if (!this.githubToken) {
      logger.warn('No GitHub token provided. GitHub API operations will be disabled.');
    }
    
    // Set up Express middleware
    this._setupMiddleware();
    
    // Create webhook endpoint
    this.app.post(this.path, this._handleWebhook.bind(this));
    
    // Add a health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
  }
  
  /**
   * Set up Express middleware
   * @private
   */
  _setupMiddleware() {
    // Add request logging if enabled
    if (this.enableRequestLogging) {
      // Create logs directory if it doesn't exist
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Log all requests to file
      const accessLogStream = fs.createWriteStream(
        path.join(logsDir, 'access.log'), 
        { flags: 'a' }
      );
      
      this.app.use(morgan('combined', { stream: accessLogStream }));
      
      // Also log to console with a shorter format
      this.app.use(morgan('dev', { stream: logger.stream }));
    }
    
    // Parse JSON bodies with signature verification
    this.app.use(bodyParser.json({
      verify: this._verifyPayload.bind(this),
      limit: '10mb'
    }));
    
    // Error handling middleware
    this.app.use((err, req, res, next) => {
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        logger.error('Invalid JSON payload:', err);
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
      next(err);
    });
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
      const hmac = crypto.createHmac('sha256', this.webhookSecret);
      const digest = 'sha256=' + hmac.update(buf).digest('hex');
      
      if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
        const error = new Error('Invalid webhook signature');
        error.status = 403;
        throw error;
      }
      
      // Store the verification result
      req.webhookVerified = true;
    } catch (error) {
      if (error.message !== 'Invalid webhook signature') {
        logger.error('Error verifying webhook signature:', error);
      }
      throw error;
    }
  }
  
  /**
   * Handle incoming webhook requests
   * @private
   */
  async _handleWebhook(req, res) {
    try {
      if (this.webhookSecret && !req.webhookVerified) {
        logger.warn('Received unverified webhook payload');
        return res.status(403).json({ error: 'Invalid signature' });
      }
      
      const event = req.headers['x-github-event'];
      const payload = req.body;
      const deliveryId = req.headers['x-github-delivery'];
      
      logger.info(`Received GitHub webhook: ${event} (${deliveryId})`);
      
      if (!event || !payload) {
        return res.status(400).json({ error: 'Missing event or payload' });
      }
      
      // Acknowledge receipt immediately
      res.status(202).json({ 
        status: 'processing',
        event,
        deliveryId
      });
      
      // Process the event asynchronously
      this._processEvent(event, payload, deliveryId).catch(error => {
        logger.error(`Error processing webhook event ${event} (${deliveryId}):`, error);
      });
    } catch (error) {
      logger.error('Error handling webhook:', error);
      
      // Only send error response if one hasn't been sent yet
      if (!res.headersSent) {
        res.status(error.status || 500).json({ 
          error: error.message || 'Internal server error',
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  /**
   * Process a webhook event
   * @private
   * @param {string} event - GitHub event name
   * @param {Object} payload - Event payload
   * @param {string} deliveryId - GitHub delivery ID
   */
  async _processEvent(event, payload, deliveryId) {
    const handler = this.eventHandlers[event];
    
    if (!handler) {
      logger.info(`No handler registered for event: ${event}`);
      return;
    }
    
    try {
      logger.info(`Processing ${event} event (${deliveryId})`);
      
      // Create context object with useful information
      const context = {
        event,
        deliveryId,
        timestamp: new Date(),
        githubToken: this.githubToken
      };
      
      // Call handler with payload and context
      await handler(payload, context);
      
      logger.info(`Successfully processed ${event} event (${deliveryId})`);
    } catch (error) {
      logger.error(`Error in ${event} event handler (${deliveryId}):`, error);
      throw error;
    }
  }
  
  /**
   * Register a handler for a specific GitHub event
   * @param {string} event - GitHub event name
   * @param {Function} handler - Event handler function
   */
  registerEventHandler(event, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Event handler for ${event} must be a function`);
    }
    
    this.eventHandlers[event] = handler;
    logger.info(`Registered handler for ${event} event`);
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
              this.ngrokUrl = await this._startNgrok();
              url = this.ngrokUrl + this.path;
              logger.info(`ngrok tunnel established at ${this.ngrokUrl}`);
            } catch (ngrokError) {
              logger.error('Failed to start ngrok:', ngrokError);
              // Continue without ngrok
            }
          }
          
          resolve({
            server: this.server,
            port: this.port,
            url,
            useNgrok,
            ngrokUrl: this.ngrokUrl,
            path: this.path
          });
        });
        
        this.server.on('error', (error) => {
          logger.error('Server error:', error);
          reject(error);
        });
        
        // Set up graceful shutdown
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
      } catch (error) {
        logger.error('Error starting server:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Start ngrok tunnel
   * @private
   * @returns {Promise<string>} ngrok URL
   */
  async _startNgrok() {
    const options = {
      addr: this.port,
      ...this.ngrokOptions
    };
    
    try {
      return await ngrok.connect(options);
    } catch (error) {
      logger.error('Failed to connect to ngrok:', error);
      throw error;
    }
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
            await ngrok.disconnect();
            await ngrok.kill();
            logger.info('ngrok tunnel closed');
          } catch (error) {
            logger.error('Error closing ngrok tunnel:', error);
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
   * @param {string} [options.url] - Custom webhook URL (uses ngrok URL by default)
   * @param {string} [options.secret] - Custom webhook secret (uses instance secret by default)
   * @returns {Promise<Object>} Webhook creation response
   */
  async setupWebhook(options) {
    if (!this.githubToken) {
      throw new Error('GitHub token required to set up webhook');
    }
    
    if (!this.ngrokUrl && !options.url) {
      throw new Error('Server must be started with ngrok or custom URL provided');
    }
    
    const { owner, repo, events = ['push'], secret = this.webhookSecret } = options;
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
    if (secret) {
      webhookData.config.secret = secret;
    }
    
    try {
      const response = await axios({
        method: 'post',
        url: `https://api.github.com/repos/${owner}/${repo}/hooks`,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${this.githubToken}`,
          'User-Agent': 'GitHub-Webhook-Server'
        },
        data: webhookData,
        timeout: this.requestTimeout
      });
      
      logger.info(`Webhook created for ${owner}/${repo}`);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      logger.error(`Error creating webhook for ${owner}/${repo}: ${errorMessage}`);
      
      // Provide more helpful error messages
      if (error.response?.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or no access. Ensure your token has the 'admin:repo_hook' scope.`);
      } else if (error.response?.status === 422) {
        throw new Error(`Invalid webhook configuration for ${owner}/${repo}: ${errorMessage}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Get existing webhooks for a repository
   * @private
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of webhook objects
   */
  async _getRepositoryWebhooks(owner, repo) {
    try {
      const response = await axios({
        method: 'get',
        url: `https://api.github.com/repos/${owner}/${repo}/hooks`,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${this.githubToken}`,
          'User-Agent': 'GitHub-Webhook-Server'
        },
        timeout: this.requestTimeout
      });
      
      return response.data;
    } catch (error) {
      // If 404, the repo might not exist or token doesn't have access
      if (error.response && error.response.status === 404) {
        logger.warn(`Repository ${owner}/${repo} not found or no access`);
        return [];
      }
      
      logger.error(`Error getting webhooks for ${owner}/${repo}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Delete a webhook from a repository
   * @param {Object} options - Options for webhook deletion
   * @param {string} options.owner - Repository owner
   * @param {string} options.repo - Repository name
   * @param {number} options.hookId - Webhook ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteWebhook(options) {
    const { owner, repo, hookId } = options;
    
    if (!this.githubToken) {
      throw new Error('GitHub token required to delete webhook');
    }
    
    try {
      await axios({
        method: 'delete',
        url: `https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}`,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${this.githubToken}`,
          'User-Agent': 'GitHub-Webhook-Server'
        },
        timeout: this.requestTimeout
      });
      
      logger.info(`Webhook ${hookId} deleted from ${owner}/${repo}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting webhook ${hookId} from ${owner}/${repo}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Test a webhook by sending a ping event
   * @param {Object} options - Options for webhook testing
   * @param {string} options.owner - Repository owner
   * @param {string} options.repo - Repository name
   * @param {number} options.hookId - Webhook ID to test
   * @returns {Promise<boolean>} Success status
   */
  async testWebhook(options) {
    const { owner, repo, hookId } = options;
    
    if (!this.githubToken) {
      throw new Error('GitHub token required to test webhook');
    }
    
    try {
      await axios({
        method: 'post',
        url: `https://api.github.com/repos/${owner}/${repo}/hooks/${hookId}/tests`,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${this.githubToken}`,
          'User-Agent': 'GitHub-Webhook-Server'
        },
        timeout: this.requestTimeout
      });
      
      logger.info(`Webhook ${hookId} tested successfully for ${owner}/${repo}`);
      return true;
    } catch (error) {
      logger.error(`Error testing webhook ${hookId} for ${owner}/${repo}: ${error.message}`);
      return false;
    }
  }
}

module.exports = WebhookServer;
