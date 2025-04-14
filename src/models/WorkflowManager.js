/**
 * WorkflowManager.js
 * Manages dynamic workflow configurations, phases and execution
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const logger = require('../utils/logger');
const templateEngine = require('../utils/templateEngine');

class WorkflowManager extends EventEmitter {
  constructor(config = {}) {
    super();
    
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
   * Create default templates if none exist
   */
  createDefaultTemplates() {
    try {
      // Create default templates if none exist
      if (Object.keys(this.templates).length === 0) {
        const defaultTemplates = {
          'feature-implementation': {
            name: 'Feature Implementation',
            description: 'Template for implementing a new feature',
            content: 'Implement the {{featureName}} feature according to the following requirements:\n\n{{requirements}}\n\nConsider the following aspects:\n- Performance\n- Security\n- Maintainability\n- Testability',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          'bug-fix': {
            name: 'Bug Fix',
            description: 'Template for fixing a bug',
            content: 'Fix the bug in {{component}} described as follows:\n\n{{bugDescription}}\n\nSteps to reproduce:\n{{reproductionSteps}}\n\nExpected behavior:\n{{expectedBehavior}}',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          'code-review': {
            name: 'Code Review',
            description: 'Template for code review',
            content: 'Review the following code for {{component}}:\n\n```\n{{code}}\n```\n\nFocus on:\n- Code quality\n- Potential bugs\n- Performance issues\n- Security vulnerabilities',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };
        
        // Save default templates
        for (const [name, data] of Object.entries(defaultTemplates)) {
          this.saveTemplate(name, data);
        }
        
        logger.info('Created default templates');
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to create default templates: ${error.message}`);
      return false;
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
      currentPhase.startedAt = new Date().toISOString();
      
      // Save workflow
      this.saveWorkflow(execution.workflowId, workflow);
      
      // Log phase start
      logger.info(`Executing phase: ${currentPhase.name} (${execution.currentPhaseIndex + 1}/${workflow.phases.length})`);
      this.logExecution(executionId, 'info', `Executing phase: ${currentPhase.name}`);
      
      // Emit phase started event
      this.emit('phaseStarted', {
        executionId,
        workflowId: execution.workflowId,
        projectId: execution.projectId,
        phase: currentPhase
      });
      
      try {
        // Execute phase
        const result = await this.executePhase(executionId, currentPhase);
        
        // Update phase status
        currentPhase.status = 'completed';
        currentPhase.completedAt = new Date().toISOString();
        
        // Add result to execution context
        execution.phaseResults.push({
          phaseId: currentPhase.id,
          result,
          completedAt: new Date().toISOString()
        });
        
        // Log phase completion
        logger.info(`Completed phase: ${currentPhase.name}`);
        this.logExecution(executionId, 'info', `Completed phase: ${currentPhase.name}`);
        
        // Emit phase completed event
        this.emit('phaseCompleted', {
          executionId,
          workflowId: execution.workflowId,
          projectId: execution.projectId,
          phase: currentPhase,
          result
        });
        
        // Move to next phase
        execution.currentPhaseIndex++;
        
        // Save workflow
        this.saveWorkflow(execution.workflowId, workflow);
        
        // Execute next phase
        setImmediate(() => this.executeNextPhase(executionId));
      } catch (error) {
        // Phase execution failed
        currentPhase.status = 'failed';
        currentPhase.failedAt = new Date().toISOString();
        currentPhase.error = error.message;
        
        // Save workflow
        this.saveWorkflow(execution.workflowId, workflow);
        
        // Log phase failure
        logger.error(`Failed to execute phase: ${currentPhase.name} - ${error.message}`);
        this.logExecution(executionId, 'error', `Failed to execute phase: ${currentPhase.name} - ${error.message}`);
        
        // Emit phase failed event
        this.emit('phaseFailed', {
          executionId,
          workflowId: execution.workflowId,
          projectId: execution.projectId,
          phase: currentPhase,
          error: error.message
        });
        
        // Fail the workflow execution
        this.failWorkflowExecution(executionId, error.message);
      }
    } catch (error) {
      logger.error(`Error in executeNextPhase: ${error.message}`);
      this.failWorkflowExecution(executionId, error.message);
    }
  }
  
  /**
   * Execute a specific phase
   * @param {string} executionId - Execution ID
   * @param {object} phase - Phase configuration
   * @returns {Promise<object>} Phase execution result
   */
  async executePhase(executionId, phase) {
    try {
      const execution = this.activeWorkflows[executionId];
      
      // Get template if specified
      let templateContent = null;
      if (phase.templateId && this.templates[phase.templateId]) {
        templateContent = this.processTemplate(phase.templateId, execution.context);
      }
      
      // In a real implementation, this would execute the phase logic
      // For now, we'll just simulate a delay and return a result
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return simulated result
      return {
        success: true,
        output: `Simulated output for phase: ${phase.name}`,
        templateContent,
        executedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Failed to execute phase: ${error.message}`);
      throw error;
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
      
      // Update execution status
      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      
      // Log completion
      logger.info(`Completed workflow execution: ${executionId}`);
      this.logExecution(executionId, 'info', 'Workflow execution completed');
      
      // Emit workflow completed event
      this.emit('workflowCompleted', {
        executionId,
        workflowId: execution.workflowId,
        projectId: execution.projectId,
        results: execution.phaseResults
      });
    } catch (error) {
      logger.error(`Failed to complete workflow execution: ${error.message}`);
    }
  }
  
  /**
   * Fail a workflow execution
   * @param {string} executionId - Execution ID
   * @param {string} errorMessage - Error message
   */
  failWorkflowExecution(executionId, errorMessage) {
    try {
      const execution = this.activeWorkflows[executionId];
      if (!execution) {
        throw new Error(`Execution not found: ${executionId}`);
      }
      
      // Update execution status
      execution.status = 'failed';
      execution.failedAt = new Date().toISOString();
      execution.error = errorMessage;
      
      // Log failure
      logger.error(`Failed workflow execution: ${executionId} - ${errorMessage}`);
      this.logExecution(executionId, 'error', `Workflow execution failed: ${errorMessage}`);
      
      // Emit workflow failed event
      this.emit('workflowFailed', {
        executionId,
        workflowId: execution.workflowId,
        projectId: execution.projectId,
        error: errorMessage
      });
    } catch (error) {
      logger.error(`Error in failWorkflowExecution: ${error.message}`);
    }
  }
  
  /**
   * Log a message to the execution log
   * @param {string} executionId - Execution ID
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   */
  logExecution(executionId, level, message) {
    try {
      const execution = this.activeWorkflows[executionId];
      if (!execution) {
        return;
      }
      
      // Add log entry
      execution.logs.push({
        timestamp: new Date().toISOString(),
        level,
        message
      });
    } catch (error) {
      logger.error(`Failed to log execution: ${error.message}`);
    }
  }
  
  /**
   * Get the status of a workflow execution
   * @param {string} executionId - Execution ID
   * @returns {object} Execution status
   */
  getExecutionStatus(executionId) {
    const execution = this.activeWorkflows[executionId];
    if (!execution) {
      return null;
    }
    
    const workflow = this.getWorkflow(execution.workflowId);
    
    return {
      executionId,
      workflowId: execution.workflowId,
      workflowName: workflow ? workflow.name : 'Unknown',
      projectId: execution.projectId,
      status: execution.status,
      currentPhase: execution.currentPhaseIndex + 1,
      totalPhases: workflow ? workflow.phases.length : 0,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      failedAt: execution.failedAt,
      error: execution.error,
      phaseResults: execution.phaseResults.length
    };
  }
  
  /**
   * Get all active workflow executions
   * @returns {Array<object>} Active executions
   */
  getAllExecutions() {
    return Object.keys(this.activeWorkflows).map(executionId => 
      this.getExecutionStatus(executionId)
    );
  }
}

module.exports = WorkflowManager;
