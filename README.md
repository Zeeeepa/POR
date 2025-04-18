# POR - Project Orchestration and Reporting

A comprehensive system for managing multiple GitHub projects, automating cursor positioning for sending prompts, and orchestrating development workflows.

## Features

- **Input Configuration**: Capture and manage cursor positions for automated text entry
- **Project Management**: Import and manage multiple GitHub repositories
- **Template Management**: Create and manage reusable prompt templates
- **Phase Configuration**: Configure development phases with custom templates
- **Workflow Automation**: Automate development workflows with GitHub integration
- **Concurrent Development**: Support for concurrent development across multiple projects

## Architecture

The system is built with a modular architecture:

- **Core Components**:
  - `UnifiedCursorManager`: Manages cursor positions and automation
  - `InputConfigManager`: Manages input configuration for cursor positions
  - `DeplaEnhanced`: Main manager class that coordinates other components
  - `MessageQueueManager`: Handles message queuing and delivery
  - `GitHubEnhanced`: Manages GitHub integration
  - `WorkflowManager`: Manages development workflows
  - `MultiProjectManager`: Manages multiple projects

- **API Routes**:
  - `/api/input-config`: Input configuration API endpoints
  - `/api/github`: GitHub integration API endpoints
  - `/api/projects`: Project management API endpoints

- **User Interface**:
  - React components for the frontend
  - EJS templates for server-rendered pages

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- npm 7.x or higher
- Git

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/POR.git
   cd POR
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with the following variables:
   ```
   PORT=3000
   GITHUB_TOKEN=your_github_token
   ```

4. Start the development server:
   ```
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

### Input Configuration

1. Navigate to the Input Configuration page
2. Click "Capture Position" to capture a new cursor position
3. Move your cursor to the desired position and press Enter
4. Configure automation settings as needed

### Project Management

1. Navigate to the Projects page
2. Click "Add Project" to add a new GitHub repository
3. Configure project settings and templates
4. Use batch import to add multiple repositories at once

### Workflow Automation

1. Configure phases for your project
2. Set up templates for each phase
3. Start the workflow automation
4. Monitor progress on the Workflow Dashboard

## Development

### Project Structure

```
POR/
├── src/
│   ├── components/         # React components
│   ├── models/             # Data models
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   ├── views/              # EJS templates
│   └── server.js           # Express server
├── public/                 # Static assets
├── .env                    # Environment variables
└── package.json            # Dependencies
```

### Adding New Features

1. Create a new branch:
   ```
   git checkout -b feature/your-feature-name
   ```

2. Implement your feature
3. Write tests
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
