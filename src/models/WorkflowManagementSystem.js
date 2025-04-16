// Comprehensive Workflow Management System
const WorkflowManager = require('./WorkflowManager');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class WorkflowManagementSystem extends WorkflowManager {
    constructor(options) {
        super(options);
    }

    async createWorkflow(name, steps, options) {
        const workflowId = uuidv4();
        const workflow = { id: workflowId, name, steps, options };
        this.saveWorkflowState(workflow);
        return workflow;
    }

    async deleteWorkflow(id) {
        this.activeWorkflows.delete(id);
        fs.unlinkSync(path.join(this.workflowsDir, `${id}.json`));
    }

    async getWorkflow(id) {
        return this.getWorkflowState(id);
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
