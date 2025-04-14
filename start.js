#!/usr/bin/env node

/**
 * Depla Client Deployment Script
 * 
 * This script helps with setting up and launching the Depla client application,
 * including configuring the connection to the WSL2 server and initializing
 * the application with the right settings.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, exec, execSync } = require('child_process');
const open = require('open');
const os = require('os');

// Configuration paths
const configDir = path.join(process.env.APPDATA || process.env.HOME, '.depla');
const configPath = path.join(configDir, 'config.json');

// Configuration
const CONFIG_FILE = path.join(os.homedir(), '.depla', 'config.json');
const WSL_DISTRO = 'Ubuntu'; // Change this to your WSL distro name if different

// Constants
const WSL_SERVER_DIR = 'wsl2-server';
const WSL_SETUP_SCRIPT = path.join(WSL_SERVER_DIR, 'setup.sh');
const WSL_LAUNCHER = path.join(WSL_SERVER_DIR, 'launch.py');

// Default configuration
const defaultConfig = {
  wsl2: {
    endpoint: '127.0.0.1',
    port: 8080,
    messageDelay: 3000
  },
  github: {
    token: ''
  },
  app: {
    port: 3000,
    dataDir: path.join(configDir, 'data'),
    templatesDir: path.join(configDir, 'templates')
  },
  wsl: {
    distro: WSL_DISTRO,
    autostart: false
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
  
  // WSL2 server setup
  if (args.includes('--setup-wsl') || args.includes('-w')) {
    await setupWSL2Server();
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
    // WSL2 server configuration
    console.log('\n--- WSL2 Server Configuration ---');
    config.wsl2.endpoint = await question('WSL2 Server IP Address:', config.wsl2.endpoint);
    config.wsl2.port = parseInt(await question('WSL2 Server Port:', config.wsl2.port.toString()), 10);
    
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
 * Setup the WSL2 server
 */
async function setupWSL2Server() {
  console.log('\n=== WSL2 Server Setup ===\n');
  
  try {
    // Check if WSL2 is installed
    exec('wsl -l -v', (error, stdout) => {
      if (error) {
        console.error('WSL2 is not installed or not properly configured.');
        console.log('Please install WSL2 first: https://docs.microsoft.com/en-us/windows/wsl/install');
        rl.close();
        return;
      }
      
      // Check if the default distro is Ubuntu
      const distroList = stdout.toString();
      if (!distroList.includes('Ubuntu')) {
        console.log('Ubuntu distribution not found in WSL2.');
        console.log('Please install Ubuntu from the Microsoft Store.');
        return;
      }
      
      console.log('WSL2 with Ubuntu is installed.');
      console.log('Setting up the Depla server in WSL2...');
      
      // Copy server files to WSL2
      const serverSourceDir = path.join(__dirname, 'wsl2-server');
      const serverDestDir = '~/depla-server';
      
      // Create WSL command to run
      const setupCommand = `
        mkdir -p ${serverDestDir} && 
        cd ${serverDestDir} && 
        chmod +x setup.sh && 
        ./setup.sh
      `;
      
      // Start WSL with the setup command
      console.log('Launching WSL2 setup...');
      spawn('wsl', ['-d', 'Ubuntu', '-e', 'bash', '-c', setupCommand], {
        stdio: 'inherit'
      });
      
      console.log('\nAfter setup completes, you can start the server with:');
      console.log('wsl -d Ubuntu -e python3 ~/depla-server/launch.py');
    });
  } catch (error) {
    console.error(`Error setting up WSL2 server: ${error.message}`);
  }
}

/**
 * Start the application
 */
function startApplication(config) {
  // Check if server.js exists
  const serverPath = path.join(__dirname, 'src', 'server.js');
  if (!fs.existsSync(serverPath)) {
    console.error('Server file not found. Make sure you are in the Depla project directory.');
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

// Ensure config directory exists
function ensureConfigDir() {
  const configDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

// Check if WSL is installed and setup
function checkWSL() {
  try {
    execSync('wsl --status', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Check if setup script has been run in WSL
async function checkSetup() {
  return new Promise((resolve) => {
    exec('wsl test -f ~/.depla/.setup_complete && echo "yes" || echo "no"', (error, stdout) => {
      resolve(stdout.trim() === 'yes');
    });
  });
}

// Run setup script in WSL
async function runSetup() {
  console.log('Setting up WSL environment...');
  
  // Make sure setup script is executable
  execSync(`wsl chmod +x ${WSL_SETUP_SCRIPT}`, { stdio: 'inherit' });
  
  // Run setup script
  return new Promise((resolve, reject) => {
    const setupProcess = exec(`wsl bash ${WSL_SETUP_SCRIPT}`, { stdio: 'inherit' });
    
    setupProcess.stdout?.pipe(process.stdout);
    setupProcess.stderr?.pipe(process.stderr);
    
    setupProcess.on('exit', (code) => {
      if (code === 0) {
        console.log('WSL setup completed successfully');
        
        // Mark setup as complete
        exec('wsl mkdir -p ~/.depla && touch ~/.depla/.setup_complete');
        
        resolve(true);
      } else {
        console.error(`WSL setup failed with code ${code}`);
        reject(new Error(`Setup failed with code ${code}`));
      }
    });
  });
}

// Start the launcher in WSL
function startLauncher() {
  console.log('Starting Depla WSL2 Server launcher...');
  
  // Make sure launcher is executable
  execSync(`wsl chmod +x ${WSL_LAUNCHER}`, { stdio: 'ignore' });
  
  // Start launcher
  exec(`wsl python3 ${WSL_LAUNCHER}`, (error) => {
    if (error) {
      console.error('Failed to start launcher:', error);
    }
  });
}

// Create autostart file for Windows
function setupAutostart() {
  const startupDir = path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const batFile = path.join(startupDir, 'depla-wsl2-server.bat');
  
  // Get current script directory
  const scriptDir = __dirname;
  
  // Create batch file content
  const batContent = `@echo off
cd "${scriptDir}"
node start.js
`;
  
  try {
    fs.writeFileSync(batFile, batContent);
    console.log('Autostart configured. The server will start automatically when you log in.');
  } catch (error) {
    console.error('Failed to create autostart file:', error);
    console.log('You can manually add this program to startup by creating a shortcut in:', startupDir);
  }
}

// Ask user if they want to set up autostart
function promptAutostart() {
  return new Promise((resolve) => {
    rl.question('Would you like to set up Depla WSL2 Server to start automatically when you log in? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        setupAutostart();
      }
      resolve();
    });
  });
}

// Main function
async function main() {
  try {
    console.log('Depla WSL2 Server Setup');
    console.log('=======================');
    
    // Check WSL installation
    if (!checkWSL()) {
      console.error('Error: Windows Subsystem for Linux (WSL) is not installed.');
      console.log('Please install WSL by following the instructions at:');
      console.log('https://docs.microsoft.com/en-us/windows/wsl/install');
      process.exit(1);
    }
    
    // Check if setup has been run
    const isSetup = await checkSetup();
    
    if (!isSetup) {
      await runSetup();
    } else {
      console.log('WSL environment already set up');
    }
    
    // Ask about autostart
    await promptAutostart();
    
    // Start the launcher
    startLauncher();
    
    console.log('Depla WSL2 Server is now running. You can close this window.');
    
  } catch (error) {
    console.error('Error during setup:', error);
  } finally {
    rl.close();
  }
}

// Run the main function
main(); 