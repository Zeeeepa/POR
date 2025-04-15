/**
 * ConfigurationSystem.test.js
 * Unit tests for the ConfigurationSystem module
 */

const path = require('path');
const fs = require('fs-extra');
const ConfigurationSystem = require('../framework/ConfigurationSystem');

// Test directory for configuration files
const TEST_CONFIG_DIR = path.join(__dirname, 'test_config');

// Setup and teardown
beforeEach(() => {
  // Create test config directory
  fs.ensureDirSync(TEST_CONFIG_DIR);
});

afterEach(() => {
  // Clean up test config directory
  fs.removeSync(TEST_CONFIG_DIR);
});

describe('ConfigurationSystem', () => {
  describe('Basic Functionality', () => {
    test('should initialize with default configuration', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      const config = configSystem.getConfig();
      expect(config).toBeDefined();
      expect(config.app).toBeDefined();
      expect(config.app.name).toBe('Depla Project Manager');
    });
    
    test('should get and set configuration values', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Set a value
      configSystem.setConfig('test.value', 'test123');
      
      // Get the value
      const value = configSystem.getConfig('test.value');
      expect(value).toBe('test123');
    });
    
    test('should return default value when path not found', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      const value = configSystem.getConfig('nonexistent.path', 'default');
      expect(value).toBe('default');
    });
  });
  
  describe('Multiple Sources', () => {
    test('should load from multiple sources with correct priority', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Add a memory source with higher priority
      configSystem.addMemorySource('memory', {
        app: {
          name: 'Memory App'
        }
      }, { priority: 100 });
      
      // The memory source should override the default
      const appName = configSystem.getConfig('app.name');
      expect(appName).toBe('Memory App');
    });
    
    test('should add and remove sources', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Add a source
      configSystem.addMemorySource('test', { test: 'value' });
      
      // Check sources
      const sources = configSystem.getConfigSources();
      expect(sources.length).toBeGreaterThan(1);
      expect(sources.some(s => s.id === 'test')).toBe(true);
      
      // Remove the source
      configSystem.removeSource('test');
      
      // Check sources again
      const updatedSources = configSystem.getConfigSources();
      expect(updatedSources.some(s => s.id === 'test')).toBe(false);
    });
  });
  
  describe('Validation', () => {
    test('should validate configuration against schema', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Set some test values
      configSystem.setConfig('user', {
        name: 'Test User',
        email: 'test@example.com',
        age: 30
      });
      
      // Define a schema
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          age: { type: 'number', minimum: 18 }
        },
        required: ['name', 'email']
      };
      
      // Validate
      const result = configSystem.validateConfig(schema, { path: 'user' });
      expect(result.valid).toBe(true);
    });
    
    test('should detect validation errors', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Set some invalid test values
      configSystem.setConfig('user', {
        name: 'Test User',
        age: 'not a number'
      });
      
      // Define a schema
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          age: { type: 'number', minimum: 18 }
        },
        required: ['name', 'email']
      };
      
      // Validate
      const result = configSystem.validateConfig(schema, { path: 'user' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Change Notifications', () => {
    test('should notify watchers of configuration changes', done => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Add a watcher
      configSystem.watchConfig('test', (path, value) => {
        expect(path).toBe('test.value');
        expect(value).toBe('updated');
        done();
      });
      
      // Change the value
      configSystem.setConfig('test.value', 'updated');
    });
    
    test('should remove watchers', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Add a watcher
      const watcherId = configSystem.watchConfig('test', () => {});
      
      // Check watchers
      expect(configSystem.watchers.has(watcherId)).toBe(true);
      
      // Remove the watcher
      configSystem.unwatchConfig(watcherId);
      
      // Check watchers again
      expect(configSystem.watchers.has(watcherId)).toBe(false);
    });
  });
  
  describe('History and Versioning', () => {
    test('should track configuration history', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Make some changes
      configSystem.setConfig('test.value', 'value1');
      configSystem.setConfig('test.value', 'value2');
      configSystem.setConfig('test.value', 'value3');
      
      // Get history
      const history = configSystem.getConfigHistory('test.value');
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].value).toBe('value3');
    });
  });
  
  describe('Secure Storage', () => {
    test('should store sensitive values securely', () => {
      // Set encryption key
      process.env.CONFIG_ENCRYPTION_KEY = 'test-encryption-key-12345678901234';
      
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Set a secure value
      configSystem.setConfig('secure.api.key', 'very-secret-api-key', { secure: true });
      
      // Read the config file directly
      const configPath = path.join(TEST_CONFIG_DIR, 'config.json');
      const rawConfig = fs.readJsonSync(configPath);
      
      // Check that the value is not stored in plain text
      expect(rawConfig.secure.api.key).toBe('***ENCRYPTED***');
      expect(rawConfig._encrypted).toBeDefined();
      expect(Object.keys(rawConfig._encrypted)).toContain('secure.api.key');
      
      // But we can still access it through the API
      const apiKey = configSystem.getConfig('secure.api.key');
      expect(apiKey).toBe('very-secret-api-key');
      
      // Clean up
      delete process.env.CONFIG_ENCRYPTION_KEY;
    });
  });
  
  describe('Hierarchical Configuration', () => {
    test('should support hierarchical configuration with inheritance', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Set base configuration
      configSystem.setConfig('database', {
        host: 'localhost',
        port: 5432,
        username: 'user',
        password: 'password',
        options: {
          ssl: false,
          timeout: 30000
        }
      });
      
      // Set environment-specific configuration that inherits from base
      configSystem.addMemorySource('production', {
        database: {
          host: 'production-db.example.com',
          options: {
            ssl: true
          }
        }
      }, { priority: 100 });
      
      // Check merged configuration
      const dbConfig = configSystem.getConfig('database');
      expect(dbConfig.host).toBe('production-db.example.com'); // Overridden
      expect(dbConfig.port).toBe(5432); // Inherited
      expect(dbConfig.options.ssl).toBe(true); // Overridden
      expect(dbConfig.options.timeout).toBe(30000); // Inherited
    });
  });
  
  describe('Reset and Merge', () => {
    test('should reset configuration to defaults', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Change some values
      configSystem.setConfig('app.name', 'Modified App');
      expect(configSystem.getConfig('app.name')).toBe('Modified App');
      
      // Reset
      configSystem.resetConfig();
      
      // Check reset values
      expect(configSystem.getConfig('app.name')).toBe('Depla Project Manager');
    });
    
    test('should merge configurations', () => {
      const configSystem = new ConfigurationSystem({
        configDir: TEST_CONFIG_DIR,
        defaultConfigPath: path.join(TEST_CONFIG_DIR, 'config.json')
      });
      
      // Merge a new configuration
      configSystem.mergeConfig({
        newSection: {
          enabled: true,
          options: {
            feature1: true,
            feature2: false
          }
        }
      });
      
      // Check merged values
      expect(configSystem.getConfig('newSection.enabled')).toBe(true);
      expect(configSystem.getConfig('newSection.options.feature1')).toBe(true);
      
      // Original values should still be there
      expect(configSystem.getConfig('app.name')).toBe('Depla Project Manager');
    });
  });
});
