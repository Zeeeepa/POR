/**
 * webhook-system-usage.js
 * Example usage of the WebhookSystem
 */

const WebhookSystem = require('../src/utils/WebhookSystem');
const FileStorage = require('../src/utils/storage/FileStorage');
const logger = require('../src/utils/logger');

// Initialize storage adapter
const storage = new FileStorage({
  directory: './data/webhooks'
});

// Initialize webhook system
const webhookSystem = new WebhookSystem({
  sources: {
    github: {
      token: process.env.GITHUB_TOKEN,
      webhookUrl: process.env.WEBHOOK_URL || 'https://example.com/webhook/github'
    }
  },
  storage,
  maxRetries: 3,
  retryDelay: 5000
});

// Example: Register a webhook
async function registerWebhook() {
  try {
    const result = await webhookSystem.registerWebhook('github', {
      url: 'https://example.com/webhook/github',
      secret: 'my-webhook-secret',
      events: ['push', 'pull_request'],
      repository: 'owner/repo'
    });
    
    logger.info('Webhook registered', result);
    return result.id;
  } catch (error) {
    logger.error('Failed to register webhook', { error: error.message });
    return null;
  }
}

// Example: Register event handlers
function registerEventHandlers() {
  // Handler for all GitHub push events
  const pushHandlerId = webhookSystem.registerEventHandler('github', 'push', async (source, event, payload) => {
    logger.info(`Processing ${event} event from ${source}`, {
      repository: payload.repository?.full_name,
      ref: payload.ref
    });
    
    // Process the push event
    // For example, trigger a build, update a dashboard, etc.
  });
  
  // Handler for all GitHub pull request events
  const prHandlerId = webhookSystem.registerEventHandler('github', 'pull_request', async (source, event, payload) => {
    logger.info(`Processing ${event} event from ${source}`, {
      repository: payload.repository?.full_name,
      action: payload.action,
      pr: payload.pull_request?.number
    });
    
    // Process the pull request event
    // For example, trigger a code review, run tests, etc.
  });
  
  // Handler for all events from any source (wildcard)
  const wildcardHandlerId = webhookSystem.registerEventHandler('*', '*', async (source, event, payload) => {
    logger.debug(`Received ${event} event from ${source}`);
    
    // Log all events for monitoring purposes
  });
  
  return { pushHandlerId, prHandlerId, wildcardHandlerId };
}

// Example: Process a webhook
async function processWebhook(source, event, payload, signature, secret) {
  // Validate the webhook signature
  const isValid = webhookSystem.validateWebhook(source, payload, signature, secret);
  
  if (!isValid) {
    logger.warn(`Invalid webhook signature for ${source} event`);
    return { success: false, message: 'Invalid signature' };
  }
  
  // Process the webhook
  const result = await webhookSystem.processWebhook(source, event, payload);
  logger.info(`Webhook processed`, { eventId: result.eventId });
  
  return result;
}

// Example: Get webhook statistics
function getWebhookStats() {
  const stats = webhookSystem.getWebhookStats();
  logger.info('Webhook statistics', { stats });
  return stats;
}

// Example: List recent events
function listRecentEvents() {
  const events = webhookSystem.listEvents({
    limit: 10,
    offset: 0
  });
  
  logger.info(`Recent events (${events.length})`, {
    events: events.map(e => ({
      id: e.id,
      source: e.source,
      event: e.event,
      timestamp: e.timestamp,
      status: e.status
    }))
  });
  
  return events;
}

// Example: Replay a failed event
async function replayEvent(eventId) {
  const result = await webhookSystem.replayEvent(eventId);
  
  if (result.success) {
    logger.info(`Event replayed successfully`, {
      originalEventId: eventId,
      newEventId: result.eventId
    });
  } else {
    logger.error(`Failed to replay event`, {
      eventId,
      message: result.message
    });
  }
  
  return result;
}

// Example: Express route handler for GitHub webhooks
function githubWebhookHandler(req, res) {
  const event = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  const payload = req.body;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  
  // Process the webhook asynchronously
  processWebhook('github', event, payload, signature, secret)
    .then(result => {
      if (result.success) {
        logger.info(`GitHub webhook processed successfully`, { eventId: result.eventId });
      } else {
        logger.error(`Failed to process GitHub webhook`, { message: result.message });
      }
    })
    .catch(error => {
      logger.error(`Error processing GitHub webhook`, { error: error.message });
    });
  
  // Return a quick response to GitHub
  res.status(202).json({ message: 'Webhook received and queued for processing' });
}

// Example: Main function to demonstrate usage
async function main() {
  try {
    // Register a webhook
    const webhookId = await registerWebhook();
    
    if (!webhookId) {
      logger.error('Failed to register webhook, exiting');
      return;
    }
    
    // Register event handlers
    const handlerIds = registerEventHandlers();
    logger.info('Event handlers registered', handlerIds);
    
    // Simulate receiving a webhook
    const mockPayload = {
      repository: {
        full_name: 'owner/repo'
      },
      ref: 'refs/heads/main',
      commits: [
        {
          id: '123456',
          message: 'Test commit'
        }
      ]
    };
    
    // Create a valid signature for testing
    const crypto = require('crypto');
    const secret = 'my-webhook-secret';
    const payloadString = JSON.stringify(mockPayload);
    const hmac = crypto.createHmac('sha256', secret);
    const signature = 'sha256=' + hmac.update(payloadString).digest('hex');
    
    // Process the webhook
    const result = await processWebhook('github', 'push', mockPayload, signature, secret);
    
    if (result.success) {
      // Get webhook statistics
      getWebhookStats();
      
      // List recent events
      listRecentEvents();
      
      // Replay the event
      await replayEvent(result.eventId);
    }
    
    logger.info('Example completed successfully');
  } catch (error) {
    logger.error('Example failed', { error: error.message });
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in main', { error: error.message });
    process.exit(1);
  });
}

module.exports = {
  webhookSystem,
  registerWebhook,
  registerEventHandlers,
  processWebhook,
  getWebhookStats,
  listRecentEvents,
  replayEvent,
  githubWebhookHandler
};
