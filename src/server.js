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
const UnifiedCursorManager = require('./utils/UnifiedCursorManager');
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
    cursorManager = new UnifiedCursorManager();
    
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

// Project routes
app.get('/projects', async (req, res) => {
  const { projects } = await deplaManager.initialize();
  res.render('projects', { projects });
});

// New route for creating a new project
app.get('/projects/new', (req, res) => {
  res.render('project-new');
});

// New API route to get GitHub repositories
app.get('/api/github/repositories', async (req, res) => {
  try {
    // Initialize GitHub client if not already initialized
    if (!githubClient) {
      githubClient = new GitHubEnhanced();
    }
    
    // Get repositories
    const repositories = await githubClient.getUserRepositories({
      sort: 'updated',
      direction: 'desc'
    });
    
    // Return repositories as JSON
    res.json({
      success: true,
      repositories: repositories.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        description: repo.description,
        private: repo.private,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url
        },
        updated_at: repo.updated_at
      }))
    });
  } catch (error) {
    logger.error(`Failed to get GitHub repositories: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/projects/:name', async (req, res) => {
  const project = deplaManager.getProject(req.params.name);
  if (project) {
    // Get phase configurations for the project
    const phases = await phaseConfigManager.getPhaseConfigs(project.config.name);
    res.render('project-detail', { project, phases });
  } else {
    res.status(404).send('Project not found');
  }
});

app.post('/projects/add', async (req, res) => {
  try {
    const { repoUrl, projectName, description, initializeTemplates } = req.body;
    
    // Validate repository URL
    if (!repoUrl) {
      throw new Error('Repository URL is required');
    }
    
    // Add the project
    const project = await deplaManager.addProject(repoUrl, projectName || '');
    
    // Update description if provided
    if (description) {
      project.config.description = description;
      await fs.writeJson(path.join(project.path, 'project.json'), project.config, { spaces: 2 });
    }
    
    // Initialize templates if requested
    if (initializeTemplates === 'on') {
      await deplaManager.multiProjectManager.initializeProject(
        deplaManager.multiProjectManager.getAllProjectTabs().find(tab => tab.projectName === project.config.name).id
      );
    }
    
    res.redirect(`/projects/${project.config.name}`);
  } catch (error) {
    logger.error(`Failed to add project: ${error.message}`);
    res.status(400).render('error', { 
      title: 'Project Creation Failed',
      message: error.message,
      backUrl: '/projects/new'
    });
  }
});

// New route for creating an empty project
app.post('/projects/create-empty', async (req, res) => {
  try {
    const { projectName, description } = req.body;
    
    if (!projectName) {
      throw new Error('Project name is required');
    }
    
    // Create empty project
    const project = await deplaManager.baseManager.createProject(projectName, { description });
    
    // Add to multi-project manager
    await deplaManager.multiProjectManager.addProjectTab({
      projectName: project.config.name,
      repoUrl: ''
    });
    
    res.redirect(`/projects/${project.config.name}`);
  } catch (error) {
    logger.error(`Failed to create empty project: ${error.message}`);
    res.status(400).render('error', { 
      title: 'Project Creation Failed',
      message: error.message,
      backUrl: '/projects/new'
    });
  }
});

// New route for batch import
app.get('/projects/batch-import', (req, res) => {
  res.render('batch-import');
});

app.post('/projects/batch-import', async (req, res) => {
  try {
    const { repoUrls } = req.body;
    
    if (!repoUrls) {
      throw new Error('Repository URLs are required');
    }
    
    // Split by newline and filter empty lines
    const urls = repoUrls.split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    if (urls.length === 0) {
      throw new Error('No valid repository URLs provided');
    }
    
    // Prepare project data for batch import
    const projectsData = urls.map(url => ({ repoUrl: url }));
    
    // Add projects in batch
    const results = await deplaManager.multiProjectManager.addMultipleProjectTabs(projectsData);
    
    res.redirect('/projects');
  } catch (error) {
    logger.error(`Failed to batch import projects: ${error.message}`);
    res.status(400).render('error', { 
      title: 'Batch Import Failed',
      message: error.message,
      backUrl: '/projects/batch-import'
    });
  }
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
