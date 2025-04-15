/**
 * ProjectManagementError.js
 * Custom error classes for the project management system
 */

/**
 * Base error class for project management system
 * @extends Error
 */
class ProjectManagementError extends Error {
  /**
   * Create a new ProjectManagementError
   * @param {string} message - Error message
   * @param {Object} [options] - Additional error options
   * @param {string} [options.code] - Error code
   * @param {*} [options.details] - Additional error details
   */
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'PROJECT_MANAGEMENT_ERROR';
    this.details = options.details || null;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a project is not found
 * @extends ProjectManagementError
 */
class ProjectNotFoundError extends ProjectManagementError {
  /**
   * Create a new ProjectNotFoundError
   * @param {string} projectId - ID of the project that was not found
   * @param {Object} [options] - Additional error options
   */
  constructor(projectId, options = {}) {
    super(`Project not found: ${projectId}`, {
      code: 'PROJECT_NOT_FOUND',
      details: { projectId, ...options.details },
      ...options
    });
  }
}

/**
 * Error thrown when a project already exists
 * @extends ProjectManagementError
 */
class ProjectExistsError extends ProjectManagementError {
  /**
   * Create a new ProjectExistsError
   * @param {string} projectId - ID of the project that already exists
   * @param {Object} [options] - Additional error options
   */
  constructor(projectId, options = {}) {
    super(`Project already exists: ${projectId}`, {
      code: 'PROJECT_EXISTS',
      details: { projectId, ...options.details },
      ...options
    });
  }
}

/**
 * Error thrown when a project validation fails
 * @extends ProjectManagementError
 */
class ProjectValidationError extends ProjectManagementError {
  /**
   * Create a new ProjectValidationError
   * @param {string} message - Validation error message
   * @param {Object} [options] - Additional error options
   * @param {Object} [options.validationErrors] - Validation errors by field
   */
  constructor(message, options = {}) {
    super(message, {
      code: 'PROJECT_VALIDATION_ERROR',
      details: { validationErrors: options.validationErrors || {} },
      ...options
    });
  }
}

/**
 * Error thrown when a project operation fails
 * @extends ProjectManagementError
 */
class ProjectOperationError extends ProjectManagementError {
  /**
   * Create a new ProjectOperationError
   * @param {string} message - Operation error message
   * @param {Object} [options] - Additional error options
   * @param {string} [options.operation] - The operation that failed
   */
  constructor(message, options = {}) {
    super(message, {
      code: 'PROJECT_OPERATION_ERROR',
      details: { operation: options.operation || 'unknown' },
      ...options
    });
  }
}

/**
 * Error thrown when a project dependency is not found or invalid
 * @extends ProjectManagementError
 */
class ProjectDependencyError extends ProjectManagementError {
  /**
   * Create a new ProjectDependencyError
   * @param {string} message - Dependency error message
   * @param {Object} [options] - Additional error options
   * @param {Array} [options.dependencies] - The dependencies that caused the error
   */
  constructor(message, options = {}) {
    super(message, {
      code: 'PROJECT_DEPENDENCY_ERROR',
      details: { dependencies: options.dependencies || [] },
      ...options
    });
  }
}

module.exports = {
  ProjectManagementError,
  ProjectNotFoundError,
  ProjectExistsError,
  ProjectValidationError,
  ProjectOperationError,
  ProjectDependencyError
};
