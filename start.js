/**
 * Unified application entry point
 * This starts the application with the unified components from the core module
 */

const { app, initializeApp } = require('./src/server');
const { logger } = require('./src/core');

// Initialize the application
initializeApp().catch(error => {
  logger.error('Failed to initialize application:', error);
  process.exit(1);
});
