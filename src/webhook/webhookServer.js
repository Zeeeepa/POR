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
    this.port = options.port || 3000;
    this.path = options.path || '/webhook';
    this.webhookSecret = options.webhookSecret;
    this.githubToken = options.githubToken;
    this.ngrokOptions = options.ngrokOptions || {};
    
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
    this.app.use(bodyParser.json({
      verify: this._verifyPayload.bind(this)
    }));
    
    // Create webhook endpoint
    this.app.post(this.path, this._handleWebhook.bind(this));
    
    // Add a health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok' });
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
    
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    const digest = 'sha256=' + hmac.update(buf).digest('hex');
    
    if (signature !== digest) {
      const error = new Error('Invalid webhook signature');
      error.status = 403;
      throw error;
    }
    
    // Store the verification result
    req.webhookVerified = true;
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
      res.status(202).json({ status: 'processing' });
      
      // Process the event asynchronously
      this._processEvent(event, payload).catch(error => {
        logger.error(`Error processing webhook event ${event}:`, error);
      });
    } catch (error) {
      logger.error('Error handling webhook:', error);
      
      // Only send error response if one hasn't been sent yet
      if (!res.headersSent) {
        res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
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
      logger.error(`Error in ${event} event handler:`, error);
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
            ngrokUrl: this.ngrokUrl
          });
        });
        
        this.server.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
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
    
    return await ngrok.connect(options);
  }
  
  /**
   * Stop the webhook server and ngrok tunnel
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
   * @returns {Promise<Object>} Webhook creation response
   */
  async setupWebhook(options) {
    if (!this.githubToken) {
      throw new Error('GitHub token required to set up webhook');
    }
    
    if (!this.ngrokUrl && !options.url) {
      throw new Error('Server must be started with ngrok or custom URL provided');
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
  }
  
  /**
   * Get existing webhooks for a repository
   * @private
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
        }
      });
      
      return response.data;
    } catch (error) {
      // If 404, the repo might not exist or token doesn't have access
      if (error.response && error.response.status === 404) {
        logger.warn(`Repository ${owner}/${repo} not found or no access`);
        return [];
      }
      throw error;
    }
  }
}

module.exports = WebhookServer; 