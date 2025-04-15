# ConfigurationSystem

A robust configuration management system that supports multiple sources, validation, hierarchical configuration, secure storage, change notifications, versioning, and a clean API.

## Features

- **Multiple Configuration Sources**: Load configuration from files, environment variables, databases, and memory
- **Configuration Validation**: Validate configuration against JSON Schema
- **Hierarchical Configuration**: Support for configuration inheritance and overrides
- **Secure Storage**: Encrypt sensitive configuration values
- **Change Notifications**: Watch for configuration changes
- **Configuration Versioning**: Track configuration history
- **Clean API**: Simple, promise-based API for accessing configuration
- **Caching**: Performance optimization with configurable caching

## Installation

The ConfigurationSystem is part of the framework module. To use it, simply import it:

```javascript
const { ConfigurationSystem } = require('../framework');
```

## Usage

### Basic Usage

```javascript
// Create a configuration system instance
const configSystem = new ConfigurationSystem();

// Get configuration values
const appName = configSystem.getConfig('app.name');
const githubToken = configSystem.getConfig('github.token');

// Set configuration values
configSystem.setConfig('app.environment', 'development');
configSystem.setConfig('database', {
  host: 'localhost',
  port: 5432,
  username: 'user',
  password: 'password'
});
```

### Multiple Configuration Sources

```javascript
// Add a file source
configSystem.addFileSource('config', '/path/to/config.json');

// Add an environment source
configSystem.addEnvironmentSource('env', { prefix: 'APP_' });

// Add a memory source with higher priority
configSystem.addMemorySource('production', {
  app: {
    environment: 'production'
  },
  database: {
    host: 'production-db.example.com'
  }
}, { priority: 100 });

// Get sources
const sources = configSystem.getConfigSources();

// Remove a source
configSystem.removeSource('production');
```

### Configuration Validation

```javascript
// Define a schema
const schema = {
  type: 'object',
  properties: {
    host: { type: 'string' },
    port: { type: 'number' },
    username: { type: 'string' },
    password: { type: 'string' }
  },
  required: ['host', 'username', 'password']
};

// Validate configuration
const result = configSystem.validateConfig(schema, { path: 'database' });
if (result.valid) {
  console.log('Configuration is valid');
} else {
  console.error('Validation errors:', result.errors);
}
```

### Secure Storage

```javascript
// Set an encryption key (in a real app, this would be in environment variables)
process.env.CONFIG_ENCRYPTION_KEY = 'your-encryption-key';

// Store a sensitive value
configSystem.setConfig('api.key', 'super-secret-api-key', { secure: true });

// Retrieve the value
const apiKey = configSystem.getConfig('api.key');
```

### Change Notifications

```javascript
// Add a watcher
const watcherId = configSystem.watchConfig('database', (path, value) => {
  console.log(`Configuration changed: ${path} = ${JSON.stringify(value)}`);
});

// Change a value to trigger the watcher
configSystem.setConfig('database.host', 'new-host.example.com');

// Remove the watcher
configSystem.unwatchConfig(watcherId);
```

### Configuration History

```javascript
// Make some changes
configSystem.setConfig('feature.enabled', true);
configSystem.setConfig('feature.enabled', false);
configSystem.setConfig('feature.enabled', true);

// Get history
const history = configSystem.getConfigHistory('feature.enabled');
console.log('Configuration history:', history);
```

### Reset Configuration

```javascript
// Reset a specific path
configSystem.resetConfig('app.name');

// Reset all configuration
configSystem.resetConfig();
```

### Merge Configuration

```javascript
// Merge a new configuration
configSystem.mergeConfig({
  newFeature: {
    enabled: true,
    options: {
      timeout: 5000,
      retries: 3
    }
  }
});
```

### Save Configuration

```javascript
// Save configuration to a file
configSystem.saveConfig('/path/to/exported_config.json');
```

## API Reference

### Constructor

```javascript
const configSystem = new ConfigurationSystem(options);
```

Options:
- `configDir`: Directory for configuration files (default: `path.join(process.cwd(), 'config')`)
- `defaultConfigPath`: Path to default configuration file (default: `path.join(configDir, 'app_config.json')`)
- `encryptionKey`: Key for encrypting sensitive values (default: `process.env.CONFIG_ENCRYPTION_KEY`)
- `cacheEnabled`: Whether to enable caching (default: `true`)
- `cacheTimeout`: Cache timeout in milliseconds (default: `60000`)

### Methods

#### Configuration Access

- `loadConfig(options)`: Load configuration from all sources
- `getConfig(path, defaultValue)`: Get a configuration value by path
- `setConfig(path, value, options)`: Set a configuration value

#### Sources Management

- `addSource(id, type, options)`: Add a configuration source
- `addFileSource(id, filePath, options)`: Add a file configuration source
- `addEnvironmentSource(id, options)`: Add an environment configuration source
- `addDatabaseSource(id, options)`: Add a database configuration source
- `addMemorySource(id, data, options)`: Add a memory configuration source
- `removeSource(id)`: Remove a configuration source
- `getConfigSources()`: Get all configuration sources

#### Validation

- `validateConfig(schema, options)`: Validate configuration against a schema

#### Change Notifications

- `watchConfig(path, callback)`: Watch for configuration changes
- `unwatchConfig(watcherId)`: Remove a configuration watcher

#### History and Versioning

- `getConfigHistory(path, options)`: Get configuration change history

#### Reset and Merge

- `resetConfig(path)`: Reset configuration to default values
- `mergeConfig(source, options)`: Merge configuration from another source
- `saveConfig(destination, options)`: Save configuration to a destination

## Error Handling

The ConfigurationSystem uses a custom `ConfigurationError` class for specific error types. Each error includes:

- `message`: Error message
- `code`: Error code (e.g., 'LOAD_FAILED', 'SOURCE_NOT_FOUND')
- `details`: Additional error details

## Example

See `src/examples/ConfigurationSystemExample.js` for a complete example of using the ConfigurationSystem.
