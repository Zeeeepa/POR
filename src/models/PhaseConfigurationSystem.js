/**
 * Phase Configuration System
 * Provides a comprehensive system for managing development phases.
 */
const { v4: uuidv4 } = require('uuid');
const PhaseConfigManager = require('./PhaseConfigManager');
const logger = require('../utils/logger');
const { AppError, ErrorTypes, StatusCodes } = require('../utils/errorHandler');
// Cache for phases (simple in-memory cache)
const phaseCache = new Map();
class PhaseConfigurationSystem {
  /**
   * Initialize the Phase Configuration System
   * @param {Object} options - Configuration options passed to PhaseConfigManager
   */
  constructor(options = {}) {
    this.manager = new PhaseConfigManager(options);
    this.templates = new Map(); // Store phase templates
    logger.info('PhaseConfigurationSystem initialized');
  }
  /**
   * Create a new phase for a project.
   * @param {string} projectId - The ID of the project.
   * @param {Object} phaseData - Data for the new phase.
   * @returns {Promise<Object>} The created phase object.
   * @throws {AppError} If validation fails or creation fails.
   */
  async createPhase(projectId, phaseData) {
    logger.debug(`Creating phase for project ${projectId}`, { phaseData });
    try {
      // Basic validation
      if (!projectId || !phaseData || !phaseData.name) {
        throw new AppError('Project ID and phase name are required', ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
      }
      // Add projectId to phase data if not present
      const phaseToCreate = { ...phaseData, projectId };
      // Use the manager to create the phase
      const createdPhase = this.manager.createPhase(phaseToCreate);
      // Invalidate relevant cache entries
      this._invalidateCacheForProject(projectId);
      logger.info(`Phase created successfully for project ${projectId}`, { phaseId: createdPhase.id });
      return createdPhase;
    } catch (error) {
      logger.error(`Error creating phase for project ${projectId}`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create phase', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  /**
   * Delete a phase by its ID for a specific project.
   * @param {string} projectId - The ID of the project.
   * @param {string} phaseId - The ID of the phase to delete.
   * @returns {Promise<boolean>} True if deletion was successful.
   * @throws {AppError} If phase not found or deletion fails.
   */
  async deletePhase(projectId, phaseId) {
    logger.debug(`Deleting phase ${phaseId} for project ${projectId}`);
    try {
      // Ensure phase belongs to the project before deleting (optional, depends on manager logic)
      const phase = await this.getPhase(projectId, phaseId); // Use getPhase to ensure it exists and belongs to project
      if (!phase) {
         // getPhase already throws NotFoundError
         return false; // Should not be reached if getPhase throws
      }
      const success = this.manager.deletePhase(phaseId);
      if (!success) {
        // This might indicate the phase was already deleted or another issue
        throw new AppError(`Phase ${phaseId} not found or could not be deleted`, ErrorTypes.NOT_FOUND, StatusCodes.NOT_FOUND);
      }
      // Invalidate cache
      this._invalidateCacheForPhase(projectId, phaseId);
      logger.info(`Phase ${phaseId} deleted successfully for project ${projectId}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting phase ${phaseId} for project ${projectId}`, error);
      if (error instanceof AppError) throw error;
      // Check if the manager threw a specific error type we can map
      throw new AppError('Failed to delete phase', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  /**
   * Get a phase by its ID for a specific project. Uses caching.
   * @param {string} projectId - The ID of the project.
   * @param {string} phaseId - The ID of the phase to retrieve.
   * @returns {Promise<Object>} The phase object.
   * @throws {AppError} If phase not found.
   */
  async getPhase(projectId, phaseId) {
    const cacheKey = `phase:${projectId}:${phaseId}`;
    if (phaseCache.has(cacheKey)) {
      logger.debug(`Cache hit for phase ${phaseId} in project ${projectId}`);
      return phaseCache.get(cacheKey);
    }
    logger.debug(`Fetching phase ${phaseId} for project ${projectId}`);
    try {
      const phase = this.manager.getPhaseById(phaseId);
      if (!phase) {
        throw new AppError(`Phase ${phaseId} not found`, ErrorTypes.NOT_FOUND, StatusCodes.NOT_FOUND);
      }
      // Basic check: Ensure the retrieved phase belongs to the requested project
      // This assumes the manager doesn't inherently filter by projectId in getPhaseById
      // Adjust if PhaseConfigManager handles project association differently
      if (phase.projectId && phase.projectId !== projectId) {
         throw new AppError(`Phase ${phaseId} does not belong to project ${projectId}`, ErrorTypes.AUTHORIZATION, StatusCodes.FORBIDDEN);
      }
       // If phase.projectId is not set, we might allow access or have different logic
       // For now, let's assume projectId is a required field managed by createPhase
      // Add to cache
      phaseCache.set(cacheKey, phase);
      // Set a timeout for cache expiration (e.g., 5 minutes)
      setTimeout(() => phaseCache.delete(cacheKey), 5 * 60 * 1000);
      return phase;
    } catch (error) {
      logger.error(`Error fetching phase ${phaseId} for project ${projectId}`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get phase', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  /**
   * List all phases for a specific project. Supports filtering and pagination (optional).
   * @param {string} projectId - The ID of the project.
   * @param {Object} [options={}] - Filtering and pagination options.
   * @param {string} [options.status] - Filter by phase status (if applicable).
   * @param {string} [options.type] - Filter by phase type.
   * @param {number} [options.limit] - Max number of phases to return.
   * @param {number} [options.offset] - Number of phases to skip.
   * @param {string} [options.sortBy='order'] - Field to sort by.
   * @param {string} [options.sortOrder='asc'] - Sort order ('asc' or 'desc').
   * @returns {Promise<Array<Object>>} An array of phase objects.
   * @throws {AppError} If listing fails.
   */
  async listPhases(projectId, options = {}) {
     // Use a cache key that includes project ID and relevant options
    const cacheKey = `listPhases:${projectId}:${JSON.stringify(options)}`;
    if (phaseCache.has(cacheKey)) {
      logger.debug(`Cache hit for listPhases in project ${projectId} with options`, options);
      return phaseCache.get(cacheKey);
    }
    logger.debug(`Listing phases for project ${projectId} with options`, options);
    try {
      // Adapt filtering based on PhaseConfigManager's capabilities
      // The current manager `getPhases` doesn't filter by projectId directly.
      // We need to load all phases and filter here, or enhance the manager.
      // Let's assume we filter after getting all phases for simplicity now.
      // Reload phases from manager to ensure freshness if not relying solely on cache
      this.manager.loadPhases(); // Or rely on constructor load + updates
      let allPhases = this.manager.getPhases({ type: options.type }); // Use manager's type filter if available
      // Filter by projectId
      let projectPhases = allPhases.filter(p => p.projectId === projectId);
      // --- Add filtering based on options ---
      if (options.status) {
        // Assuming phase objects have a 'status' property
        projectPhases = projectPhases.filter(p => p.status === options.status);
      }
      // Add more filters as needed
      // --- Sorting ---
      const sortBy = options.sortBy || 'order'; // Default sort by order
      const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
      projectPhases.sort((a, b) => {
        const valA = a[sortBy];
        const valB = b[sortBy];
        if (valA < valB) return -1 * sortOrder;
        if (valA > valB) return 1 * sortOrder;
        return 0;
      });
      // --- Pagination ---
      const offset = options.offset || 0;
      const limit = options.limit; // No default limit means return all
      if (limit !== undefined) {
        projectPhases = projectPhases.slice(offset, offset + limit);
      }
       // Add to cache
      phaseCache.set(cacheKey, projectPhases);
      // Set a timeout for cache expiration (e.g., 1 minute for lists)
      setTimeout(() => phaseCache.delete(cacheKey), 1 * 60 * 1000);
      return projectPhases;
    } catch (error) {
      logger.error(`Error listing phases for project ${projectId}`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to list phases', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  /**
   * Update properties of a phase.
   * @param {string} projectId - The ID of the project.
   * @param {string} phaseId - The ID of the phase to update.
   * @param {Object} properties - An object containing properties to update.
   * @returns {Promise<Object>} The updated phase object.
   * @throws {AppError} If phase not found or update fails.
   */
  async updatePhase(projectId, phaseId, properties) {
    logger.debug(`Updating phase ${phaseId} for project ${projectId}`, { properties });
    try {
       // First, get the phase to ensure it exists and belongs to the project
      const existingPhase = await this.getPhase(projectId, phaseId);
       // getPhase handles NotFoundError and AuthorizationError
      // Use the manager to update the phase
      const updatedPhase = this.manager.updatePhase(phaseId, properties);
      if (!updatedPhase) {
        // This case might be redundant if getPhase worked, but good for safety
        throw new AppError(`Phase ${phaseId} not found or update failed`, ErrorTypes.NOT_FOUND, StatusCodes.NOT_FOUND);
      }
      // Invalidate cache
      this._invalidateCacheForPhase(projectId, phaseId);
      logger.info(`Phase ${phaseId} updated successfully for project ${projectId}`);
      return updatedPhase;
    } catch (error) {
      logger.error(`Error updating phase ${phaseId} for project ${projectId}`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update phase', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  /**
   * Set the order of phases within a project.
   * Supports sequential and parallel ordering (represented in phase dependencies).
   * @param {string} projectId - The ID of the project.
   * @param {Array<string>|Object} phaseOrder - An array of phase IDs for sequential order,
   *                                           or a more complex structure for parallel/dependencies.
   *                                           Example (simple sequential): ['phase1', 'phase2', 'phase3']
   *                                           Example (complex): { type: 'sequential', order: [...] } or { type: 'graph', nodes: [...], edges: [...] }
   * @returns {Promise<boolean>} True if ordering was successful.
   * @throws {AppError} If ordering fails or input is invalid.
   */
  async orderPhases(projectId, phaseOrder) {
    logger.debug(`Ordering phases for project ${projectId}`, { phaseOrder });
    try {
      // Validate input
      if (!projectId || !phaseOrder) {
        throw new AppError('Project ID and phase order data are required', ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
      }
      // --- Implementation Strategy ---
      // 1. Fetch all phases for the project.
      // 2. Validate that all IDs in phaseOrder exist and belong to the project.
      // 3. Update the 'order' property (for simple sequential) or 'dependencies' property (for complex)
      //    for each phase based on the provided phaseOrder structure.
      // 4. Use `updatePhase` for each modified phase. This might be inefficient for many phases.
      //    Alternatively, enhance `PhaseConfigManager` with a bulk update or specific ordering method.
      // Let's implement the simple sequential case using 'order' property first.
      if (Array.isArray(phaseOrder)) {
        const phases = await this.listPhases(projectId);
        const phaseMap = new Map(phases.map(p => [p.id, p]));
        // Validate IDs
        for (const phaseId of phaseOrder) {
          if (!phaseMap.has(phaseId)) {
            throw new AppError(`Invalid phase ID ${phaseId} found in order list for project ${projectId}`, ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
          }
        }
         if (phaseOrder.length !== phases.length) {
             // Or handle cases where only a subset is ordered? For now, assume full reorder.
             logger.warn(`Phase order length (${phaseOrder.length}) does not match total phases (${phases.length}) for project ${projectId}. Proceeding with provided order.`);
             // throw new AppError(`Phase order list must contain all phases for project ${projectId}`, ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
         }
        // Update order property sequentially
        // Use Promise.all for concurrent updates
        await Promise.all(phaseOrder.map(async (phaseId, index) => {
          const currentPhase = phaseMap.get(phaseId);
          // Only update if the order actually changed
          if (currentPhase.order !== index + 1) {
             await this.updatePhase(projectId, phaseId, { order: index + 1 });
          }
        }));
        // Invalidate list cache for the project
        this._invalidateCacheForProject(projectId);
        logger.info(`Sequential phase order updated successfully for project ${projectId}`);
        return true;
      } else if (typeof phaseOrder === 'object' && phaseOrder.type === 'graph') {
        // --- Handle complex dependency graph ordering ---
        // This requires updating the `dependencies` array in each phase object.
        // Example: phaseOrder = { type: 'graph', nodes: ['p1', 'p2', 'p3'], edges: [['p1', 'p2'], ['p1', 'p3']] }
        // This implies p2 and p3 depend on p1.
        logger.info(`Processing graph-based phase ordering for project ${projectId}`);
        const phases = await this.listPhases(projectId);
        const phaseMap = new Map(phases.map(p => [p.id, p]));
        // Validate nodes and edges
        const nodeIds = phaseOrder.nodes || [];
        const edgeList = phaseOrder.edges || [];
        for (const nodeId of nodeIds) {
            if (!phaseMap.has(nodeId)) {
                throw new AppError(`Invalid phase ID ${nodeId} found in graph nodes for project ${projectId}`, ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
            }
        }
         for (const [sourceId, targetId] of edgeList) {
             if (!phaseMap.has(sourceId) || !phaseMap.has(targetId)) {
                 throw new AppError(`Invalid phase ID in edge [${sourceId}, ${targetId}] for project ${projectId}`, ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
             }
         }
        // Reset dependencies for all involved nodes first
         await Promise.all(nodeIds.map(async (nodeId) => {
             const currentPhase = phaseMap.get(nodeId);
             if (currentPhase.dependencies && currentPhase.dependencies.length > 0) {
                 await this.updatePhase(projectId, nodeId, { dependencies: [] });
             }
         }));
        // Build dependency map
        const dependencyMap = new Map(); // Map<targetId, sourceId[]>
        for (const [sourceId, targetId] of edgeList) {
          if (!dependencyMap.has(targetId)) {
            dependencyMap.set(targetId, []);
          }
          dependencyMap.get(targetId).push(sourceId);
        }
        // Update dependencies for each phase
        await Promise.all(nodeIds.map(async (nodeId) => {
          const dependencies = dependencyMap.get(nodeId) || [];
          // Check if dependencies actually changed before updating
          const currentPhase = await this.getPhase(projectId, nodeId); // Get fresh data
          const currentDeps = currentPhase.dependencies || [];
          // Simple comparison (might need deep equal for complex objects)
          if (JSON.stringify(dependencies.sort()) !== JSON.stringify(currentDeps.sort())) {
             await this.updatePhase(projectId, nodeId, { dependencies });
          }
        }));
        // Invalidate relevant caches
        this._invalidateCacheForProject(projectId); // Invalidate list and individual phases involved
        logger.info(`Graph-based phase dependencies updated successfully for project ${projectId}`);
        return true;
      } else {
        throw new AppError('Invalid phaseOrder format. Must be an array of IDs or a graph object.', ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
      }
    } catch (error) {
      logger.error(`Error ordering phases for project ${projectId}`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to order phases', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  /**
   * Get the next phase(s) in sequence or based on dependencies.
   * @param {string} projectId - The ID of the project.
   * @param {string} currentPhaseId - The ID of the current phase.
   * @returns {Promise<Array<Object>>} An array of next phase objects. Empty if no next phase.
   * @throws {AppError} If current phase not found or logic fails.
   */
  async getNextPhase(projectId, currentPhaseId) {
    logger.debug(`Getting next phase(s) after ${currentPhaseId} for project ${projectId}`);
    try {
      const currentPhase = await this.getPhase(projectId, currentPhaseId);
      const allPhases = await this.listPhases(projectId); // Ensure sorted by order
      // --- Strategy: Check dependencies first, then sequential order ---
      // 1. Find phases that depend *directly* on the current phase
      const dependentPhases = allPhases.filter(p =>
        p.dependencies && p.dependencies.includes(currentPhaseId)
      );
      if (dependentPhases.length > 0) {
        // If phases depend on the current one, those are the next ones (potentially parallel)
        logger.info(`Found ${dependentPhases.length} phases depending on ${currentPhaseId}`, { dependentPhaseIds: dependentPhases.map(p=>p.id) });
        return dependentPhases;
      }
      // 2. If no phases depend on the current one, check for the next sequential phase based on 'order'
      // Ensure phases are sorted by 'order'
      const sortedPhases = [...allPhases].sort((a, b) => (a.order || 0) - (b.order || 0));
      const currentIndex = sortedPhases.findIndex(p => p.id === currentPhaseId);
      if (currentIndex === -1) {
         // Should not happen if getPhase succeeded, but safety check
         throw new AppError(`Current phase ${currentPhaseId} not found in project list`, ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR);
      }
      if (currentIndex < sortedPhases.length - 1) {
        const nextSequentialPhase = sortedPhases[currentIndex + 1];
        // Check if this next sequential phase has unmet dependencies
        const nextPhaseDeps = nextSequentialPhase.dependencies || [];
        if (nextPhaseDeps.length === 0) {
           logger.info(`Found next sequential phase ${nextSequentialPhase.id} for ${currentPhaseId}`);
           return [nextSequentialPhase]; // Return as an array
        } else {
           // The next *ordered* phase has dependencies, so it's not automatically next.
           // In a strict dependency model, nothing follows sequentially if dependencies aren't met.
           // Or, perhaps the model allows skipping? For now, assume strict dependencies.
           logger.info(`Next sequential phase ${nextSequentialPhase.id} has dependencies, returning empty.`);
           return [];
        }
      }
      // 3. If it's the last phase sequentially and nothing depends on it, there's no next phase.
      logger.info(`Phase ${currentPhaseId} is the last phase or has no dependents.`);
      return [];
    } catch (error) {
      logger.error(`Error getting next phase after ${currentPhaseId} for project ${projectId}`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get next phase', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  /**
   * Validate the configuration of a specific phase.
   * (Placeholder - Implement specific validation rules)
   * @param {string} projectId - The ID of the project.
   * @param {string} phaseId - The ID of the phase to validate.
   * @returns {Promise<{isValid: boolean, errors: Array<string>}>} Validation result.
   * @throws {AppError} If phase not found or validation fails unexpectedly.
   */
  async validatePhase(projectId, phaseId) {
    logger.debug(`Validating phase ${phaseId} for project ${projectId}`);
    try {
      const phase = await this.getPhase(projectId, phaseId);
      const errors = [];
      // Example Validation Rules:
      if (!phase.name || phase.name.trim() === '') {
        errors.push('Phase name cannot be empty.');
      }
      if (typeof phase.order !== 'number' || phase.order < 0) {
        errors.push('Phase order must be a non-negative number.');
      }
      if (phase.dependencies && !Array.isArray(phase.dependencies)) {
        errors.push('Phase dependencies must be an array of phase IDs.');
      }
      // Check if dependencies exist within the same project
      if (phase.dependencies && phase.dependencies.length > 0) {
         const projectPhases = await this.listPhases(projectId);
         const projectPhaseIds = new Set(projectPhases.map(p => p.id));
         for (const depId of phase.dependencies) {
             if (!projectPhaseIds.has(depId)) {
                 errors.push(`Dependency phase ID "${depId}" does not exist in project ${projectId}.`);
             }
             if (depId === phaseId) {
                 errors.push(`Phase cannot depend on itself.`);
             }
             // Add cycle detection if necessary (more complex)
         }
      }
      // Add more validation rules for actions, conditions, type, etc.
      const isValid = errors.length === 0;
      logger.info(`Validation result for phase ${phaseId}: ${isValid ? 'Valid' : 'Invalid'}`, { errors });
      return { isValid, errors };
    } catch (error) {
      logger.error(`Error validating phase ${phaseId} for project ${projectId}`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to validate phase', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  /**
   * Get the status and metrics for a specific phase.
   * (Placeholder - Requires integration with runtime/execution data)
   * @param {string} projectId - The ID of the project.
   * @param {string} phaseId - The ID of the phase.
   * @returns {Promise<Object>} Status and metrics object.
   * @throws {AppError} If phase not found or status retrieval fails.
   */
  async getPhaseStatus(projectId, phaseId) {
    logger.debug(`Getting status for phase ${phaseId} for project ${projectId}`);
    try {
      const phase = await this.getPhase(projectId, phaseId);
      // --- Placeholder Logic ---
      // This needs integration with where the actual phase execution status is stored.
      // For now, return mock data based on phase config.
      const mockStatus = {
        status: phase.status || 'pending', // Assuming phase object might have a status
        progress: phase.progress || 0, // Example metric
        startTime: phase.startTime || null,
        endTime: phase.endTime || null,
        estimatedDuration: phase.estimatedDuration,
        // Add more relevant metrics: errors, logs link, assigned user, etc.
      };
      logger.info(`Retrieved status for phase ${phaseId}`, { status: mockStatus });
      return mockStatus;
    } catch (error) {
      logger.error(`Error getting status for phase ${phaseId} for project ${projectId}`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get phase status', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  /**
   * Create or update a reusable phase template.
   * @param {string} name - The unique name for the template.
   * @param {Object} phaseConfig - The configuration object for the phase template.
   * @returns {Promise<Object>} The saved template configuration.
   * @throws {AppError} If validation fails.
   */
  async setPhaseTemplate(name, phaseConfig) {
    logger.debug(`Setting phase template "${name}"`, { phaseConfig });
    try {
      if (!name || !phaseConfig || typeof phaseConfig !== 'object') {
        throw new AppError('Template name and configuration object are required', ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
      }
      // Basic validation of template config (can be more extensive)
      if (!phaseConfig.name || !phaseConfig.type) {
         // Templates might not need a name *within* the config if identified by the key 'name'
         // Let's require at least a type.
         // throw new AppError('Template configuration must include at least "name" and "type"', ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
         if (!phaseConfig.type) {
             throw new AppError('Template configuration must include at least "type"', ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST);
         }
      }
      // Store the template (in memory for this example, could be persisted)
      const templateData = { ...phaseConfig, templateName: name }; // Add template name for reference
      this.templates.set(name, templateData);
      logger.info(`Phase template "${name}" saved successfully.`);
      return templateData;
    } catch (error) {
      logger.error(`Error setting phase template "${name}"`, error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to set phase template', ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
   /**
   * Get a phase template by name.
   * @param {string} name - The name of the template.
   * @returns {Promise<Object>} The template configuration.
   * @throws {AppError} If template not found.
   */
  async getPhaseTemplate(name) {
    logger.debug(`Getting phase template "${name}"`);
    if (this.templates.has(name)) {
      return this.templates.get(name);
    } else {
      logger.warn(`Phase template "${name}" not found.`);
      throw new AppError(`Phase template "${name}" not found`, ErrorTypes.NOT_FOUND, StatusCodes.NOT_FOUND);
    }
  }
  /**
   * List available phase template names.
   * @returns {Promise<Array<string>>} Array of template names.
   */
  async listPhaseTemplates() {
    logger.debug('Listing available phase templates');
    return Array.from(this.templates.keys());
  }
  /**
   * Create a new phase from a template.
   * @param {string} projectId - The ID of the project.
   * @param {string} templateName - The name of the template to use.
   * @param {Object} [overrides={}] - Properties to override in the template.
   * @returns {Promise<Object>} The created phase object.
   * @throws {AppError} If template not found or creation fails.
   */
  async createPhaseFromTemplate(projectId, templateName, overrides = {}) {
    logger.debug(`Creating phase for project ${projectId} from template "${templateName}"`, { overrides });
    try {
      const template = await this.getPhaseTemplate(templateName);
      // Merge template with overrides
      // Ensure critical fields like name are provided if not in template/overrides
      const phaseData = {
        ...template,
        ...overrides,
        // Ensure a unique name if not provided in overrides
        name: overrides.name || `${template.name || templateName} - Instance ${uuidv4().substring(0, 4)}`,
        templateSource: templateName, // Add reference to the source template
        // Reset fields that should be instance-specific if necessary
        id: undefined, // Ensure a new ID is generated
        status: 'pending',
        progress: 0,
        startTime: null,
        endTime: null,
        createdAt: undefined,
        updatedAt: undefined,
      };
      // Remove the templateName property used internally for storage
      delete phaseData.templateName;
      return this.createPhase(projectId, phaseData);
    } catch (error) {
      logger.error(`Error creating phase from template "${templateName}" for project ${projectId}`, error);
      // Don't re-wrap AppErrors
      if (error instanceof AppError) throw error;
      // Provide more specific error if template wasn't found vs. creation failed
      throw new AppError(`Failed to create phase from template "${templateName}"`, ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, { originalError: error.message });
    }
  }
  // --- Private Helper Methods ---
  /**
   * Invalidate cache entries related to a specific phase.
   * @param {string} projectId - Project ID.
   * @param {string} phaseId - Phase ID.
   */
  _invalidateCacheForPhase(projectId, phaseId) {
    const phaseCacheKey = `phase:${projectId}:${phaseId}`;
    phaseCache.delete(phaseCacheKey);
    logger.debug(`Invalidated cache for phase ${phaseId} in project ${projectId}`);
    // Also invalidate list caches that might contain this phase
    this._invalidateCacheForProject(projectId);
  }
  /**
   * Invalidate all list cache entries for a project.
   * @param {string} projectId - Project ID.
   */
  _invalidateCacheForProject(projectId) {
     const prefix = `listPhases:${projectId}:`;
     let invalidatedCount = 0;
     for (const key of phaseCache.keys()) {
         if (key.startsWith(prefix)) {
             phaseCache.delete(key);
             invalidatedCount++;
         }
     }
     // Also potentially invalidate individual phase caches if order changes affect them
     // For simplicity, we might just clear all project-related phase caches on order changes
     const phasePrefix = `phase:${projectId}:`;
     for (const key of phaseCache.keys()) {
         if (key.startsWith(phasePrefix)) {
             phaseCache.delete(key);
             // We could log this, but it might be noisy
         }
     }
     if (invalidatedCount > 0) {
        logger.debug(`Invalidated ${invalidatedCount} list cache entries for project ${projectId}`);
     }
  }
}
module.exports = PhaseConfigurationSystem;
