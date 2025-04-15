#!/usr/bin/env node

/**
 * Depla Client Deployment Script
 * 
 * This script helps with setting up and launching the Depla client application,
 * including configuring the connection and initializing
 * the application with the right settings.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const open = require('open');

// Configuration paths
const configDir = path.join(process.env.APPDATA || process.env.HOME, '.depla');
const configPath = path.join(configDir, 'config.json');

// Default configuration
const defaultConfig = {
  github: {
    token: ''
  },
  app: {
    port: 3000,
    dataDir: path.join(configDir, 'data'),
    templatesDir: path.join(configDir, 'templates')
  },
  server: {
    port: 8080
  }
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Main function
 */
async function main() {
  console.log('\n=== Depla Project Manager Setup ===\n');
  
  // Ensure config directory exists
  ensureDirectories();
  
  // Load or create configuration
  let config = loadConfig();
  
  // Check for command line arguments
  const args = process.argv.slice(2);
  
  // Quick start option
  if (args.includes('--start') || args.includes('-s')) {
    startApplication(config);
    return;
  }
  
  // Setup wizard
  if (args.includes('--setup') || args.includes('-w') || !configExists()) {
    await setupWizard(config);
  }
  
  // Start the application
  startApplication(config);
}

/**
 * Check if config file exists
 */
function configExists() {
  return fs.existsSync(configPath);
}

/**
 * Ensure all required directories exist
 */
function ensureDirectories() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`Created config directory at ${configDir}`);
  }
  
  // Create data and templates directories
  const dataDir = path.join(configDir, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const templatesDir = path.join(configDir, 'templates');
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
}

/**
 * Load configuration
 */
function loadConfig() {
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...defaultConfig, ...config };
    } catch (error) {
      console.error(`Error loading config: ${error.message}`);
      return { ...defaultConfig };
    }
  }
  return { ...defaultConfig };
}

/**
 * Save configuration
 */
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Configuration saved successfully.');
    return true;
  } catch (error) {
    console.error(`Error saving config: ${error.message}`);
    return false;
  }
}

/**
 * Run the setup wizard
 */
async function setupWizard(config) {
  console.log('\n=== Configuration Wizard ===\n');
  
  // Ask questions
  try {
    // GitHub configuration
    console.log('\n--- GitHub Configuration ---');
    if (!config.github.token) {
      console.log('A GitHub Personal Access Token is required for repository operations.');
      console.log('You can generate one at: https://github.com/settings/tokens');
    }
    config.github.token = await question('GitHub Personal Access Token:', config.github.token || '');
    
    // App configuration
    console.log('\n--- Application Configuration ---');
    config.app.port = parseInt(await question('Web UI Port:', config.app.port.toString()), 10);
    
    // Save the configuration
    saveConfig(config);
    
    console.log('\nConfiguration complete!\n');
  } catch (error) {
    console.error(`Error during setup: ${error.message}`);
  }
}

/**
 * Helper function to ask a question
 */
function question(query, defaultValue) {
  return new Promise((resolve) => {
    const defaultText = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`${query}${defaultText}: `, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

/**
 * Start the application
 */
function startApplication(config) {
  // Check if server.js exists
  const serverPath = path.join(__dirname, 'src', 'server.js');
  if (!fs.existsSync(serverPath)) {
    console.error('Server file not found at: ' + serverPath);
    console.error('Make sure you are in the Depla project directory and the src/server.js file exists.');
    rl.close();
    return;
  }
  
  console.log('\n=== Starting Depla Project Manager ===\n');
  console.log(`Web UI will be available at: http://localhost:${config.app.port}`);
  
  // Set environment variables for configuration
  const env = {
    ...process.env,
    DEPLA_CONFIG_PATH: configPath,
    PORT: config.app.port
  };
  
  // Start the server
  const server = spawn('node', [serverPath], {
    env,
    stdio: 'inherit'
  });
  
  server.on('close', (code) => {
    console.log(`Application exited with code ${code}`);
    rl.close();
  });
  
  // Open browser after a short delay
  setTimeout(() => {
    open(`http://localhost:${config.app.port}`);
  }, 2000);
}

// Run the main function
main().catch(error => {
  console.error(`Error: ${error.message}`);
  rl.close();
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\nExiting...');
  rl.close();
  process.exit(0);
});
