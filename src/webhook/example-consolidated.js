/**
 * Example usage of the WebhookManager
 * This demonstrates the consolidated approach to webhook management
 */

require('dotenv').config();
const WebhookManager = require('./WebhookManager');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

// Load environment variables
const PORT = process.env.PORT || 3000;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

// Initialize the webhook manager
const webhookManager = new WebhookManager({
  port: PORT,
  webhookSecret: GITHUB_WEBHOOK_SECRET,
  githubToken: GITHUB_TOKEN,
  ngrokOptions: {
    authtoken: NGROK_AUTH_TOKEN
  },
  useNgrok: true // Enable ngrok by default
});

// Register event handlers
// Push event handler
webhookManager.registerEventHandler('push', async (payload) => {
  try {
    const { repository, ref, commits, sender } = payload;
    const branch = ref.replace('refs/heads/', '');
    
    logger.info(`Received push to ${repository.full_name} on branch ${branch} by ${sender.login}`);
    logger.info(`Commits: ${commits ? commits.length : 0}`);
    
    // Here you would add your business logic for handling push events
  } catch (error) {
    logger.error('Error handling push event', { error: error.stack });
    throw errorHandler.webhookError(`Failed to process push event: ${error.message}`);
  }
});

// Pull request event handler
webhookManager.registerEventHandler('pull_request', async (payload) => {
  try {
    const { action, pull_request, repository } = payload;
    
    logger.info(`Received pull_request event: ${action}`);
    logger.info(`PR #${pull_request.number}: ${pull_request.title}`);
    logger.info(`Repository: ${repository.full_name}`);
    
    // Here you would add your business logic for handling PR events
  } catch (error) {
    logger.error('Error handling pull_request event', { error: error.stack });
    throw errorHandler.webhookError(`Failed to process pull_request event: ${error.message}`);
  }
});

// Issues event handler
webhookManager.registerEventHandler('issues', async (payload) => {
  try {
    const { action, issue, repository } = payload;
    
    logger.info(`Received issues event: ${action}`);
    logger.info(`Issue #${issue.number}: ${issue.title}`);
    logger.info(`Repository: ${repository.full_name}`);
    
    // Here you would add your business logic for handling issue events
  } catch (error) {
    logger.error('Error handling issues event', { error: error.stack });
    throw errorHandler.webhookError(`Failed to process issues event: ${error.message}`);
  }
});

// Start server and set up webhook
async function main() {
  try {
    // Start the webhook manager
    const serverInfo = await webhookManager.start();
    logger.info(`Webhook server started on port ${PORT}`);
    logger.info(`Webhook URL: ${serverInfo.url}`);
    logger.info(`Dashboard URL: ${serverInfo.dashboardUrl}`);
    
    // Set up webhook for repository if configured
    if (GITHUB_OWNER && GITHUB_REPO) {
      try {
        const webhook = await webhookManager.setupWebhook({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          events: ['push', 'pull_request', 'issues']
        });
        
        logger.info(`Webhook created successfully for ${GITHUB_OWNER}/${GITHUB_REPO}`);
        logger.info(`Webhook ID: ${webhook.id}`);
      } catch (error) {
        if (error.name === errorHandler.ErrorTypes.VALIDATION) {
          logger.error(`Invalid repository configuration: ${error.message}`);
        } else {
          logger.error(`Failed to set up webhook: ${error.message}`, { error: error.stack });
        }
      }
    } else {
      logger.info('GITHUB_OWNER or GITHUB_REPO not configured. Skipping webhook setup.');
      logger.info(`Use this URL for your webhook: ${serverInfo.url}`);
    }
    
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

module.exports = {
  webhookManager,
  start: main
};
