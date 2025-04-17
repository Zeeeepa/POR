const EventEmitter = require('events');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { deepmerge } = require('deepmerge');
const { validateWorkflow } = require('../utils/validation');
const { logger } = require('../utils/logger');

// WorkflowManager class for handling workflow operations
class WorkflowManager extends EventEmitter {
  constructor() {
    super();
    this.workflows = new Map();
    this.workflowsPath = path.join(process.cwd(), 'workflows');
    this.initializeWorkflowDirectory();
  }

  // Initialize workflow directory
  initializeWorkflowDirectory() {
    try {
      fs.ensureDirSync(this.workflowsPath);
    } catch (error) {
      logger.error('Failed to initialize workflow directory:', error);
      throw error;
    }
  }

  // Create a new workflow
  async createWorkflow(workflowData) {
    try {
      const workflowId = uuidv4();
      const workflow = {
        id: workflowId,
        ...workflowData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await validateWorkflow(workflow);
      
      const filePath = path.join(this.workflowsPath, `${workflowId}.json`);
      await fs.writeJson(filePath, workflow, { spaces: 2 });
      
      this.workflows.set(workflowId, workflow);
      this.emit('workflowCreated', workflow);
      
      return workflow;
    } catch (error) {
      logger.error('Failed to create workflow:', error);
      throw error;
    }
  }

  // Get a workflow by ID
  async getWorkflow(workflowId) {
    try {
      if (this.workflows.has(workflowId)) {
        return this.workflows.get(workflowId);
      }

      const filePath = path.join(this.workflowsPath, `${workflowId}.json`);
      const workflow = await fs.readJson(filePath);
      this.workflows.set(workflowId, workflow);
      
      return workflow;
    } catch (error) {
      logger.error(`Failed to get workflow ${workflowId}:`, error);
      throw error;
    }
  }

  // Update an existing workflow
  async updateWorkflow(workflowId, updates) {
    try {
      const existingWorkflow = await this.getWorkflow(workflowId);
      const updatedWorkflow = deepmerge(existingWorkflow, {
        ...updates,
        updatedAt: new Date().toISOString()
      });

      await validateWorkflow(updatedWorkflow);
      
      const filePath = path.join(this.workflowsPath, `${workflowId}.json`);
      await fs.writeJson(filePath, updatedWorkflow, { spaces: 2 });
      
      this.workflows.set(workflowId, updatedWorkflow);
      this.emit('workflowUpdated', updatedWorkflow);
      
      return updatedWorkflow;
    } catch (error) {
      logger.error(`Failed to update workflow ${workflowId}:`, error);
      throw error;
    }
  }

  // Delete a workflow
  async deleteWorkflow(workflowId) {
    try {
      const filePath = path.join(this.workflowsPath, `${workflowId}.json`);
      await fs.remove(filePath);
      
      this.workflows.delete(workflowId);
      this.emit('workflowDeleted', workflowId);
      
      return true;
    } catch (error) {
      logger.error(`Failed to delete workflow ${workflowId}:`, error);
      throw error;
    }
  }

  // List all workflows
  async listWorkflows() {
    try {
      const files = await fs.readdir(this.workflowsPath);
      const workflows = await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(async file => {
            const workflowId = path.basename(file, '.json');
            return await this.getWorkflow(workflowId);
          })
      );
      
      return workflows;
    } catch (error) {
      logger.error('Failed to list workflows:', error);
      throw error;
    }
  }
}

module.exports = WorkflowManager;
