/**
 * Example usage of the WebhookServer
 */

require('dotenv').config();
const WebhookServer = require('./webhookServer');
const { logger } = require('../utils/logger');

// Load environment variables
const PORT = process.env.PORT || 3000;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

// Initialize the webhook server
const webhookServer = new WebhookServer({
  port: PORT,
  webhookSecret: GITHUB_WEBHOOK_SECRET,
  githubToken: GITHUB_TOKEN,
  ngrokOptions: {
    authtoken: NGROK_AUTH_TOKEN
  }
});

// Register event handlers
// Push event handler
webhookServer.registerEventHandler('push', (payload) => {
  const { repository, ref, commits, sender } = payload;
  const branch = ref.replace('refs/heads/', '');
  
  logger.info(`Received push to ${repository.full_name} on branch ${branch} by ${sender.login}`);
  logger.info(`Commits: ${commits ? commits.length : 0}`);
  
  // Here you would add your business logic for handling push events
});

// Pull request event handler
webhookServer.registerEventHandler('pull_request', (payload) => {
  const { action, pull_request, repository } = payload;
  
  logger.info(`Received pull_request event: ${action}`);
  logger.info(`PR #${pull_request.number}: ${pull_request.title}`);
  logger.info(`Repository: ${repository.full_name}`);
  
  // Here you would add your business logic for handling PR events
});

// Issues event handler
webhookServer.registerEventHandler('issues', (payload) => {
  const { action, issue, repository } = payload;
  
  logger.info(`Received issues event: ${action}`);
  logger.info(`Issue #${issue.number}: ${issue.title}`);
  logger.info(`Repository: ${repository.full_name}`);
  
  // Here you would add your business logic for handling issue events
});

// Start server and set up webhook
async function main() {
  try {
    // Start the server with ngrok tunneling
    const serverInfo = await webhookServer.start(true);
    logger.info(`Webhook server started on port ${PORT}`);
    logger.info(`Public URL: ${serverInfo.url}`);
    
    // Set up webhook for repository if configured
    if (GITHUB_OWNER && GITHUB_REPO) {
      try {
        const webhook = await webhookServer.setupWebhook({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          events: ['push', 'pull_request', 'issues']
        });
        
        logger.info(`Webhook created successfully for ${GITHUB_OWNER}/${GITHUB_REPO}`);
        logger.info(`Webhook ID: ${webhook.id}`);
      } catch (error) {
        logger.error(`Failed to set up webhook: ${error.message}`);
      }
    } else {
      logger.info('GITHUB_OWNER or GITHUB_REPO not configured. Skipping webhook setup.');
      logger.info(`Use this URL for your webhook: ${serverInfo.url}/webhook`);
    }
    
    return serverInfo;
  } catch (error) {
    logger.error(`Failed to start webhook server: ${error.message}`);
    throw error;
  }
}

// Handle graceful shutdown
function shutdown() {
  logger.info('Shutting down webhook server...');
  webhookServer.stop()
    .then(() => {
      logger.info('Server stopped successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error(`Error during shutdown: ${error.message}`);
      process.exit(1);
    });
}

// Register shutdown handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  webhookServer,
  start: main
}; 