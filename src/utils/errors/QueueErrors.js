/**
 * QueueErrors.js
 * Custom error types for the message queue system
 */

/**
 * Base error class for queue-related errors
 */
class QueueError extends Error {
  /**
   * Create a new QueueError
   * @param {string} message - Error message
   * @param {Object} [metadata] - Additional error metadata
   */
  constructor(message, metadata = {}) {
    super(message);
    this.name = this.constructor.name;
    this.metadata = metadata;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a queue operation is performed on a non-existent queue
 */
class QueueNotFoundError extends QueueError {
  /**
   * Create a new QueueNotFoundError
   * @param {string} queueName - Name of the queue that wasn't found
   * @param {Object} [metadata] - Additional error metadata
   */
  constructor(queueName, metadata = {}) {
    super(`Queue not found: ${queueName}`, { queueName, ...metadata });
  }
}

/**
 * Error thrown when a message operation is performed on a non-existent message
 */
class MessageNotFoundError extends QueueError {
  /**
   * Create a new MessageNotFoundError
   * @param {string} messageId - ID of the message that wasn't found
   * @param {string} queueName - Name of the queue
   * @param {Object} [metadata] - Additional error metadata
   */
  constructor(messageId, queueName, metadata = {}) {
    super(`Message not found: ${messageId} in queue ${queueName}`, { messageId, queueName, ...metadata });
  }
}

/**
 * Error thrown when a queue operation fails due to rate limiting
 */
class QueueRateLimitError extends QueueError {
  /**
   * Create a new QueueRateLimitError
   * @param {string} queueName - Name of the rate-limited queue
   * @param {number} currentRate - Current rate
   * @param {number} maxRate - Maximum allowed rate
   * @param {Object} [metadata] - Additional error metadata
   */
  constructor(queueName, currentRate, maxRate, metadata = {}) {
    super(`Rate limit exceeded for queue ${queueName}: ${currentRate}/${maxRate}`, 
      { queueName, currentRate, maxRate, ...metadata });
  }
}

/**
 * Error thrown when a queue operation fails due to the queue being full
 */
class QueueFullError extends QueueError {
  /**
   * Create a new QueueFullError
   * @param {string} queueName - Name of the full queue
   * @param {number} maxSize - Maximum size of the queue
   * @param {Object} [metadata] - Additional error metadata
   */
  constructor(queueName, maxSize, metadata = {}) {
    super(`Queue ${queueName} is full (max size: ${maxSize})`, { queueName, maxSize, ...metadata });
  }
}

/**
 * Error thrown when a message serialization or deserialization fails
 */
class MessageSerializationError extends QueueError {
  /**
   * Create a new MessageSerializationError
   * @param {string} operation - The operation that failed (serialize/deserialize)
   * @param {Error} originalError - The original error that occurred
   * @param {Object} [metadata] - Additional error metadata
   */
  constructor(operation, originalError, metadata = {}) {
    super(`Message ${operation} failed: ${originalError.message}`, { operation, originalError, ...metadata });
  }
}

/**
 * Error thrown when a storage operation fails
 */
class StorageError extends QueueError {
  /**
   * Create a new StorageError
   * @param {string} operation - The storage operation that failed
   * @param {Error} originalError - The original error that occurred
   * @param {Object} [metadata] - Additional error metadata
   */
  constructor(operation, originalError, metadata = {}) {
    super(`Storage operation '${operation}' failed: ${originalError.message}`, 
      { operation, originalError, ...metadata });
  }
}

/**
 * Error thrown when a queue validation fails
 */
class QueueValidationError extends QueueError {
  /**
   * Create a new QueueValidationError
   * @param {string} message - Validation error message
   * @param {Object} [metadata] - Additional error metadata
   */
  constructor(message, metadata = {}) {
    super(`Validation error: ${message}`, metadata);
  }
}

module.exports = {
  QueueError,
  QueueNotFoundError,
  MessageNotFoundError,
  QueueRateLimitError,
  QueueFullError,
  MessageSerializationError,
  StorageError,
  QueueValidationError
};
