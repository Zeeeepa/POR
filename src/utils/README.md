# POR Utils Module

This directory contains utility modules for the POR application, providing functionality for GitHub integration, webhook management, ngrok tunneling, and cursor automation.

## Modules

### `logger.js`

A configurable logging utility built on Winston that provides consistent logging across the application.

- Supports multiple log levels (error, warn, info, debug)
- Logs to both console and files
- Handles objects and errors gracefully
- Configurable via environment variables

```javascript
const logger = require('./utils/logger');

logger.info('Application started');
logger.error(new Error('Something went wrong'));
```

### `GitHubEnhanced.js`

Enhanced GitHub integration with PR analysis and auto-merging capabilities.

- Authenticate with GitHub API
- Manage repositories and webhooks
- Analyze pull requests for auto-merge eligibility
- Queue and process PRs for analysis and merging
- Detect PR types based on content and branch naming

```javascript
const GitHubEnhanced = require('./utils/GitHubEnhanced');
const config = require('./config');

const github = new GitHubEnhanced(config);
await github.authenticate();
const repos = await github.getRepositories();
```

### `WebhookManager.js`

Manages GitHub webhooks for repositories, ensuring they are properly configured and updated.

- List, create, and update webhooks
- Verify webhook signatures
- Set up webhooks for all accessible repositories
- Handle repository creation events

```javascript
const WebhookManager = require('./utils/WebhookManager');

const webhookManager = new WebhookManager(
  config.github.token,
  'https://example.com/webhook',
  config.github.webhookSecret
);

await webhookManager.setupWebhooksForAllRepos();
```

### `NgrokManager.js`

Manages ngrok tunnels for exposing local servers to the internet.

- Start and stop ngrok tunnels
- Configure tunnel options
- Get public URL for local services

```javascript
const NgrokManager = require('./utils/NgrokManager');

const ngrok = new NgrokManager({
  authtoken: config.ngrokAuthToken,
  region: 'us'
});

const publicUrl = await ngrok.startTunnel(3000);
console.log(`Server accessible at: ${publicUrl}`);
```

### `CursorAutomation.js`

Handles cursor position capture and text input automation for external interfaces.

- Save and load cursor positions
- Capture mouse positions
- Send text to specific screen positions
- Platform-specific clipboard handling

```javascript
const cursorAutomation = require('./utils/CursorAutomation');

// Capture current mouse position
cursorAutomation.captureCurrentPosition('chatInput');

// Later, send text to that position
await cursorAutomation.sendTextToPosition('chatInput', 'Hello, world!');
```

## Configuration

The utils modules rely on the central configuration in `src/config.js`, which loads settings from environment variables with sensible defaults.

## Error Handling

All modules implement consistent error handling patterns:
- Errors are logged with appropriate context
- Functions either throw errors (for critical failures) or return success/failure status
- Async functions use try/catch blocks to handle errors gracefully
