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
  // Use the directly imported DeplaEnhanced class
  deplaManager = new DeplaEnhanced();
  
  // Start the server
  app.listen(PORT, () => {
    logger.info(`Depla Project Manager running on http://localhost:${PORT}`);
  });
}

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

app.post('/settings', async (req, res) => {
  const newConfig = req.body;
  deplaManager.updateConfig(newConfig);
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
