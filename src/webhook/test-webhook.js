/**
 * Test script for the webhook module
 * This script demonstrates how to use the webhook module
 */

require('dotenv').config();
const { createWebhookManager } = require('./index');
const logger = require('../utils/logger');

// Load environment variables
const PORT = process.env.PORT || 3000;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN;

// Create webhook manager
const webhookManager = createWebhookManager({
  port: PORT,
  webhookSecret: GITHUB_WEBHOOK_SECRET,
  githubToken: GITHUB_TOKEN,
  ngrokOptions: {
    authtoken: NGROK_AUTH_TOKEN
  },
  useNgrok: true
});

// Register event handlers
webhookManager.registerEventHandler('ping', async (payload) => {
  logger.info('Received ping event');
  logger.info(`Repository: ${payload.repository?.full_name || 'N/A'}`);
  logger.info(`Sender: ${payload.sender?.login || 'N/A'}`);
});

// Start the webhook manager
async function main() {
  try {
    const serverInfo = await webhookManager.start();
    
    logger.info('Webhook module test server started');
    logger.info(`Webhook URL: ${serverInfo.url}`);
    logger.info(`Dashboard URL: ${serverInfo.dashboardUrl}`);
    
    logger.info('');
    logger.info('To test the webhook:');
    logger.info('1. Use the webhook URL in a GitHub repository webhook');
    logger.info('2. Or use curl to send a test payload:');
    logger.info(`   curl -X POST ${serverInfo.url} \\`);
    logger.info('     -H "Content-Type: application/json" \\');
    logger.info('     -H "X-GitHub-Event: ping" \\');
    logger.info('     -d \'{"repository":{"full_name":"test/repo"},"sender":{"login":"testuser"}}\'');
    logger.info('');
    logger.info('Press Ctrl+C to stop the server');
    
    return serverInfo;
  } catch (error) {
    logger.error(`Failed to start webhook manager: ${error.message}`, { error: error.stack });
    throw error;
  }
}

// Handle graceful shutdown
function shutdown() {
  logger.info('Shutting down webhook manager...');
  webhookManager.stop()
    .then(() => {
      logger.info('Manager stopped successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error(`Error during shutdown: ${error.message}`, { error: error.stack });
      process.exit(1);
    });
}

// Register shutdown handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Server failed to start: ${error.message}`, { error: error.stack });
    process.exit(1);
  });
}
