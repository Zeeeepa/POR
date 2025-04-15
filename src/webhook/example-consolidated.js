/**
 * Example usage of the WebhookServerManager
 * Demonstrates how to set up and use the webhook module
 */

const dotenv = require('dotenv');
dotenv.config();

const WebhookServerManager = require('./WebhookServerManager');
const logger = require('../utils/logger');

// Load environment variables
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USE_NGROK = process.env.USE_NGROK === 'true';

// Create webhook manager
const webhookManager = new WebhookServerManager({
  port: PORT,
  webhookSecret: WEBHOOK_SECRET,
  githubToken: GITHUB_TOKEN,
  useNgrok: USE_NGROK,
  ngrokOptions: {
    authtoken: process.env.NGROK_AUTH_TOKEN,
    region: process.env.NGROK_REGION || 'us'
  }
});

// Register event handlers
webhookManager.registerEventHandler('push', async (payload) => {
  try {
    const repo = payload.repository.full_name;
    const branch = payload.ref.replace('refs/heads/', '');
    const commits = payload.commits || [];
    
    logger.info(`Received push event for ${repo} on branch ${branch} with ${commits.length} commits`);
    
    // Process commits
    for (const commit of commits) {
      logger.info(`Commit ${commit.id.substring(0, 7)} by ${commit.author.name}: ${commit.message}`);
    }
  } catch (error) {
    logger.error('Error handling push event', { error: error.stack });
  }
});

webhookManager.registerEventHandler('pull_request', async (payload) => {
  try {
    const action = payload.action;
    const prNumber = payload.number;
    const repo = payload.repository.full_name;
    const title = payload.pull_request.title;
    
    logger.info(`Received pull_request event: ${action} PR #${prNumber} on ${repo}: ${title}`);
    
    // Handle different PR actions
    switch (action) {
      case 'opened':
        logger.info(`New PR opened: ${title}`);
        break;
      case 'closed':
        if (payload.pull_request.merged) {
          logger.info(`PR #${prNumber} was merged`);
        } else {
          logger.info(`PR #${prNumber} was closed without merging`);
        }
        break;
      default:
        logger.info(`PR #${prNumber} ${action}`);
    }
  } catch (error) {
    logger.error('Error handling pull_request event', { error: error.stack });
  }
});

webhookManager.registerEventHandler('issues', async (payload) => {
  try {
    const action = payload.action;
    const issueNumber = payload.issue.number;
    const repo = payload.repository.full_name;
    const title = payload.issue.title;
    
    logger.info(`Received issues event: ${action} issue #${issueNumber} on ${repo}: ${title}`);
    
    // Handle different issue actions
    switch (action) {
      case 'opened':
        logger.info(`New issue opened: ${title}`);
        break;
      case 'closed':
        logger.info(`Issue #${issueNumber} was closed`);
        break;
      default:
        logger.info(`Issue #${issueNumber} ${action}`);
    }
  } catch (error) {
    logger.error('Error handling issues event', { error: error.stack });
  }
});

// Start the webhook server
async function start() {
  try {
    const serverInfo = await webhookManager.start();
    logger.info(`Webhook server started on ${serverInfo.url}`);
    
    if (serverInfo.ngrokUrl) {
      logger.info(`ngrok tunnel available at ${serverInfo.ngrokUrl}`);
    }
    
    // Set up a webhook for a repository
    if (process.env.SETUP_WEBHOOK === 'true' && process.env.REPO_OWNER && process.env.REPO_NAME) {
      const webhook = await webhookManager.setupWebhook({
        owner: process.env.REPO_OWNER,
        repo: process.env.REPO_NAME,
        events: ['push', 'pull_request', 'issues']
      });
      
      logger.info(`Webhook set up for ${process.env.REPO_OWNER}/${process.env.REPO_NAME}`);
      logger.info(`Webhook ID: ${webhook.id}`);
    }
    
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

// Export for testing
module.exports = {
  start,
  webhookManager,
};

// Start if this file is run directly
if (require.main === module) {
  start();
}
