/**
 * WebhookServerManager.js
 * Central manager for webhook server functionality
 */

const WebhookServer = require('./webhookServer');
const setupDashboard = require('./dashboard');
const NgrokManager = require('../utils/NgrokManager');
const logger = require('../utils/logger');
const validation = require('../utils/validation');
const errorHandler = require('../utils/errorHandler');
const express = require('express');

/**
 * WebhookServerManager class for centralized webhook server management
 */
class WebhookServerManager {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.port=3000] - Port for webhook server
   * @param {number} [options.dashboardPort] - Port for dashboard (defaults to port+1)
   * @param {string} [options.webhookPath='/webhook'] - Path for webhook endpoint
   * @param {string} [options.dashboardPath='/dashboard'] - Path for dashboard
   * @param {string} options.webhookSecret - GitHub webhook secret
   * @param {string} options.githubToken - GitHub personal access token
   * @param {Object} [options.ngrokOptions] - ngrok configuration options
   * @param {boolean} [options.useNgrok=false] - Whether to use ngrok by default
   */
  constructor(options = {}) {
    try {
      // Validate required options
      validation.isObject(options, 'options');
      
      // Set default options
      this.port = options.port || 3000;
      this.dashboardPort = options.dashboardPort || (this.port + 1);
      this.webhookPath = options.webhookPath || '/webhook';
      this.dashboardPath = options.dashboardPath || '/dashboard';
      this.webhookSecret = options.webhookSecret;
      this.githubToken = options.githubToken;
      this.ngrokOptions = options.ngrokOptions || {};
      this.useNgrok = options.useNgrok !== undefined ? options.useNgrok : false;
      
      // Initialize components
      this.webhookServer = new WebhookServer({
        port: this.port,
        path: this.webhookPath,
        webhookSecret: this.webhookSecret,
        githubToken: this.githubToken,
        ngrokOptions: this.ngrokOptions
      });
      
      // Initialize dashboard app
      this.dashboardApp = express();
      this.dashboard = null;
      this.dashboardServer = null;
      
      // Track state
      this.isRunning = false;
      this.serverInfo = null;
      
      logger.info('WebhookServerManager initialized');
    } catch (error) {
      const enhancedError = errorHandler.internalError(
        `Failed to initialize WebhookServerManager: ${error.message}`,
        { originalError: error.message }
      );
      logger.error('Failed to initialize WebhookServerManager', { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Register a handler for a specific GitHub event
   * @param {string} event - GitHub event name
   * @param {Function} handler - Event handler function
   * @returns {WebhookServerManager} this instance for chaining
   */
  registerEventHandler(event, handler) {
    try {
      validation.isString(event, 'event');
      validation.isFunction(handler, 'handler');
      
      this.webhookServer.registerEventHandler(event, handler);
      return this;
    } catch (error) {
      const enhancedError = errorHandler.validationError(
        `Failed to register event handler for ${event}: ${error.message}`,
        { originalError: error.message }
      );
      logger.error(`Failed to register event handler for ${event}`, { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Start the webhook server and dashboard
   * @param {boolean} [useNgrok] - Whether to expose the server using ngrok (overrides constructor setting)
   * @returns {Promise<Object>} Server info including URLs
   */
  async start(useNgrok = undefined) {
    try {
      if (this.isRunning) {
        logger.warn('WebhookServerManager is already running');
        return this.serverInfo;
      }
      
      // Use parameter if provided, otherwise use instance setting
      const shouldUseNgrok = useNgrok !== undefined ? useNgrok : this.useNgrok;
      
      // Start webhook server
      logger.info(`Starting webhook server on port ${this.port}`);
      this.serverInfo = await this.webhookServer.start(shouldUseNgrok);
      
      // Set up and start dashboard
      logger.info(`Setting up dashboard on port ${this.dashboardPort}`);
      this.dashboard = setupDashboard(this.dashboardApp, this.webhookServer, this.dashboardPath);
      
      // Start dashboard server
      this.dashboardServer = this.dashboardApp.listen(this.dashboardPort, () => {
        logger.info(`Dashboard available at http://localhost:${this.dashboardPort}${this.dashboardPath}`);
      });
      
      // Update server info with dashboard URL
      this.serverInfo.dashboardUrl = `http://localhost:${this.dashboardPort}${this.dashboardPath}`;
      this.isRunning = true;
      
      logger.info('WebhookServerManager started successfully');
      return this.serverInfo;
    } catch (error) {
      const enhancedError = errorHandler.internalError(
        `Failed to start WebhookServerManager: ${error.message}`,
        { originalError: error.message }
      );
      logger.error('Failed to start WebhookServerManager', { error: error.stack });
      
      // Clean up if partial start
      await this._cleanupOnFailure();
      
      throw enhancedError;
    }
  }
  
  /**
   * Clean up resources on startup failure
   * @private
   */
  async _cleanupOnFailure() {
    if (this.webhookServer) {
      try {
        await this.webhookServer.stop();
      } catch (e) {
        logger.error('Error stopping webhook server during cleanup', { error: e.stack });
      }
    }
    
    if (this.dashboardServer) {
      try {
        await new Promise(resolve => this.dashboardServer.close(resolve));
      } catch (e) {
        logger.error('Error stopping dashboard server during cleanup', { error: e.stack });
      }
    }
  }
  
  /**
   * Stop the webhook server and dashboard
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      if (!this.isRunning) {
        logger.warn('WebhookServerManager is not running');
        return;
      }
      
      logger.info('Stopping WebhookServerManager');
      
      // Stop webhook server
      await this.webhookServer.stop();
      
      // Stop dashboard server
      if (this.dashboardServer) {
        await new Promise(resolve => this.dashboardServer.close(resolve));
        logger.info('Dashboard server stopped');
      }
      
      this.isRunning = false;
      logger.info('WebhookServerManager stopped successfully');
    } catch (error) {
      const enhancedError = errorHandler.internalError(
        `Error stopping WebhookServerManager: ${error.message}`,
        { originalError: error.message }
      );
      logger.error('Error stopping WebhookServerManager', { error: error.stack });
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
      
      if (!this.isRunning) {
        throw errorHandler.validationError('WebhookServerManager must be running before setting up webhooks');
      }
      
      return await this.webhookServer.setupWebhook(options);
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      const enhancedError = errorHandler.externalServiceError(
        `Failed to set up webhook for ${options?.owner}/${options?.repo}: ${error.message}`,
        { originalError: error.message }
      );
      
      logger.error(`Failed to set up webhook for ${options?.owner}/${options?.repo}`, { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Get server information
   * @returns {Object|null} Server information or null if not running
   */
  getServerInfo() {
    return this.isRunning ? this.serverInfo : null;
  }
  
  /**
   * Get the webhook server instance
   * @returns {WebhookServer} Webhook server instance
   */
  getWebhookServer() {
    return this.webhookServer;
  }
  
  /**
   * Get the dashboard instance
   * @returns {Object|null} Dashboard instance or null if not started
   */
  getDashboard() {
    return this.dashboard;
  }
  
  /**
   * Check if the manager is running
   * @returns {boolean} Whether the manager is running
   */
  isManagerRunning() {
    return this.isRunning;
  }
}

module.exports = WebhookServerManager;
