# Depla Project Manager

A project management tool for developers to organize and track project development.

## Features

- GitHub integration for repository management
- Project requirements tracking
- Implementation planning
- Message templating and management
- Configuration management

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

## Configuration

The application configuration is stored in `config/app_config.json`. You can modify settings through the web interface at http://localhost:3000/settings.

### GitHub Settings

- **Username**: Your GitHub username
- **Personal Access Token**: Your GitHub personal access token with repo scope

### General Settings

- **Message Delay**: Delay between messages when sending batches (in milliseconds)
- **Auto-start Processing**: Automatically start processing when loading a project

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

## License

MIT
