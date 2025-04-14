# GitHub Webhook Server

A JavaScript implementation for handling GitHub webhooks with automatic ngrok tunnel setup for local development and a built-in dashboard for monitoring.

## Features

- Express server for handling GitHub webhook events
- Automatic ngrok tunnel setup for exposing local server to the internet
- GitHub webhook signature validation for security
- Support for multiple GitHub event types (push, pull_request, issues, etc.)
- Programmatic webhook registration with GitHub API
- Custom event handlers
- **Web Dashboard for monitoring webhook events**

## Installation

Ensure you have the following dependencies in your project:

```bash
npm install express body-parser axios crypto ngrok ejs moment chart.js @octokit/rest
```

For development, you may also want:

```bash
npm install dotenv nodemon --save-dev
```

## Configuration

Create a `.env` file with the following variables:

```
PORT=3000
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_TOKEN=your_github_personal_access_token
NGROK_AUTH_TOKEN=your_ngrok_auth_token
NGROK_REGION=us
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_repository_name
```

## Usage

See the `example-detailed.js` file for a complete implementation. Here's a quick overview:

```javascript
const WebhookServer = require('./webhookServer');
const setupDashboard = require('./dashboard');

// Initialize the server
const webhookServer = new WebhookServer({
  port: 3000,
  webhookSecret: 'your_webhook_secret',
  githubToken: 'your_github_token',
  ngrokOptions: {
    authtoken: 'your_ngrok_auth_token',
    region: 'us'
  }
});

// Set up the dashboard
setupDashboard(webhookServer.app, webhookServer);

// Register custom event handlers
webhookServer.registerEventHandler('issues', async (payload) => {
  console.log(`Issue ${payload.action}: #${payload.issue.number}`);
});

// Start the server with ngrok tunnel
async function start() {
  const result = await webhookServer.start(true);
  console.log(`Webhook URL: ${result.url}`);
  console.log(`Dashboard URL: ${result.url}/dashboard`);
  
  // Set up GitHub webhook automatically
  await webhookServer.setupWebhook({
    owner: 'your_username',
    repo: 'your_repo',
    events: ['push', 'pull_request', 'issues']
  });
}

start();
```

## Web Dashboard

The webhook server includes a built-in web dashboard for monitoring webhook activity. The dashboard provides:

- Real-time monitoring of webhook events
- Detailed information for each event type
- Filtering and searching capabilities
- Event payload viewer with syntax highlighting
- Statistics and visualizations

Access the dashboard at: `http://localhost:{PORT}/dashboard` or via your ngrok URL: `https://{NGROK_URL}/dashboard`

For more information about the dashboard, see [DASHBOARD.md](./DASHBOARD.md).

## API Reference

### WebhookServer

```javascript
const webhookServer = new WebhookServer(options);
```

Options:
- `port`: Port to run the server on (default: 3000)
- `webhookSecret`: GitHub webhook secret for signature validation
- `githubToken`: GitHub personal access token for API calls
- `ngrokOptions`: Configuration for ngrok tunnel (authtoken, region, etc.)

### Methods

- `start(useNgrok = false)`: Start the webhook server, optionally with ngrok tunnel
- `stop()`: Stop the server and close ngrok tunnel
- `registerEventHandler(event, handler)`: Register a custom event handler
- `setupWebhook(options)`: Set up a GitHub webhook for a repository
  - `options.owner`: Repository owner
  - `options.repo`: Repository name
  - `options.events`: Array of events to subscribe to

### Dashboard

```javascript
const dashboard = setupDashboard(app, webhookServer, basePath = '/dashboard');
```

Parameters:
- `app`: Express app instance (usually webhookServer.app)
- `webhookServer`: WebhookServer instance
- `basePath`: Base path for dashboard routes (default: '/dashboard')

## Security Considerations

- Always use a webhook secret to validate incoming requests
- Store secrets in environment variables, not in code
- Use HTTPS when possible (ngrok provides this automatically)
- Validate the payload structure before processing events

## Examples

Check the following example files:
- `example.js`: Basic implementation with minimal event handlers
- `example-detailed.js`: Comprehensive implementation with detailed event handlers and dashboard integration 