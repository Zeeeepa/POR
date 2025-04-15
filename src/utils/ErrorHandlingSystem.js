/**
 * ErrorHandlingSystem.js
 * Comprehensive error handling and logging system for distributed applications
 * 
 * This module provides a standardized approach to error handling and logging
 * with support for multiple log destinations, structured logging, error tracking,
 * and a clean API for error management.
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json, splat, errors } = format;
const { Console, File } = transports;
const EventEmitter = require('events');
const os = require('os');
const config = require('./config');
const baseErrorHandler = require('./errorHandler');
const baseLogger = require('./logger');

// Create a custom event emitter for error and log events
class LogEventEmitter extends EventEmitter {}
const logEvents = new LogEventEmitter();

// Define log levels with numeric values
const LOG_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  http: 4,
  debug: 5,
  trace: 6,
  silly: 7
};

// Define error severity levels
const ERROR_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

// Define log destinations
const LOG_DESTINATIONS = {
  CONSOLE: 'console',
  FILE: 'file',
  SERVICE: 'service',
  DATABASE: 'database',
  MEMORY: 'memory'
};

// Define log formats
const LOG_FORMATS = {
  JSON: 'json',
  TEXT: 'text',
  CSV: 'csv'
};

// In-memory log storage for quick access
const memoryLogs = {
  entries: [],
  maxSize: 1000, // Default max size
  add(entry) {
    this.entries.unshift(entry);
    if (this.entries.length > this.maxSize) {
      this.entries.pop();
    }
    return entry;
  },
  clear() {
    this.entries = [];
  },
  setMaxSize(size) {
    this.maxSize = size;
    if (this.entries.length > this.maxSize) {
      this.entries = this.entries.slice(0, this.maxSize);
    }
  },
  getEntries(options = {}) {
    const { level, limit = this.entries.length, search, from, to } = options;
    
    return this.entries
      .filter(entry => {
        let include = true;
        
        // Filter by log level
        if (level && entry.level !== level) {
          include = false;
        }
        
        // Filter by search term
        if (search && !JSON.stringify(entry).toLowerCase().includes(search.toLowerCase())) {
          include = false;
        }
        
        // Filter by date range
        if (from && new Date(entry.timestamp) < new Date(from)) {
          include = false;
        }
        
        if (to && new Date(entry.timestamp) > new Date(to)) {
          include = false;
        }
        
        return include;
      })
      .slice(0, limit);
  }
};

// Custom error classes
class ExtendedError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.severity = options.severity || ERROR_SEVERITY.MEDIUM;
    this.code = options.code;
    this.context = options.context || {};
    this.cause = options.cause;
    this.tags = options.tags || [];
    this.retryable = options.retryable !== undefined ? options.retryable : true;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      severity: this.severity,
      code: this.code,
      context: this.context,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
      tags: this.tags,
      retryable: this.retryable,
      stack: this.stack
    };
  }
}

// Specific error types
class ValidationError extends ExtendedError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      severity: options.severity || ERROR_SEVERITY.MEDIUM,
      code: options.code || 'VALIDATION_ERROR'
    });
    this.validationErrors = options.validationErrors || [];
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    };
  }
}

class NetworkError extends ExtendedError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      severity: options.severity || ERROR_SEVERITY.HIGH,
      code: options.code || 'NETWORK_ERROR'
    });
    this.request = options.request;
    this.response = options.response;
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      request: this.request,
      response: this.response
    };
  }
}

class TimeoutError extends ExtendedError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      severity: options.severity || ERROR_SEVERITY.HIGH,
      code: options.code || 'TIMEOUT_ERROR'
    });
    this.timeoutMs = options.timeoutMs;
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      timeoutMs: this.timeoutMs
    };
  }
}

class DatabaseError extends ExtendedError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      severity: options.severity || ERROR_SEVERITY.HIGH,
      code: options.code || 'DATABASE_ERROR'
    });
    this.query = options.query;
    this.params = options.params;
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      query: this.query,
      params: this.params
    };
  }
}

class ConfigurationError extends ExtendedError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      severity: options.severity || ERROR_SEVERITY.CRITICAL,
      code: options.code || 'CONFIGURATION_ERROR'
    });
    this.configKey = options.configKey;
    this.configValue = options.configValue;
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      configKey: this.configKey,
      configValue: this.configValue
    };
  }
}

// Create custom Winston formats
const customFormats = {
  // Detailed JSON format with metadata
  detailedJson: combine(
    timestamp(),
    errors({ stack: true }),
    splat(),
    json()
  ),
  
  // Colorized console format
  colorizedConsole: combine(
    colorize(),
    timestamp(),
    printf(({ level, message, timestamp, ...metadata }) => {
      let metaStr = '';
      if (Object.keys(metadata).length > 0 && metadata.stack) {
        metaStr = `\n${metadata.stack}`;
      } else if (Object.keys(metadata).length > 0) {
        metaStr = `\n${JSON.stringify(metadata, null, 2)}`;
      }
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
  ),
  
  // CSV format for file logging
  csv: combine(
    timestamp(),
    printf(({ level, message, timestamp, ...metadata }) => {
      const metaStr = Object.keys(metadata).length > 0 
        ? JSON.stringify(metadata).replace(/"/g, '""') 
        : '';
      return `"${timestamp}","${level}","${message.replace(/"/g, '""')}","${metaStr}"`;
    })
  )
};

// Default logger options
const defaultLoggerOptions = {
  level: config.logging?.level || 'info',
  format: customFormats.detailedJson,
  defaultMeta: { 
    service: config.logging?.serviceName || 'service',
    hostname: os.hostname(),
    pid: process.pid
  },
  transports: [
    new Console({
      format: customFormats.colorizedConsole,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    })
  ],
  exitOnError: false
};

// Error handling system implementation
const ErrorHandlingSystem = {
  // Constants
  LOG_LEVELS,
  ERROR_SEVERITY,
  LOG_DESTINATIONS,
  LOG_FORMATS,
  
  // Error classes
  ExtendedError,
  ValidationError,
  NetworkError,
  TimeoutError,
  DatabaseError,
  ConfigurationError,
  
  // Event emitter for log events
  events: logEvents,
  
  // In-memory logs
  memoryLogs,
  
  // Registered error handlers
  errorHandlers: new Map(),
  
  // Registered loggers
  loggers: new Map(),
  
  // Global log level
  globalLogLevel: config.logging?.level || 'info',
  
  /**
   * Create a new logger instance
   * @param {string} name - Logger name
   * @param {Object} options - Logger options
   * @param {string} [options.level] - Log level
   * @param {Array} [options.destinations] - Log destinations
   * @param {Object} [options.defaultMeta] - Default metadata
   * @param {string} [options.format] - Log format
   * @returns {Object} Logger instance
   */
  createLogger(name, options = {}) {
    if (!name) {
      throw new ValidationError('Logger name is required');
    }
    
    // If logger already exists, return it
    if (this.loggers.has(name)) {
      return this.loggers.get(name);
    }
    
    const loggerOptions = {
      ...defaultLoggerOptions,
      defaultMeta: {
        ...defaultLoggerOptions.defaultMeta,
        ...options.defaultMeta,
        logger: name
      }
    };
    
    // Set log level
    if (options.level) {
      loggerOptions.level = options.level;
    }
    
    // Configure transports based on destinations
    const destinations = options.destinations || [LOG_DESTINATIONS.CONSOLE];
    const loggerTransports = [];
    
    // Add console transport
    if (destinations.includes(LOG_DESTINATIONS.CONSOLE)) {
      loggerTransports.push(
        new Console({
          format: customFormats.colorizedConsole,
          level: options.level || this.globalLogLevel
        })
      );
    }
    
    // Add file transport
    if (destinations.includes(LOG_DESTINATIONS.FILE)) {
      const logsDir = config.logging?.directory || path.join(process.cwd(), 'logs');
      fs.ensureDirSync(logsDir);
      
      // Add combined log file
      loggerTransports.push(
        new File({
          filename: path.join(logsDir, `${name}.log`),
          format: options.format === LOG_FORMATS.CSV 
            ? customFormats.csv 
            : customFormats.detailedJson,
          maxsize: config.logging?.maxSize || 5242880, // 5MB
          maxFiles: config.logging?.maxFiles || 5,
          level: options.level || this.globalLogLevel
        })
      );
      
      // Add error log file
      loggerTransports.push(
        new File({
          filename: path.join(logsDir, `${name}-error.log`),
          format: options.format === LOG_FORMATS.CSV 
            ? customFormats.csv 
            : customFormats.detailedJson,
          maxsize: config.logging?.maxSize || 5242880, // 5MB
          maxFiles: config.logging?.maxFiles || 5,
          level: 'error'
        })
      );
    }
    
    // Set transports
    loggerOptions.transports = loggerTransports;
    
    // Create Winston logger
    const winstonLogger = createLogger(loggerOptions);
    
    // Add memory transport
    if (destinations.includes(LOG_DESTINATIONS.MEMORY)) {
      winstonLogger.on('logging', (transport, level, msg, meta) => {
        if (transport.name === 'console') {
          this.memoryLogs.add({
            timestamp: new Date().toISOString(),
            level,
            message: msg,
            logger: name,
            ...meta
          });
        }
      });
    }
    
    // Create enhanced logger with additional methods
    const enhancedLogger = {
      // Standard log methods
      error: (message, meta = {}) => this._logWithContext(winstonLogger, 'error', message, meta, name),
      warn: (message, meta = {}) => this._logWithContext(winstonLogger, 'warn', message, meta, name),
      info: (message, meta = {}) => this._logWithContext(winstonLogger, 'info', message, meta, name),
      http: (message, meta = {}) => this._logWithContext(winstonLogger, 'http', message, meta, name),
      debug: (message, meta = {}) => this._logWithContext(winstonLogger, 'debug', message, meta, name),
      trace: (message, meta = {}) => this._logWithContext(winstonLogger, 'debug', message, { ...meta, trace: true }, name),
      
      // Log an error with stack trace
      logError: (message, error, meta = {}) => {
        if (error && error instanceof Error) {
          this._logWithContext(
            winstonLogger, 
            'error', 
            `${message}: ${error.message}`, 
            { 
              ...meta, 
              stack: error.stack,
              errorName: error.name,
              errorCode: error.code,
              errorDetails: error.toJSON ? error.toJSON() : undefined
            },
            name
          );
        } else {
          this._logWithContext(winstonLogger, 'error', message, meta, name);
        }
      },
      
      // Set logger level
      setLevel: (level) => {
        if (!LOG_LEVELS.hasOwnProperty(level)) {
          throw new ValidationError(`Invalid log level: ${level}`);
        }
        winstonLogger.level = level;
        return enhancedLogger;
      },
      
      // Get current logger level
      getLevel: () => winstonLogger.level,
      
      // Get logger name
      getName: () => name,
      
      // Create a child logger with additional metadata
      child: (childMeta = {}) => {
        const childName = `${name}:child`;
        const childLogger = this.createLogger(childName, {
          ...options,
          defaultMeta: {
            ...options.defaultMeta,
            ...childMeta
          }
        });
        return childLogger;
      }
    };
    
    // Store logger
    this.loggers.set(name, enhancedLogger);
    
    return enhancedLogger;
  },
  
  /**
   * Log a message with context
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} context - Log context
   * @returns {Object} Log entry
   */
  logMessage(level, message, context = {}) {
    if (!LOG_LEVELS.hasOwnProperty(level)) {
      throw new ValidationError(`Invalid log level: ${level}`);
    }
    
    // Get default logger
    const logger = this.loggers.get('default') || this.createLogger('default');
    
    // Log message
    return this._logWithContext(logger, level, message, context);
  },
  
  /**
   * Internal method to log with context
   * @private
   */
  _logWithContext(logger, level, message, context = {}, loggerName = 'default') {
    // Create log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      logger: loggerName,
      ...context
    };
    
    // Log to Winston
    logger[level](message, context);
    
    // Emit log event
    this.events.emit('log', logEntry);
    this.events.emit(`log:${level}`, logEntry);
    
    return logEntry;
  },
  
  /**
   * Create a standardized error
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @param {Error|Object} [cause] - Error cause
   * @param {Object} [options] - Additional options
   * @returns {Error} Standardized error
   */
  createError(type, message, cause, options = {}) {
    // Validate error type
    if (!type) {
      throw new ValidationError('Error type is required');
    }
    
    // Determine error class based on type
    let ErrorClass;
    switch (type.toLowerCase()) {
      case 'validation':
        ErrorClass = ValidationError;
        break;
      case 'network':
        ErrorClass = NetworkError;
        break;
      case 'timeout':
        ErrorClass = TimeoutError;
        break;
      case 'database':
        ErrorClass = DatabaseError;
        break;
      case 'configuration':
        ErrorClass = ConfigurationError;
        break;
      default:
        ErrorClass = ExtendedError;
    }
    
    // Create error instance
    const error = new ErrorClass(message, {
      ...options,
      cause
    });
    
    // Log error if requested
    if (options.log !== false) {
      const logger = this.loggers.get(options.logger || 'default') || this.createLogger('default');
      logger.logError(message, error, { context: options.context });
    }
    
    // Emit error event
    this.events.emit('error', error);
    this.events.emit(`error:${type.toLowerCase()}`, error);
    
    return error;
  },
  
  /**
   * Handle an error with options
   * @param {Error} error - Error to handle
   * @param {Object} [options={}] - Error handling options
   * @param {boolean} [options.log=true] - Whether to log the error
   * @param {boolean} [options.rethrow=false] - Whether to rethrow the error
   * @param {string} [options.logger='default'] - Logger to use
   * @param {Object} [options.context={}] - Additional context
   * @returns {Object} Error handling result
   */
  handleError(error, options = {}) {
    const { 
      log = true, 
      rethrow = false, 
      logger: loggerName = 'default',
      context = {}
    } = options;
    
    // Get logger
    const logger = this.loggers.get(loggerName) || this.createLogger(loggerName);
    
    // Convert to standardized error if needed
    const standardizedError = error instanceof ExtendedError 
      ? error 
      : this._convertToStandardError(error, options);
    
    // Log error if requested
    if (log) {
      logger.logError(standardizedError.message, standardizedError, context);
    }
    
    // Check for registered error handlers
    const errorType = standardizedError.name;
    if (this.errorHandlers.has(errorType)) {
      try {
        const handler = this.errorHandlers.get(errorType);
        const result = handler(standardizedError, options);
        
        // Emit handled event
        this.events.emit('error:handled', {
          error: standardizedError,
          handler: errorType,
          result
        });
        
        // Return result
        return {
          error: standardizedError,
          handled: true,
          result
        };
      } catch (handlerError) {
        // Log handler error
        logger.logError(
          `Error handler for ${errorType} failed`, 
          handlerError, 
          { originalError: standardizedError }
        );
        
        // Rethrow if requested
        if (rethrow) {
          throw standardizedError;
        }
        
        // Return error
        return {
          error: standardizedError,
          handled: false,
          handlerError
        };
      }
    }
    
    // No handler found
    // Rethrow if requested
    if (rethrow) {
      throw standardizedError;
    }
    
    // Return error
    return {
      error: standardizedError,
      handled: false
    };
  },
  
  /**
   * Convert any error to a standardized error
   * @private
   */
  _convertToStandardError(error, options = {}) {
    if (error instanceof ExtendedError) {
      return error;
    }
    
    // Check for common error patterns to determine type
    const message = error.message || 'Unknown error';
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
      return new NetworkError(message, {
        ...options,
        code: error.code,
        cause: error
      });
    }
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      return new TimeoutError(message, {
        ...options,
        code: error.code,
        cause: error
      });
    }
    
    if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
      return new ValidationError(message, {
        ...options,
        code: error.code,
        cause: error,
        validationErrors: error.validationErrors || error.errors || []
      });
    }
    
    // Default to extended error
    return new ExtendedError(message, {
      ...options,
      code: error.code,
      cause: error
    });
  },
  
  /**
   * Register a custom error handler
   * @param {string} type - Error type to handle
   * @param {Function} handler - Error handler function
   * @returns {boolean} Registration success
   */
  registerErrorHandler(type, handler) {
    if (!type || typeof handler !== 'function') {
      throw new ValidationError('Error type and handler function are required');
    }
    
    this.errorHandlers.set(type, handler);
    return true;
  },
  
  /**
   * Set the global log level
   * @param {string} level - Log level
   * @returns {boolean} Success
   */
  setLogLevel(level) {
    if (!LOG_LEVELS.hasOwnProperty(level)) {
      throw new ValidationError(`Invalid log level: ${level}`);
    }
    
    this.globalLogLevel = level;
    
    // Update all loggers
    for (const [name, logger] of this.loggers.entries()) {
      logger.setLevel(level);
    }
    
    return true;
  },
  
  /**
   * Get log entries with filtering options
   * @param {Object} options - Filtering options
   * @param {string} [options.level] - Filter by log level
   * @param {number} [options.limit] - Maximum number of entries to return
   * @param {string} [options.search] - Search term
   * @param {string} [options.from] - Start date
   * @param {string} [options.to] - End date
   * @param {string} [options.logger] - Filter by logger name
   * @returns {Array} Filtered log entries
   */
  getLogEntries(options = {}) {
    return this.memoryLogs.getEntries({
      ...options,
      logger: options.logger
    });
  },
  
  /**
   * Create a log stream for real-time logging
   * @param {Object} options - Stream options
   * @param {string} [options.level] - Minimum log level
   * @param {Function} [options.filter] - Filter function
   * @returns {EventEmitter} Log stream
   */
  createLogStream(options = {}) {
    const stream = new EventEmitter();
    const { level, filter } = options;
    
    // Create event handler
    const handleLog = (logEntry) => {
      // Check level
      if (level && LOG_LEVELS[logEntry.level] > LOG_LEVELS[level]) {
        return;
      }
      
      // Apply custom filter
      if (filter && !filter(logEntry)) {
        return;
      }
      
      // Emit log event
      stream.emit('data', logEntry);
    };
    
    // Register event listener
    this.events.on('log', handleLog);
    
    // Add cleanup method
    stream.close = () => {
      this.events.removeListener('log', handleLog);
      stream.removeAllListeners();
    };
    
    return stream;
  },
  
  /**
   * Archive logs based on criteria
   * @param {Object} options - Archive options
   * @param {string} [options.before] - Archive logs before this date
   * @param {string} [options.logger] - Archive logs for specific logger
   * @param {string} [options.destination] - Archive destination
   * @returns {Object} Archive result
   */
  archiveLogs(options = {}) {
    const { 
      before = new Date().toISOString(),
      logger,
      destination = path.join(config.logging?.directory || 'logs', 'archives')
    } = options;
    
    // Ensure archive directory exists
    fs.ensureDirSync(destination);
    
    // Generate archive filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const loggerSuffix = logger ? `-${logger}` : '';
    const archiveFilename = `logs-${timestamp}${loggerSuffix}.json`;
    const archivePath = path.join(destination, archiveFilename);
    
    // Get logs to archive
    const logsToArchive = this.getLogEntries({
      to: before,
      logger
    });
    
    // Write logs to archive file
    fs.writeFileSync(archivePath, JSON.stringify(logsToArchive, null, 2));
    
    // Remove archived logs from memory
    const beforeDate = new Date(before);
    this.memoryLogs.entries = this.memoryLogs.entries.filter(entry => {
      return new Date(entry.timestamp) >= beforeDate || (logger && entry.logger !== logger);
    });
    
    return {
      archived: logsToArchive.length,
      archivePath,
      timestamp: new Date().toISOString()
    };
  },
  
  /**
   * Parse a log entry into structured data
   * @param {string|Object} entry - Log entry to parse
   * @returns {Object} Structured log data
   */
  parseLogEntry(entry) {
    // If entry is already an object, return it
    if (typeof entry === 'object' && entry !== null) {
      return entry;
    }
    
    // Try to parse as JSON
    try {
      return JSON.parse(entry);
    } catch (e) {
      // Not JSON, try to parse as text
      const textPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z) \[(\w+)\]: (.+)$/;
      const match = textPattern.exec(entry);
      
      if (match) {
        return {
          timestamp: match[1],
          level: match[2],
          message: match[3]
        };
      }
      
      // CSV format
      const csvPattern = /"([^"]*)","([^"]*)","([^"]*)","(.*)"/;
      const csvMatch = csvPattern.exec(entry);
      
      if (csvMatch) {
        let metadata = {};
        try {
          metadata = JSON.parse(csvMatch[4].replace(/""/g, '"'));
        } catch (e) {
          // Ignore parsing errors
        }
        
        return {
          timestamp: csvMatch[1],
          level: csvMatch[2],
          message: csvMatch[3].replace(/""/g, '"'),
          ...metadata
        };
      }
      
      // Return as raw message
      return {
        timestamp: new Date().toISOString(),
        level: 'unknown',
        message: entry
      };
    }
  },
  
  /**
   * Initialize the error handling system
   * @param {Object} options - Initialization options
   * @returns {Object} ErrorHandlingSystem
   */
  initialize(options = {}) {
    // Create default logger
    this.createLogger('default', options);
    
    // Set up error handlers for uncaught exceptions and unhandled rejections
    if (options.handleUncaught !== false) {
      process.on('uncaughtException', (error) => {
        const logger = this.loggers.get('default');
        logger.logError('Uncaught exception', error);
        
        // Exit process if configured
        if (options.exitOnUncaught !== false) {
          process.exit(1);
        }
      });
      
      process.on('unhandledRejection', (reason, promise) => {
        const logger = this.loggers.get('default');
        logger.logError('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)));
        
        // Exit process if configured
        if (options.exitOnUnhandled !== false) {
          process.exit(1);
        }
      });
    }
    
    return this;
  }
};

// Initialize with default options
ErrorHandlingSystem.initialize();

module.exports = ErrorHandlingSystem;
