# Webhook Module

A robust and flexible webhook server for handling GitHub events with built-in dashboard for monitoring.

## Features

- **Secure Webhook Processing**: Validates GitHub webhook signatures for security
- **Flexible Event Handling**: Register custom handlers for different GitHub events
- **Ngrok Integration**: Easily expose local server to the internet for testing
- **Dashboard UI**: Monitor webhook activity with a web-based dashboard
- **Error Handling**: Comprehensive error handling with detailed logging
- **Validation**: Input validation for all parameters
- **API Endpoints**: RESTful API for accessing webhook data

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file with the following variables:

```
PORT=3000
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_TOKEN=your_github_token
NGROK_AUTH_TOKEN=your_ngrok_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_repo_name
```

## Usage

### Basic Usage

```javascript
const WebhookServer = require('./webhookServer');
const setupDashboard = require('./dashboard');

// Initialize the webhook server
const webhookServer = new WebhookServer({
  port: 3000,
  webhookSecret: 'your_webhook_secret',
  githubToken: 'your_github_token'
});

// Register event handlers
webhookServer.registerEventHandler('push', async (payload) => {
  console.log(`Received push to ${payload.repository.full_name}`);
  // Handle push event
});

// Start the server
webhookServer.start(true) // true to use ngrok
  .then(serverInfo => {
    console.log(`Webhook URL: ${serverInfo.url}`);
  });

// Set up dashboard (optional)
const express = require('express');
const app = express();
const dashboard = setupDashboard(app, webhookServer);

// Start dashboard server
app.listen(3001, () => {
  console.log(`Dashboard available at http://localhost:3001${dashboard.basePath}`);
});
```

### Setting Up a Webhook

```javascript
// Set up webhook for a repository
webhookServer.setupWebhook({
  owner: 'username',
  repo: 'repo-name',
  events: ['push', 'pull_request', 'issues']
})
  .then(webhook => {
    console.log(`Webhook created with ID: ${webhook.id}`);
  })
  .catch(error => {
    console.error(`Failed to set up webhook: ${error.message}`);
  });
```

## Components

### WebhookServer

The main server for handling GitHub webhooks.

```javascript
const server = new WebhookServer({
  port: 3000,                    // Port to listen on
  path: '/webhook',              // Path for webhook endpoint
  webhookSecret: 'secret',       // GitHub webhook secret
  githubToken: 'token',          // GitHub personal access token
  ngrokOptions: {                // Options for ngrok
    authtoken: 'ngrok_token'
  }
});
```

### Dashboard

Web UI for monitoring webhook activity.

```javascript
const dashboard = setupDashboard(expressApp, webhookServer, '/dashboard');
```

## API Reference

### WebhookServer

- `constructor(options)`: Initialize the webhook server
- `registerEventHandler(event, handler)`: Register a handler for a GitHub event
- `start(useNgrok)`: Start the webhook server
- `stop()`: Stop the webhook server
- `setupWebhook(options)`: Configure a GitHub repository webhook

### Dashboard

- `setupDashboard(app, webhookServer, basePath)`: Set up dashboard routes

## Error Handling

The module uses a standardized error handling approach:

```javascript
try {
  // Your code
} catch (error) {
  // Error will be properly logged and formatted
  throw errorHandler.webhookError(`Failed to process event: ${error.message}`);
}
```

## Validation

All inputs are validated:

```javascript
validation.isString(value, 'paramName');
validation.isNumber(value, 'paramName', { min: 1, max: 100 });
validation.isObject(value, 'paramName', { requiredProps: ['prop1', 'prop2'] });
```

## Example

See `example.js` for a complete working example.

## License

MIT
