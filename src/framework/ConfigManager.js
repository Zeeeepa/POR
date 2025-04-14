/**
 * ConfigManager.js
 * Manages application configuration with file persistence
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

class ConfigManager {
  constructor(configPath) {
    this.configDir = path.join(process.cwd(), 'config');
    this.configPath = configPath || path.join(this.configDir, 'app_config.json');
    this.config = {};
    
    // Ensure config directory exists
    fs.ensureDirSync(this.configDir);
    
    this.loadConfig();
  }
  
  /**
   * Load configuration from file
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        this.config = fs.readJsonSync(this.configPath);
        logger.info('Configuration loaded successfully');
      } else {
        // Create default configuration
        this.config = this.getDefaultConfig();
        this.saveConfig();
        logger.info('Default configuration created');
      }
    } catch (error) {
      logger.error(`Failed to load configuration: ${error.message}`);
      this.config = this.getDefaultConfig();
    }
  }
  
  /**
   * Save configuration to file
   */
  saveConfig() {
    try {
      fs.writeJsonSync(this.configPath, this.config, { spaces: 2 });
      logger.info('Configuration saved successfully');
      return true;
    } catch (error) {
      logger.error(`Failed to save configuration: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get default configuration
   * @returns {Object} Default configuration
   */
  getDefaultConfig() {
    return {
      app: {
        name: 'Depla Project Manager',
        version: '1.0.0'
      },
      github: {
        token: process.env.GITHUB_TOKEN || '',
        username: process.env.GITHUB_USERNAME || '',
        webhook: {
          secret: process.env.WEBHOOK_SECRET || '',
          events: ['push', 'pull_request']
        }
      },
      automation: {
        enabled: false,
        interval: 60000 // 1 minute
      },
      messaging: {
        defaultDelay: 2000,
        maxConcurrentMessages: 3,
        maxRetries: 3
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  
  /**
   * Get the current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   * @returns {boolean} Success status
   */
  updateConfig(newConfig) {
    try {
      // Merge new config with existing
      this.config = {
        ...this.config,
        ...newConfig,
        updatedAt: new Date().toISOString()
      };
      
      // Save updated config
      return this.saveConfig();
    } catch (error) {
      logger.error(`Failed to update configuration: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get a specific configuration value
   * @param {string} key - Configuration key (dot notation supported)
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} Configuration value
   */
  get(key, defaultValue = null) {
    try {
      const keys = key.split('.');
      let value = this.config;
      
      for (const k of keys) {
        if (value === undefined || value === null) {
          return defaultValue;
        }
        value = value[k];
      }
      
      return value !== undefined ? value : defaultValue;
    } catch (error) {
      logger.error(`Failed to get configuration value for ${key}: ${error.message}`);
      return defaultValue;
    }
  }
  
  /**
   * Set a specific configuration value
   * @param {string} key - Configuration key (dot notation supported)
   * @param {*} value - Value to set
   * @returns {boolean} Success status
   */
  set(key, value) {
    try {
      const keys = key.split('.');
      let current = this.config;
      
      // Navigate to the nested object
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!current[k] || typeof current[k] !== 'object') {
          current[k] = {};
        }
        current = current[k];
      }
      
      // Set the value
      current[keys[keys.length - 1]] = value;
      
      // Update timestamp
      this.config.updatedAt = new Date().toISOString();
      
      // Save the updated config
      return this.saveConfig();
    } catch (error) {
      logger.error(`Failed to set configuration value for ${key}: ${error.message}`);
      return false;
    }
  }
}

module.exports = ConfigManager;
