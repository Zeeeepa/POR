/**
 * errorHandler.js
 * Standardized error handling utilities
 */

const logger = require('./logger');

/**
 * Error types for consistent error handling
 */
const ErrorTypes = {
  VALIDATION: 'ValidationError',
  AUTHENTICATION: 'AuthenticationError',
  AUTHORIZATION: 'AuthorizationError',
  NOT_FOUND: 'NotFoundError',
  CONFLICT: 'ConflictError',
  EXTERNAL_SERVICE: 'ExternalServiceError',
  INTERNAL: 'InternalError',
  WEBHOOK: 'WebhookError'
};

/**
 * Custom error class with type and status code
 */
class AppError extends Error {
  /**
   * Create a new application error
   * @param {string} message - Error message
   * @param {string} type - Error type from ErrorTypes
   * @param {number} statusCode - HTTP status code
   * @param {Object} [details={}] - Additional error details
   */
  constructor(message, type = ErrorTypes.INTERNAL, statusCode = 500, details = {}) {
    super(message);
    this.name = type;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  /**
   * Convert error to JSON representation
   * @returns {Object} JSON representation of error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Error handler utility
 */
const errorHandler = {
  /**
   * Error type constants
   */
  ErrorTypes,
  
  /**
   * AppError class
   */
  AppError,
  
  /**
   * Create a validation error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Validation error details
   * @returns {AppError} Validation error
   */
  validationError(message, details = {}) {
    return new AppError(message, ErrorTypes.VALIDATION, 400, details);
  },
  
  /**
   * Create an authentication error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Authentication error details
   * @returns {AppError} Authentication error
   */
  authenticationError(message, details = {}) {
    return new AppError(message, ErrorTypes.AUTHENTICATION, 401, details);
  },
  
  /**
   * Create an authorization error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Authorization error details
   * @returns {AppError} Authorization error
   */
  authorizationError(message, details = {}) {
    return new AppError(message, ErrorTypes.AUTHORIZATION, 403, details);
  },
  
  /**
   * Create a not found error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Not found error details
   * @returns {AppError} Not found error
   */
  notFoundError(message, details = {}) {
    return new AppError(message, ErrorTypes.NOT_FOUND, 404, details);
  },
  
  /**
   * Create a conflict error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Conflict error details
   * @returns {AppError} Conflict error
   */
  conflictError(message, details = {}) {
    return new AppError(message, ErrorTypes.CONFLICT, 409, details);
  },
  
  /**
   * Create an external service error
   * @param {string} message - Error message
   * @param {Object} [details={}] - External service error details
   * @returns {AppError} External service error
   */
  externalServiceError(message, details = {}) {
    return new AppError(message, ErrorTypes.EXTERNAL_SERVICE, 502, details);
  },
  
  /**
   * Create an internal error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Internal error details
   * @returns {AppError} Internal error
   */
  internalError(message, details = {}) {
    return new AppError(message, ErrorTypes.INTERNAL, 500, details);
  },
  
  /**
   * Create a webhook error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Webhook error details
   * @returns {AppError} Webhook error
   */
  webhookError(message, details = {}) {
    return new AppError(message, ErrorTypes.WEBHOOK, 400, details);
  },
  
  /**
   * Handle an error by logging it and returning a standardized response
   * @param {Error} error - Error to handle
   * @param {Object} [options={}] - Error handling options
   * @param {boolean} [options.logError=true] - Whether to log the error
   * @param {boolean} [options.includeStack=false] - Whether to include stack trace in response
   * @returns {Object} Standardized error response
   */
  handleError(error, options = {}) {
    const { logError = true, includeStack = false } = options;
    
    // Default error response
    const errorResponse = {
      error: {
        type: ErrorTypes.INTERNAL,
        message: 'An unexpected error occurred',
        statusCode: 500
      }
    };
    
    // Handle AppError instances
    if (error instanceof AppError) {
      errorResponse.error = {
        type: error.name,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
        timestamp: error.timestamp
      };
    } else {
      // Handle standard errors
      errorResponse.error = {
        type: ErrorTypes.INTERNAL,
        message: error.message || 'An unexpected error occurred',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
    }
    
    // Include stack trace if requested
    if (includeStack && error.stack) {
      errorResponse.error.stack = error.stack;
    }
    
    // Log the error
    if (logError) {
      if (errorResponse.error.statusCode >= 500) {
        logger.error(`${errorResponse.error.type}: ${errorResponse.error.message}`, {
          error: error.stack || error.toString(),
          details: errorResponse.error.details
        });
      } else {
        logger.warn(`${errorResponse.error.type}: ${errorResponse.error.message}`, {
          details: errorResponse.error.details
        });
      }
    }
    
    return errorResponse;
  },
  
  /**
   * Express middleware for handling errors
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  expressErrorHandler(err, req, res, next) {
    const errorResponse = this.handleError(err);
    res.status(errorResponse.error.statusCode).json(errorResponse);
  },
  
  /**
   * Async handler for Express routes
   * @param {Function} fn - Async route handler function
   * @returns {Function} Express middleware function
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
};

module.exports = errorHandler;
