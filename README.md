# Depla Project Manager

A multi-threaded project management system with AI-prompted implementation.

## Features

- GitHub repository integration
- Webhook server for GitHub events
- Project management dashboard
- Message queue system
- Automated implementation steps

## Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)
- GitHub account with personal access token

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/Zeeeepa/POR.git
   cd POR
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with your GitHub token:
   ```
   GITHUB_TOKEN=your_github_token_here
   ```

## Usage

1. Start the application:
   ```
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. If you didn't set up a GitHub token in the `.env` file, you will be prompted to enter it when starting the application.

## Configuration

You can configure the application through the web interface at `/settings` or by editing the `.env` file:

```
# GitHub Configuration
GITHUB_TOKEN=your_github_token_here

# Application Configuration
PORT=3000
LOG_LEVEL=info
```

## Project Structure

- `src/` - Main application code
  - `server.js` - Express server
  - `framework/` - Core framework components
  - `utils/` - Utility functions
  - `webhook/` - GitHub webhook handling

## License

MIT
