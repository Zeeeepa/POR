/**
 * ConfigurationSystem.js
 * A robust configuration management system that supports multiple sources,
 * validation, hierarchical configuration, secure storage, change notifications,
 * versioning, and a clean API.
 * 
 * This module builds upon the existing ConfigManager.js but adds advanced features.
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');
const dotenv = require('dotenv');
const EventEmitter = require('events');
const crypto = require('crypto');
const Ajv = require('ajv');
const deepmerge = require('deepmerge');

// Load environment variables from .env file
dotenv.config();

/**
 * ConfigurationError class for specific configuration-related errors
 */
class ConfigurationError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ConfigurationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * ConfigurationSource class representing a configuration source
 */
class ConfigurationSource {
  constructor(id, type, options = {}) {
    this.id = id;
    this.type = type;
    this.options = options;
    this.priority = options.priority || 0;
  }
}

/**
 * ConfigurationSystem class for managing application configuration
 */
class ConfigurationSystem extends EventEmitter {
  /**
   * Create a new ConfigurationSystem instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      configDir: path.join(process.cwd(), 'config'),
      defaultConfigPath: path.join(process.cwd(), 'config', 'app_config.json'),
      encryptionKey: process.env.CONFIG_ENCRYPTION_KEY,
      cacheEnabled: true,
      cacheTimeout: 60000, // 1 minute
      ...options
    };
    
    // Ensure config directory exists
    fs.ensureDirSync(this.options.configDir);
    
    // Initialize configuration sources
    this.sources = new Map();
    
    // Initialize configuration cache
    this.cache = {
      data: {},
      timestamp: 0
    };
    
    // Initialize configuration history
    this.history = [];
    
    // Initialize configuration watchers
    this.watchers = new Map();
    
    // Add default file source
    this.addFileSource('default', this.options.defaultConfigPath, { priority: 0 });
    
    // Add environment source
    this.addEnvironmentSource('env', { prefix: 'APP_', priority: 50 });
    
    // Load initial configuration
    this.loadConfig();
  }
  
  /**
   * Load configuration from all sources
   * @param {Object} options - Load options
   * @returns {Object} Merged configuration
   */
  loadConfig(options = {}) {
    try {
      const config = {};
      
      // Sort sources by priority (higher priority overrides lower)
      const sortedSources = Array.from(this.sources.values())
        .sort((a, b) => a.priority - b.priority);
      
      // Load from each source
      for (const source of sortedSources) {
        const sourceConfig = this._loadFromSource(source);
        deepmerge(config, sourceConfig);
      }
      
      // Update cache
      this.cache = {
        data: config,
        timestamp: Date.now()
      };
      
      // Add to history
      this._addToHistory(config);
      
      logger.info('Configuration loaded successfully from all sources');
      return config;
    } catch (error) {
      logger.error(`Failed to load configuration: ${error.message}`);
      throw new ConfigurationError(
        `Failed to load configuration: ${error.message}`,
        'LOAD_FAILED',
        { originalError: error }
      );
    }
  }
  
  /**
   * Load configuration from a specific source
   * @param {ConfigurationSource} source - Configuration source
   * @returns {Object} Configuration from source
   * @private
   */
  _loadFromSource(source) {
    try {
      switch (source.type) {
        case 'file':
          return this._loadFromFile(source);
        case 'environment':
          return this._loadFromEnvironment(source);
        case 'database':
          return this._loadFromDatabase(source);
        case 'memory':
          return this._loadFromMemory(source);
        default:
          logger.warn(`Unknown source type: ${source.type}`);
          return {};
      }
    } catch (error) {
      logger.error(`Failed to load from source ${source.id}: ${error.message}`);
      return {};
    }
  }
  
  /**
   * Load configuration from a file source
   * @param {ConfigurationSource} source - File configuration source
   * @returns {Object} Configuration from file
   * @private
   */
  _loadFromFile(source) {
    const filePath = source.options.path;
    
    if (!fs.existsSync(filePath)) {
      // Create default configuration if file doesn't exist
      const defaultConfig = this._getDefaultConfig();
      fs.writeJsonSync(filePath, defaultConfig, { spaces: 2 });
      return defaultConfig;
    }
    
    // Read and parse file
    const config = fs.readJsonSync(filePath);
    
    // Handle sensitive data
    if (config._encrypted && this.options.encryptionKey) {
      Object.keys(config._encrypted).forEach(key => {
        const decrypted = this._decrypt(config._encrypted[key]);
        const keyParts = key.split('.');
        let current = config;
        
        // Navigate to the nested object
        for (let i = 0; i < keyParts.length - 1; i++) {
          const part = keyParts[i];
          if (!current[part]) current[part] = {};
          current = current[part];
        }
        
        // Set the decrypted value
        current[keyParts[keyParts.length - 1]] = decrypted;
      });
    }
    
    return config;
  }
  
