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

// New route for creating a new project
app.get('/projects/new', (req, res) => {
  res.render('project-new');
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
