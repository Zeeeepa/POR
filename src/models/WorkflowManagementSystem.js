// Comprehensive Workflow Management System
const WorkflowManager = require('./WorkflowManager');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const logger = require('./logger'); // Assuming a logger module is available
const AppError = require('./AppError'); // Assuming an AppError module is available
const StatusCodes = require('./StatusCodes'); // Assuming a StatusCodes module is available
const ErrorTypes = require('./ErrorTypes'); // Assuming an ErrorTypes module is available

class WorkflowManagementSystem extends WorkflowManager {
    constructor(options) {
        super(options);
    }

    async createWorkflow(name, steps, options) {
        try {
            const workflowId = uuidv4();
            const workflow = { id: workflowId, name, steps, options };
            this.saveWorkflowState(workflow);
            logger.info(`Workflow created successfully: ${workflowId}`);
            return workflow;
        } catch (error) {
            logger.error(`Failed to create workflow: ${error.message}`);
            throw new AppError('Workflow creation failed', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
        }
    }

    async deleteWorkflow(id) {
        this.activeWorkflows.delete(id);
        fs.unlinkSync(path.join(this.workflowsDir, `${id}.json`));
    }

    async getWorkflow(id) {
        if (this.cache.has(id)) {
            logger.debug(`Cache hit for workflow ${id}`);
            return this.cache.get(id);
        }
        const workflow = this.getWorkflowState(id);
        this.cache.set(id, workflow);
        logger.debug(`Cache miss for workflow ${id}, loaded from state`);
        return workflow;
    }

    async listWorkflows(options) {
        return this.getActiveWorkflows().filter(workflow => {
            return Object.keys(options).every(key => workflow[key] === options[key]);
        });
    }

    async startWorkflow(id, context) {
        return super.startWorkflow(id, context);
    }

    async stopWorkflow(executionId) {
        const workflow = this.getWorkflowState(executionId);
        if (workflow) {
            workflow.status = 'stopped';
            this.saveWorkflowState(workflow);
        }
    }

    async getWorkflowStatus(executionId) {
        const workflow = this.getWorkflowState(executionId);
        return workflow ? workflow.status : null;
    }

    async resumeWorkflow(executionId, stepId) {
        const workflow = this.getWorkflowState(executionId);
        if (workflow && workflow.status === 'paused') {
            workflow.status = 'active';
            workflow.currentPhaseIndex = stepId;
            this.saveWorkflowState(workflow);
            this.startPhase(executionId, stepId);
        }
    }

    async createWorkflowTemplate(name, workflow) {
        this.templateManager.saveTemplate(name, workflow);
    }

    async getWorkflowHistory(id) {
        const workflow = this.getWorkflowState(id);
        return workflow ? workflow.phases : [];
    }
}

module.exports = WorkflowManagementSystem;
