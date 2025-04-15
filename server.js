/**
 * Server adapter for backward compatibility
 * This file re-exports the unified server from src/server.js
 */

// Import the unified server
const server = require('./src/server');

// If this file is run directly, initialize the application
if (require.main === module) {
  server.initializeApp().catch(error => {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  });
}

// Export the unified server
module.exports = server;
