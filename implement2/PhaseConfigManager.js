cat > src/models/PhaseConfigManager.js << 'EOL'
/**
 * Phase Configuration Manager
 * Manages workflow phases and their configurations
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
class PhaseConfigManager {
    /**
     * Initialize the Phase Configuration Manager
     * @param {Object} options - Configuration options
     * @param {string} options.phasesDir - Directory to store phase configurations
     * @param {string} options.workflowsDir - Directory to store workflow configurations
     */
    constructor(options = {}) {
        this.phasesDir = options.phasesDir || path.join(process.cwd(), 'data', 'phases');
        this.workflowsDir = options.workflowsDir || path.join(process.cwd(), 'data', 'workflows');
        this.phases = [];
        this.workflows = [];
        
        // Ensure directories exist
        if (!fs.existsSync(this.phasesDir)) {
            fs.mkdirSync(this.phasesDir, { recursive: true });
        }
        
        if (!fs.existsSync(this.workflowsDir)) {
            fs.mkdirSync(this.workflowsDir, { recursive: true });
        }
        
        // Initialize data
        this.loadPhases();
        this.loadWorkflows();
    }
    
    /**
     * Load all phases from the phases directory
     */
    loadPhases() {
        try {
            const files = fs.readdirSync(this.phasesDir);
            this.phases = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const phasePath = path.join(this.phasesDir, file);
                    const phaseData = JSON.parse(fs.readFileSync(phasePath, 'utf8'));
                    this.phases.push(phaseData);
                }
            }
            
            // Sort phases by order
            this.phases.sort((a, b) => a.order - b.order);
            
            return this.phases;
        } catch (error) {
            console.error('Error loading phases:', error);
            return [];
        }
    }
    
    /**
     * Load all workflows from the workflows directory
     */
    loadWorkflows() {
        try {
            const files = fs.readdirSync(this.workflowsDir);
            this.workflows = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const workflowPath = path.join(this.workflowsDir, file);
                    const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
                    this.workflows.push(workflowData);
                }
            }
            
            // Sort workflows by name
            this.workflows.sort((a, b) => a.name.localeCompare(b.name));
            
            return this.workflows;
        } catch (error) {
            console.error('Error loading workflows:', error);
            return [];
        }
    }
    
    /**
     * Get all phases
     * @param {Object} filters - Optional filters to apply
     * @returns {Array} - Array of phases
     */
    getPhases(filters = {}) {
        let filteredPhases = [...this.phases];
        
        // Apply filters
        if (filters.workflowId) {
            const workflow = this.getWorkflowById(filters.workflowId);
            if (workflow && workflow.phases) {
                const phaseIds = workflow.phases.map(p => p.id);
                filteredPhases = filteredPhases.filter(p => phaseIds.includes(p.id));
            } else {
                return [];
            }
        }
        
        if (filters.type) {
            filteredPhases = filteredPhases.filter(p => p.type === filters.type);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredPhases = filteredPhases.filter(p => 
                p.name.toLowerCase().includes(searchTerm) || 
                (p.description && p.description.toLowerCase().includes(searchTerm))
            );
        }
        
        return filteredPhases;
    }
    
    /**
     * Get all workflows
     * @param {Object} filters - Optional filters to apply
     * @returns {Array} - Array of workflows
     */
    getWorkflows(filters = {}) {
        let filteredWorkflows = [...this.workflows];
        
        // Apply filters
        if (filters.projectId) {
            filteredWorkflows = filteredWorkflows.filter(w => w.projectId === filters.projectId);
        }
        
        if (filters.status) {
            filteredWorkflows = filteredWorkflows.filter(w => w.status === filters.status);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredWorkflows = filteredWorkflows.filter(w => 
                w.name.toLowerCase().includes(searchTerm) || 
                (w.description && w.description.toLowerCase().includes(searchTerm))
            );
        }
        
        return filteredWorkflows;
    }
    
    /**
     * Get a phase by ID
     * @param {string} id - Phase ID
     * @returns {Object|null} - Phase object or null if not found
     */
    getPhaseById(id) {
        return this.phases.find(p => p.id === id) || null;
    }
    
    /**
     * Get a workflow by ID
     * @param {string} id - Workflow ID
     * @returns {Object|null} - Workflow object or null if not found
     */
    getWorkflowById(id) {
        return this.workflows.find(w => w.id === id) || null;
    }
    
    /**
     * Create a new phase
     * @param {Object} phaseData - Phase data
     * @returns {Object} - Created phase
     */
    createPhase(phaseData) {
        const newPhase = {
            id: phaseData.id || uuidv4(),
            name: phaseData.name,
            description: phaseData.description || '',
            type: phaseData.type || 'manual',
            estimatedDuration: phaseData.estimatedDuration || 15,
            order: phaseData.order || this.phases.length + 1,
            actions: phaseData.actions || [],
            conditions: phaseData.conditions || {},
            dependencies: phaseData.dependencies || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save phase to file
        const phasePath = path.join(this.phasesDir, `${newPhase.id}.json`);
        fs.writeFileSync(phasePath, JSON.stringify(newPhase, null, 2));
        
        // Add to phases array
        this.phases.push(newPhase);
        
        return newPhase;
    }
    
    /**
     * Create a new workflow
     * @param {Object} workflowData - Workflow data
     * @returns {Object} - Created workflow
     */
    createWorkflow(workflowData) {
        const newWorkflow = {
            id: workflowData.id || uuidv4(),
            name: workflowData.name,
            description: workflowData.description || '',
            projectId: workflowData.projectId || null,
            status: workflowData.status || 'draft',
            phases: workflowData.phases || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save workflow to file
        const workflowPath = path.join(this.workflowsDir, `${newWorkflow.id}.json`);
        fs.writeFileSync(workflowPath, JSON.stringify(newWorkflow, null, 2));
        
        // Add to workflows array
        this.workflows.push(newWorkflow);
        
        return newWorkflow;
    }
    
    /**
     * Update an existing phase
     * @param {string} id - Phase ID
     * @param {Object} phaseData - Updated phase data
     * @returns {Object|null} - Updated phase or null if not found
     */
    updatePhase(id, phaseData) {
        const phaseIndex = this.phases.findIndex(p => p.id === id);
        
        if (phaseIndex === -1) {
            return null;
        }
        
        const existingPhase = this.phases[phaseIndex];
        
        // Update phase
        const updatedPhase = {
            ...existingPhase,
            name: phaseData.name || existingPhase.name,
            description: phaseData.description !== undefined ? phaseData.description : existingPhase.description,
            type: phaseData.type || existingPhase.type,
            estimatedDuration: phaseData.estimatedDuration !== undefined ? phaseData.estimatedDuration : existingPhase.estimatedDuration,
            order: phaseData.order !== undefined ? phaseData.order : existingPhase.order,
            actions: phaseData.actions || existingPhase.actions,
            conditions: phaseData.conditions || existingPhase.conditions,
            dependencies: phaseData.dependencies || existingPhase.dependencies,
            updatedAt: new Date().toISOString()
        };
        
        // Save updated phase
        const phasePath = path.join(this.phasesDir, `${id}.json`);
        fs.writeFileSync(phasePath, JSON.stringify(updatedPhase, null, 2));
        
        // Update phases array
        this.phases[phaseIndex] = updatedPhase;
        
        return updatedPhase;
    }
    
    /**
     * Update an existing workflow
     * @param {string} id - Workflow ID
     * @param {Object} workflowData - Updated workflow data
     * @returns {Object|null} - Updated workflow or null if not found
     */
    updateWorkflow(id, workflowData) {
        const workflowIndex = this.workflows.findIndex(w => w.id === id);
        
        if (workflowIndex === -1) {
            return null;
        }
        
        const existingWorkflow = this.workflows[workflowIndex];
        
        // Update workflow
        const updatedWorkflow = {
            ...existingWorkflow,
            name: workflowData.name || existingWorkflow.name,
            description: workflowData.description !== undefined ? workflowData.description : existingWorkflow.description,
            projectId: workflowData.projectId !== undefined ? workflowData.projectId : existingWorkflow.projectId,
            status: workflowData.status || existingWorkflow.status,
            phases: workflowData.phases || existingWorkflow.phases,
            updatedAt: new Date().toISOString()
        };
        
        // Save updated workflow
        const workflowPath = path.join(this.workflowsDir, `${id}.json`);
        fs.writeFileSync(workflowPath, JSON.stringify(updatedWorkflow, null, 2));
        
        // Update workflows array
        this.workflows[workflowIndex] = updatedWorkflow;
        
        return updatedWorkflow;
    }
    
    /**
     * Delete a phase
     * @param {string} id - Phase ID
     * @returns {boolean} - True if deleted, false if not found
     */
    deletePhase(id) {
        const phaseIndex = this.phases.findIndex(p => p.id === id);
        
        if (phaseIndex === -1) {
            return false;
        }
        
        // Remove phase file
        const phasePath = path.join(this.phasesDir, `${id}.json`);
        fs.unlinkSync(phasePath);
        
        // Remove from phases array
        this.phases.splice(phaseIndex, 1);
        
        // Update workflows that use this phase
        for (const workflow of this.workflows) {
            const phaseIndex = workflow.phases.findIndex(p => p.id === id);
            if (phaseIndex !== -1) {
                workflow.phases.splice(phaseIndex, 1);
                this.updateWorkflow(workflow.id, workflow);
            }
        }
        
        return true;
    }
    
    /**
     * Delete a workflow
     * @param {string} id - Workflow ID
     * @returns {boolean} - True if deleted, false if not found
     */
    deleteWorkflow(id) {
        const workflowIndex = this.workflows.findIndex(w => w.id === id);
        
        if (workflowIndex === -1) {
            return false;
        }
        
        // Remove workflow file
        const workflowPath = path.join(this.workflowsDir, `${id}.json`);
        fs.unlinkSync(workflowPath);
        
        // Remove from workflows array
        this.workflows.splice(workflowIndex, 1);
        
        return true;
    }
    
    /**
     * Add a phase to a workflow
     * @param {string} workflowId - Workflow ID
     * @param {string} phaseId - Phase ID
     * @param {number} order - Order of the phase in the workflow
     * @returns {Object|null} - Updated workflow or null if not found
     */
    addPhaseToWorkflow(workflowId, phaseId, order = null) {
        const workflow = this.getWorkflowById(workflowId);
        const phase = this.getPhaseById(phaseId);
        
        if (!workflow || !phase) {
            return null;
        }
        
        // Check if phase is already in workflow
        const existingPhaseIndex = workflow.phases.findIndex(p => p.id === phaseId);
        if (existingPhaseIndex !== -1) {
            // Phase already exists in workflow, update its order if provided
            if (order !== null) {
                workflow.phases[existingPhaseIndex].order = order;
                // Re-sort phases by order
                workflow.phases.sort((a, b) => a.order - b.order);
            }
        } else {
            // Add phase to workflow
            const phaseOrder = order !== null ? order : workflow.phases.length + 1;
            workflow.phases.push({
                id: phaseId,
                order: phaseOrder
            });
            // Sort phases by order
            workflow.phases.sort((a, b) => a.order - b.order);
        }
        
        // Update workflow
        return this.updateWorkflow(workflowId, workflow);
    }
    
    /**
     * Remove a phase from a workflow
     * @param {string} workflowId - Workflow ID
     * @param {string} phaseId - Phase ID
     * @returns {Object|null} - Updated workflow or null if not found
     */
    removePhaseFromWorkflow(workflowId, phaseId) {
        const workflow = this.getWorkflowById(workflowId);
        
        if (!workflow) {
            return null;
        }
        
        // Find phase in workflow
        const phaseIndex = workflow.phases.findIndex(p => p.id === phaseId);
        if (phaseIndex === -1) {
            return workflow; // Phase not in workflow
        }
        
        // Remove phase from workflow
        workflow.phases.splice(phaseIndex, 1);
        
        // Update order of remaining phases
        workflow.phases.forEach((phase, index) => {
            phase.order = index + 1;
        });
        
        // Update workflow
        return this.updateWorkflow(workflowId, workflow);
    }
    
    /**
     * Reorder phases in a workflow
     * @param {string} workflowId - Workflow ID
     * @param {Array} phaseOrders - Array of {id, order} objects
     * @returns {Object|null} - Updated workflow or null if not found
     */
    reorderWorkflowPhases(workflowId, phaseOrders) {
        const workflow = this.getWorkflowById(workflowId);
        
        if (!workflow) {
            return null;
        }
        
        // Update order of each phase
        for (const phaseOrder of phaseOrders) {
            const phaseIndex = workflow.phases.findIndex(p => p.id === phaseOrder.id);
            if (phaseIndex !== -1) {
                workflow.phases[phaseIndex].order = phaseOrder.order;
            }
        }
        
        // Sort phases by order
        workflow.phases.sort((a, b) => a.order - b.order);
        
        // Update workflow
        return this.updateWorkflow(workflowId, workflow);
    }
    
    /**
     * Get phases for a workflow with full phase data
     * @param {string} workflowId - Workflow ID
     * @returns {Array} - Array of phases with full data
     */
    getWorkflowPhases(workflowId) {
        const workflow = this.getWorkflowById(workflowId);
        
        if (!workflow) {
            return [];
        }
        
        // Get full phase data for each phase in the workflow
        const workflowPhases = [];
        for (const phaseRef of workflow.phases) {
            const phase = this.getPhaseById(phaseRef.id);
            if (phase) {
                workflowPhases.push({
                    ...phase,
                    order: phaseRef.order
                });
            }
        }
        
        // Sort phases by order
        workflowPhases.sort((a, b) => a.order - b.order);
        
        return workflowPhases;
    }
    
    /**
     * Duplicate a workflow
     * @param {string} id - Workflow ID to duplicate
     * @param {string} newName - Name for the duplicated workflow
     * @returns {Object|null} - Duplicated workflow or null if not found
     */
    duplicateWorkflow(id, newName) {
        const workflow = this.getWorkflowById(id);
        
        if (!workflow) {
            return null;
        }
        
        // Create new workflow based on existing one
        const duplicatedWorkflow = {
            ...workflow,
            id: uuidv4(),
            name: newName || `${workflow.name} (Copy)`,
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save duplicated workflow
        const workflowPath = path.join(this.workflowsDir, `${duplicatedWorkflow.id}.json`);
        fs.writeFileSync(workflowPath, JSON.stringify(duplicatedWorkflow, null, 2));
        
        // Add to workflows array
        this.workflows.push(duplicatedWorkflow);
        
        return duplicatedWorkflow;
    }
    
    /**
     * Duplicate a phase
     * @param {string} id - Phase ID to duplicate
     * @param {string} newName - Name for the duplicated phase
     * @returns {Object|null} - Duplicated phase or null if not found
     */
    duplicatePhase(id, newName) {
        const phase = this.getPhaseById(id);
        
        if (!phase) {
            return null;
        }
        
        // Create new phase based on existing one
        const duplicatedPhase = {
            ...phase,
            id: uuidv4(),
            name: newName || `${phase.name} (Copy)`,
            order: this.phases.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save duplicated phase
        const phasePath = path.join(this.phasesDir, `${duplicatedPhase.id}.json`);
        fs.writeFileSync(phasePath, JSON.stringify(duplicatedPhase, null, 2));
        
        // Add to phases array
        this.phases.push(duplicatedPhase);
        
        return duplicatedPhase;
    }
    
    /**
     * Import phases from a file or data
     * @param {Array|Object} data - Phase data to import
     * @param {Object} options - Import options
     * @returns {Object} - Import results
     */
    importPhases(data, options = {}) {
        const phases = Array.isArray(data) ? data : [data];
        const results = {
            imported: [],
            skipped: [],
            errors: []
        };
        
        for (const phase of phases) {
            try {
                // Check if phase with same name exists
                const existingPhase = this.phases.find(p => p.name === phase.name);
                
                if (existingPhase && !options.overwrite) {
                    results.skipped.push({
                        name: phase.name,
                        reason: 'Phase with same name already exists'
                    });
                    continue;
                }
                
                if (existingPhase && options.overwrite) {
                    // Update existing phase
                    const updated = this.updatePhase(existingPhase.id, phase);
                    if (updated) {
                        results.imported.push(updated);
                    } else {
                        results.errors.push({
                            name: phase.name,
                            error: 'Failed to update existing phase'
                        });
                    }
                } else {
                    // Create new phase
                    const newPhase = this.createPhase({
                        ...phase,
                        id: options.keepId && phase.id ? phase.id : undefined
                    });
                    results.imported.push(newPhase);
                }
            } catch (error) {
                results.errors.push({
                    name: phase.name || 'Unknown',
                    error: error.message
                });
            }
        }
        
        return results;
    }
    
    /**
     * Import workflows from a file or data
     * @param {Array|Object} data - Workflow data to import
     * @param {Object} options - Import options
     * @returns {Object} - Import results
     */
    importWorkflows(data, options = {}) {
        const workflows = Array.isArray(data) ? data : [data];
        const results = {
            imported: [],
            skipped: [],
            errors: []
        };
        
        for (const workflow of workflows) {
            try {
                // Check if workflow with same name exists
                const existingWorkflow = this.workflows.find(w => w.name === workflow.name);
                
                if (existingWorkflow && !options.overwrite) {
                    results.skipped.push({
                        name: workflow.name,
                        reason: 'Workflow with same name already exists'
                    });
                    continue;
                }
                
                if (existingWorkflow && options.overwrite) {
                    // Update existing workflow
                    const updated = this.updateWorkflow(existingWorkflow.id, workflow);
                    if (updated) {
                        results.imported.push(updated);
                    } else {
                        results.errors.push({
                            name: workflow.name,
                            error: 'Failed to update existing workflow'
                        });
                    }
                } else {
                    // Create new workflow
                    const newWorkflow = this.createWorkflow({
                        ...workflow,
                        id: options.keepId && workflow.id ? workflow.id : undefined
                    });
                    results.imported.push(newWorkflow);
                }
            } catch (error) {
                results.errors.push({
                    name: workflow.name || 'Unknown',
                    error: error.message
                });
            }
        }
        
        return results;
    }
    
    /**
     * Export phases to a file
     * @param {Array} phaseIds - Array of phase IDs to export
     * @param {string} outputPath - Path to save the exported phases
     * @returns {boolean} - True if export successful
     */
    exportPhases(phaseIds, outputPath) {
        try {
            const phasesToExport = phaseIds
                ? this.phases.filter(p => phaseIds.includes(p.id))
                : this.phases;
            
            fs.writeFileSync(outputPath, JSON.stringify(phasesToExport, null, 2));
            return true;
        } catch (error) {
            console.error('Error exporting phases:', error);
            return false;
        }
    }
    
    /**
     * Export workflows to a file
     * @param {Array} workflowIds - Array of workflow IDs to export
     * @param {string} outputPath - Path to save the exported workflows
     * @returns {boolean} - True if export successful
     */
    exportWorkflows(workflowIds, outputPath) {
        try {
            const workflowsToExport = workflowIds
                ? this.workflows.filter(w => workflowIds.includes(w.id))
                : this.workflows;
            
            fs.writeFileSync(outputPath, JSON.stringify(workflowsToExport, null, 2));
            return true;
        } catch (error) {
            console.error('Error exporting workflows:', error);
            return false;
        }
    }
    
    /**
     * Start a workflow
     * @param {string} workflowId - Workflow ID
     * @returns {Object|null} - Updated workflow or null if not found
     */
    startWorkflow(workflowId) {
        const workflow = this.getWorkflowById(workflowId);
        
        if (!workflow) {
            return null;
        }
        
        // Update workflow status
        workflow.status = 'active';
        workflow.startedAt = new Date().toISOString();
        workflow.currentPhaseIndex = 0;
        
        // Update workflow
        return this.updateWorkflow(workflowId, workflow);
    }
    
    /**
     * Pause a workflow
     * @param {string} workflowId - Workflow ID
     * @returns {Object|null} - Updated workflow or null if not found
     */
    pauseWorkflow(workflowId) {
        const workflow = this.getWorkflowById(workflowId);
        
        if (!workflow) {
            return null;
        }
        
        // Update workflow status
        workflow.status = 'paused';
        workflow.pausedAt = new Date().toISOString();
        
        // Update workflow
        return this.updateWorkflow(workflowId, workflow);
    }
    
    /**
     * Resume a workflow
     * @param {string} workflowId - Workflow ID
     * @returns {Object|null} - Updated workflow or null if not found
     */
    resumeWorkflow(workflowId) {
        const workflow = this.getWorkflowById(workflowId);
        
        if (!workflow) {
            return null;
        }
        
        // Update workflow status
        workflow.status = 'active';
        workflow.resumedAt = new Date().toISOString();
        
        // Update workflow
        return this.updateWorkflow(workflowId, workflow);
    }
    
    /**
     * Complete a workflow
     * @param {string} workflowId - Workflow ID
     * @returns {Object|null} - Updated workflow or null if not found
     */
    completeWorkflow(workflowId) {
        const workflow = this.getWorkflowById(workflowId);
        
        if (!workflow) {
            return null;
        }
        
        // Update workflow status
        workflow.status = 'completed';
        workflow.completedAt = new Date().toISOString();
        
        // Update workflow
        return this.updateWorkflow(workflowId, workflow);
    }
    
    /**
     * Advance a workflow to the next phase
     * @param {string} workflowId - Workflow ID
     * @returns {Object|null} - Updated workflow or null if not found
     */
    advanceWorkflow(workflowId) {
        const workflow = this.getWorkflowById(workflowId);
        
        if (!workflow) {
            return null;
        }
        
        // Get current phase index
        const currentPhaseIndex = workflow.currentPhaseIndex || 0;
        
        // Check if there are more phases
        if (currentPhaseIndex >= workflow.phases.length - 1) {
            // No more phases, complete workflow
            return this.completeWorkflow(workflowId);
        }
        
        // Advance to next phase
        workflow.currentPhaseIndex = currentPhaseIndex + 1;
        
        // Update workflow
        return this.updateWorkflow(workflowId, workflow);
    }
    
    /**
     * Get the current phase of a workflow
     * @param {string} workflowId - Workflow ID
     * @returns {Object|null} - Current phase or null if not found
     */
    getCurrentPhase(workflowId) {
        const workflow = this.getWorkflowById(workflowId);
        
        if (!workflow) {
            return null;
        }
        
        // Get current phase index
        const currentPhaseIndex = workflow.currentPhaseIndex || 0;
        
        // Check if there are phases
        if (workflow.phases.length === 0) {
            return null;
        }
        
        // Get current phase
        const currentPhaseRef = workflow.phases[currentPhaseIndex];
        if (!currentPhaseRef) {
            return null;
        }
        
        // Get full phase data
        return this.getPhaseById(currentPhaseRef.id);
    }
}
module.exports = PhaseConfigManager;
EOL