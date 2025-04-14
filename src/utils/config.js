/**
 * config.js
 * Centralized configuration management for the application
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs-extra');

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration object with default values and environment overrides
 */
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
  },
  
  // GitHub configuration
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    apiUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    appId: process.env.GITHUB_APP_ID,
    appPrivateKey: process.env.GITHUB_APP_PRIVATE_KEY,
  },
  
  // Ngrok configuration
  ngrok: {
    authToken: process.env.NGROK_AUTH_TOKEN,
    region: process.env.NGROK_REGION || 'us',
    enabled: process.env.USE_NGROK === 'true',
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: process.env.LOG_DIRECTORY || path.join(process.cwd(), 'logs'),
    maxSize: parseInt(process.env.LOG_MAX_SIZE || '10485760', 10), // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
    serviceName: process.env.SERVICE_NAME || 'depla-project-manager',
  },
  
  // Webhook configuration
  webhook: {
    path: process.env.WEBHOOK_PATH || '/webhook',
    events: (process.env.WEBHOOK_EVENTS || 'push,pull_request').split(','),
  },
  
  // Get a configuration value with optional default
  get: function(key, defaultValue) {
    const parts = key.split('.');
    let current = this;
    
    for (const part of parts) {
      if (current[part] === undefined) {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current !== undefined ? current : defaultValue;
  },
  
  // Check if running in production environment
  isProduction: function() {
    return this.server.env === 'production';
  },
  
  // Check if running in development environment
  isDevelopment: function() {
    return this.server.env === 'development';
  },
  
  // Check if running in test environment
  isTest: function() {
    return this.server.env === 'test';
  },
};

// Ensure logs directory exists
fs.ensureDirSync(config.logging.directory);

module.exports = config;
