/**
 * Framework adapter for backward compatibility
 * This file re-exports the unified framework from src/framework/index.js
 */

// Import the unified framework
const framework = require('./src/framework');

// Export the unified framework
module.exports = framework;
