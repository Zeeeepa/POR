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
  WEBHOOK: 'WebhookError',
  RATE_LIMIT: 'RateLimitError',
  TIMEOUT: 'TimeoutError',
  NETWORK: 'NetworkError',
  RESOURCE_EXHAUSTED: 'ResourceExhaustedError'
};

/**
 * HTTP status codes for consistent error responses
 */
const StatusCodes = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
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
   * HTTP status codes
   */
  StatusCodes,
  
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
    return new AppError(message, ErrorTypes.VALIDATION, StatusCodes.BAD_REQUEST, details);
  },
  
  /**
   * Create an authentication error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Authentication error details
   * @returns {AppError} Authentication error
   */
  authenticationError(message, details = {}) {
    return new AppError(message, ErrorTypes.AUTHENTICATION, StatusCodes.UNAUTHORIZED, details);
  },
  
  /**
   * Create an authorization error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Authorization error details
   * @returns {AppError} Authorization error
   */
  authorizationError(message, details = {}) {
    return new AppError(message, ErrorTypes.AUTHORIZATION, StatusCodes.FORBIDDEN, details);
  },
  
  /**
   * Create a not found error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Not found error details
   * @returns {AppError} Not found error
   */
  notFoundError(message, details = {}) {
    return new AppError(message, ErrorTypes.NOT_FOUND, StatusCodes.NOT_FOUND, details);
  },
  
  /**
   * Create a conflict error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Conflict error details
   * @returns {AppError} Conflict error
   */
  conflictError(message, details = {}) {
    return new AppError(message, ErrorTypes.CONFLICT, StatusCodes.CONFLICT, details);
  },
  
  /**
   * Create an external service error
   * @param {string} message - Error message
   * @param {Object} [details={}] - External service error details
   * @returns {AppError} External service error
   */
  externalServiceError(message, details = {}) {
    return new AppError(message, ErrorTypes.EXTERNAL_SERVICE, StatusCodes.BAD_GATEWAY, details);
  },
  
  /**
   * Create an internal error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Internal error details
   * @returns {AppError} Internal error
   */
  internalError(message, details = {}) {
    return new AppError(message, ErrorTypes.INTERNAL, StatusCodes.INTERNAL_SERVER_ERROR, details);
  },
  
  /**
   * Create a webhook error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Webhook error details
   * @returns {AppError} Webhook error
   */
  webhookError(message, details = {}) {
    return new AppError(message, ErrorTypes.WEBHOOK, StatusCodes.BAD_REQUEST, details);
  },
  
  /**
   * Create a rate limit error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Rate limit error details
   * @returns {AppError} Rate limit error
   */
  rateLimitError(message, details = {}) {
    return new AppError(message, ErrorTypes.RATE_LIMIT, StatusCodes.TOO_MANY_REQUESTS, details);
  },
  
  /**
   * Create a timeout error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Timeout error details
   * @returns {AppError} Timeout error
   */
  timeoutError(message, details = {}) {
    return new AppError(message, ErrorTypes.TIMEOUT, StatusCodes.GATEWAY_TIMEOUT, details);
  },
  
  /**
   * Create a network error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Network error details
   * @returns {AppError} Network error
   */
  networkError(message, details = {}) {
    return new AppError(message, ErrorTypes.NETWORK, StatusCodes.SERVICE_UNAVAILABLE, details);
  },
  
  /**
   * Create a resource exhausted error
   * @param {string} message - Error message
   * @param {Object} [details={}] - Resource exhausted error details
   * @returns {AppError} Resource exhausted error
   */
  resourceExhaustedError(message, details = {}) {
    return new AppError(message, ErrorTypes.RESOURCE_EXHAUSTED, StatusCodes.TOO_MANY_REQUESTS, details);
  },
  
  /**
   * Handle an error by logging it and returning a standardized response
   * @param {Error} error - Error to handle
   * @param {Object} [options={}] - Error handling options
   * @param {boolean} [options.logError=true] - Whether to log the error
   * @param {boolean} [options.includeStack=false] - Whether to include stack trace in response
   * @param {boolean} [options.sanitize=true] - Whether to sanitize sensitive information
   * @returns {Object} Standardized error response
   */
  handleError(error, options = {}) {
    const { logError = true, includeStack = false, sanitize = true } = options;
    
    // Default error response
    const errorResponse = {
      error: {
        type: ErrorTypes.INTERNAL,
        message: 'An unexpected error occurred',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR
      }
    };
    
    // Handle AppError instances
    if (error instanceof AppError) {
      errorResponse.error = {
        type: error.name,
        message: error.message,
        statusCode: error.statusCode,
        details: sanitize ? this.sanitizeErrorDetails(error.details) : error.details,
        timestamp: error.timestamp
      };
    } else {
      // Handle standard errors
      errorResponse.error = {
        type: ErrorTypes.INTERNAL,
        message: error.message || 'An unexpected error occurred',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
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
   * Sanitize error details to remove sensitive information
   * @param {Object} details - Error details to sanitize
   * @returns {Object} Sanitized error details
   */
  sanitizeErrorDetails(details = {}) {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential', 'apiKey'];
    const sanitized = { ...details };
    
    // Recursively sanitize objects
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const result = Array.isArray(obj) ? [...obj] : { ...obj };
      
      for (const key in result) {
        if (typeof result[key] === 'object' && result[key] !== null) {
          result[key] = sanitizeObject(result[key]);
        } else if (typeof result[key] === 'string' && 
                  sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
          result[key] = '[REDACTED]';
        }
      }
      
      return result;
    };
    
    return sanitizeObject(sanitized);
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
  },
  
  /**
   * Convert any error to an AppError
   * @param {Error} error - Error to convert
   * @returns {AppError} Converted error
   */
  convertToAppError(error) {
    if (error instanceof AppError) {
      return error;
    }
    
    // Check for common error patterns to determine type
    const message = error.message || 'Unknown error';
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return this.networkError(message, { originalError: error.message, code: error.code });
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      return this.timeoutError(message, { originalError: error.message, code: error.code });
    }
    
    if (error.response && error.response.status === 429) {
      return this.rateLimitError(message, { originalError: error.message });
    }
    
    if (error.response && error.response.status === 404) {
      return this.notFoundError(message, { originalError: error.message });
    }
    
    if (error.response && error.response.status === 401) {
      return this.authenticationError(message, { originalError: error.message });
    }
    
    if (error.response && error.response.status === 403) {
      return this.authorizationError(message, { originalError: error.message });
    }
    
    // Default to internal error
    return this.internalError(message, { originalError: error.message });
  }
};

module.exports = errorHandler;
