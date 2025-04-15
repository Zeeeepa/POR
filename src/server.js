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

// Load environment variables from .env file
require('dotenv').config();

// Initialize the app
const app = express();
const PORT = process.env.PORT || 3000;

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Initialize DeplaEnhanced
let deplaManager;

// Initialize application
async function initializeApp() {
  try {
    // Create .env file if it doesn't exist
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, '# Environment variables\n');
      logger.info('Created empty .env file');
    }
    
    // Use the directly imported DeplaEnhanced class
    deplaManager = new DeplaEnhanced();
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`Depla Project Manager running on http://localhost:${PORT}`);
    });
    
    return deplaManager;
  } catch (error) {
    logger.error('Failed to initialize application:', error);
    throw error;
  }
}

// Routes
app.get('/', async (req, res) => {
  try {
    const { projects } = await deplaManager.initialize();
    res.render('dashboard', { projects });
  } catch (error) {
    logger.error('Error rendering dashboard:', error);
    res.status(500).render('error', { error: 'Failed to load dashboard' });
  }
});

app.get('/projects', async (req, res) => {
  try {
    const { projects } = await deplaManager.initialize();
    res.render('projects', { projects });
  } catch (error) {
    logger.error('Error rendering projects:', error);
    res.status(500).render('error', { error: 'Failed to load projects' });
  }
});

app.get('/projects/:name', async (req, res) => {
  const project = deplaManager.getProject(req.params.name);
  if (project) {
    res.render('project-detail', { project });
  } else {
    res.status(404).send('Project not found');
  }
});

