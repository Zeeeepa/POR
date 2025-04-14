/**
 * logger.js
 * A simple, configurable logging utility for the application.
 * Supports different log levels and output formats.
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
fs.ensureDirSync(logsDir);

// Define log levels and colors
const logLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
  }
};

// Apply colors to Winston
winston.addColors(logLevels.colors);

// Create custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// Create console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  levels: logLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Write logs to files
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log') 
    }),
    // Console output
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  // Don't exit on uncaught exceptions
  exitOnError: false
});

// Add a simple wrapper to handle objects and errors better
const enhancedLogger = {
  error: (message, meta = {}) => {
    if (message instanceof Error) {
      logger.error(`${message.message} - ${message.stack}`, { meta });
    } else if (typeof message === 'object') {
      logger.error(JSON.stringify(message), { meta });
    } else {
      logger.error(message, { meta });
    }
  },
  
  warn: (message, meta = {}) => {
    if (typeof message === 'object') {
      logger.warn(JSON.stringify(message), { meta });
    } else {
      logger.warn(message, { meta });
    }
  },
  
  info: (message, meta = {}) => {
    if (typeof message === 'object') {
      logger.info(JSON.stringify(message), { meta });
    } else {
      logger.info(message, { meta });
    }
  },
  
  debug: (message, meta = {}) => {
    if (typeof message === 'object') {
      logger.debug(JSON.stringify(message), { meta });
    } else {
      logger.debug(message, { meta });
    }
  }
};

module.exports = enhancedLogger;
