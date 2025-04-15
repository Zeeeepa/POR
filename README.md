# Depla Project Manager

Multi-threaded project management system with AI-prompted implementation.

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

## Running the Application

You can run the application using one of the following methods:

### Method 1: Using npm start

```
npm start
```

This will start the server using the configuration in package.json.

### Method 2: Using the start script

```
node start.js
```

This will run the setup wizard if needed and then start the application.

### Method 3: Quick start

```
node start.js --start
```

This will skip the setup wizard and start the application immediately.

## Configuration

The application uses a configuration file stored in:
- Windows: `%APPDATA%\.depla\config.json`
- macOS/Linux: `$HOME/.depla/config.json`

You can run the setup wizard to configure the application:

```
node start.js --setup
```

## WSL2 Integration

If you're using Windows, the application can integrate with WSL2 for additional functionality. To set up the WSL2 server:

```
node start.js --setup-wsl
```

## Project Structure

- `src/server.js`: Main Express server
- `framework.js`: Core framework functionality
- `src/framework/`: Framework components
- `src/models/`: Data models
- `src/utils/`: Utility functions
- `src/webhook/`: Webhook handling

## License

MIT
