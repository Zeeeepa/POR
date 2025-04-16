const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { WorkflowError, ValidationError } = require('../utils/errors');
const { validateWorkflow, validateTemplate } = require('../utils/validators');
const { cacheManager } = require('../utils/cache');
const logger = require('../utils/logger');

class WorkflowManagementSystem extends EventEmitter {
  constructor() {
    super();
    this.workflows = new Map();
    this.executions = new Map();
    this.templates = new Map();
    this.cache = cacheManager;
    this.logger = logger;
  }

  /**
   * Create a new workflow
   * @param {string} name - Workflow name
   * @param {Array} steps - Array of workflow steps
   * @param {Object} options - Additional workflow options
   * @returns {string} Workflow ID
   */
  async createWorkflow(name, steps, options = {}) {
    try {
      const workflow = {
        id: uuidv4(),
        name,
        steps: steps.map(step => ({
          id: uuidv4(),
          ...step
        })),
        options,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await validateWorkflow(workflow);
      this.workflows.set(workflow.id, workflow);
      this.cache.set(`workflow:${workflow.id}`, workflow);
      this.logger.info(`Created workflow: ${workflow.id}`);
      
      return workflow.id;
    } catch (error) {
      this.logger.error(`Error creating workflow: ${error.message}`);
      throw new WorkflowError(`Failed to create workflow: ${error.message}`);
    }
  }

  /**
   * Delete a workflow
   * @param {string} id - Workflow ID
   */
  async deleteWorkflow(id) {
    try {
      if (!this.workflows.has(id)) {
        throw new ValidationError(`Workflow ${id} not found`);
      }

      this.workflows.delete(id);
      this.cache.delete(`workflow:${id}`);
      this.logger.info(`Deleted workflow: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting workflow: ${error.message}`);
      throw new WorkflowError(`Failed to delete workflow: ${error.message}`);
    }
  }

  /**
   * Get a workflow by ID
   * @param {string} id - Workflow ID
   * @returns {Object} Workflow object
   */
  async getWorkflow(id) {
    try {
      const cached = this.cache.get(`workflow:${id}`);
      if (cached) return cached;

      const workflow = this.workflows.get(id);
      if (!workflow) {
        throw new ValidationError(`Workflow ${id} not found`);
      }

      this.cache.set(`workflow:${id}`, workflow);
      return workflow;
    } catch (error) {
      this.logger.error(`Error getting workflow: ${error.message}`);
      throw new WorkflowError(`Failed to get workflow: ${error.message}`);
    }
  }

  /**
   * List all workflows with filtering options
   * @param {Object} options - Filter options
   * @returns {Array} Array of workflows
   */
  async listWorkflows(options = {}) {
    try {
      let workflows = Array.from(this.workflows.values());

      if (options.name) {
        workflows = workflows.filter(w => w.name.includes(options.name));
      }
      if (options.status) {
        workflows = workflows.filter(w => w.status === options.status);
      }
      if (options.createdAfter) {
        workflows = workflows.filter(w => w.createdAt > new Date(options.createdAfter));
      }

      return workflows;
    } catch (error) {
      this.logger.error(`Error listing workflows: ${error.message}`);
      throw new WorkflowError(`Failed to list workflows: ${error.message}`);
    }
  }

  /**
   * Start a workflow execution
   * @param {string} id - Workflow ID
   * @param {Object} context - Execution context
   * @returns {string} Execution ID
   */
  async startWorkflow(id, context = {}) {
    try {
      const workflow = await this.getWorkflow(id);
      const execution = {
        id: uuidv4(),
        workflowId: id,
        context,
        status: 'running',
        currentStep: 0,
        steps: workflow.steps.map(step => ({
          ...step,
          status: 'pending',
          startTime: null,
          endTime: null,
          error: null
        })),
        startTime: new Date(),
        endTime: null,
        error: null
      };

      this.executions.set(execution.id, execution);
      this.emit('workflowStarted', { executionId: execution.id, workflowId: id });
      
      // Start executing the first step
      await this._executeStep(execution.id, 0);
      
      return execution.id;
    } catch (error) {
      this.logger.error(`Error starting workflow: ${error.message}`);
      throw new WorkflowError(`Failed to start workflow: ${error.message}`);
    }
  }

  /**
   * Stop a workflow execution
   * @param {string} executionId - Execution ID
   */
  async stopWorkflow(executionId) {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw new ValidationError(`Execution ${executionId} not found`);
      }

      execution.status = 'stopped';
      execution.endTime = new Date();
      this.executions.set(executionId, execution);
      this.emit('workflowStopped', { executionId });
    } catch (error) {
      this.logger.error(`Error stopping workflow: ${error.message}`);
      throw new WorkflowError(`Failed to stop workflow: ${error.message}`);
    }
  }

  /**
   * Get workflow execution status
   * @param {string} executionId - Execution ID
   * @returns {Object} Execution status
   */
  async getWorkflowStatus(executionId) {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw new ValidationError(`Execution ${executionId} not found`);
      }

      return {
        id: execution.id,
        status: execution.status,
        currentStep: execution.currentStep,
        steps: execution.steps.map(step => ({
          id: step.id,
          name: step.name,
          status: step.status,
          startTime: step.startTime,
          endTime: step.endTime,
          error: step.error
        })),
        startTime: execution.startTime,
        endTime: execution.endTime,
        error: execution.error
      };
    } catch (error) {
      this.logger.error(`Error getting workflow status: ${error.message}`);
      throw new WorkflowError(`Failed to get workflow status: ${error.message}`);
    }
  }

  /**
   * Resume a paused workflow
   * @param {string} executionId - Execution ID
   * @param {string} stepId - Step ID to resume from
   */
  async resumeWorkflow(executionId, stepId) {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw new ValidationError(`Execution ${executionId} not found`);
      }

      const stepIndex = execution.steps.findIndex(step => step.id === stepId);
      if (stepIndex === -1) {
        throw new ValidationError(`Step ${stepId} not found in execution ${executionId}`);
      }

      execution.status = 'running';
      await this._executeStep(executionId, stepIndex);
    } catch (error) {
      this.logger.error(`Error resuming workflow: ${error.message}`);
      throw new WorkflowError(`Failed to resume workflow: ${error.message}`);
    }
  }

  /**
   * Create a workflow template
   * @param {string} name - Template name
   * @param {Object} workflow - Workflow configuration
   * @returns {string} Template ID
   */
  async createWorkflowTemplate(name, workflow) {
    try {
      const template = {
        id: uuidv4(),
        name,
        workflow,
        createdAt: new Date()
      };

      await validateTemplate(template);
      this.templates.set(template.id, template);
      this.cache.set(`template:${template.id}`, template);
      
      return template.id;
    } catch (error) {
      this.logger.error(`Error creating workflow template: ${error.message}`);
      throw new WorkflowError(`Failed to create workflow template: ${error.message}`);
    }
  }

  /**
   * Get workflow execution history
   * @param {string} id - Workflow ID
   * @returns {Array} Array of execution histories
   */
  async getWorkflowHistory(id) {
    try {
      const executions = Array.from(this.executions.values())
        .filter(execution => execution.workflowId === id)
        .map(execution => ({
          id: execution.id,
          status: execution.status,
          startTime: execution.startTime,
          endTime: execution.endTime,
          error: execution.error,
          stepCount: execution.steps.length,
          completedSteps: execution.steps.filter(step => step.status === 'completed').length
        }));

      return executions;
    } catch (error) {
      this.logger.error(`Error getting workflow history: ${error.message}`);
      throw new WorkflowError(`Failed to get workflow history: ${error.message}`);
    }
  }

  /**
   * Execute a workflow step
   * @private
   * @param {string} executionId - Execution ID
   * @param {number} stepIndex - Step index
   */
  async _executeStep(executionId, stepIndex) {
    const execution = this.executions.get(executionId);
    const step = execution.steps[stepIndex];

    try {
      step.status = 'running';
      step.startTime = new Date();
      execution.currentStep = stepIndex;
      this.executions.set(executionId, execution);

      // Execute step logic
      await this._processStep(step, execution.context);

      step.status = 'completed';
      step.endTime = new Date();

      // Check if there are more steps
      if (stepIndex < execution.steps.length - 1) {
        await this._executeStep(executionId, stepIndex + 1);
      } else {
        execution.status = 'completed';
        execution.endTime = new Date();
        this.emit('workflowCompleted', { executionId });
      }
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      step.endTime = new Date();
      execution.status = 'failed';
      execution.error = error.message;
      execution.endTime = new Date();
      this.emit('workflowFailed', { executionId, error: error.message });
    }

    this.executions.set(executionId, execution);
  }

  /**
   * Process a workflow step
   * @private
   * @param {Object} step - Step configuration
   * @param {Object} context - Execution context
   */
  async _processStep(step, context) {
    // Implementation will vary based on step type
    switch (step.type) {
      case 'function':
        if (typeof step.function === 'function') {
          await step.function(context);
        }
        break;
      case 'parallel':
        await Promise.all(step.steps.map(s => this._processStep(s, context)));
        break;
      case 'conditional':
        if (step.condition(context)) {
          await this._processStep(step.then, context);
        } else if (step.else) {
          await this._processStep(step.else, context);
        }
        break;
      default:
        throw new Error(`Unsupported step type: ${step.type}`);
    }
  }
}

module.exports = WorkflowManagementSystem;
