# Depla Project Manager - Enhanced

A multi-threaded project management tool that orchestrates automated AI-prompted development across multiple repositories.

## Core Features

- **Multi-Project Management**: Manage multiple GitHub repositories in a tabbed interface
- **Dynamic Workflow Configuration**: Create custom workflows with phased execution
- **Automated Prompt Sequences**: Send structured prompts to AI systems with coordinated timing
- **Input Automation**: Capture cursor positions and automate text entry in external systems
- **GitHub Integration**: Monitor repositories for changes, analyze PRs, and auto-merge where appropriate
- **Concurrent Message Queue**: Process up to hundreds of concurrent actions with prioritization
- **Webhook Module**: Robust webhook management system for handling GitHub events

## System Requirements

- Node.js 16+
- Windows, macOS, or Linux (with XClip for Linux clipboard support)
- GitHub account with Personal Access Token (for repository access)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/depla-project-manager.git
cd depla-project-manager
```

2. Install dependencies:
```bash
npm install
```

3. Configure the application:
- Create a `.env` file in the project root 
- Add GitHub token: `GITHUB_TOKEN=your_github_token`

## Usage

### Starting the Application

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### Webhook Module

The webhook module provides a robust system for handling GitHub webhook events. See [Webhook Module README](src/webhook/README-consolidated.md) for detailed documentation.

Basic usage:

```javascript
const { createWebhookServerManager } = require('./src/webhook');

// Create webhook server manager
const webhookManager = createWebhookServerManager({
  port: 3000,
  webhookSecret: 'your_webhook_secret',
  githubToken: 'your_github_token',
  useNgrok: true
});

// Register event handlers
webhookManager.registerEventHandler('push', async (payload) => {
  console.log(`Received push to ${payload.repository.full_name}`);
});

// Start the webhook manager
webhookManager.start()
  .then(serverInfo => {
    console.log(`Webhook URL: ${serverInfo.url}`);
    console.log(`Dashboard URL: ${serverInfo.dashboardUrl}`);
  });
```

### GitHub Webhook Management

For managing GitHub webhooks across multiple repositories:

```javascript
const { createGitHubWebhookManager } = require('./src/webhook');

// Create GitHub webhook manager
const githubWebhookManager = createGitHubWebhookManager(
  'your_github_token',
  'https://your-webhook-url.com/webhook'
);

// Set up webhooks for all accessible repositories
githubWebhookManager.setupWebhooksForAllRepos()
  .then(results => {
    console.log('Webhook setup results:', results);
  });
```

### Workflow Setup

1. **Configure Input Sources**:
   - Go to Settings > Input Sources
   - Click "Capture Cursor Position" and position your cursor where text should be entered
   - Name the position (e.g., "ChatGPT Input")

2. **Add Projects**:
   - Go to Projects > Add Project
   - Enter repository URL(s) - supports batch addition
   - Initialize projects with template files

3. **Configure Workflow**:
   - Create a new workflow with phases:
     - Phase 1: Structure Analysis
     - Phase 2: Feature Suggestions
     - Phase 3: Step Generation
     - Phase 4: Feature Implementation

4. **Start Automation**:
   - Apply workflow to project(s)
   - Start message processing
   - Monitor progress in dashboard

## Development Workflow

The system implements a structured workflow for AI-prompted development:

1. **Structure Analysis**: Analyze codebase and generate STRUCTURE.md
2. **Feature Suggestions**: Generate potential features and enhancements
3. **Implementation Steps**: Break down features into concurrent components
4. **Concurrent Development**: Send prompts for each component with proper context
5. **Validation**: Verify implemented features against requirements

## Project Structure

- `src/models/` - Core data models and business logic
- `src/utils/` - Utility functions and helpers
- `src/views/` - EJS templates for web interface
- `src/webhook/` - Webhook management system
- `src/server.js` - Express application

## Customization

### Templates

Prompt templates are stored in `config/templates/` as JSON files:

```json
{
  "name": "Feature Implementation",
  "description": "Template for implementing a specific feature",
  "content": "In accordance to best developmental methods and considering all correspondent code context -> Implement {{featureName}}\n\n{{featureDescription}}\n\n{{featureRequirements}}\n\nhave in mind that there are other concurrently developed correspondent features therefore you should carefully align with requirements of the feature",
  "type": "implementation"
}
```

### Workflows

Workflows are stored in `config/workflows/` as JSON files:

```json
{
  "name": "Standard Development Workflow",
  "description": "Standard workflow for AI-prompted development",
  "phases": [
    {
      "name": "Structure Analysis",
      "templateId": "structure-analysis",
      "requiresCodeAnalysis": false
    },
    {
      "name": "Feature Suggestions",
      "templateId": "feature-suggestion",
      "requiresCodeAnalysis": false
    },
    {
      "name": "Step Generation",
      "templateId": "step-generation",
      "requiresCodeAnalysis": false
    },
    {
      "name": "Feature Implementation",
      "templateId": "feature-implementation",
      "requiresCodeAnalysis": true
    }
  ]
}
```

## API Reference

The application exposes a REST API for programmatic control:

- `GET /api/projects` - List all projects
- `POST /api/projects` - Add a new project
- `POST /api/capture-cursor/:name` - Capture cursor position
- `POST /api/send-message` - Send a message to specified position
- `GET /api/queue-status` - Get message queue status

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