app.post('/projects/add', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    const project = await deplaManager.addProject(repoUrl);
    res.redirect(`/projects/${project.config.name}`);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

app.get('/projects/:name/requirements', async (req, res) => {
  const project = deplaManager.getProject(req.params.name);
  if (project) {
    const requirementsPath = path.join(project.path, 'REQUIREMENTS.md');
    if (fs.existsSync(requirementsPath)) {
      const requirements = fs.readFileSync(requirementsPath, 'utf8');
      res.render('requirements', { project, requirements });
    } else {
      res.render('requirements', { project, requirements: '# Project Requirements' });
    }
  } else {
    res.status(404).send('Project not found');
  }
});

app.post('/projects/:name/requirements', async (req, res) => {
  const project = deplaManager.getProject(req.params.name);
  if (project) {
    const { content } = req.body;
    project.updateRequirements(content);
    res.redirect(`/projects/${project.config.name}`);
  } else {
    res.status(404).send('Project not found');
  }
});

app.get('/projects/:name/generate-steps', async (req, res) => {
  const project = deplaManager.getProject(req.params.name);
  if (project) {
    const steps = await project.generateSteps();
    fs.writeFileSync(path.join(project.path, 'STEPS.md'), steps);
    project.loadSteps();
    res.redirect(`/projects/${project.config.name}`);
  } else {
    res.status(404).send('Project not found');
  }
});

// Message routes
app.get('/projects/:name/messages', async (req, res) => {
  const project = deplaManager.getProject(req.params.name);
  if (project) {
    res.render('messages', { project });
  } else {
    res.status(404).send('Project not found');
  }
});

app.post('/projects/:name/messages/add', async (req, res) => {
  const project = deplaManager.getProject(req.params.name);
  if (project) {
    const message = req.body;
    project.addMessage(message);
    res.redirect(`/projects/${project.config.name}/messages`);
  } else {
    res.status(404).send('Project not found');
  }
});

app.post('/projects/:name/messages/:id/send', async (req, res) => {
  const result = await deplaManager.sendMessage(req.params.name, req.params.id);
  if (result) {
    res.redirect(`/projects/${req.params.name}/messages`);
  } else {
    res.status(400).send('Failed to send message');
  }
});

app.post('/projects/:name/messages/send-all', async (req, res) => {
  const result = await deplaManager.sendAllMessages(req.params.name);
  if (result) {
    res.redirect(`/projects/${req.params.name}/messages`);
  } else {
    res.status(400).send('Failed to send messages');
  }
});

// Settings routes
app.get('/settings', async (req, res) => {
  res.render('settings', { config: deplaManager.config });
});

app.post('/settings/update', async (req, res) => {
  const newConfig = req.body;
  deplaManager.updateConfig({ ...deplaManager.config, ...newConfig });
  res.redirect('/settings');
});

app.post('/settings/github', async (req, res) => {
  const githubConfig = req.body;
  deplaManager.updateConfig({ 
    ...deplaManager.config, 
    github: { 
      ...deplaManager.config.github,
      token: githubConfig.githubToken || deplaManager.config.github?.token,
      username: githubConfig.githubUsername,
      autoCreateRepo: !!githubConfig.autoCreateRepo
    } 
  });
  res.redirect('/settings');
});

// New route for cursor position capture
app.post('/settings/cursor-position', async (req, res) => {
  try {
    const { position } = req.body;
    if (!position) {
      return res.status(400).json({ success: false, error: 'Position is required' });
    }
    
    // Save position to config
    deplaManager.updateConfig({ 
      ...deplaManager.config, 
      cursorPosition: position 
    });
    
    // Save position to CursorAutomation
    const [x, y] = position.split(',').map(Number);
    CursorAutomation.savePosition('default', { x, y });
    
    res.json({ success: true, position });
  } catch (error) {
    logger.error(`Failed to save cursor position: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// New route for prompt automation settings
app.post('/settings/ai', async (req, res) => {
  try {
    const { cursorPosition, promptDelay, enablePromptAutomation } = req.body;
    
    deplaManager.updateConfig({ 
      ...deplaManager.config, 
      cursorPosition,
      promptDelay: parseInt(promptDelay, 10) || 2000,
      enablePromptAutomation: !!enablePromptAutomation
    });
    
    res.redirect('/settings');
  } catch (error) {
    logger.error(`Failed to save prompt settings: ${error.message}`);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// New route for GitHub automation settings
app.post('/settings/github-automation', async (req, res) => {
  try {
    const { enableAutoMerge, autoMergeKeywords, pollingInterval } = req.body;
    
    deplaManager.updateConfig({ 
      ...deplaManager.config, 
      enableAutoMerge: !!enableAutoMerge,
      autoMergeKeywords: autoMergeKeywords || '',
      pollingInterval: parseInt(pollingInterval, 10) || 60,
      automation: {
        ...deplaManager.config.automation,
        enabled: !!enableAutoMerge,
        interval: (parseInt(pollingInterval, 10) || 60) * 1000
      }
    });
    
    // Update automation status
    if (enableAutoMerge) {
      deplaManager.setupAutomation();
    } else {
      deplaManager.stopAutomation();
    }
    
    res.redirect('/settings');
  } catch (error) {
    logger.error(`Failed to save GitHub automation settings: ${error.message}`);
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.post('/settings/advanced', async (req, res) => {
  const advancedConfig = req.body;
  deplaManager.updateConfig({ 
    ...deplaManager.config, 
    logLevel: advancedConfig.logLevel,
    port: parseInt(advancedConfig.port, 10) || 3000,
    enableWebhooks: !!advancedConfig.enableWebhooks
  });
  res.redirect('/settings');
});

app.get('/settings/export', async (req, res) => {
  res.json(deplaManager.config);
});

app.post('/settings/reset', async (req, res) => {
  deplaManager.configManager.resetConfig();
  deplaManager.config = deplaManager.configManager.getConfig();
  res.redirect('/settings');
});

// Initialize the application
if (require.main === module) {
  initializeApp().catch(error => {
    logger.error('Failed to initialize application:', error);
    // Don't exit the process on authentication failure, just log the error
    if (error.message && !error.message.includes('GitHub authentication failed')) {
      process.exit(1);
    }
  });
}

module.exports = { app, initializeApp };
