# Depla Project Manager

A project management tool for developers to organize and track project development with GitHub integration.

## Features

- GitHub integration for repository management
- Project requirements tracking
- Implementation planning
- Message templating and management
- Configuration management
- Webhook support for automated PR processing

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- GitHub account with a personal access token

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

3. Create a `.env` file in the root directory with your GitHub token:
```
GITHUB_TOKEN=your_github_token_here
```

Alternatively, you can enter your GitHub token when prompted during startup.

## Usage

Start the application:
```bash
npm start
```

The application will be available at http://localhost:3000

### GitHub Token Setup

The application requires a GitHub token to function properly. You can provide it in one of the following ways:

1. Create a `.env` file in the root directory with your GitHub token:
```
GITHUB_TOKEN=your_github_token_here
```

2. When you start the application without a token, you will be prompted to enter it in the console. The token will be saved to a `.env` file for future use.

3. Configure it through the web interface at http://localhost:3000/settings.

To create a GitHub token:
1. Go to your GitHub account settings
2. Navigate to Developer settings > Personal access tokens
3. Generate a new token with the `repo` scope
4. Copy the token and use it in the application

## Configuration

The application configuration is stored in `config/app_config.json`. You can modify settings through the web interface at http://localhost:3000/settings.

### GitHub Settings

- **Username**: Your GitHub username
- **Personal Access Token**: Your GitHub personal access token with repo scope

### General Settings

- **Message Delay**: Delay between messages when sending batches (in milliseconds)
- **Auto-start Processing**: Automatically start processing when loading a project

### Webhook Settings

- **Enable Webhooks**: Turn on/off webhook server
- **Port**: Port for the webhook server (default: 3200)
- **Secret**: Secret for webhook signature verification

### Automation Settings

- **Enable Automation**: Turn on/off automated processing
- **Process Interval**: Time between processing runs (in milliseconds)
- **Auto-start Next Phase**: Automatically start the next phase when current phase is mostly complete

## Project Structure

- `framework.js`: Core framework functionality
- `src/`: Source code
  - `server.js`: Express server
  - `framework/`: Framework components
  - `utils/`: Utility functions
  - `models/`: Data models
- `views/`: EJS templates
- `public/`: Static assets
- `templates/`: Message templates
- `projects/`: Project data (created when adding projects)
- `config/`: Application configuration

## Troubleshooting

### GitHub Token Issues

If you encounter errors related to GitHub authentication:
1. Check that your token is correctly set in the `.env` file or in the application settings
2. Verify that your token has the necessary permissions (repo scope)
3. Ensure your token hasn't expired

### Server Start Issues

If the server fails to start:
1. Check that all dependencies are installed (`npm install`)
2. Verify that the required port (default: 3000) is available
3. Check the console output for specific error messages

## License

MIT
