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
const CursorPositionManager = require('./models/CursorPositionManager');
const PhaseConfigManager = require('./models/PhaseConfigManager');
const WorkflowManager = require('./models/WorkflowManager');

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
let githubClient;
let templateManager;
let cursorPositionManager;
let phaseConfigManager;
let workflowManager;

// Initialize application
async function initializeApp() {
  // Initialize GitHub client
  githubClient = new GitHubEnhanced();
  
  // Use the directly imported DeplaEnhanced class
  deplaManager = new DeplaEnhanced();
  
  // Initialize new managers
  templateManager = new TemplateManager();
  cursorPositionManager = new CursorPositionManager();
  phaseConfigManager = new PhaseConfigManager();
  workflowManager = new WorkflowManager();
  
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
  // Get cursor positions for settings page
  const cursorPositions = await cursorPositionManager.getAllPositions();
  res.render('settings', { 
    config: deplaManager.config,
    cursorPositions
  });
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
    const { position, name } = req.body;
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
    const positionName = name || 'default';
    
    // Save to both systems for compatibility
    CursorAutomation.savePosition(positionName, { x, y });
    await cursorPositionManager.savePosition(positionName, { x, y });
    
    res.json({ success: true, position, name: positionName });
  } catch (error) {
    logger.error(`Failed to save cursor position: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// New route for cursor positions management
app.get('/cursor-positions', async (req, res) => {
  try {
    const positions = await cursorPositionManager.getAllPositions();
    res.render('cursor-positions', { positions });
  } catch (error) {
    logger.error(`Failed to get cursor positions: ${error.message}`);
    res.status(500).render('error', {
      title: 'Error Loading Cursor Positions',
      message: error.message,
      backUrl: '/settings'
    });
  }
});

app.post('/cursor-positions/add', async (req, res) => {
  try {
    const { name, x, y } = req.body;
    if (!name || !x || !y) {
      throw new Error('Name, X, and Y coordinates are required');
    }
    
    await cursorPositionManager.savePosition(name, { x: parseInt(x), y: parseInt(y) });
    res.redirect('/cursor-positions');
  } catch (error) {
    logger.error(`Failed to add cursor position: ${error.message}`);
    res.status(400).render('error', {
      title: 'Failed to Add Cursor Position',
      message: error.message,
      backUrl: '/cursor-positions'
    });
  }
});

app.post('/cursor-positions/delete/:name', async (req, res) => {
  try {
    await cursorPositionManager.deletePosition(req.params.name);
    res.redirect('/cursor-positions');
  } catch (error) {
    logger.error(`Failed to delete cursor position: ${error.message}`);
    res.status(500).render('error', {
      title: 'Failed to Delete Cursor Position',
      message: error.message,
      backUrl: '/cursor-positions'
    });
  }
});

// New route for template management
app.get('/templates', async (req, res) => {
  try {
    const templates = await templateManager.getAllTemplates();
    res.render('template-manager', { templates });
  } catch (error) {
    logger.error(`Failed to get templates: ${error.message}`);
    res.status(500).render('error', {
      title: 'Error Loading Templates',
      message: error.message,
      backUrl: '/settings'
    });
  }
});

app.post('/templates/add', async (req, res) => {
  try {
    const { name, content, description, category } = req.body;
    if (!name || !content) {
      throw new Error('Name and content are required');
    }
    
    await templateManager.saveTemplate(name, content, description, category);
    res.redirect('/templates');
  } catch (error) {
    logger.error(`Failed to add template: ${error.message}`);
    res.status(400).render('error', {
      title: 'Failed to Add Template',
      message: error.message,
      backUrl: '/templates'
    });
  }
});

app.post('/templates/delete/:name', async (req, res) => {
  try {
    await templateManager.deleteTemplate(req.params.name);
    res.redirect('/templates');
  } catch (error) {
    logger.error(`Failed to delete template: ${error.message}`);
    res.status(500).render('error', {
      title: 'Failed to Delete Template',
      message: error.message,
      backUrl: '/templates'
    });
  }
});

// New route for phase configuration
app.get('/projects/:name/phases', async (req, res) => {
  try {
    const project = deplaManager.getProject(req.params.name);
    if (!project) {
      return res.status(404).send('Project not found');
    }
    
    const phases = await phaseConfigManager.getPhaseConfigs(project.config.name);
    res.render('phase-editor', { project, phases });
  } catch (error) {
    logger.error(`Failed to get phase configurations: ${error.message}`);
    res.status(500).render('error', {
      title: 'Error Loading Phase Configurations',
      message: error.message,
      backUrl: `/projects/${req.params.name}`
    });
  }
});

app.post('/projects/:name/phases/add', async (req, res) => {
  try {
    const { phaseName, description, steps, order } = req.body;
    if (!phaseName) {
      throw new Error('Phase name is required');
    }
    
    await phaseConfigManager.addPhaseConfig(req.params.name, {
      name: phaseName,
      description,
      steps: steps ? steps.split('\n').map(step => step.trim()).filter(Boolean) : [],
      order: parseInt(order) || 0
    });
    
    res.redirect(`/projects/${req.params.name}/phases`);
  } catch (error) {
    logger.error(`Failed to add phase configuration: ${error.message}`);
    res.status(400).render('error', {
      title: 'Failed to Add Phase Configuration',
      message: error.message,
      backUrl: `/projects/${req.params.name}/phases`
    });
  }
});

app.post('/projects/:name/phases/delete/:phaseId', async (req, res) => {
  try {
    await phaseConfigManager.deletePhaseConfig(req.params.name, req.params.phaseId);
    res.redirect(`/projects/${req.params.name}/phases`);
  } catch (error) {
    logger.error(`Failed to delete phase configuration: ${error.message}`);
    res.status(500).render('error', {
      title: 'Failed to Delete Phase Configuration',
      message: error.message,
      backUrl: `/projects/${req.params.name}/phases`
    });
  }
});

// New route for workflow dashboard
app.get('/workflow-dashboard', async (req, res) => {
  try {
    const workflows = await workflowManager.getAllWorkflows();
    const projects = (await deplaManager.initialize()).projects;
    
    res.render('workflow-dashboard', { workflows, projects });
  } catch (error) {
    logger.error(`Failed to get workflows: ${error.message}`);
    res.status(500).render('error', {
      title: 'Error Loading Workflow Dashboard',
      message: error.message,
      backUrl: '/'
    });
  }
});

app.post('/workflow/start', async (req, res) => {
  try {
    const { projectName, phaseName } = req.body;
    if (!projectName || !phaseName) {
      throw new Error('Project name and phase name are required');
    }
    
    const workflowId = await workflowManager.startWorkflow(projectName, phaseName);
    res.redirect('/workflow-dashboard');
  } catch (error) {
    logger.error(`Failed to start workflow: ${error.message}`);
    res.status(400).render('error', {
      title: 'Failed to Start Workflow',
      message: error.message,
      backUrl: '/workflow-dashboard'
    });
  }
});

app.post('/workflow/:id/stop', async (req, res) => {
  try {
    await workflowManager.stopWorkflow(req.params.id);
    res.redirect('/workflow-dashboard');
  } catch (error) {
    logger.error(`Failed to stop workflow: ${error.message}`);
    res.status(500).render('error', {
      title: 'Failed to Stop Workflow',
      message: error.message,
      backUrl: '/workflow-dashboard'
    });
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
