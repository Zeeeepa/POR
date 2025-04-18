/**
 * Unified Express server for Depla Project Manager
 * This replaces both root server.js and src/server.js
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const framework = require('./framework');
const logger = require('./utils/logger');
// Import DeplaEnhanced directly to avoid circular dependency
const DeplaEnhanced = require('./models/DeplaEnhanced');
const CursorAutomation = require('./utils/CursorAutomation');
const GitHubEnhanced = require('./utils/GitHubEnhanced');
const TemplateManager = require('./models/TemplateManager');
const PhaseConfigManager = require('./models/PhaseConfigManager');
const WorkflowManager = require('./models/WorkflowManager');
const InputConfigManager = require('./components/InputConfiguration/InputConfigManager');

// Import routes
const inputConfigRoutes = require('./routes/inputConfigRoutes');

// Load environment variables from .env file
require('dotenv').config();

// Initialize the app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up view engine for server-side templates
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to ensure GitHub is initialized
const ensureGitHubInitialized = async (req, res, next) => {
  if (!githubClient || !githubClient.isInitialized()) {
    try {
      await githubClient.initializeClient();
      if (!githubClient.isInitialized()) {
        return res.status(401).json({
          success: false,
          error: 'GitHub authentication required',
          needsAuth: true
        });
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: error.message,
        needsAuth: true
      });
    }
  }
  next();
};

// Serve static files from the React app build directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
} else {
  // In development, serve from client's public directory
  app.use(express.static(path.join(__dirname, 'client/public')));
}

// Serve static files for development
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Initialize managers
let deplaManager;
let githubClient;
let templateManager;
let cursorManager;
let phaseConfigManager;
let workflowManager;
let inputConfigManager;

// Initialize application
async function initializeApp() {
  try {
    // Initialize GitHub client first
    githubClient = new GitHubEnhanced();
    const githubInitialized = await githubClient.initializeClient();
    
    // Initialize cursor manager
    cursorManager = new CursorAutomation();
    
    // Initialize other managers
    deplaManager = new DeplaEnhanced();
    templateManager = new TemplateManager();
    phaseConfigManager = new PhaseConfigManager();
    workflowManager = new WorkflowManager();
    inputConfigManager = new InputConfigManager({ cursorManager });
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`Depla Project Manager running on http://localhost:${PORT}`);
    });

    return githubInitialized;
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    throw error;
  }
}

// API route to check GitHub auth status
app.get('/api/auth/status', async (req, res) => {
  try {
    if (!githubClient) {
      githubClient = new GitHubEnhanced();
    }
    const initialized = await githubClient.initializeClient();
    if (initialized) {
      const user = await githubClient.getUserInfo();
      res.json({
        success: true,
        authenticated: true,
        user: {
          login: user.login,
          avatar_url: user.avatar_url
        }
      });
    } else {
      res.json({
        success: true,
        authenticated: false,
        needsAuth: true
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      needsAuth: true
    });
  }
});

// API route to set GitHub token
app.post('/api/auth/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    if (!githubClient) {
      githubClient = new GitHubEnhanced();
    }

    const success = await githubClient.setToken(token);
    if (success) {
      const user = await githubClient.getUserInfo();
      res.json({
        success: true,
        user: {
          login: user.login,
          avatar_url: user.avatar_url
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid GitHub token'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Routes that require GitHub authentication
app.use('/api/github', ensureGitHubInitialized);
app.use('/projects', ensureGitHubInitialized);

// Register API routes
app.use('/api/input-config', inputConfigRoutes);

// Routes
app.get('/', async (req, res) => {
  const { projects } = await deplaManager.initialize();
  res.render('dashboard', { projects });
});

// Input Configuration routes
app.get('/input-config', (req, res) => {
  res.render('input-config');
});

// Serve React app for all other routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });
} else {
  // In development, serve the React dev server's index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/public/index.html'));
  });
}

// Initialize the application
if (require.main === module) {
  initializeApp().catch(error => {
    logger.error('Failed to initialize application:', error);
    // Exit with error code if initialization fails
    process.exit(1);
  });
}

module.exports = { app, initializeApp };
