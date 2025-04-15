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
Output:
WARNING: Your command contains '$' characters which may not be properly escaped.
If you're experiencing unexpected behavior, try escaping dollar signs with a backslash (\$), especially in file paths or when working with tsx/jsx files.
10m ago

Now let's create the enhanced CursorAutomation.js file:
run_command
Command:
cat > src/utils/CursorAutomation.js << 'EOL'
/**
 * Enhanced Cursor Automation Utility
 * Provides support for multiple named cursor positions and automation
 */
const robot = require('robotjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
class CursorAutomation extends EventEmitter {
    /**
     * Initialize the Cursor Automation utility
     * @param {Object} options - Configuration options
     * @param {string} options.dataDir - Directory to store cursor data
     * @param {boolean} options.enableMultiCursor - Whether to enable multi-cursor support
     * @param {number} options.maxCursors - Maximum number of concurrent cursors
     * @param {string} options.cursorSpeed - Speed of cursor movement (slow, medium, fast, instant)
     * @param {boolean} options.showCursorPath - Whether to show cursor movement path
     */
    constructor(options = {}) {
        super();
        this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'cursor');
        this.enableMultiCursor = options.enableMultiCursor || false;
        this.maxCursors = options.maxCursors || 1;
        this.cursorSpeed = options.cursorSpeed || 'medium';
        this.showCursorPath = options.showCursorPath || false;
        this.positions = new Map();
        this.activeCursors = [];
        this.isRecording = false;
        this.recordedActions = [];
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        // Set up speed mappings
        this.speedMappings = {
            slow: 10,
            medium: 20,
            fast: 40,
            instant: 0
        };
        
        // Load saved positions
        this.loadPositions();
    }
    
    /**
     * Load saved cursor positions
     */
    loadPositions() {
        try {
            const positionsFile = path.join(this.dataDir, 'positions.json');
            
            if (fs.existsSync(positionsFile)) {
                const data = JSON.parse(fs.readFileSync(positionsFile, 'utf8'));
                
                for (const position of data) {
                    this.positions.set(position.id, position);
                }
                
                console.log(`Loaded ${this.positions.size} cursor positions`);
            }
        } catch (error) {
            console.error('Error loading cursor positions:', error);
        }
    }
    
    /**
     * Save cursor positions
     */
    savePositions() {
        try {
            const positionsFile = path.join(this.dataDir, 'positions.json');
            const data = Array.from(this.positions.values());
            
            fs.writeFileSync(positionsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving cursor positions:', error);
        }
    }
    
    /**
     * Get the current cursor position
     * @returns {Object} - Current cursor position {x, y}
     */
    getCurrentPosition() {
        return robot.getMousePos();
    }
    
    /**
     * Capture the current cursor position
     * @param {string} name - Name for the position
     * @param {Object} options - Additional options
     * @returns {Object} - Captured position
     */
    capturePosition(name, options = {}) {
        const pos = this.getCurrentPosition();
        
        const position = {
            id: uuidv4(),
            name: name,
            x: pos.x,
            y: pos.y,
            description: options.description || '',
            application: options.application || '',
            group: options.group || 'default',
            createdAt: new Date().toISOString()
        };
        
        // Add to positions
        this.positions.set(position.id, position);
        
        // Save positions
        this.savePositions();
        
        // Emit position captured event
        this.emit('positionCaptured', position);
        
        return position;
    }
    
    /**
     * Get a saved position by ID
     * @param {string} id - Position ID
     * @returns {Object|null} - Position or null if not found
     */
    getPositionById(id) {
        return this.positions.get(id) || null;
    }
    
    /**
     * Get a saved position by name
     * @param {string} name - Position name
     * @returns {Object|null} - Position or null if not found
     */
    getPositionByName(name) {
        for (const position of this.positions.values()) {
            if (position.name === name) {
                return position;
            }
        }
        
        return null;
    }
    
    /**
     * Get all saved positions
     * @param {Object} filters - Optional filters
     * @returns {Array} - Array of positions
     */
    getAllPositions(filters = {}) {
        let positions = Array.from(this.positions.values());
        
        // Apply filters
        if (filters.group) {
            positions = positions.filter(p => p.group === filters.group);
        }
        
        if (filters.application) {
            positions = positions.filter(p => p.application === filters.application);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            positions = positions.filter(p => 
                p.name.toLowerCase().includes(searchTerm) || 
                (p.description && p.description.toLowerCase().includes(searchTerm))
            );
        }
        
        return positions;
    }
    
    /**
     * Update a saved position
     * @param {string} id - Position ID
     * @param {Object} data - Updated position data
     * @returns {Object|null} - Updated position or null if not found
     */
    updatePosition(id, data) {
        const position = this.getPositionById(id);
        
        if (!position) {
            return null;
        }
        
        // Update position
        const updatedPosition = {
            ...position,
            name: data.name || position.name,
            x: data.x !== undefined ? data.x : position.x,
            y: data.y !== undefined ? data.y : position.y,
            description: data.description !== undefined ? data.description : position.description,
            application: data.application !== undefined ? data.application : position.application,
            group: data.group || position.group,
            updatedAt: new Date().toISOString()
        };
        
        // Save updated position
        this.positions.set(id, updatedPosition);
        this.savePositions();
        
        // Emit position updated event
        this.emit('positionUpdated', updatedPosition);
        
        return updatedPosition;
    }
    
    /**
     * Delete a saved position
     * @param {string} id - Position ID
     * @returns {boolean} - True if deleted, false if not found
     */
    deletePosition(id) {
        const position = this.getPositionById(id);
        
        if (!position) {
            return false;
        }
        
        // Remove position
        this.positions.delete(id);
        this.savePositions();
        
        // Emit position deleted event
        this.emit('positionDeleted', position);
        
        return true;
    }
    
    /**
     * Move cursor to a saved position
     * @param {string} positionId - Position ID or name
     * @param {Object} options - Movement options
     * @returns {boolean} - True if moved successfully
     */
    moveCursorToPosition(positionId, options = {}) {
        // Find position by ID or name
        let position = this.getPositionById(positionId);
        if (!position) {
            position = this.getPositionByName(positionId);
        }
        
        if (!position) {
            return false;
        }
        
        // Check if we can create another cursor
        if (this.enableMultiCursor && this.activeCursors.length >= this.maxCursors) {
            console.warn(`Maximum number of cursors (${this.maxCursors}) reached`);
            return false;
        }
        
        // Get movement speed
        const speed = options.speed || this.cursorSpeed;
        const speedValue = this.speedMappings[speed] || this.speedMappings.medium;
        
        // Move cursor
        if (speedValue === 0 || speed === 'instant') {
            // Instant movement
            robot.moveMouse(position.x, position.y);
        } else {
            // Smooth movement
            this._smoothMoveCursor(position.x, position.y, speedValue, options.callback);
        }
        
        // Add to active cursors if multi-cursor is enabled
        if (this.enableMultiCursor) {
            const cursorId = uuidv4();
            
            this.activeCursors.push({
                id: cursorId,
                position: position,
                createdAt: new Date().toISOString()
            });
            
            // Emit cursor created event
            this.emit('cursorCreated', {
                id: cursorId,
                position: position
            });
        }
        
        // Add to recorded actions if recording
        if (this.isRecording) {
            this.recordedActions.push({
                type: 'move',
                positionId: position.id,
                timestamp: new Date().toISOString()
            });
        }
        
        return true;
    }
    
    /**
     * Move cursor smoothly to a position
     * @private
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     * @param {number} speed - Movement speed
     * @param {Function} callback - Optional callback after movement
     */
    _smoothMoveCursor(targetX, targetY, speed, callback) {
        const currentPos = robot.getMousePos();
        const startX = currentPos.x;
        const startY = currentPos.y;
        
        // Calculate distance
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate number of steps based on distance and speed
        const steps = Math.max(Math.floor(distance / speed), 1);
        
        // Move cursor in steps
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = Math.round(startX + dx * t);
            const y = Math.round(startY + dy * t);
            
            robot.moveMouse(x, y);
            
            // Show cursor path if enabled
            if (this.showCursorPath) {
                this._showCursorPathPoint(x, y);
            }
            
            // Small delay between steps
            if (i < steps) {
                this._sleep(10);
            }
        }
        
        // Ensure final position is exact
        robot.moveMouse(targetX, targetY);
        
        // Call callback if provided
        if (typeof callback === 'function') {
            callback();
        }
    }
    
    /**
     * Show a point on the cursor path
     * @private
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    _showCursorPathPoint(x, y) {
        // This is a placeholder for the actual implementation
        // The implementation would depend on the UI framework
        this.emit('cursorPathPoint', { x, y });
    }
    
    /**
     * Sleep for a specified number of milliseconds
     * @private
     * @param {number} ms - Milliseconds to sleep
     */
    _sleep(ms) {
        const start = Date.now();
        while (Date.now() - start < ms) {
            // Busy wait
        }
    }
    
    /**
     * Click at the current cursor position
     * @param {string} button - Mouse button to click (left, right, middle)
     * @param {boolean} doubleClick - Whether to perform a double click
     * @returns {boolean} - True if clicked successfully
     */
    clickAtCurrentPosition(button = 'left', doubleClick = false) {
        try {
            if (doubleClick) {
                robot.mouseClick(button);
                this._sleep(100);
                robot.mouseClick(button);
            } else {
                robot.mouseClick(button);
            }
            
            // Add to recorded actions if recording
            if (this.isRecording) {
                this.recordedActions.push({
                    type: 'click',
                    button,
                    doubleClick,
                    position: this.getCurrentPosition(),
                    timestamp: new Date().toISOString()
                });
            }
            
            return true;
        } catch (error) {
            console.error('Error clicking at current position:', error);
            return false;
        }
    }
    
    /**
     * Click at a saved position
     * @param {string} positionId - Position ID or name
     * @param {string} button - Mouse button to click (left, right, middle)
     * @param {boolean} doubleClick - Whether to perform a double click
     * @returns {boolean} - True if clicked successfully
     */
    clickAtPosition(positionId, button = 'left', doubleClick = false) {
        // Move cursor to position
        const moved = this.moveCursorToPosition(positionId);
        
        if (!moved) {
            return false;
        }
        
        // Click at position
        return this.clickAtCurrentPosition(button, doubleClick);
    }
    
    /**
     * Type text at the current cursor position
     * @param {string} text - Text to type
     * @returns {boolean} - True if typed successfully
     */
    typeAtCurrentPosition(text) {
        try {
            robot.typeString(text);
            
            // Add to recorded actions if recording
            if (this.isRecording) {
                this.recordedActions.push({
                    type: 'type',
                    text,
                    position: this.getCurrentPosition(),
                    timestamp: new Date().toISOString()
                });
            }
            
            return true;
        } catch (error) {
            console.error('Error typing at current position:', error);
            return false;
        }
    }
    
    /**
     * Type text at a saved position
     * @param {string} positionId - Position ID or name
     * @param {string} text - Text to type
     * @returns {boolean} - True if typed successfully
     */
    typeAtPosition(positionId, text) {
        // Move cursor to position
        const moved = this.moveCursorToPosition(positionId);
        
        if (!moved) {
            return false;
        }
        
        // Click to focus
        this.clickAtCurrentPosition();
        
        // Type text
        return this.typeAtCurrentPosition(text);
    }
    
    /**
     * Start recording cursor actions
     * @returns {boolean} - True if recording started
     */
    startRecording() {
        if (this.isRecording) {
            return false;
        }
        
        this.isRecording = true;
        this.recordedActions = [];
        
        // Emit recording started event
        this.emit('recordingStarted');
        
        return true;
    }
    
    /**
     * Stop recording cursor actions
     * @returns {Array} - Recorded actions
     */
    stopRecording() {
        if (!this.isRecording) {
            return [];
        }
        
        this.isRecording = false;
        
        // Emit recording stopped event
        this.emit('recordingStopped', this.recordedActions);
        
        return this.recordedActions;
    }
    
    /**
     * Save recorded actions as a macro
     * @param {string} name - Macro name
     * @param {Object} options - Additional options
     * @returns {Object} - Saved macro
     */
    saveRecordingAsMacro(name, options = {}) {
        if (!this.recordedActions || this.recordedActions.length === 0) {
            throw new Error('No recorded actions to save');
        }
        
        const macro = {
            id: uuidv4(),
            name,
            description: options.description || '',
            actions: this.recordedActions,
            createdAt: new Date().toISOString()
        };
        
        try {
            const macrosFile = path.join(this.dataDir, 'macros.json');
            let macros = [];
            
            if (fs.existsSync(macrosFile)) {
                macros = JSON.parse(fs.readFileSync(macrosFile, 'utf8'));
            }
            
            macros.push(macro);
            
            fs.writeFileSync(macrosFile, JSON.stringify(macros, null, 2));
            
            // Emit macro saved event
            this.emit('macroSaved', macro);
            
            return macro;
        } catch (error) {
            console.error('Error saving macro:', error);
            throw error;
        }
    }
    
    /**
     * Play a macro
     * @param {string} macroId - Macro ID or name
     * @returns {boolean} - True if played successfully
     */
    playMacro(macroId) {
        try {
            const macrosFile = path.join(this.dataDir, 'macros.json');
            
            if (!fs.existsSync(macrosFile)) {
                return false;
            }
            
            const macros = JSON.parse(fs.readFileSync(macrosFile, 'utf8'));
            
            // Find macro by ID or name
            const macro = macros.find(m => m.id === macroId || m.name === macroId);
            
            if (!macro) {
                return false;
            }
            
            // Emit macro started event
            this.emit('macroStarted', macro);
            
            // Play actions
            for (const action of macro.actions) {
                switch (action.type) {
                    case 'move':
                        this.moveCursorToPosition(action.positionId);
                        break;
                        
                    case 'click':
                        if (action.position) {
                            robot.moveMouse(action.position.x, action.position.y);
                        }
                        this.clickAtCurrentPosition(action.button, action.doubleClick);
                        break;
                        
                    case 'type':
                        if (action.position) {
                            robot.moveMouse(action.position.x, action.position.y);
                        }
                        this.typeAtCurrentPosition(action.text);
                        break;
                }
                
                // Small delay between actions
                this._sleep(100);
            }
            
            // Emit macro completed event
            this.emit('macroCompleted', macro);
            
            return true;
        } catch (error) {
            console.error('Error playing macro:', error);
            
            // Emit macro error event
            this.emit('macroError', error);
            
            return false;
        }
    }
    
    /**
     * Get all macros
     * @returns {Array} - Array of macros
     */
    getAllMacros() {
        try {
            const macrosFile = path.join(this.dataDir, 'macros.json');
            
            if (!fs.existsSync(macrosFile)) {
                return [];
            }
            
            return JSON.parse(fs.readFileSync(macrosFile, 'utf8'));
        } catch (error) {
            console.error('Error getting macros:', error);
            return [];
        }
    }
    
    /**
     * Delete a macro
     * @param {string} macroId - Macro ID
     * @returns {boolean} - True if deleted, false if not found
     */
    deleteMacro(macroId) {
        try {
            const macrosFile = path.join(this.dataDir, 'macros.json');
            
            if (!fs.existsSync(macrosFile)) {
                return false;
            }
            
            let macros = JSON.parse(fs.readFileSync(macrosFile, 'utf8'));
            
            // Find macro index
            const macroIndex = macros.findIndex(m => m.id === macroId);
            
            if (macroIndex === -1) {
                return false;
            }
            
            // Remove macro
            const deletedMacro = macros.splice(macroIndex, 1)[0];
            
            // Save macros
            fs.writeFileSync(macrosFile, JSON.stringify(macros, null, 2));
            
            // Emit macro deleted event
            this.emit('macroDeleted', deletedMacro);
            
            return true;
        } catch (error) {
            console.error('Error deleting macro:', error);
            return false;
        }
    }
    
    /**
     * Get all active cursors
     * @returns {Array} - Array of active cursors
     */
    getActiveCursors() {
        return [...this.activeCursors];
    }
    
    /**
     * Remove an active cursor
     * @param {string} cursorId - Cursor ID
     * @returns {boolean} - True if removed, false if not found
     */
    removeActiveCursor(cursorId) {
        const cursorIndex = this.activeCursors.findIndex(c => c.id === cursorId);
        
        if (cursorIndex === -1) {
            return false;
        }
        
        // Remove cursor
        const removedCursor = this.activeCursors.splice(cursorIndex, 1)[0];
        
        // Emit cursor removed event
        this.emit('cursorRemoved', removedCursor);
        
        return true;
    }
    
    /**
     * Clear all active cursors
     */
    clearActiveCursors() {
        this.activeCursors = [];
        
        // Emit cursors cleared event
        this.emit('cursorsCleared');
    }
    
    /**
     * Get the screen size
     * @returns {Object} - Screen size {width, height}
     */
    getScreenSize() {
        return robot.getScreenSize();
    }
    
    /**
     * Check if a position is valid (within screen bounds)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} - True if position is valid
     */
    isValidPosition(x, y) {
        const screenSize = this.getScreenSize();
        return x >= 0 && x < screenSize.width && y >= 0 && y < screenSize.height;
    }
    
    /**
     * Import cursor positions from a file or data
     * @param {Array|Object} data - Position data to import
     * @param {Object} options - Import options
     * @returns {Object} - Import results
     */
    importPositions(data, options = {}) {
        const positions = Array.isArray(data) ? data : [data];
        const results = {
            imported: [],
            skipped: [],
            errors: []
        };
        
        for (const position of positions) {
            try {
                // Check if position with same name exists
                let existingPosition = null;
                
                for (const pos of this.positions.values()) {
                    if (pos.name === position.name) {
                        existingPosition = pos;
                        break;
                    }
                }
                
                if (existingPosition && !options.overwrite) {
                    results.skipped.push({
                        name: position.name,
                        reason: 'Position with same name already exists'
                    });
                    continue;
                }
                
                if (existingPosition && options.overwrite) {
                    // Update existing position
                    const updated = this.updatePosition(existingPosition.id, position);
                    if (updated) {
                        results.imported.push(updated);
                    } else {
                        results.errors.push({
                            name: position.name,
                            error: 'Failed to update existing position'
                        });
                    }
                } else {
                    // Create new position
                    const newPosition = {
                        id: options.keepId && position.id ? position.id : uuidv4(),
                        name: position.name,
                        x: position.x,
                        y: position.y,
                        description: position.description || '',
                        application: position.application || '',
                        group: position.group || 'default',
                        createdAt: new Date().toISOString()
                    };
                    
                    // Add to positions
                    this.positions.set(newPosition.id, newPosition);
                    results.imported.push(newPosition);
                }
            } catch (error) {
                results.errors.push({
                    name: position.name || 'Unknown',
                    error: error.message
                });
            }
        }
        
        // Save positions
        this.savePositions();
        
        return results;
    }
    
    /**
     * Export cursor positions to a file
     * @param {Array} positionIds - Array of position IDs to export
     * @param {string} outputPath - Path to save the exported positions
     * @returns {boolean} - True if export successful
     */
    exportPositions(positionIds, outputPath) {
        try {
            let positionsToExport = [];
            
            if (positionIds && positionIds.length > 0) {
                // Export specific positions
                for (const id of positionIds) {
                    const position = this.getPositionById(id);
                    if (position) {
                        positionsToExport.push(position);
                    }
                }
            } else {
                // Export all positions
                positionsToExport = Array.from(this.positions.values());
            }
            
            fs.writeFileSync(outputPath, JSON.stringify(positionsToExport, null, 2));
            return true;
        } catch (error) {
            console.error('Error exporting positions:', error);
            return false;
        }
    }
}
module.exports = CursorAutomation;
EOL