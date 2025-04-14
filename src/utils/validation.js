/**
 * validation.js
 * Utility functions for parameter validation
 */

const logger = require('./logger');

/**
 * Validation utility for consistent parameter validation
 */
const validation = {
  /**
   * Validate that a parameter is a non-empty string
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @param {boolean} [allowEmpty=false] - Whether to allow empty strings
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isString(value, paramName, allowEmpty = false) {
    if (typeof value !== 'string') {
      throw new Error(`${paramName} must be a string`);
    }
    
    if (!allowEmpty && value.trim() === '') {
      throw new Error(`${paramName} cannot be empty`);
    }
    
    return true;
  },
  
  /**
   * Validate that a parameter is a number
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @param {Object} [options={}] - Validation options
   * @param {number} [options.min] - Minimum allowed value
   * @param {number} [options.max] - Maximum allowed value
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isNumber(value, paramName, options = {}) {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${paramName} must be a number`);
    }
    
    if (options.min !== undefined && value < options.min) {
      throw new Error(`${paramName} must be at least ${options.min}`);
    }
    
    if (options.max !== undefined && value > options.max) {
      throw new Error(`${paramName} must be at most ${options.max}`);
    }
    
    return true;
  },
  
  /**
   * Validate that a parameter is a boolean
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isBoolean(value, paramName) {
    if (typeof value !== 'boolean') {
      throw new Error(`${paramName} must be a boolean`);
    }
    
    return true;
  },
  
  /**
   * Validate that a parameter is an array
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @param {Object} [options={}] - Validation options
   * @param {number} [options.minLength] - Minimum array length
   * @param {number} [options.maxLength] - Maximum array length
   * @param {Function} [options.itemValidator] - Function to validate each item
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isArray(value, paramName, options = {}) {
    if (!Array.isArray(value)) {
      throw new Error(`${paramName} must be an array`);
    }
    
    if (options.minLength !== undefined && value.length < options.minLength) {
      throw new Error(`${paramName} must have at least ${options.minLength} items`);
    }
    
    if (options.maxLength !== undefined && value.length > options.maxLength) {
      throw new Error(`${paramName} must have at most ${options.maxLength} items`);
    }
    
    if (options.itemValidator && typeof options.itemValidator === 'function') {
      for (let i = 0; i < value.length; i++) {
        try {
          options.itemValidator(value[i], `${paramName}[${i}]`);
        } catch (error) {
          throw new Error(`Invalid item in ${paramName} at index ${i}: ${error.message}`);
        }
      }
    }
    
    return true;
  },
  
  /**
   * Validate that a parameter is an object
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @param {Object} [options={}] - Validation options
   * @param {string[]} [options.requiredProps] - Required properties
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isObject(value, paramName, options = {}) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${paramName} must be an object`);
    }
    
    if (options.requiredProps) {
      for (const prop of options.requiredProps) {
        if (value[prop] === undefined) {
          throw new Error(`${paramName} must have a '${prop}' property`);
        }
      }
    }
    
    return true;
  },
  
  /**
   * Validate that a parameter is a valid URL
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isUrl(value, paramName) {
    try {
      this.isString(value, paramName);
      new URL(value);
      return true;
    } catch (error) {
      throw new Error(`${paramName} must be a valid URL`);
    }
  },
  
  /**
   * Validate that a parameter is a valid repository name (owner/repo format)
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isRepoName(value, paramName) {
    try {
      this.isString(value, paramName);
      
      if (!value.includes('/')) {
        throw new Error(`${paramName} must be in the format "owner/repo"`);
      }
      
      const [owner, repo] = value.split('/');
      
      if (!owner || !repo) {
        throw new Error(`${paramName} must be in the format "owner/repo"`);
      }
      
      return true;
    } catch (error) {
      if (error.message.includes('must be in the format')) {
        throw error;
      }
      throw new Error(`${paramName} must be a valid repository name in the format "owner/repo"`);
    }
  },
  
  /**
   * Validate that a value is one of a set of allowed values
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @param {Array} allowedValues - Array of allowed values
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isOneOf(value, paramName, allowedValues) {
    if (!allowedValues.includes(value)) {
      throw new Error(`${paramName} must be one of: ${allowedValues.join(', ')}`);
    }
    
    return true;
  },
  
  /**
   * Validate that a parameter exists and is not null or undefined
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  exists(value, paramName) {
    if (value === undefined || value === null) {
      throw new Error(`${paramName} is required`);
    }
    
    return true;
  },
  
  /**
   * Validate a webhook payload signature
   * @param {string} signature - X-Hub-Signature-256 header
   * @param {string} body - Raw request body
   * @param {string} secret - Webhook secret
   * @returns {boolean} Whether the signature is valid
   */
  isValidWebhookSignature(signature, body, secret) {
    try {
      // Validate parameters
      this.isString(signature, 'signature');
      this.isString(body, 'body');
      this.isString(secret, 'secret');
      
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(body).digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(digest),
        Buffer.from(signature)
      );
    } catch (error) {
      logger.error(`Webhook signature validation failed: ${error.message}`);
      return false;
    }
  }
};

module.exports = validation;
