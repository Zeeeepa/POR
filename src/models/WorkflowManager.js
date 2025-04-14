/**
 * WorkflowManager.js
 * Manages dynamic workflow configurations, phases and execution
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const templateEngine = require('../utils/templateEngine');

class WorkflowManager {
  constructor(config = {}) {
    this.configDir = path.join(process.cwd(), 'config');
    this.workflowsDir = path.join(this.configDir, 'workflows');
    this.templatesDir = path.join(this.configDir, 'templates');
    
    // Ensure directories exist
    fs.ensureDirSync(this.workflowsDir);
    fs.ensureDirSync(this.templatesDir);
    
    this.workflows = {};
    this.templates = {};
    this.activeWorkflows = {};
    
    this.loadTemplates();
    this.loadWorkflows();
  }
  
  /**
   * Load all workflow templates
   */
  loadTemplates() {
    try {
      const templateFiles = fs.readdirSync(this.templatesDir).filter(file => file.endsWith('.json'));
      
      this.templates = {};
      for (const file of templateFiles) {
        const templatePath = path.join(this.templatesDir, file);
        const templateName = path.basename(file, '.json');
        
        const templateData = fs.readJsonSync(templatePath);
        this.templates[templateName] = templateData;
      }
      
      logger.info(`Loaded ${Object.keys(this.templates).length} workflow templates`);
    } catch (error) {
      logger.error(`Failed to load workflow templates: ${error.message}`);
    }
  }
  
  /**
   * Load all saved workflows
   */
  loadWorkflows() {
    try {
      const workflowFiles = fs.readdirSync(this.workflowsDir).filter(file => file.endsWith('.json'));
      
      this.workflows = {};
      for (const file of workflowFiles) {
        const workflowPath = path.join(this.workflowsDir, file);
        const workflowId = path.basename(file, '.json');
        
        const workflowData = fs.readJsonSync(workflowPath);
        this.workflows[workflowId] = workflowData;
      }
      
      logger.info(`Loaded ${Object.keys(this.workflows).length} workflows`);
    } catch (error) {
      logger.error(`Failed to load workflows: ${error.message}`);
    }
  }
  
  /**
   * Save a workflow configuration
   * @param {string} workflowId - Workflow ID
   * @param {object} workflowData - Workflow configuration
   */
  saveWorkflow(workflowId, workflowData) {
    try {
      const workflowPath = path.join(this.workflowsDir, `${workflowId}.json`);
      
      // Ensure workflow has a name
      if (!workflowData.name) {
        workflowData.name = `Workflow ${workflowId}`;
      }
      
      // Add metadata
      workflowData.updatedAt = new Date().toISOString();
      if (!workflowData.createdAt) {
        workflowData.createdAt = new Date().toISOString();
      }
      
      // Save to disk
      fs.writeJsonSync(workflowPath, workflowData, { spaces: 2 });
      
      // Update in-memory cache
      this.workflows[workflowId] = workflowData;
      
      logger.info(`Saved workflow: ${workflowData.name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save workflow: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Create a new workflow configuration
   * @param {string} name - Workflow name
   * @param {object} data - Initial workflow data
   * @returns {string} New workflow ID
   */
  createWorkflow(name, data = {}) {
    const workflowId = uuidv4();
    
    const workflowData = {
      id: workflowId,
      name: name,
      description: data.description || '',
      phases: data.phases || [],
      settings: data.settings || {
        defaultDelayBetweenMessages: 2000,
        enableAutoMerge: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.saveWorkflow(workflowId, workflowData);
    return workflowId;
  }
  
  /**
   * Save a template
   * @param {string} templateName - Template name
   * @param {object} templateData - Template configuration
   */
  saveTemplate(templateName, templateData) {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.json`);
      
      // Add metadata
      templateData.updatedAt = new Date().toISOString();
      if (!templateData.createdAt) {
        templateData.createdAt = new Date().toISOString();
      }
      
      // Save to disk
      fs.writeJsonSync(templatePath, templateData, { spaces: 2 });
      
      // Update in-memory cache
      this.templates[templateName] = templateData;
      
      logger.info(`Saved template: ${templateName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to save template: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Create a new workflow phase
   * @param {string} workflowId - Workflow ID
   * @param {object} phaseData - Phase configuration
   * @returns {number} New phase index
   */
  addPhaseToWorkflow(workflowId, phaseData) {
    try {
      if (!this.workflows[workflowId]) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      const workflow = this.workflows[workflowId];
      
      // Create phase object
      const phase = {
        id: uuidv4(),
        name: phaseData.name || `Phase ${workflow.phases.length + 1}`,
        description: phaseData.description || '',
        templateId: phaseData.templateId,
        requiresCodeAnalysis: phaseData.requiresCodeAnalysis === true,
        expectedOutput: phaseData.expectedOutput || '',
        successCriteria: phaseData.successCriteria || '',
        status: 'pending',
        order: workflow.phases.length,
        createdAt: new Date().toISOString()
      };
      
      // Add to workflow
      workflow.phases.push(phase);
      
      // Save workflow
      this.saveWorkflow(workflowId, workflow);
      
      return workflow.phases.length - 1;
    } catch (error) {
      logger.error(`Failed to add phase to workflow: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get a workflow configuration
   * @param {string} workflowId - Workflow ID
   * @returns {object} Workflow configuration
   */
  getWorkflow(workflowId) {
    return this.workflows[workflowId];
  }
  
  /**
   * Get all workflow configurations
   * @returns {object} All workflows
   */
  getAllWorkflows() {
    return { ...this.workflows };
  }
  
  /**
   * Get all templates
   * @returns {object} All templates
   */
  getAllTemplates() {
    return { ...this.templates };
  }
  
  /**
   * Get a template by name
   * @param {string} templateName - Template name
   * @returns {object} Template data
   */
  getTemplate(templateName) {
    return this.templates[templateName];
  }
  
  /**
   * Get template content with variables replaced
   * @param {string} templateName - Template name
   * @param {object} variables - Variables to replace in template
   * @returns {string} Processed template content
   */
  processTemplate(templateName, variables = {}) {
    try {
      const template = this.getTemplate(templateName);
      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }
      
      // Process template with Handlebars
      return templateEngine.renderString(template.content, variables);
    } catch (error) {
      logger.error(`Failed to process template: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Start workflow execution for a project
   * @param {string} workflowId - Workflow ID
   * @param {string} projectId - Project ID
   * @param {object} initialContext - Initial context data
   * @returns {string} Execution ID
   */
  startWorkflowExecution(workflowId, projectId, initialContext = {}) {
    try {
      // Get workflow config
      const workflow = this.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      // Check if workflow has phases
      if (!workflow.phases || workflow.phases.length === 0) {
        throw new Error('Workflow has no phases to execute');
      }
      
      // Create execution context
      const executionId = uuidv4();
      const executionContext = {
        executionId,
        workflowId,
        projectId,
        currentPhaseIndex: 0,
        status: 'running',
        startedAt: new Date().toISOString(),
        context: {
          ...initialContext,
          projectId,
          workflowId,
          executionId
        },
        phaseResults: [],
        logs: []
      };
      
      // Save to active workflows
      this.activeWorkflows[executionId] = executionContext;
      
      // Log start
      logger.info(`Started workflow execution: ${workflow.name} for project ${projectId}`);
      this.logExecution(executionId, 'info', 'Workflow execution started');
      
      // Start executing first phase
      this.executeNextPhase(executionId);
      
      return executionId;
    } catch (error) {
      logger.error(`Failed to start workflow execution: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Execute the next phase in a workflow
   * @param {string} executionId - Execution ID
   */
  async executeNextPhase(executionId) {
    try {
      const execution = this.activeWorkflows[executionId];
      if (!execution) {
        throw new Error(`Execution not found: ${executionId}`);
      }
      
      // Get workflow and current phase
      const workflow = this.getWorkflow(execution.workflowId);
      const currentPhase = workflow.phases[execution.currentPhaseIndex];
      
      if (!currentPhase) {
        // All phases completed
        this.completeWorkflowExecution(executionId);
        return;
      }
      
      // Update phase status
      currentPhase.status = 'running';
      this.saveWorkflow(execution.workflowId, workflow);
      
      // Log phase start
      this.logExecution(executionId, 'info', `Starting phase: ${currentPhase.name}`);
      
      // Get template
      const template = this.getTemplate(currentPhase.templateId);
      if (!template) {
        throw new Error(`Template not found: ${currentPhase.templateId}`);
      }
      
      // Process template with context
      const processedContent = this.processTemplate(currentPhase.templateId, execution.context);
      
      // Add phase to results
      execution.phaseResults.push({
        phaseId: currentPhase.id,
        status: 'running',
        startedAt: new Date().toISOString()
      });
      
      // Handle based on phase type
      if (currentPhase.requiresCodeAnalysis) {
        // This is a concurrent phase - will be processed differently
        this.logExecution(executionId, 'info', 'Phase requires code analysis - creating components');
        
        // For now, we'll just simulate this being handled by another component
        this.logExecution(executionId, 'info', 'Concurrent component handling delegated to external system');
        
        // In a real implementation, this would send the template content to a system
        // that would parse the output and create component-specific messages
      } else {
        // Regular phase - send the template directly
        this.logExecution(executionId, 'info', 'Sending phase template to automation system');
        
        // In a real implementation, this would actually send the message
        // For now, we'll just log it
        this.logExecution(executionId, 'debug', `Template content: ${processedContent.substring(0, 100)}...`);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update current phase result
        const currentPhaseResultIndex = execution.phaseResults.length - 1;
        execution.phaseResults[currentPhaseResultIndex].status = 'completed';
        execution.phaseResults[currentPhaseResultIndex].completedAt = new Date().toISOString();
        
        // Move to next phase
        execution.currentPhaseIndex++;
        
        // Continue to next phase
        this.executeNextPhase(executionId);
      }
    } catch (error) {
      logger.error(`Failed to execute phase: ${error.message}`);
      this.logExecution(executionId, 'error', `Phase execution failed: ${error.message}`);
      
      // Update execution status
      if (this.activeWorkflows[executionId]) {
        this.activeWorkflows[executionId].status = 'failed';
      }
    }
  }
  
  /**
   * Complete a workflow execution
   * @param {string} executionId - Execution ID
   */
  completeWorkflowExecution(executionId) {
    try {
      const execution = this.activeWorkflows[executionId];
      if (!execution) {
        throw new Error(`Execution not found: ${executionId}`);
      }
      
      // Update status
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      
      // Log completion
      this.logExecution(executionId, 'info', 'Workflow execution completed successfully');
      
      // In a real implementation, we might save execution history to a database
      
      // Remove from active workflows after a delay
      setTimeout(() => {
        delete this.activeWorkflows[executionId];
      }, 60000); // Keep in memory for 1 minute for reference
      
      return true;
    } catch (error) {
      logger.error(`Failed to complete workflow execution: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Add a log entry to an execution
   * @param {string} executionId - Execution ID
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   */
  logExecution(executionId, level, message) {
    try {
      if (!this.activeWorkflows[executionId]) {
        return false;
      }
      
      this.activeWorkflows[executionId].logs.push({
        timestamp: new Date().toISOString(),
        level,
        message
      });
      
      // Also log to system logger
      logger[level](`[Execution ${executionId}] ${message}`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to log execution: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get the status of a workflow execution
   * @param {string} executionId - Execution ID
   * @returns {object} Execution status
   */
  getExecutionStatus(executionId) {
    return this.activeWorkflows[executionId];
  }
  
  /**
   * Create default workflow templates
   */
  createDefaultTemplates() {
    // Structure Analysis Template
    this.saveTemplate('structure-analysis', {
      name: 'Structure Analysis',
      description: 'Analyzes the current codebase structure',
      content: '{{projectUrl}} - View this file and properly analyze code contexts from whole project - GenerateSTRUCTURE\'current\'.promptp',
      type: 'initialization',
      createdAt: new Date().toISOString()
    });
    
    // Feature Suggestion Template
    this.saveTemplate('feature-suggestion', {
      name: 'Feature Suggestion',
      description: 'Generates suggested features for the project',
      content: '{{projectUrl}} - View this file and properly analyze code contexts from whole project and generate suggested feature list- View explicitly: generateSTRUCTURE\'suggested\'.prompt',
      type: 'initialization',
      createdAt: new Date().toISOString()
    });
    
    // Step Generation Template
    this.saveTemplate('step-generation', {
      name: 'Step Generation',
      description: 'Creates implementation steps with concurrent components',
      content: 'Carefully analyze text contents from - GenerateSTEP.prompt and accordingly create STEPS.md instructions with maximum concurrently developable components as shown in examples',
      type: 'initialization',
      createdAt: new Date().toISOString()
    });
    
    // Feature Implementation Template
    this.saveTemplate('feature-implementation', {
      name: 'Feature Implementation',
      description: 'Template for implementing a specific feature',
      content: 'In accordance to best developmental methods and considering all correspondent code context -> Implement {{featureName}}\n\n{{featureDescription}}\n\n{{featureRequirements}}\n\nhave in mind that there are other concurrently developed correspondent features therefore you should carefully align with requirements of the feature',
      type: 'implementation',
      createdAt: new Date().toISOString()
    });
    
    // Feature Validation Template
    this.saveTemplate('feature-validation', {
      name: 'Feature Validation',
      description: 'Validates implemented features for a phase',
      content: 'Properly analyze if features from phase {{phaseNumber}} fully correspond to the requirements of the phase and if the created code context does not have any code issues, wrongly set parameters or wrong initializations anywhere - if it does, propose a PR with fixes',
      type: 'validation',
      createdAt: new Date().toISOString()
    });
    
    logger.info('Created default workflow templates');
  }
}

module.exports = WorkflowManager; 