/**
 * validation.js
 * Utility functions for parameter validation
 */

const logger = require('./logger');
const webhookUtils = require('./github/webhookUtils');

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
   * @param {boolean} [options.allowInfinity=false] - Whether to allow Infinity values
   * @param {boolean} [options.allowNaN=false] - Whether to allow NaN values
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isNumber(value, paramName, options = {}) {
    if (typeof value !== 'number') {
      throw new Error(`${paramName} must be a number`);
    }
    
    if (!options.allowNaN && isNaN(value)) {
      throw new Error(`${paramName} cannot be NaN`);
    }
    
    if (!options.allowInfinity && !isFinite(value)) {
      throw new Error(`${paramName} cannot be Infinity or -Infinity`);
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
   * @param {boolean} [options.allowEmpty=true] - Whether to allow empty arrays
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isArray(value, paramName, options = {}) {
    if (!Array.isArray(value)) {
      throw new Error(`${paramName} must be an array`);
    }
    
    const { allowEmpty = true } = options;
    
    if (!allowEmpty && value.length === 0) {
      throw new Error(`${paramName} cannot be empty`);
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
   * @param {Object} [options.propValidators] - Validators for specific properties
   * @param {boolean} [options.allowNull=false] - Whether to allow null values
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isObject(value, paramName, options = {}) {
    const { allowNull = false } = options;
    
    if (value === null) {
      if (allowNull) {
        return true;
      }
      throw new Error(`${paramName} cannot be null`);
    }
    
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${paramName} must be an object`);
    }
    
    if (options.requiredProps) {
      for (const prop of options.requiredProps) {
        if (value[prop] === undefined) {
          throw new Error(`${paramName} must have a '${prop}' property`);
        }
      }
    }
    
    if (options.propValidators && typeof options.propValidators === 'object') {
      for (const [prop, validator] of Object.entries(options.propValidators)) {
        if (value[prop] !== undefined && typeof validator === 'function') {
          try {
            validator(value[prop], `${paramName}.${prop}`);
          } catch (error) {
            throw new Error(`Invalid property '${prop}' in ${paramName}: ${error.message}`);
          }
        }
      }
    }
    
    return true;
  },
  
  /**
   * Validate that a parameter is a valid URL
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @param {Object} [options={}] - Validation options
   * @param {string[]} [options.protocols] - Allowed protocols (e.g., ['http', 'https'])
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isUrl(value, paramName, options = {}) {
    try {
      this.isString(value, paramName);
      const url = new URL(value);
      
      if (options.protocols && options.protocols.length > 0) {
        const protocol = url.protocol.replace(':', '');
        if (!options.protocols.includes(protocol)) {
          throw new Error(`${paramName} must use one of these protocols: ${options.protocols.join(', ')}`);
        }
      }
      
      return true;
    } catch (error) {
      if (error.message.includes('protocols')) {
        throw error;
      }
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
    if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
      throw new Error('allowedValues must be a non-empty array');
    }
    
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
   * Validate that a parameter is a valid date
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @param {Object} [options={}] - Validation options
   * @param {Date} [options.min] - Minimum allowed date
   * @param {Date} [options.max] - Maximum allowed date
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isDate(value, paramName, options = {}) {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      throw new Error(`${paramName} must be a valid Date object`);
    }
    
    if (options.min instanceof Date && !isNaN(options.min.getTime()) && value < options.min) {
      throw new Error(`${paramName} must be on or after ${options.min.toISOString()}`);
    }
    
    if (options.max instanceof Date && !isNaN(options.max.getTime()) && value > options.max) {
      throw new Error(`${paramName} must be on or before ${options.max.toISOString()}`);
    }
    
    return true;
  },
  
  /**
   * Validate that a parameter is a valid function
   * @param {any} value - Value to validate
   * @param {string} paramName - Parameter name for error messages
   * @returns {boolean} Whether the value is valid
   * @throws {Error} If validation fails
   */
  isFunction(value, paramName) {
    if (typeof value !== 'function') {
      throw new Error(`${paramName} must be a function`);
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
    return webhookUtils.verifySignature(signature, body, secret);
  }
};

module.exports = validation;
