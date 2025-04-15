/**
 * Simple test script for webhook functionality
 * Run this to test the webhook server with a simple ping event
 */

const dotenv = require('dotenv');
dotenv.config();

const { createWebhookServerManager } = require('./index');
const logger = require('../utils/logger');

// Load environment variables
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USE_NGROK = process.env.USE_NGROK === 'true';

// Create webhook manager
const webhookManager = createWebhookServerManager({
  port: PORT,
  webhookSecret: WEBHOOK_SECRET,
  githubToken: GITHUB_TOKEN,
  useNgrok: USE_NGROK,
  ngrokOptions: {
    authtoken: process.env.NGROK_AUTH_TOKEN,
    region: process.env.NGROK_REGION || 'us'
  }
});

// Register a simple ping handler
webhookManager.registerEventHandler('ping', async (payload) => {
  logger.info('Received ping event!');
  logger.info(`Repository: ${payload.repository?.full_name || 'Unknown'}`);
  logger.info(`Sender: ${payload.sender?.login || 'Unknown'}`);
  logger.info(`Zen message: ${payload.zen || 'No zen message'}`);
});

// Start the webhook server
async function start() {
  try {
    const serverInfo = await webhookManager.start();
    logger.info(`Webhook server started on ${serverInfo.url}`);
    
    if (serverInfo.ngrokUrl) {
      logger.info(`ngrok tunnel available at ${serverInfo.ngrokUrl}`);
      logger.info(`To test, add a webhook to your GitHub repository with URL: ${serverInfo.ngrokUrl}${webhookManager.webhookPath}`);
    } else {
      logger.info(`Webhook URL: ${serverInfo.url}`);
      logger.info('Note: You need to make this URL publicly accessible for GitHub to reach it.');
    }
    
    logger.info('Press Ctrl+C to stop the server');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down...');
      await webhookManager.stop();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start webhook server', { error: error.stack });
    process.exit(1);
  }
}

// Start if this file is run directly
if (require.main === module) {
  start();
}
