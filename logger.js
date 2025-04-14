/**
 * Logger utility
 * Provides consistent logging across the application
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// Log directory
const LOG_DIR = path.join(process.cwd(), 'logs');
fs.ensureDirSync(LOG_DIR);

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  silly: 5
};

// Define log colors
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  silly: 'grey'
};

// Add colors to Winston
winston.addColors(logColors);

// Create formatter
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length 
      ? ` ${JSON.stringify(meta)}` 
      : '';
    return `${timestamp} ${level}: ${message}${metaString}`;
  })
);

// Create console formatter with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

// Create logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Write to all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log')
    }),
    
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error'
    }),
    
    // Console transport with colors
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    })
  ]
});

// Create stream for use with Morgan (HTTP logging)
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

module.exports = logger; 