cat > src/models/WorkflowManager.js << 'EOL'
/**
 * Workflow Manager
 * Manages workflow execution and state
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
class WorkflowManager extends EventEmitter {
    /**
     * Initialize the Workflow Manager
     * @param {Object} options - Configuration options
     * @param {Object} options.phaseConfigManager - Phase configuration manager instance
     * @param {Object} options.templateManager - Template manager instance
     * @param {Object} options.cursorPositionManager - Cursor position manager instance
     * @param {string} options.workflowsDir - Directory to store workflow state
     */
    constructor(options = {}) {
        super();
        this.phaseConfigManager = options.phaseConfigManager;
        this.templateManager = options.templateManager;
        this.cursorPositionManager = options.cursorPositionManager;
        this.workflowsDir = options.workflowsDir || path.join(process.cwd(), 'data', 'workflow-state');
        this.activeWorkflows = new Map();
        this.workflowQueue = [];
        
        // Ensure workflow state directory exists
        if (!fs.existsSync(this.workflowsDir)) {
            fs.mkdirSync(this.workflowsDir, { recursive: true });
        }
        
        // Load active workflows
        this.loadActiveWorkflows();
    }
    
    /**
     * Load active workflows from the workflow state directory
     */
    loadActiveWorkflows() {
        try {
            const files = fs.readdirSync(this.workflowsDir);
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const workflowPath = path.join(this.workflowsDir, file);
                    const workflowState = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
                    
                    // Only load active or paused workflows
                    if (workflowState.status === 'active' || workflowState.status === 'paused') {
                        this.activeWorkflows.set(workflowState.id, workflowState);
                    }
                }
            }
            
            console.log(`Loaded ${this.activeWorkflows.size} active workflows`);
        } catch (error) {
            console.error('Error loading active workflows:', error);
        }
    }
    
    /**
     * Save workflow state to file
     * @param {Object} workflowState - Workflow state to save
     */
    saveWorkflowState(workflowState) {
        try {
            const workflowPath = path.join(this.workflowsDir, `${workflowState.id}.json`);
            fs.writeFileSync(workflowPath, JSON.stringify(workflowState, null, 2));
        } catch (error) {
            console.error(`Error saving workflow state for ${workflowState.id}:`, error);
        }
    }
    
    /**
     * Start a workflow
     * @param {string} workflowId - Workflow ID
     * @param {Object} options - Workflow options
     * @returns {Object} - Workflow state
     */
    startWorkflow(workflowId, options = {}) {
        // Get workflow configuration
        const workflow = this.phaseConfigManager.getWorkflowById(workflowId);
        
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }
        
        // Check if workflow is already active
        if (this.activeWorkflows.has(workflowId)) {
            throw new Error(`Workflow ${workflowId} is already active`);
        }
        
        // Get workflow phases
        const phases = this.phaseConfigManager.getWorkflowPhases(workflowId);
        
        if (phases.length === 0) {
            throw new Error(`Workflow ${workflowId} has no phases`);
        }
        
        // Create workflow state
        const workflowState = {
            id: workflowId,
            name: workflow.name,
            description: workflow.description,
            projectId: workflow.projectId,
            status: 'active',
            currentPhaseIndex: 0,
            phases: phases.map(phase => ({
                id: phase.id,
                name: phase.name,
                type: phase.type,
                status: 'pending',
                order: phase.order,
                startedAt: null,
                completedAt: null,
                result: null,
                error: null
            })),
            options: {
                autoAdvance: options.autoAdvance !== undefined ? options.autoAdvance : true,
                variables: options.variables || {},
                ...options
            },
            progress: 0,
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedAt: null,
            result: null,
            error: null
        };
        
        // Add to active workflows
        this.activeWorkflows.set(workflowId, workflowState);
        
        // Save workflow state
        this.saveWorkflowState(workflowState);
        
        // Start first phase
        this.startPhase(workflowId, 0);
        
        // Emit workflow started event
        this.emit('workflowStarted', workflowState);
        
        return workflowState;
    }
    
    /**
     * Start a workflow phase
     * @param {string} workflowId - Workflow ID
     * @param {number} phaseIndex - Phase index
     * @returns {Object} - Updated workflow state
     */
    startPhase(workflowId, phaseIndex) {
        const workflowState = this.activeWorkflows.get(workflowId);
        
        if (!workflowState) {
            throw new Error(`Workflow ${workflowId} not found or not active`);
        }
        
        if (phaseIndex < 0 || phaseIndex >= workflowState.phases.length) {
            throw new Error(`Invalid phase index ${phaseIndex}`);
        }
        
        // Get phase
        const phase = workflowState.phases[phaseIndex];
        
        // Update phase status
        phase.status = 'active';
        phase.startedAt = new Date().toISOString();
        
        // Update workflow state
        workflowState.currentPhaseIndex = phaseIndex;
        workflowState.updatedAt = new Date().toISOString();
        
        // Save workflow state
        this.saveWorkflowState(workflowState);
        
        // Get full phase configuration
        const phaseConfig = this.phaseConfigManager.getPhaseById(phase.id);
        
        // Execute phase based on type
        switch (phaseConfig.type) {
            case 'manual':
                // Manual phases require user interaction
                this.emit('phaseStarted', workflowState, phase, phaseConfig);
                break;
                
            case 'automated':
                // Automated phases execute automatically
                this._executeAutomatedPhase(workflowState, phase, phaseConfig);
                break;
                
            case 'conditional':
                // Conditional phases evaluate conditions
                this._evaluateConditionalPhase(workflowState, phase, phaseConfig);
                break;
                
            case 'approval':
                // Approval phases require user approval
                this.emit('approvalRequired', workflowState, phase, phaseConfig);
                break;
                
            default:
                // Unknown phase type
                this.completePhase(workflowId, phaseIndex, {
                    success: false,
                    error: `Unknown phase type: ${phaseConfig.type}`
                });
        }
        
        return workflowState;
    }
    
    /**
     * Complete a workflow phase
     * @param {string} workflowId - Workflow ID
     * @param {number} phaseIndex - Phase index
     * @param {Object} result - Phase result
     * @returns {Object} - Updated workflow state
     */
    completePhase(workflowId, phaseIndex, result = {}) {
        const workflowState = this.activeWorkflows.get(workflowId);
        
        if (!workflowState) {
            throw new Error(`Workflow ${workflowId} not found or not active`);
        }
        
        if (phaseIndex < 0 || phaseIndex >= workflowState.phases.length) {
            throw new Error(`Invalid phase index ${phaseIndex}`);
        }
        
        // Get phase
        const phase = workflowState.phases[phaseIndex];
        
        // Update phase status
        phase.status = result.success !== false ? 'completed' : 'failed';
        phase.completedAt = new Date().toISOString();
        phase.result = result.data || null;
        phase.error = result.error || null;
        
        // Update workflow progress
        workflowState.progress = Math.round((phaseIndex + 1) / workflowState.phases.length * 100);
        workflowState.updatedAt = new Date().toISOString();
        
        // Save workflow state
        this.saveWorkflowState(workflowState);
        
        // Emit phase completed event
        this.emit('phaseCompleted', workflowState, phase, result);
        
        // Check if this is the last phase
        if (phaseIndex === workflowState.phases.length - 1) {
            // Complete workflow
            this.completeWorkflow(workflowId, {
                success: result.success !== false,
                data: result.data || null,
                error: result.error || null
            });
        } else if (workflowState.options.autoAdvance && result.success !== false) {
            // Auto-advance to next phase
            this.startPhase(workflowId, phaseIndex + 1);
        }
        
        return workflowState;
    }
    
    /**
     * Complete a workflow
     * @param {string} workflowId - Workflow ID
     * @param {Object} result - Workflow result
     * @returns {Object} - Updated workflow state
     */
    completeWorkflow(workflowId, result = {}) {
        const workflowState = this.activeWorkflows.get(workflowId);
        
        if (!workflowState) {
            throw new Error(`Workflow ${workflowId} not found or not active`);
        }
        
        // Update workflow status
        workflowState.status = result.success !== false ? 'completed' : 'failed';
        workflowState.completedAt = new Date().toISOString();
        workflowState.result = result.data || null;
        workflowState.error = result.error || null;
        workflowState.progress = 100;
        workflowState.updatedAt = new Date().toISOString();
        
        // Save workflow state
        this.saveWorkflowState(workflowState);
        
        // Remove from active workflows
        this.activeWorkflows.delete(workflowId);
        
        // Emit workflow completed event
        this.emit('workflowCompleted', workflowState, result);
        
        // Process next workflow in queue
        this._processQueue();
        
        return workflowState;
    }
    
    /**
     * Pause a workflow
     * @param {string} workflowId - Workflow ID
     * @returns {Object} - Updated workflow state
     */
    pauseWorkflow(workflowId) {
        const workflowState = this.activeWorkflows.get(workflowId);
        
        if (!workflowState) {
            throw new Error(`Workflow ${workflowId} not found or not active`);
        }
        
        // Update workflow status
        workflowState.status = 'paused';
        workflowState.pausedAt = new Date().toISOString();
        workflowState.updatedAt = new Date().toISOString();
        
        // Save workflow state
        this.saveWorkflowState(workflowState);
        
        // Emit workflow paused event
        this.emit('workflowPaused', workflowState);
        
        return workflowState;
    }
    
    /**
     * Resume a workflow
     * @param {string} workflowId - Workflow ID
     * @returns {Object} - Updated workflow state
     */
    resumeWorkflow(workflowId) {
        const workflowState = this.activeWorkflows.get(workflowId);
        
        if (!workflowState) {
            throw new Error(`Workflow ${workflowId} not found or not active`);
        }
        
        if (workflowState.status !== 'paused') {
            throw new Error(`Workflow ${workflowId} is not paused`);
        }
        
        // Update workflow status
        workflowState.status = 'active';
        workflowState.resumedAt = new Date().toISOString();
        workflowState.updatedAt = new Date().toISOString();
        
        // Save workflow state
        this.saveWorkflowState(workflowState);
        
        // Emit workflow resumed event
        this.emit('workflowResumed', workflowState);
        
        // Resume current phase
        const currentPhaseIndex = workflowState.currentPhaseIndex;
        const currentPhase = workflowState.phases[currentPhaseIndex];
        
        if (currentPhase.status === 'active') {
            // Get full phase configuration
            const phaseConfig = this.phaseConfigManager.getPhaseById(currentPhase.id);
            
            // Re-emit phase started event
            this.emit('phaseStarted', workflowState, currentPhase, phaseConfig);
        }
        
        return workflowState;
    }
    
    /**
     * Cancel a workflow
     * @param {string} workflowId - Workflow ID
     * @param {string} reason - Cancellation reason
     * @returns {Object} - Updated workflow state
     */
    cancelWorkflow(workflowId, reason = 'User cancelled') {
        const workflowState = this.activeWorkflows.get(workflowId);
        
        if (!workflowState) {
            throw new Error(`Workflow ${workflowId} not found or not active`);
        }
        
        // Update workflow status
        workflowState.status = 'cancelled';
        workflowState.cancelledAt = new Date().toISOString();
        workflowState.error = reason;
        workflowState.updatedAt = new Date().toISOString();
        
        // Save workflow state
        this.saveWorkflowState(workflowState);
        
        // Remove from active workflows
        this.activeWorkflows.delete(workflowId);
        
        // Emit workflow cancelled event
        this.emit('workflowCancelled', workflowState, reason);
        
        // Process next workflow in queue
        this._processQueue();
        
        return workflowState;
    }
    
    /**
     * Queue a workflow for execution
     * @param {string} workflowId - Workflow ID
     * @param {Object} options - Workflow options
     * @returns {Object} - Queue entry
     */
    queueWorkflow(workflowId, options = {}) {
        // Get workflow configuration
        const workflow = this.phaseConfigManager.getWorkflowById(workflowId);
        
        if (!workflow) {
            throw new Error(`Workflow ${workflowId} not found`);
        }
        
        // Create queue entry
        const queueEntry = {
            id: uuidv4(),
            workflowId,
            options,
            queuedAt: new Date().toISOString()
        };
        
        // Add to queue
        this.workflowQueue.push(queueEntry);
        
        // Emit workflow queued event
        this.emit('workflowQueued', queueEntry, workflow);
        
        // Process queue
        this._processQueue();
        
        return queueEntry;
    }
    
    /**
     * Process the workflow queue
     * @private
     */
    _processQueue() {
        // Check if there are workflows in the queue
        if (this.workflowQueue.length === 0) {
            return;
        }
        
        // Get next workflow from queue
        const queueEntry = this.workflowQueue.shift();
        
        // Start workflow
        try {
            this.startWorkflow(queueEntry.workflowId, queueEntry.options);
        } catch (error) {
            console.error(`Error starting queued workflow ${queueEntry.workflowId}:`, error);
            
            // Emit workflow error event
            this.emit('workflowError', queueEntry, error);
            
            // Process next workflow in queue
            this._processQueue();
        }
    }
    
    /**
     * Execute an automated phase
     * @private
     * @param {Object} workflowState - Workflow state
     * @param {Object} phase - Phase state
     * @param {Object} phaseConfig - Phase configuration
     */
    _executeAutomatedPhase(workflowState, phase, phaseConfig) {
        try {
            // Execute actions
            const actions = phaseConfig.actions || [];
            const results = [];
            
            // Process each action
            for (const action of actions) {
                const actionResult = this._executeAction(action, workflowState);
                results.push(actionResult);
            }
            
            // Complete phase
            this.completePhase(workflowState.id, workflowState.currentPhaseIndex, {
                success: true,
                data: results
            });
        } catch (error) {
            console.error(`Error executing automated phase ${phase.id}:`, error);
            
            // Complete phase with error
            this.completePhase(workflowState.id, workflowState.currentPhaseIndex, {
                success: false,
                error: error.message
            });
        }
    }
    
    /**
     * Evaluate a conditional phase
     * @private
     * @param {Object} workflowState - Workflow state
     * @param {Object} phase - Phase state
     * @param {Object} phaseConfig - Phase configuration
     */
    _evaluateConditionalPhase(workflowState, phase, phaseConfig) {
        try {
            // Get conditions
            const conditions = phaseConfig.conditions || {};
            
            // Evaluate conditions
            const result = this._evaluateConditions(conditions, workflowState);
            
            // Complete phase
            this.completePhase(workflowState.id, workflowState.currentPhaseIndex, {
                success: true,
                data: {
                    result,
                    conditions
                }
            });
        } catch (error) {
            console.error(`Error evaluating conditional phase ${phase.id}:`, error);
            
            // Complete phase with error
            this.completePhase(workflowState.id, workflowState.currentPhaseIndex, {
                success: false,
                error: error.message
            });
        }
    }
    
    /**
     * Execute an action
     * @private
     * @param {Object} action - Action to execute
     * @param {Object} workflowState - Workflow state
     * @returns {Object} - Action result
     */
    _executeAction(action, workflowState) {
        // Process variables in action
        const processedAction = this._processVariables(action, workflowState.options.variables);
        
        // Execute action based on type
        switch (processedAction.type) {
            case 'template':
                return this._executeTemplateAction(processedAction, workflowState);
                
            case 'cursor':
                return this._executeCursorAction(processedAction, workflowState);
                
            case 'wait':
                return this._executeWaitAction(processedAction, workflowState);
                
            case 'script':
                return this._executeScriptAction(processedAction, workflowState);
                
            default:
                throw new Error(`Unknown action type: ${processedAction.type}`);
        }
    }
    
    /**
     * Execute a template action
     * @private
     * @param {Object} action - Template action
     * @param {Object} workflowState - Workflow state
     * @returns {Object} - Action result
     */
    _executeTemplateAction(action, workflowState) {
        // Get template
        const templateId = action.templateId;
        const variables = action.variables || workflowState.options.variables || {};
        
        // Process template
        const processedContent = this.templateManager.processTemplate(templateId, variables);
        
        if (!processedContent) {
            throw new Error(`Template ${templateId} not found or processing failed`);
        }
        
        return {
            type: 'template',
            templateId,
            content: processedContent
        };
    }
    
    /**
     * Execute a cursor action
     * @private
     * @param {Object} action - Cursor action
     * @param {Object} workflowState - Workflow state
     * @returns {Object} - Action result
     */
    _executeCursorAction(action, workflowState) {
        const positionId = action.positionId;
        const actionType = action.actionType || 'move';
        
        switch (actionType) {
            case 'move':
                // Move cursor to position
                const moved = this.cursorPositionManager.moveCursorToPosition(positionId, action.options);
                
                if (!moved) {
                    throw new Error(`Failed to move cursor to position ${positionId}`);
                }
                
                return {
                    type: 'cursor',
                    actionType: 'move',
                    positionId,
                    success: true
                };
                
            case 'click':
                // Click at position
                const clicked = this.cursorPositionManager.clickAtPosition(
                    positionId,
                    action.button || 'left',
                    action.doubleClick || false
                );
                
                if (!clicked) {
                    throw new Error(`Failed to click at position ${positionId}`);
                }
                
                return {
                    type: 'cursor',
                    actionType: 'click',
                    positionId,
                    success: true
                };
                
            case 'type':
                // Type text at position
                const text = action.text || '';
                const typed = this.cursorPositionManager.typeAtPosition(positionId, text);
                
                if (!typed) {
                    throw new Error(`Failed to type text at position ${positionId}`);
                }
                
                return {
                    type: 'cursor',
                    actionType: 'type',
                    positionId,
                    text,
                    success: true
                };
                
            default:
                throw new Error(`Unknown cursor action type: ${actionType}`);
        }
    }
    
    /**
     * Execute a wait action
     * @private
     * @param {Object} action - Wait action
     * @param {Object} workflowState - Workflow state
     * @returns {Object} - Action result
     */
    _executeWaitAction(action, workflowState) {
        const duration = action.duration || 1000; // Default to 1 second
        
        // Wait for specified duration
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    type: 'wait',
                    duration,
                    success: true
                });
            }, duration);
        });
    }
    
    /**
     * Execute a script action
     * @private
     * @param {Object} action - Script action
     * @param {Object} workflowState - Workflow state
     * @returns {Object} - Action result
     */
    _executeScriptAction(action, workflowState) {
        const script = action.script || '';
        
        // Create context for script execution
        const context = {
            workflowState,
            variables: workflowState.options.variables || {},
            result: null,
            error: null
        };
        
        try {
            // Execute script
            const scriptFn = new Function('context', script);
            context.result = scriptFn(context);
            
            return {
                type: 'script',
                success: true,
                result: context.result
            };
        } catch (error) {
            context.error = error.message;
            
            return {
                type: 'script',
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Evaluate conditions
     * @private
     * @param {Object} conditions - Conditions to evaluate
     * @param {Object} workflowState - Workflow state
     * @returns {boolean} - Evaluation result
     */
    _evaluateConditions(conditions, workflowState) {
        // Process variables in conditions
        const processedConditions = this._processVariables(conditions, workflowState.options.variables);
        
        // Create context for condition evaluation
        const context = {
            workflowState,
            variables: workflowState.options.variables || {},
            phases: workflowState.phases,
            currentPhase: workflowState.phases[workflowState.currentPhaseIndex],
            result: false
        };
        
        // Evaluate condition expression
        if (processedConditions.expression) {
            try {
                const expressionFn = new Function('context', `return ${processedConditions.expression};`);
                context.result = expressionFn(context);
            } catch (error) {
                console.error(`Error evaluating condition expression: ${error.message}`);
                context.result = false;
            }
        }
        
        return context.result;
    }
    
    /**
     * Process variables in an object
     * @private
     * @param {Object} obj - Object to process
     * @param {Object} variables - Variables to use
     * @returns {Object} - Processed object
     */
    _processVariables(obj, variables) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this._processVariables(item, variables));
        }
        
        const result = {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
                // Replace variables in string
                result[key] = this._replaceVariables(value, variables);
            } else if (typeof value === 'object') {
                // Process nested objects
                result[key] = this._processVariables(value, variables);
            } else {
                // Keep other values as is
                result[key] = value;
            }
        }
        
        return result;
    }
    
    /**
     * Replace variables in a string
     * @private
     * @param {string} str - String to process
     * @param {Object} variables - Variables to use
     * @returns {string} - Processed string
     */
    _replaceVariables(str, variables) {
        if (!str || typeof str !== 'string') {
            return str;
        }
        
        // Replace variables in the string
        return str.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (match, varName) => {
            // Handle nested variable names (e.g. user.name)
            const parts = varName.split('.');
            let value = variables;
            
            for (const part of parts) {
                if (value === undefined || value === null) {
                    return match; // Keep original if parent is undefined
                }
                
                value = value[part];
                
                if (value === undefined) {
                    return match; // Keep original if variable not found
                }
            }
            
            return value !== null && value !== undefined ? value : match;
        });
    }
    
    /**
     * Get all active workflows
     * @returns {Array} - Array of active workflow states
     */
    getActiveWorkflows() {
        return Array.from(this.activeWorkflows.values());
    }
    
    /**
     * Get workflow state
     * @param {string} workflowId - Workflow ID
     * @returns {Object|null} - Workflow state or null if not found
     */
    getWorkflowState(workflowId) {
        return this.activeWorkflows.get(workflowId) || null;
    }
    
    /**
     * Get workflow queue
     * @returns {Array} - Array of queued workflows
     */
    getWorkflowQueue() {
        return [...this.workflowQueue];
    }
}
module.exports = WorkflowManager;
EOL