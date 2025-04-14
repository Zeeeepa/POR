/**
 * config.js
 * Central configuration module for the application.
 * Loads configuration from environment variables with sensible defaults.
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs-extra');

// Load environment variables from .env file if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

/**
 * Configuration object with defaults and environment variable overrides
 */
const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || 'localhost',
    environment: process.env.NODE_ENV || 'development'
  },
  
  // GitHub configuration
  github: {
    token: process.env.GITHUB_TOKEN,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
    autoMerge: process.env.GITHUB_AUTO_MERGE === 'true',
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO
  },
  
  // Ngrok configuration
  ngrokAuthToken: process.env.NGROK_AUTH_TOKEN,
  ngrokRegion: process.env.NGROK_REGION || 'us',
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    directory: process.env.LOG_DIR || path.join(process.cwd(), 'logs')
  },
  
  // Webhook configuration
  webhook: {
    path: process.env.WEBHOOK_PATH || '/webhook',
    useNgrok: process.env.USE_NGROK === 'true'
  }
};

// Validate critical configuration
if (!config.github.token && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: GitHub token not configured. GitHub API operations will be disabled.');
}

if (!config.github.webhookSecret && process.env.NODE_ENV === 'production') {
  console.warn('WARNING: GitHub webhook secret not configured. Webhook verification will be disabled.');
}

module.exports = config;
