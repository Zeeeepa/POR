/**
 * logger.js
 * Centralized logging utility with multiple levels and file output
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');
const config = require('./config');

// Ensure logs directory exists
const logsDir = config.logging.directory;
fs.ensureDirSync(logsDir);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ level, message, timestamp, ...metadata }) => {
      let metaStr = '';
      if (Object.keys(metadata).length > 0 && metadata.stack !== undefined) {
        metaStr = `\n${metadata.stack}`;
      } else if (Object.keys(metadata).length > 0) {
        metaStr = `\n${JSON.stringify(metadata, null, 2)}`;
      }
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    }
  )
);

// Create the logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: config.logging.serviceName },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: consoleFormat
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
    })
  ],
  // Don't exit on uncaught exceptions
  exitOnError: false
});

// Add a stream for Morgan HTTP logger integration
logger.stream = {
  write: function(message) {
    logger.info(message.trim());
  }
};

/**
 * Log an error with stack trace
 * @param {string} message - Error message
 * @param {Error} [error] - Error object
 */
logger.logError = function(message, error) {
  if (error && error instanceof Error) {
    this.error(`${message}: ${error.message}`, { stack: error.stack });
  } else {
    this.error(message);
  }
};

/**
 * Log a debug message with optional metadata
 * @param {string} message - Debug message
 * @param {Object} [metadata] - Additional metadata
 */
logger.debug = function(message, metadata) {
  this.log('debug', message, metadata);
};

module.exports = logger;