  /**
   * Load configuration from environment variables
   * @param {ConfigurationSource} source - Environment configuration source
   * @returns {Object} Configuration from environment
   * @private
   */
  _loadFromEnvironment(source) {
    const config = {};
    const prefix = source.options.prefix || '';
    
    // Process environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith(prefix)) {
        const configKey = key.substring(prefix.length).toLowerCase().replace(/_/g, '.');
        let value = process.env[key];
        
        // Try to parse as JSON if it looks like an object or array
        if ((value.startsWith('{') && value.endsWith('}')) || 
            (value.startsWith('[') && value.endsWith(']'))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }
        
        // Set nested property
        this._setNestedProperty(config, configKey, value);
      }
    });
    
    return config;
  }
  
  /**
   * Load configuration from a database source
   * @param {ConfigurationSource} source - Database configuration source
   * @returns {Object} Configuration from database
   * @private
   */
  _loadFromDatabase(source) {
    // This is a placeholder for database loading
    // In a real implementation, this would connect to the database
    // and retrieve configuration values
    logger.info(`Database source ${source.id} loading not implemented yet`);
    return {};
  }
  
  /**
   * Load configuration from memory
   * @param {ConfigurationSource} source - Memory configuration source
   * @returns {Object} Configuration from memory
   * @private
   */
  _loadFromMemory(source) {
    return source.options.data || {};
  }
  
  /**
   * Get default configuration
   * @returns {Object} Default configuration
   * @private
   */
  _getDefaultConfig() {
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
   * Set a nested property in an object using a dot-notation path
   * @param {Object} obj - Target object
   * @param {string} path - Dot-notation path
   * @param {*} value - Value to set
   * @private
   */
  _setNestedProperty(obj, path, value) {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) current[part] = {};
      current = current[part];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  /**
   * Add a configuration source
   * @param {string} id - Source identifier
   * @param {string} type - Source type ('file', 'environment', 'database', 'memory')
   * @param {Object} options - Source options
   * @returns {ConfigurationSource} Added source
   */
  addSource(id, type, options = {}) {
    const source = new ConfigurationSource(id, type, options);
    this.sources.set(id, source);
    
    // Reload configuration
    this.loadConfig();
    
    return source;
  }
  
  /**
   * Add a file configuration source
   * @param {string} id - Source identifier
   * @param {string} filePath - Path to configuration file
   * @param {Object} options - Source options
   * @returns {ConfigurationSource} Added source
   */
  addFileSource(id, filePath, options = {}) {
    return this.addSource(id, 'file', { ...options, path: filePath });
  }
  
  /**
   * Add an environment configuration source
   * @param {string} id - Source identifier
   * @param {Object} options - Source options
   * @returns {ConfigurationSource} Added source
   */
  addEnvironmentSource(id, options = {}) {
    return this.addSource(id, 'environment', options);
  }
  
  /**
   * Add a database configuration source
   * @param {string} id - Source identifier
   * @param {Object} options - Source options
   * @returns {ConfigurationSource} Added source
   */
  addDatabaseSource(id, options = {}) {
    return this.addSource(id, 'database', options);
  }
  
  /**
   * Add a memory configuration source
   * @param {string} id - Source identifier
   * @param {Object} data - Configuration data
   * @param {Object} options - Source options
   * @returns {ConfigurationSource} Added source
   */
  addMemorySource(id, data, options = {}) {
    return this.addSource(id, 'memory', { ...options, data });
  }
  
  /**
   * Remove a configuration source
   * @param {string} id - Source identifier
   * @returns {boolean} Success status
   */
  removeSource(id) {
    const result = this.sources.delete(id);
    
    if (result) {
      // Reload configuration
      this.loadConfig();
    }
    
    return result;
  }
  
  /**
   * Get all configuration sources
   * @returns {Array<ConfigurationSource>} Configuration sources
   */
  getConfigSources() {
    return Array.from(this.sources.values());
  }
  
  /**
   * Get configuration value by path
   * @param {string} path - Configuration path (dot notation)
   * @param {*} defaultValue - Default value if path not found
   * @returns {*} Configuration value
   */
  getConfig(path, defaultValue = null) {
    try {
      // Check if cache is valid
      if (this.options.cacheEnabled && 
          this.cache.timestamp > 0 && 
          Date.now() - this.cache.timestamp < this.options.cacheTimeout) {
        return this._getNestedProperty(this.cache.data, path, defaultValue);
      }
      
      // Reload configuration if cache is invalid
      const config = this.loadConfig();
      return this._getNestedProperty(config, path, defaultValue);
    } catch (error) {
      logger.error(`Failed to get configuration value for ${path}: ${error.message}`);
      return defaultValue;
    }
  }
  
  /**
   * Get a nested property from an object using a dot-notation path
   * @param {Object} obj - Source object
   * @param {string} path - Dot-notation path
   * @param {*} defaultValue - Default value if path not found
   * @returns {*} Property value
   * @private
   */
  _getNestedProperty(obj, path, defaultValue = null) {
    if (!path) return obj;
    
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current !== undefined ? current : defaultValue;
  }
  
  /**
   * Set configuration value
   * @param {string} path - Configuration path (dot notation)
   * @param {*} value - Value to set
   * @param {Object} options - Set options
   * @returns {boolean} Success status
   */
  setConfig(path, value, options = {}) {
    try {
      const { source = 'default', secure = false } = options;
      
      // Get source
      const configSource = this.sources.get(source);
      if (!configSource) {
        throw new ConfigurationError(
          `Configuration source not found: ${source}`,
          'SOURCE_NOT_FOUND'
        );
      }
      
      // Handle different source types
      switch (configSource.type) {
        case 'file':
          return this._setFileConfig(configSource, path, value, secure);
        case 'memory':
          return this._setMemoryConfig(configSource, path, value);
        case 'database':
          return this._setDatabaseConfig(configSource, path, value, secure);
        case 'environment':
          logger.warn('Cannot set configuration in environment source');
          return false;
        default:
          logger.warn(`Unknown source type: ${configSource.type}`);
          return false;
      }
    } catch (error) {
      logger.error(`Failed to set configuration value for ${path}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Set configuration in a file source
   * @param {ConfigurationSource} source - File configuration source
   * @param {string} path - Configuration path
   * @param {*} value - Value to set
   * @param {boolean} secure - Whether to store securely
   * @returns {boolean} Success status
   * @private
   */
  _setFileConfig(source, path, value, secure) {
    const filePath = source.options.path;
    
    // Read current config
    let config = {};
    if (fs.existsSync(filePath)) {
      config = fs.readJsonSync(filePath);
    }
    
    // Handle secure storage
    if (secure && this.options.encryptionKey) {
      // Initialize encrypted section if it doesn't exist
      if (!config._encrypted) config._encrypted = {};
      
      // Store encrypted value
      config._encrypted[path] = this._encrypt(value);
      
      // Store a placeholder in the regular path
      this._setNestedProperty(config, path, '***ENCRYPTED***');
    } else {
      // Store value directly
      this._setNestedProperty(config, path, value);
    }
    
    // Update timestamp
    config.updatedAt = new Date().toISOString();
    
    // Save to file
    fs.writeJsonSync(filePath, config, { spaces: 2 });
    
    // Update cache
    this.cache.timestamp = 0; // Invalidate cache
    
    // Emit change event
    this._emitChangeEvent(path, value);
    
    // Add to history
    this._addToHistory(this.loadConfig());
    
    return true;
  }
  
  /**
   * Set configuration in a memory source
   * @param {ConfigurationSource} source - Memory configuration source
   * @param {string} path - Configuration path
   * @param {*} value - Value to set
   * @returns {boolean} Success status
   * @private
   */
  _setMemoryConfig(source, path, value) {
    // Initialize data if it doesn't exist
    if (!source.options.data) source.options.data = {};
    
    // Set value
    this._setNestedProperty(source.options.data, path, value);
    
    // Update cache
    this.cache.timestamp = 0; // Invalidate cache
    
    // Emit change event
    this._emitChangeEvent(path, value);
    
    // Add to history
    this._addToHistory(this.loadConfig());
    
    return true;
  }
  
  /**
   * Set configuration in a database source
   * @param {ConfigurationSource} source - Database configuration source
   * @param {string} path - Configuration path
   * @param {*} value - Value to set
   * @param {boolean} secure - Whether to store securely
   * @returns {boolean} Success status
   * @private
   */
  _setDatabaseConfig(source, path, value, secure) {
    // This is a placeholder for database setting
    // In a real implementation, this would connect to the database
    // and store configuration values
    logger.info(`Database source ${source.id} setting not implemented yet`);
    
    // Update cache
    this.cache.timestamp = 0; // Invalidate cache
    
    // Emit change event
    this._emitChangeEvent(path, value);
    
    return false;
  }
  
  /**
   * Encrypt a value
   * @param {*} value - Value to encrypt
   * @returns {string} Encrypted value
   * @private
   */
  _encrypt(value) {
    if (!this.options.encryptionKey) {
      throw new ConfigurationError(
        'Encryption key not set',
        'ENCRYPTION_KEY_MISSING'
      );
    }
    
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-cbc',
        Buffer.from(this.options.encryptionKey.padEnd(32).slice(0, 32)),
        iv
      );
      
      const serialized = JSON.stringify(value);
      let encrypted = cipher.update(serialized, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      throw new ConfigurationError(
        `Encryption failed: ${error.message}`,
        'ENCRYPTION_FAILED',
        { originalError: error }
      );
    }
  }
  
  /**
   * Decrypt a value
   * @param {string} encrypted - Encrypted value
   * @returns {*} Decrypted value
   * @private
   */
  _decrypt(encrypted) {
    if (!this.options.encryptionKey) {
      throw new ConfigurationError(
        'Encryption key not set',
        'ENCRYPTION_KEY_MISSING'
      );
    }
    
    try {
      const [ivHex, encryptedData] = encrypted.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(this.options.encryptionKey.padEnd(32).slice(0, 32)),
        iv
      );
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      throw new ConfigurationError(
        `Decryption failed: ${error.message}`,
        'DECRYPTION_FAILED',
        { originalError: error }
      );
    }
  }
  
  /**
   * Validate configuration against a schema
   * @param {Object} schema - JSON Schema for validation
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateConfig(schema, options = {}) {
    try {
      const { path = null } = options;
      
      // Get configuration to validate
      const config = path ? this.getConfig(path) : this.getConfig();
      
      // Create validator
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(schema);
      
      // Validate
      const valid = validate(config);
      
      return {
        valid,
        errors: validate.errors || []
      };
    } catch (error) {
      logger.error(`Configuration validation failed: ${error.message}`);
      return {
        valid: false,
        errors: [{ message: error.message }]
      };
    }
  }
  
  /**
   * Watch for configuration changes
   * @param {string} path - Configuration path to watch
   * @param {Function} callback - Callback function
   * @returns {string} Watcher ID
   */
  watchConfig(path, callback) {
    if (typeof callback !== 'function') {
      throw new ConfigurationError(
        'Callback must be a function',
        'INVALID_CALLBACK'
      );
    }
    
    const watcherId = crypto.randomUUID();
    
    // Add watcher
    this.watchers.set(watcherId, { path, callback });
    
    // Return watcher ID for later removal
    return watcherId;
  }
  
  /**
   * Remove a configuration watcher
   * @param {string} watcherId - Watcher ID
   * @returns {boolean} Success status
   */
  unwatchConfig(watcherId) {
    return this.watchers.delete(watcherId);
  }
  
  /**
   * Emit change event and notify watchers
   * @param {string} path - Changed path
   * @param {*} value - New value
   * @private
   */
  _emitChangeEvent(path, value) {
    // Emit general change event
    this.emit('change', { path, value });
    
    // Emit specific path change event
    this.emit(`change:${path}`, value);
    
    // Notify watchers
    this.watchers.forEach((watcher, id) => {
      if (!watcher.path || path.startsWith(watcher.path)) {
        try {
          watcher.callback(path, value);
        } catch (error) {
          logger.error(`Watcher callback error: ${error.message}`);
        }
      }
    });
  }
  
  /**
   * Reset configuration to default values
   * @param {string} path - Configuration path to reset (null for all)
   * @returns {boolean} Success status
   */
  resetConfig(path = null) {
    try {
      if (path) {
        // Reset specific path
        const defaultConfig = this._getDefaultConfig();
        const defaultValue = this._getNestedProperty(defaultConfig, path);
        return this.setConfig(path, defaultValue);
      } else {
        // Reset all configuration
        const defaultConfig = this._getDefaultConfig();
        
        // Update default file source
        const defaultSource = this.sources.get('default');
        if (defaultSource && defaultSource.type === 'file') {
          fs.writeJsonSync(defaultSource.options.path, defaultConfig, { spaces: 2 });
        }
        
        // Update memory sources
        this.sources.forEach(source => {
          if (source.type === 'memory') {
            source.options.data = {};
          }
        });
        
        // Invalidate cache
        this.cache.timestamp = 0;
        
        // Reload configuration
        this.loadConfig();
        
        // Emit change event
        this._emitChangeEvent('', defaultConfig);
        
        return true;
      }
    } catch (error) {
      logger.error(`Failed to reset configuration: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Save configuration to a destination
   * @param {string} destination - Destination path or identifier
   * @param {Object} options - Save options
   * @returns {boolean} Success status
   */
  saveConfig(destination, options = {}) {
    try {
      const { format = 'json', path = null } = options;
      
      // Get configuration to save
      const config = path ? this.getConfig(path) : this.getConfig();
      
      // Handle different formats
      switch (format.toLowerCase()) {
        case 'json':
          fs.writeJsonSync(destination, config, { spaces: 2 });
          break;
        case 'yaml':
        case 'yml':
          // This would require a YAML library
          logger.warn('YAML format not supported yet');
          return false;
        default:
          logger.warn(`Unknown format: ${format}`);
          return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to save configuration to ${destination}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Add configuration change to history
   * @param {Object} config - Configuration snapshot
   * @private
   */
  _addToHistory(config) {
    // Add to history with timestamp
    this.history.push({
      timestamp: Date.now(),
      config: JSON.parse(JSON.stringify(config)) // Deep clone
    });
    
    // Limit history size
    const maxHistory = 50;
    if (this.history.length > maxHistory) {
      this.history = this.history.slice(-maxHistory);
    }
  }
  
  /**
   * Get configuration change history
   * @param {string} path - Configuration path to get history for (null for all)
   * @param {Object} options - History options
   * @returns {Array} Configuration history
   */
  getConfigHistory(path = null, options = {}) {
    const { limit = 10, startTime = 0, endTime = Date.now() } = options;
    
    // Filter history by time range
    let filteredHistory = this.history.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    );
    
    // Extract values for specific path
    if (path) {
      filteredHistory = filteredHistory.map(entry => ({
        timestamp: entry.timestamp,
        value: this._getNestedProperty(entry.config, path)
      }));
    }
    
    // Limit results
    return filteredHistory.slice(-limit);
  }
  
  /**
   * Merge configuration from another source
   * @param {Object|string} source - Configuration object or source identifier
   * @param {Object} options - Merge options
   * @returns {boolean} Success status
   */
  mergeConfig(source, options = {}) {
    try {
      let sourceConfig;
      
      if (typeof source === 'string') {
        // Get configuration from a source
        const configSource = this.sources.get(source);
        if (!configSource) {
          throw new ConfigurationError(
            `Configuration source not found: ${source}`,
            'SOURCE_NOT_FOUND'
          );
        }
        sourceConfig = this._loadFromSource(configSource);
      } else if (typeof source === 'object') {
        // Use provided object
        sourceConfig = source;
      } else {
        throw new ConfigurationError(
          'Source must be an object or source identifier',
          'INVALID_SOURCE'
        );
      }
      
      // Get target source
      const targetSourceId = options.target || 'default';
      const targetSource = this.sources.get(targetSourceId);
      
      if (!targetSource) {
        throw new ConfigurationError(
          `Target source not found: ${targetSourceId}`,
          'TARGET_NOT_FOUND'
        );
      }
      
      // Handle different target types
      switch (targetSource.type) {
        case 'file':
          // Read current config
          const filePath = targetSource.options.path;
          let config = {};
          
          if (fs.existsSync(filePath)) {
            config = fs.readJsonSync(filePath);
          }
          
          // Merge configurations
          const merged = deepmerge(config, sourceConfig);
          
          // Update timestamp
          merged.updatedAt = new Date().toISOString();
          
          // Save to file
          fs.writeJsonSync(filePath, merged, { spaces: 2 });
          break;
          
        case 'memory':
          // Initialize data if it doesn't exist
          if (!targetSource.options.data) targetSource.options.data = {};
          
          // Merge configurations
          targetSource.options.data = deepmerge(targetSource.options.data, sourceConfig);
          break;
          
        default:
          logger.warn(`Cannot merge into source type: ${targetSource.type}`);
          return false;
      }
      
      // Invalidate cache
      this.cache.timestamp = 0;
      
      // Reload configuration
      this.loadConfig();
      
      return true;
    } catch (error) {
      logger.error(`Failed to merge configuration: ${error.message}`);
      return false;
    }
  }
}

module.exports = ConfigurationSystem;
