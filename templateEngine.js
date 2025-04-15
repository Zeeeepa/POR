/**
 * Template engine adapter for backward compatibility
 * This file re-exports the unified template engine from src/utils/templateEngine.js
 */

// Import the unified template engine
const templateEngine = require('./src/utils/templateEngine');

// Export the unified template engine
module.exports = templateEngine;
