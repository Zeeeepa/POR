# WebhookSystem

A comprehensive webhook system for handling events from various sources. This system supports validation, routing, security, registration, and monitoring of webhooks.

## Features

- **Multi-source support**: Handle webhooks from different sources (GitHub, GitLab, etc.)
- **Webhook validation**: Verify webhook signatures to ensure authenticity
- **Event routing**: Route events to appropriate handlers based on source and event type
- **Retry mechanism**: Automatically retry failed event processing with exponential backoff
- **Event logging**: Keep track of all received events and their processing status
- **Statistics**: Collect and report statistics on webhook processing
- **Storage**: Persist webhook configurations, event logs, and statistics
- **Extensible**: Easy to add support for new webhook sources

## Installation

```bash
npm install
```

## Usage

### Basic Setup

```javascript
const WebhookSystem = require('./src/utils/WebhookSystem');
const FileStorage = require('./src/utils/storage/FileStorage');

// Initialize storage adapter
const storage = new FileStorage({
  directory: './data/webhooks'
});

// Initialize webhook system
const webhookSystem = new WebhookSystem({
  sources: {
    github: {
      token: process.env.GITHUB_TOKEN,
      webhookUrl: 'https://example.com/webhook/github'
    }
  },
  storage,
  maxRetries: 3,
  retryDelay: 5000
});
```

### Registering a Webhook

```javascript
const result = await webhookSystem.registerWebhook('github', {
  url: 'https://example.com/webhook/github',
  secret: 'my-webhook-secret',
  events: ['push', 'pull_request'],
  repository: 'owner/repo'
});

console.log(`Webhook registered with ID: ${result.id}`);
```

### Registering Event Handlers

```javascript
// Handler for GitHub push events
const pushHandlerId = webhookSystem.registerEventHandler('github', 'push', async (source, event, payload) => {
  console.log(`Processing ${event} event from ${source}`);
  // Process the push event
});

// Handler for all events (wildcard)
const wildcardHandlerId = webhookSystem.registerEventHandler('*', '*', async (source, event, payload) => {
  console.log(`Received ${event} event from ${source}`);
  // Log all events
});
```

### Processing a Webhook

```javascript
// In an Express route handler
app.post('/webhook/github', (req, res) => {
  const event = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  const payload = req.body;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  
  // Validate the webhook signature
  const isValid = webhookSystem.validateWebhook('github', payload, signature, secret);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process the webhook asynchronously
  webhookSystem.processWebhook('github', event, payload)
    .then(result => {
      console.log(`Webhook processed with event ID: ${result.eventId}`);
    })
    .catch(error => {
      console.error(`Error processing webhook: ${error.message}`);
    });
  
  // Return a quick response
  res.status(202).json({ message: 'Webhook received and queued for processing' });
});
```

### Getting Statistics

```javascript
const stats = webhookSystem.getWebhookStats();
console.log('Webhook statistics:', stats);
```

### Listing Events

```javascript
const events = webhookSystem.listEvents({
  source: 'github',
  event: 'push',
  limit: 10,
  offset: 0
});

console.log(`Found ${events.length} events`);
```

### Replaying an Event

```javascript
const result = await webhookSystem.replayEvent('event-id');

if (result.success) {
  console.log(`Event replayed with new ID: ${result.eventId}`);
} else {
  console.error(`Failed to replay event: ${result.message}`);
}
```

## API Reference

### WebhookSystem

#### Constructor

```javascript
const webhookSystem = new WebhookSystem(options);
```

- `options` (Object): Configuration options
  - `sources` (Object): Source-specific configurations
  - `storage` (Object): Storage adapter
  - `maxRetries` (Number): Maximum number of retry attempts (default: 3)
  - `retryDelay` (Number): Delay between retries in ms (default: 5000)

#### Methods

- `registerWebhook(source, options)`: Register a new webhook endpoint
- `unregisterWebhook(id)`: Unregister a webhook endpoint
- `validateWebhook(source, payload, signature, secret)`: Validate webhook signature
- `processWebhook(source, event, payload)`: Process a webhook event
- `registerEventHandler(source, event, handler, options)`: Register an event handler
- `unregisterEventHandler(source, event, handlerId)`: Unregister an event handler
- `getWebhookStats(source)`: Get webhook statistics
- `replayEvent(eventId)`: Replay a previously received event
- `listEvents(options)`: List received events with filtering options
- `getEventDetails(eventId)`: Get detailed information about an event

### FileStorage

#### Constructor

```javascript
const storage = new FileStorage(options);
```

- `options` (Object): Configuration options
  - `directory` (String): Directory to store data files (default: './data')

#### Methods

- `getWebhooks()`: Get stored webhooks
- `saveWebhooks(webhooks)`: Save webhooks to storage
- `getEventLog()`: Get stored event log
- `saveEventLog(eventLog)`: Save event log to storage
- `getStats()`: Get stored statistics
- `saveStats(stats)`: Save statistics to storage
- `clearAll()`: Clear all stored data

## Examples

See the [examples](../../../examples/webhook-system-usage.js) directory for complete usage examples.

## Testing

```bash
npm test
```

## License

MIT
