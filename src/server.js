const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const dotenv = require('dotenv');

dotenv.config();

const {
  DeplaEnhanced,
  GitHubEnhanced,
  CursorAutomation,
  TemplateManager,
  PhaseConfigManager,
  WorkflowManager,
  logger
} = require('./core');

const inputConfigRoutes = require('./routes/inputConfigRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
} else {
  app.use(express.static(path.join(__dirname, 'client/public')));
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let deplaManager;
let githubClient;
let templateManager;
let cursorManager;
let phaseConfigManager;
let workflowManager;
let inputConfigManager;

async function initializeApp() {
  try {
    githubClient = new GitHubEnhanced();
    const githubInitialized = await githubClient.initializeClient();
    
    cursorManager = new CursorAutomation();
    
    deplaManager = new DeplaEnhanced();
    templateManager = new TemplateManager();
    phaseConfigManager = new PhaseConfigManager();
    workflowManager = new WorkflowManager();
    
    const InputConfigManager = require('./components/InputConfiguration/InputConfigManager');
    inputConfigManager = new InputConfigManager({ cursorManager });
    
    app.listen(PORT, () => {
      logger.info(`POR running on http://localhost:${PORT}`);
    });

    return githubInitialized;
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    throw error;
  }
}

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

app.use('/api/github', ensureGitHubInitialized);
app.use('/projects', ensureGitHubInitialized);

app.use('/api/input-config', inputConfigRoutes);

app.get('/', async (req, res) => {
  const { projects } = await deplaManager.initialize();
  res.render('dashboard', { projects });
});

app.get('/input-config', (req, res) => {
  res.render('input-config');
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build/index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/public/index.html'));
  });
}

if (require.main === module) {
  initializeApp().catch(error => {
    logger.error('Failed to initialize application:', error);
    process.exit(1);
  });
}

module.exports = { app, initializeApp };
