/**
 * ConfigurationSystemExample.js
 * Example usage of the ConfigurationSystem module
 */

const { ConfigurationSystem } = require('../framework');
const path = require('path');

// Create a configuration system instance
const configSystem = new ConfigurationSystem({
  configDir: path.join(__dirname, 'config'),
  defaultConfigPath: path.join(__dirname, 'config', 'app_config.json'),
  cacheEnabled: true,
  cacheTimeout: 30000 // 30 seconds
});

// Example 1: Basic configuration access
console.log('Example 1: Basic configuration access');
console.log('App name:', configSystem.getConfig('app.name'));
console.log('GitHub token:', configSystem.getConfig('github.token'));
console.log();

// Example 2: Setting configuration values
console.log('Example 2: Setting configuration values');
configSystem.setConfig('app.environment', 'development');
configSystem.setConfig('database', {
  host: 'localhost',
  port: 5432,
  username: 'user',
  password: 'password'
});
console.log('Updated config:', configSystem.getConfig());
console.log();

// Example 3: Using multiple configuration sources
console.log('Example 3: Using multiple configuration sources');
// Add a memory source with higher priority
configSystem.addMemorySource('production', {
  app: {
    environment: 'production'
  },
  database: {
    host: 'production-db.example.com'
  }
}, { priority: 100 });

console.log('Environment:', configSystem.getConfig('app.environment')); // Should be 'production'
console.log('Database host:', configSystem.getConfig('database.host')); // Should be 'production-db.example.com'
console.log('Database port:', configSystem.getConfig('database.port')); // Should still be 5432 (inherited)
console.log();

// Example 4: Configuration validation
console.log('Example 4: Configuration validation');
const databaseSchema = {
  type: 'object',
  properties: {
    host: { type: 'string' },
    port: { type: 'number' },
    username: { type: 'string' },
    password: { type: 'string' }
  },
  required: ['host', 'username', 'password']
};

const validationResult = configSystem.validateConfig(databaseSchema, { path: 'database' });
console.log('Validation result:', validationResult);
console.log();

// Example 5: Secure configuration storage
console.log('Example 5: Secure configuration storage');
// Set an encryption key (in a real app, this would be in environment variables)
process.env.CONFIG_ENCRYPTION_KEY = 'example-encryption-key-12345678901234';

// Store a sensitive value
configSystem.setConfig('api.key', 'super-secret-api-key', { secure: true });
console.log('API key (retrieved):', configSystem.getConfig('api.key'));
console.log();

// Example 6: Configuration change notifications
console.log('Example 6: Configuration change notifications');
// Add a watcher
const watcherId = configSystem.watchConfig('app', (path, value) => {
  console.log(`Configuration changed: ${path} = ${JSON.stringify(value)}`);
});

// Change a value to trigger the watcher
configSystem.setConfig('app.version', '2.0.0');
console.log();

// Example 7: Configuration history
console.log('Example 7: Configuration history');
// Make some changes
configSystem.setConfig('feature.enabled', true);
configSystem.setConfig('feature.enabled', false);
configSystem.setConfig('feature.enabled', true);

// Get history
const history = configSystem.getConfigHistory('feature.enabled');
console.log('Configuration history:', history);
console.log();

// Example 8: Reset configuration
console.log('Example 8: Reset configuration');
console.log('Before reset - App name:', configSystem.getConfig('app.name'));
configSystem.setConfig('app.name', 'Modified App');
console.log('After modification - App name:', configSystem.getConfig('app.name'));
configSystem.resetConfig('app.name');
console.log('After reset - App name:', configSystem.getConfig('app.name'));
console.log();

// Example 9: Merge configuration
console.log('Example 9: Merge configuration');
configSystem.mergeConfig({
  newFeature: {
    enabled: true,
    options: {
      timeout: 5000,
      retries: 3
    }
  }
});
console.log('New feature config:', configSystem.getConfig('newFeature'));
console.log();

// Example 10: Save configuration to a file
console.log('Example 10: Save configuration to a file');
const savePath = path.join(__dirname, 'config', 'exported_config.json');
configSystem.saveConfig(savePath);
console.log(`Configuration saved to ${savePath}`);
