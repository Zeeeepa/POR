/**
 * ErrorHandlingSystem.test.js
 * Tests for the ErrorHandlingSystem module
 */

const ErrorHandlingSystem = require('../../src/utils/ErrorHandlingSystem');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const EventEmitter = require('events');

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
}));

describe('ErrorHandlingSystem', () => {
  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    
    // Reset in-memory logs
    ErrorHandlingSystem.memoryLogs.clear();
    
    // Reset registered error handlers
    ErrorHandlingSystem.errorHandlers = new Map();
    
    // Reset registered loggers
    ErrorHandlingSystem.loggers = new Map();
  });
  
  describe('createLogger', () => {
    test('should create a new logger with default options', () => {
      const logger = ErrorHandlingSystem.createLogger('test');
      
      expect(logger).toBeDefined();
      expect(logger.getName()).toBe('test');
      expect(logger.getLevel()).toBe('info');
      expect(ErrorHandlingSystem.loggers.has('test')).toBe(true);
    });
    
    test('should return existing logger if name already exists', () => {
      const logger1 = ErrorHandlingSystem.createLogger('test');
      const logger2 = ErrorHandlingSystem.createLogger('test');
      
      expect(logger1).toBe(logger2);
    });
    
    test('should throw error if name is not provided', () => {
      expect(() => {
        ErrorHandlingSystem.createLogger();
      }).toThrow('Logger name is required');
    });
    
    test('should create logger with custom level', () => {
      const logger = ErrorHandlingSystem.createLogger('test', { level: 'debug' });
      
      expect(logger.getLevel()).toBe('debug');
    });
    
    test('should create logger with file destination', () => {
      const logger = ErrorHandlingSystem.createLogger('test', {
        destinations: [ErrorHandlingSystem.LOG_DESTINATIONS.FILE]
      });
      
      expect(fs.ensureDirSync).toHaveBeenCalled();
    });
    
    test('should create child logger with additional metadata', () => {
      const logger = ErrorHandlingSystem.createLogger('parent');
      const childLogger = logger.child({ component: 'child' });
      
      expect(childLogger).toBeDefined();
      expect(childLogger.getName()).toBe('parent:child');
      expect(ErrorHandlingSystem.loggers.has('parent:child')).toBe(true);
    });
  });
  
  describe('logMessage', () => {
    test('should log a message with context', () => {
      const logEntry = ErrorHandlingSystem.logMessage('info', 'Test message', { test: true });
      
      expect(logEntry).toBeDefined();
      expect(logEntry.level).toBe('info');
      expect(logEntry.message).toBe('Test message');
      expect(logEntry.test).toBe(true);
    });
    
    test('should throw error for invalid log level', () => {
      expect(() => {
        ErrorHandlingSystem.logMessage('invalid', 'Test message');
      }).toThrow('Invalid log level: invalid');
    });
  });
  
  describe('createError', () => {
    test('should create a validation error', () => {
      const error = ErrorHandlingSystem.createError('validation', 'Invalid input', null, { log: false });
      
      expect(error).toBeInstanceOf(ErrorHandlingSystem.ValidationError);
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
    });
    
    test('should create a network error', () => {
      const error = ErrorHandlingSystem.createError('network', 'Connection failed', null, { log: false });
      
      expect(error).toBeInstanceOf(ErrorHandlingSystem.NetworkError);
      expect(error.message).toBe('Connection failed');
      expect(error.code).toBe('NETWORK_ERROR');
    });
    
    test('should create a timeout error', () => {
      const error = ErrorHandlingSystem.createError('timeout', 'Request timed out', null, { log: false });
      
      expect(error).toBeInstanceOf(ErrorHandlingSystem.TimeoutError);
      expect(error.message).toBe('Request timed out');
      expect(error.code).toBe('TIMEOUT_ERROR');
    });
    
    test('should create a database error', () => {
      const error = ErrorHandlingSystem.createError('database', 'Query failed', null, { log: false });
      
      expect(error).toBeInstanceOf(ErrorHandlingSystem.DatabaseError);
      expect(error.message).toBe('Query failed');
      expect(error.code).toBe('DATABASE_ERROR');
    });
    
    test('should create a configuration error', () => {
      const error = ErrorHandlingSystem.createError('configuration', 'Invalid config', null, { log: false });
      
      expect(error).toBeInstanceOf(ErrorHandlingSystem.ConfigurationError);
      expect(error.message).toBe('Invalid config');
      expect(error.code).toBe('CONFIGURATION_ERROR');
    });
    
    test('should create a generic error for unknown type', () => {
      const error = ErrorHandlingSystem.createError('unknown', 'Unknown error', null, { log: false });
      
      expect(error).toBeInstanceOf(ErrorHandlingSystem.ExtendedError);
      expect(error.message).toBe('Unknown error');
    });
    
    test('should include cause in error', () => {
      const cause = new Error('Original error');
      const error = ErrorHandlingSystem.createError('validation', 'Invalid input', cause, { log: false });
      
      expect(error.cause).toBe(cause);
    });
    
    test('should throw error if type is not provided', () => {
      expect(() => {
        ErrorHandlingSystem.createError(null, 'Test message');
      }).toThrow('Error type is required');
    });
  });
  
  describe('handleError', () => {
    test('should handle error with default options', () => {
      const error = new Error('Test error');
      const result = ErrorHandlingSystem.handleError(error);
      
      expect(result).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.handled).toBe(false);
    });
    
    test('should convert standard error to extended error', () => {
      const error = new Error('Test error');
      const result = ErrorHandlingSystem.handleError(error);
      
      expect(result.error).toBeInstanceOf(ErrorHandlingSystem.ExtendedError);
    });
    
    test('should use registered error handler if available', () => {
      const handler = jest.fn().mockReturnValue({ handled: true });
      ErrorHandlingSystem.registerErrorHandler('ValidationError', handler);
      
      const error = ErrorHandlingSystem.createError('validation', 'Invalid input', null, { log: false });
      const result = ErrorHandlingSystem.handleError(error);
      
      expect(handler).toHaveBeenCalledWith(error, expect.any(Object));
      expect(result.handled).toBe(true);
    });
    
    test('should handle error handler failure', () => {
      const handler = jest.fn().mockImplementation(() => {
        throw new Error('Handler failed');
      });
      ErrorHandlingSystem.registerErrorHandler('ValidationError', handler);
      
      const error = ErrorHandlingSystem.createError('validation', 'Invalid input', null, { log: false });
      const result = ErrorHandlingSystem.handleError(error);
      
      expect(handler).toHaveBeenCalled();
      expect(result.handled).toBe(false);
      expect(result.handlerError).toBeDefined();
    });
    
    test('should rethrow error if requested', () => {
      const error = new Error('Test error');
      
      expect(() => {
        ErrorHandlingSystem.handleError(error, { rethrow: true });
      }).toThrow();
    });
  });
  
  describe('registerErrorHandler', () => {
    test('should register a custom error handler', () => {
      const handler = jest.fn();
      const result = ErrorHandlingSystem.registerErrorHandler('CustomError', handler);
      
      expect(result).toBe(true);
      expect(ErrorHandlingSystem.errorHandlers.has('CustomError')).toBe(true);
    });
    
    test('should throw error if type is not provided', () => {
      expect(() => {
        ErrorHandlingSystem.registerErrorHandler(null, jest.fn());
      }).toThrow('Error type and handler function are required');
    });
    
    test('should throw error if handler is not a function', () => {
      expect(() => {
        ErrorHandlingSystem.registerErrorHandler('CustomError', 'not a function');
      }).toThrow('Error type and handler function are required');
    });
  });
  
  describe('setLogLevel', () => {
    test('should set global log level', () => {
      const result = ErrorHandlingSystem.setLogLevel('debug');
      
      expect(result).toBe(true);
      expect(ErrorHandlingSystem.globalLogLevel).toBe('debug');
    });
    
    test('should update all logger levels', () => {
      const logger1 = ErrorHandlingSystem.createLogger('test1');
      const logger2 = ErrorHandlingSystem.createLogger('test2');
      
      ErrorHandlingSystem.setLogLevel('debug');
      
      expect(logger1.getLevel()).toBe('debug');
      expect(logger2.getLevel()).toBe('debug');
    });
    
    test('should throw error for invalid log level', () => {
      expect(() => {
        ErrorHandlingSystem.setLogLevel('invalid');
      }).toThrow('Invalid log level: invalid');
    });
  });
  
  describe('getLogEntries', () => {
    beforeEach(() => {
      // Add some test log entries
      ErrorHandlingSystem.memoryLogs.add({
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test info message',
        logger: 'test'
      });
      
      ErrorHandlingSystem.memoryLogs.add({
        timestamp: '2023-01-01T01:00:00.000Z',
        level: 'error',
        message: 'Test error message',
        logger: 'test'
      });
      
      ErrorHandlingSystem.memoryLogs.add({
        timestamp: '2023-01-02T00:00:00.000Z',
        level: 'debug',
        message: 'Test debug message',
        logger: 'other'
      });
    });
    
    test('should get all log entries', () => {
      const entries = ErrorHandlingSystem.getLogEntries();
      
      expect(entries).toHaveLength(3);
    });
    
    test('should filter by log level', () => {
      const entries = ErrorHandlingSystem.getLogEntries({ level: 'error' });
      
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
    });
    
    test('should filter by search term', () => {
      const entries = ErrorHandlingSystem.getLogEntries({ search: 'debug' });
      
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Test debug message');
    });
    
    test('should filter by date range', () => {
      const entries = ErrorHandlingSystem.getLogEntries({
        from: '2023-01-01T00:30:00.000Z',
        to: '2023-01-01T23:59:59.999Z'
      });
      
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
    });
    
    test('should filter by logger name', () => {
      const entries = ErrorHandlingSystem.getLogEntries({ logger: 'other' });
      
      expect(entries).toHaveLength(1);
      expect(entries[0].logger).toBe('other');
    });
    
    test('should limit number of entries', () => {
      const entries = ErrorHandlingSystem.getLogEntries({ limit: 2 });
      
      expect(entries).toHaveLength(2);
    });
  });
  
  describe('createLogStream', () => {
    test('should create a log stream', () => {
      const stream = ErrorHandlingSystem.createLogStream();
      
      expect(stream).toBeInstanceOf(EventEmitter);
      expect(stream.close).toBeInstanceOf(Function);
    });
    
    test('should emit log events to stream', (done) => {
      const stream = ErrorHandlingSystem.createLogStream();
      
      stream.on('data', (logEntry) => {
        expect(logEntry).toBeDefined();
        expect(logEntry.message).toBe('Test message');
        stream.close();
        done();
      });
      
      // Emit a log event
      ErrorHandlingSystem.events.emit('log', {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test message',
        logger: 'test'
      });
    });
    
    test('should filter log events by level', () => {
      const stream = ErrorHandlingSystem.createLogStream({ level: 'error' });
      const dataHandler = jest.fn();
      
      stream.on('data', dataHandler);
      
      // Emit info log event (should be filtered out)
      ErrorHandlingSystem.events.emit('log', {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test info message',
        logger: 'test'
      });
      
      // Emit error log event (should pass through)
      ErrorHandlingSystem.events.emit('log', {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: 'Test error message',
        logger: 'test'
      });
      
      expect(dataHandler).toHaveBeenCalledTimes(1);
      stream.close();
    });
    
    test('should apply custom filter function', () => {
      const stream = ErrorHandlingSystem.createLogStream({
        filter: (entry) => entry.logger === 'test'
      });
      const dataHandler = jest.fn();
      
      stream.on('data', dataHandler);
      
      // Emit log event from 'test' logger (should pass through)
      ErrorHandlingSystem.events.emit('log', {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Test message',
        logger: 'test'
      });
      
      // Emit log event from 'other' logger (should be filtered out)
      ErrorHandlingSystem.events.emit('log', {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Other message',
        logger: 'other'
      });
      
      expect(dataHandler).toHaveBeenCalledTimes(1);
      stream.close();
    });
  });
  
  describe('archiveLogs', () => {
    beforeEach(() => {
      // Add some test log entries
      ErrorHandlingSystem.memoryLogs.add({
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Old message',
        logger: 'test'
      });
      
      ErrorHandlingSystem.memoryLogs.add({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'New message',
        logger: 'test'
      });
    });
    
    test('should archive logs before specified date', () => {
      const result = ErrorHandlingSystem.archiveLogs({
        before: '2023-01-02T00:00:00.000Z'
      });
      
      expect(result).toBeDefined();
      expect(result.archived).toBe(1);
      expect(fs.ensureDirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
    
    test('should filter archived logs by logger', () => {
      const result = ErrorHandlingSystem.archiveLogs({
        before: '2023-01-02T00:00:00.000Z',
        logger: 'other'
      });
      
      expect(result.archived).toBe(0);
    });
  });
  
  describe('parseLogEntry', () => {
    test('should parse object log entry', () => {
      const entry = {
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message'
      };
      
      const parsed = ErrorHandlingSystem.parseLogEntry(entry);
      
      expect(parsed).toBe(entry);
    });
    
    test('should parse JSON log entry', () => {
      const entry = JSON.stringify({
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message'
      });
      
      const parsed = ErrorHandlingSystem.parseLogEntry(entry);
      
      expect(parsed).toEqual({
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message'
      });
    });
    
    test('should parse text log entry', () => {
      const entry = '2023-01-01T00:00:00.000Z [info]: Test message';
      
      const parsed = ErrorHandlingSystem.parseLogEntry(entry);
      
      expect(parsed).toEqual({
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message'
      });
    });
    
    test('should parse CSV log entry', () => {
      const entry = '"2023-01-01T00:00:00.000Z","info","Test message","{}"';
      
      const parsed = ErrorHandlingSystem.parseLogEntry(entry);
      
      expect(parsed).toEqual({
        timestamp: '2023-01-01T00:00:00.000Z',
        level: 'info',
        message: 'Test message'
      });
    });
    
    test('should handle unparseable entry', () => {
      const entry = 'unparseable log entry';
      
      const parsed = ErrorHandlingSystem.parseLogEntry(entry);
      
      expect(parsed).toEqual({
        timestamp: expect.any(String),
        level: 'unknown',
        message: 'unparseable log entry'
      });
    });
  });
});
