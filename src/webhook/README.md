# GitHub Webhook Server

A robust and feature-rich GitHub webhook server with dashboard for monitoring webhook events.

## Features

- **Secure Webhook Processing**: Validates GitHub webhook signatures for enhanced security
- **Ngrok Integration**: Easily expose your local server to the internet for testing
- **Dashboard UI**: Monitor and inspect webhook events in real-time
- **Event Persistence**: Store webhook events for later analysis
- **Flexible Event Handlers**: Register custom handlers for different GitHub events
- **Automatic Webhook Setup**: Configure GitHub repository webhooks programmatically
- **Comprehensive Logging**: Detailed logs for debugging and monitoring
- **Authentication**: Optional basic authentication for the dashboard

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file:
   ```bash
   cp src/webhook/.env.example .env
   ```
4. Edit the `.env` file with your GitHub token, webhook secret, and other settings

## Configuration

The webhook server can be configured using environment variables:

### Server Configuration
- `PORT`: Port to listen on (default: 3000)
- `LOG_LEVEL`: Logging level (default: info)
- `ENABLE_REQUEST_LOGGING`: Enable HTTP request logging (default: false)
- `REQUEST_TIMEOUT`: Timeout for GitHub API requests in ms (default: 10000)

### GitHub Configuration
- `GITHUB_WEBHOOK_SECRET`: Secret for validating webhook payloads
- `GITHUB_TOKEN`: GitHub personal access token with appropriate scopes
- `GITHUB_OWNER`: GitHub username or organization name
- `GITHUB_REPO`: Repository name for automatic webhook setup

### Ngrok Configuration
- `NGROK_AUTH_TOKEN`: Ngrok authentication token
- `NGROK_REGION`: Ngrok region (default: us)

### Dashboard Configuration
- `DASHBOARD_AUTH_REQUIRED`: Enable basic authentication for dashboard (default: false)
- `DASHBOARD_USERNAME`: Username for dashboard authentication
- `DASHBOARD_PASSWORD`: Password for dashboard authentication

## Usage

### Basic Example

```javascript
const WebhookServer = require('./webhookServer');
const logger = require('../utils/logger');

// Initialize the webhook server
const webhookServer = new WebhookServer({
  port: 3000,
  webhookSecret: 'your_webhook_secret',
  githubToken: 'your_github_token'
});

// Register event handlers
webhookServer.registerEventHandler('push', (payload, context) => {
  logger.info(`Received push event from ${payload.repository.full_name}`);
  // Handle push event
});

// Start the server
webhookServer.start(true) // true to use ngrok
  .then(serverInfo => {
    logger.info(`Webhook server started on ${serverInfo.url}`);
  })
  .catch(error => {
    logger.error(`Failed to start server: ${error.message}`);
  });
```

### With Dashboard

```javascript
const WebhookServer = require('./webhookServer');
const setupDashboard = require('./dashboard');
const logger = require('../utils/logger');

// Initialize the webhook server
const webhookServer = new WebhookServer({
  port: 3000,
  webhookSecret: 'your_webhook_secret',
  githubToken: 'your_github_token'
});

// Set up the dashboard
setupDashboard(webhookServer.app, webhookServer, {
  basePath: '/dashboard',
  maxEvents: 100,
  persistPath: './data/events.json',
  requireAuth: true,
  auth: {
    username: 'admin',
    password: 'password'
  }
});

// Start the server
webhookServer.start(true)
  .then(serverInfo => {
    logger.info(`Webhook server started on ${serverInfo.url}`);
    logger.info(`Dashboard available at ${serverInfo.ngrokUrl}/dashboard`);
  });
```

## Advanced Usage

For more advanced usage examples, see:
- `example.js`: Basic webhook server setup
- `example-detailed.js`: Comprehensive example with dashboard and event handling

## Dashboard

The dashboard provides a web UI for monitoring webhook events:

- **Home**: Overview of server status and recent events
- **Events**: List of all webhook events with filtering options
- **Event Detail**: Detailed view of a specific event payload
- **API**: REST API endpoints for programmatic access to event data

Access the dashboard at `http://localhost:3000/dashboard` or via the ngrok URL.

## API Reference

### WebhookServer

#### Constructor
```javascript
const webhookServer = new WebhookServer({
  port: 3000,                  // Port to listen on
  path: '/webhook',            // Path for webhook endpoint
  webhookSecret: 'secret',     // GitHub webhook secret
  githubToken: 'token',        // GitHub personal access token
  ngrokOptions: {},            // Ngrok configuration options
  enableRequestLogging: false, // Enable HTTP request logging
  requestTimeout: 10000        // Timeout for GitHub API requests
});
```

#### Methods

- `registerEventHandler(event, handler)`: Register a handler for a GitHub event
- `start(useNgrok)`: Start the webhook server
- `stop()`: Stop the webhook server
- `setupWebhook(options)`: Configure a GitHub repository webhook
- `deleteWebhook(options)`: Delete a GitHub repository webhook
- `testWebhook(options)`: Test a GitHub repository webhook

### Dashboard

```javascript
const dashboard = setupDashboard(app, webhookServer, {
  basePath: '/dashboard',      // Base path for dashboard routes
  maxEvents: 100,              // Maximum number of events to store
  persistPath: './events.json', // Path to persist events
  requireAuth: false,          // Enable authentication
  auth: {                      // Authentication credentials
    username: 'admin',
    password: 'password'
  }
});
```

## License

MIT
