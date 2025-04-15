/**
 * Logger adapter for backward compatibility
 * This file re-exports the unified logger from src/utils/logger.js
 */

// Import the unified logger
const logger = require('./src/utils/logger');

// Export the unified logger
module.exports = logger;
