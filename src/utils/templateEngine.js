/**
 * Enhanced Template Engine
 * A comprehensive template engine supporting multiple formats and advanced features
 */
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const handlebars = require('handlebars');
const ejs = require('ejs');
const _ = require('lodash');
const cache = require('memory-cache');
const logger = require('./logger');
const config = require('./config');

/**
 * TemplateEngine class providing a unified interface for multiple template engines
 * with support for caching, validation, and advanced features
 */
class TemplateEngine {
  /**
   * Initialize the Template Engine
   * @param {Object} options - Configuration options
   * @param {string} options.templatesDir - Directory to store templates
   * @param {boolean} options.enableCaching - Whether to enable template caching
   * @param {number} options.cacheTTL - Cache time-to-live in milliseconds
   * @param {Object} options.engines - Custom engine configurations
   */
  constructor(options = {}) {
    this.templatesDir = options.templatesDir || path.join(process.cwd(), 'data', 'templates');
    this.enableCaching = options.enableCaching !== false;
    this.cacheTTL = options.cacheTTL || 3600000; // 1 hour default
    this.cacheKeyPrefix = 'template:';
    
    // Initialize helpers and partials registries
    this.helpers = new Map();
    this.partials = new Map();
    
    // Initialize engines registry
    this.engines = new Map();
    
    // Register built-in helpers
    this._registerBuiltInHelpers();
    
    // Register built-in engines
    this._registerBuiltInEngines();
    
    // Register custom engines if provided
    if (options.engines) {
      for (const [type, engine] of Object.entries(options.engines)) {
        this.registerEngine(type, engine);
      }
    }
    
    // Ensure templates directory exists
    this._ensureTemplatesDirExists();
    
    logger.info('Template engine initialized', { 
      templatesDir: this.templatesDir,
      enableCaching: this.enableCaching,
      cacheTTL: this.cacheTTL
    });
  }
  
  /**
   * Ensure templates directory exists
   * @private
   */
  async _ensureTemplatesDirExists() {
    try {
      await fs.mkdir(this.templatesDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create templates directory', { error });
      throw new Error(`Failed to create templates directory: ${error.message}`);
    }
  }
  
  /**
   * Register built-in template engines
   * @private
   */
  _registerBuiltInEngines() {
    // Register Handlebars engine
    this.registerEngine('handlebars', {
      compile: (template, options) => {
        const compiledTemplate = handlebars.compile(template, options);
        return (context) => compiledTemplate(context);
      },
      renderFile: async (filePath, context, options) => {
        const template = await fs.readFile(filePath, 'utf8');
        return this.engines.get('handlebars').compile(template, options)(context);
      },
      registerHelper: (name, fn) => {
        handlebars.registerHelper(name, fn);
      },
      registerPartial: (name, content) => {
        handlebars.registerPartial(name, content);
      }
    });
    
    // Register EJS engine
    this.registerEngine('ejs', {
      compile: (template, options) => {
        const compiledTemplate = ejs.compile(template, {
          ...options,
          async: true
        });
        return (context) => compiledTemplate(context);
      },
      renderFile: async (filePath, context, options) => {
        return ejs.renderFile(filePath, context, {
          ...options,
          async: true
        });
      },
      // EJS doesn't have built-in helpers/partials like Handlebars,
      // but we can implement a simple version
      registerHelper: (name, fn) => {
        // Store helpers to be included in the context
        this.helpers.set(name, fn);
      },
      registerPartial: (name, content) => {
        this.partials.set(name, content);
      }
    });
    
    // Register custom simple template engine
    this.registerEngine('simple', {
      compile: (template) => {
        return (context) => this._processSimpleTemplate(template, context);
      },
      renderFile: async (filePath, context) => {
        const template = await fs.readFile(filePath, 'utf8');
        return this._processSimpleTemplate(template, context);
      },
      registerHelper: (name, fn) => {
        this.helpers.set(name, fn);
      },
      registerPartial: (name, content) => {
        this.partials.set(name, content);
      }
    });
  }
  
  /**
   * Process a simple template with variable substitution
   * @private
   * @param {string} template - Template string
   * @param {Object} context - Context object with variables
   * @returns {string} - Processed template
   */
  _processSimpleTemplate(template, context) {
    let result = template;
    
    // Process partials
    result = this._processPartials(result);
    
    // Process variables
    result = this._processVariables(result, context);
    
    // Process conditionals
    result = this._processConditionals(result, context);
    
    // Process loops
    result = this._processLoops(result, context);
    
    // Process helpers
    result = this._processHelpers(result, context);
    
    return result;
  }
  
  /**
   * Process partials in a template
   * @private
   * @param {string} template - Template string
   * @returns {string} - Processed template
   */
  _processPartials(template) {
    return template.replace(/\{\{\s*>\s*([a-zA-Z0-9_\-]+)\s*\}\}/g, (match, partialName) => {
      const partial = this.partials.get(partialName);
      return partial || match;
    });
  }
  
  /**
   * Process variables in a template
   * @private
   * @param {string} template - Template string
   * @param {Object} context - Context object with variables
   * @returns {string} - Processed template
   */
  _processVariables(template, context) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_\.\[\]]+)\s*\}\}/g, (match, varPath) => {
      return _.get(context, varPath, '');
    });
  }
  
  /**
   * Process conditionals in a template
   * @private
   * @param {string} template - Template string
   * @param {Object} context - Context object with variables
   * @returns {string} - Processed template
   */
  _processConditionals(template, context) {
    // Match {{#if condition}}...{{else}}...{{/if}} blocks
    const ifRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
    
    return template.replace(ifRegex, (match, condition, ifContent, elseContent = '') => {
      const conditionValue = this._evaluateCondition(condition, context);
      return conditionValue ? ifContent : elseContent;
    });
  }
  
  /**
   * Evaluate a condition expression
   * @private
   * @param {string} condition - Condition expression
   * @param {Object} context - Context object with variables
   * @returns {boolean} - Evaluation result
   */
  _evaluateCondition(condition, context) {
    // Handle comparison operators
    const comparisonRegex = /([a-zA-Z0-9_\.\[\]]+)\s*(==|!=|>=|<=|>|<)\s*([a-zA-Z0-9_\.\[\]'"]+)/;
    const match = condition.match(comparisonRegex);
    
    if (match) {
      const [, leftPath, operator, rightRaw] = match;
      const leftValue = _.get(context, leftPath);
      
      // Check if right side is a string literal or a variable path
      let rightValue;
      if (rightRaw.startsWith("'") || rightRaw.startsWith('"')) {
        // String literal
        rightValue = rightRaw.slice(1, -1);
      } else {
        // Variable path
        rightValue = _.get(context, rightRaw);
      }
      
      switch (operator) {
        case '==': return leftValue == rightValue;
        case '!=': return leftValue != rightValue;
        case '>=': return leftValue >= rightValue;
        case '<=': return leftValue <= rightValue;
        case '>': return leftValue > rightValue;
        case '<': return leftValue < rightValue;
        default: return false;
      }
    }
    
    // Simple variable check
    return Boolean(_.get(context, condition));
  }
  
  /**
   * Process loops in a template
   * @private
   * @param {string} template - Template string
   * @param {Object} context - Context object with variables
   * @returns {string} - Processed template
   */
  _processLoops(template, context) {
    // Match {{#each items}}...{{/each}} blocks
    const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g;
    
    return template.replace(eachRegex, (match, itemsPath, content) => {
      const items = _.get(context, itemsPath, []);
      
      if (!Array.isArray(items)) {
        return '';
      }
      
      return items.map((item, index) => {
        // Create a context for this iteration
        const itemContext = {
          ...context,
          this: item,
          '@index': index,
          '@first': index === 0,
          '@last': index === items.length - 1
        };
        
        // Process the content with the item context
        let itemContent = this._processVariables(content, itemContext);
        itemContent = this._processConditionals(itemContent, itemContext);
        itemContent = this._processHelpers(itemContent, itemContext);
        
        return itemContent;
      }).join('');
    });
  }
  
  /**
   * Process helpers in a template
   * @private
   * @param {string} template - Template string
   * @param {Object} context - Context object with variables
   * @returns {string} - Processed template
   */
  _processHelpers(template, context) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s+([^}]*)\}\}/g, (match, helperName, argsStr) => {
      const helper = this.helpers.get(helperName);
      
      if (!helper) {
        return match;
      }
      
      try {
        // Parse arguments
        const args = this._parseHelperArgs(argsStr, context);
        
        // Call helper function with arguments
        const result = helper(...args);
        
        return result !== undefined ? String(result) : '';
      } catch (error) {
        logger.error(`Error processing helper ${helperName}:`, { error });
        return match;
      }
    });
  }
  
  /**
   * Parse helper arguments
   * @private
   * @param {string} argsStr - Arguments string
   * @param {Object} context - Context object with variables
   * @returns {Array} - Parsed arguments
   */
  _parseHelperArgs(argsStr, context) {
    const args = [];
    const argParts = argsStr.split(/\s+/);
    
    for (const part of argParts) {
      if (!part) continue;
      
      // Check if it's a string literal
      if ((part.startsWith('"') && part.endsWith('"')) || 
          (part.startsWith("'") && part.endsWith("'"))) {
        args.push(part.slice(1, -1));
      } 
      // Check if it's a number
      else if (/^-?\d+(\.\d+)?$/.test(part)) {
        args.push(parseFloat(part));
      }
      // Check if it's a boolean
      else if (part === 'true') {
        args.push(true);
      }
      else if (part === 'false') {
        args.push(false);
      }
      // Otherwise treat as a variable path
      else {
        args.push(_.get(context, part));
      }
    }
    
    return args;
  }
  
  /**
   * Register built-in helper functions
   * @private
   */
  _registerBuiltInHelpers() {
    // String manipulation helpers
    this.registerHelper('uppercase', (value) => String(value).toUpperCase());
    this.registerHelper('lowercase', (value) => String(value).toLowerCase());
    this.registerHelper('capitalize', (value) => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
    this.registerHelper('trim', (value) => String(value).trim());
    
    // Array helpers
    this.registerHelper('join', (array, separator = ', ') => {
      if (!Array.isArray(array)) return '';
      return array.join(separator);
    });
    this.registerHelper('first', (array) => {
      if (!Array.isArray(array) || array.length === 0) return '';
      return array[0];
    });
    this.registerHelper('last', (array) => {
      if (!Array.isArray(array) || array.length === 0) return '';
      return array[array.length - 1];
    });
    this.registerHelper('length', (array) => {
      if (!Array.isArray(array)) return 0;
      return array.length;
    });
    
    // Date helpers
    this.registerHelper('date', (format = 'YYYY-MM-DD') => {
      const now = new Date();
      return this._formatDate(now, format);
    });
    this.registerHelper('formatDate', (date, format = 'YYYY-MM-DD') => {
      if (!date) return '';
      const dateObj = new Date(date);
      return this._formatDate(dateObj, format);
    });
    
    // Conditional helpers
    this.registerHelper('if', (condition, trueValue, falseValue) => {
      return condition ? trueValue : (falseValue || '');
    });
    this.registerHelper('eq', (a, b) => a === b);
    this.registerHelper('neq', (a, b) => a !== b);
    this.registerHelper('gt', (a, b) => a > b);
    this.registerHelper('gte', (a, b) => a >= b);
    this.registerHelper('lt', (a, b) => a < b);
    this.registerHelper('lte', (a, b) => a <= b);
    
    // Math helpers
    this.registerHelper('add', (a, b) => Number(a) + Number(b));
    this.registerHelper('subtract', (a, b) => Number(a) - Number(b));
    this.registerHelper('multiply', (a, b) => Number(a) * Number(b));
    this.registerHelper('divide', (a, b) => Number(b) !== 0 ? Number(a) / Number(b) : 0);
    
    // Object helpers
    this.registerHelper('json', (obj) => JSON.stringify(obj, null, 2));
    this.registerHelper('get', (obj, path) => _.get(obj, path, ''));
  }
  
  /**
   * Format a date according to the specified format
   * @private
   * @param {Date} date - Date to format
   * @param {string} format - Format string
   * @returns {string} - Formatted date
   */
  _formatDate(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }
  
  /**
   * Generate a cache key for a template
   * @private
   * @param {string} template - Template string or file path
   * @param {Object} context - Context object
   * @param {Object} options - Render options
   * @returns {string} - Cache key
   */
  _generateCacheKey(template, context, options = {}) {
    const contextHash = JSON.stringify(context);
    const optionsHash = JSON.stringify(options);
    return `${this.cacheKeyPrefix}${template}:${contextHash}:${optionsHash}`;
  }
  
  /**
   * Register a helper function
   * @param {string} name - Helper name
   * @param {Function} fn - Helper function
   */
  registerHelper(name, fn) {
    this.helpers.set(name, fn);
    
    // Register with each engine that supports helpers
    for (const [type, engine] of this.engines.entries()) {
      if (typeof engine.registerHelper === 'function') {
        engine.registerHelper(name, fn);
      }
    }
    
    logger.debug(`Registered helper: ${name}`);
  }
  
  /**
   * Register a partial template
   * @param {string} name - Partial name
   * @param {string} content - Partial content
   */
  registerPartial(name, content) {
    this.partials.set(name, content);
    
    // Register with each engine that supports partials
    for (const [type, engine] of this.engines.entries()) {
      if (typeof engine.registerPartial === 'function') {
        engine.registerPartial(name, content);
      }
    }
    
    logger.debug(`Registered partial: ${name}`);
  }
  
  /**
   * Register a custom template engine
   * @param {string} type - Engine type
   * @param {Object} engine - Engine implementation
   */
  registerEngine(type, engine) {
    if (!engine.compile || !engine.renderFile) {
      throw new Error(`Invalid engine implementation for type '${type}'. Engine must implement compile and renderFile methods.`);
    }
    
    this.engines.set(type, engine);
    
    // Register existing helpers with the new engine
    if (typeof engine.registerHelper === 'function') {
      for (const [name, fn] of this.helpers.entries()) {
        engine.registerHelper(name, fn);
      }
    }
    
    // Register existing partials with the new engine
    if (typeof engine.registerPartial === 'function') {
      for (const [name, content] of this.partials.entries()) {
        engine.registerPartial(name, content);
      }
    }
    
    logger.info(`Registered template engine: ${type}`);
  }
  
  /**
   * Get a specific template engine instance
   * @param {string} type - Engine type
   * @returns {Object} - Engine instance
   */
  getEngine(type) {
    const engine = this.engines.get(type);
    
    if (!engine) {
      throw new Error(`Template engine '${type}' not found`);
    }
    
    return engine;
  }
  
  /**
   * Render a template with context
   * @param {string} template - Template string
   * @param {Object} context - Context object with variables
   * @param {Object} options - Render options
   * @param {string} options.engine - Template engine to use (default: 'simple')
   * @param {boolean} options.cache - Whether to use cache (overrides global setting)
   * @returns {Promise<string>} - Rendered template
   */
  async render(template, context = {}, options = {}) {
    const engineType = options.engine || 'simple';
    const useCache = options.cache !== undefined ? options.cache : this.enableCaching;
    
    // Check cache if enabled
    if (useCache) {
      const cacheKey = this._generateCacheKey(template, context, options);
      const cachedResult = cache.get(cacheKey);
      
      if (cachedResult) {
        logger.debug('Template cache hit', { engineType });
        return cachedResult;
      }
    }
    
    try {
      // Get the appropriate engine
      const engine = this.getEngine(engineType);
      
      // Add helpers to context for engines that need it
      const enhancedContext = {
        ...context,
        helpers: Object.fromEntries(this.helpers),
        partials: Object.fromEntries(this.partials)
      };
      
      // Compile and render the template
      const compiledTemplate = engine.compile(template, options);
      const result = await Promise.resolve(compiledTemplate(enhancedContext));
      
      // Cache the result if caching is enabled
      if (useCache) {
        const cacheKey = this._generateCacheKey(template, context, options);
        cache.put(cacheKey, result, this.cacheTTL);
      }
      
      return result;
    } catch (error) {
      logger.error('Template render error', { error, template: template.substring(0, 100) });
      throw new Error(`Failed to render template: ${error.message}`);
    }
  }
  
  /**
   * Render a template file with context
   * @param {string} filePath - Path to template file
   * @param {Object} context - Context object with variables
   * @param {Object} options - Render options
   * @param {string} options.engine - Template engine to use (auto-detected from file extension if not specified)
   * @param {boolean} options.cache - Whether to use cache (overrides global setting)
   * @returns {Promise<string>} - Rendered template
   */
  async renderFile(filePath, context = {}, options = {}) {
    const useCache = options.cache !== undefined ? options.cache : this.enableCaching;
    
    // Resolve file path
    const resolvedPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.templatesDir, filePath);
    
    // Auto-detect engine type from file extension if not specified
    let engineType = options.engine;
    if (!engineType) {
      const ext = path.extname(resolvedPath).toLowerCase();
      switch (ext) {
        case '.hbs':
        case '.handlebars':
          engineType = 'handlebars';
          break;
        case '.ejs':
          engineType = 'ejs';
          break;
        default:
          engineType = 'simple';
      }
    }
    
    // Check cache if enabled
    if (useCache) {
      const cacheKey = this._generateCacheKey(resolvedPath, context, { ...options, engine: engineType });
      const cachedResult = cache.get(cacheKey);
      
      if (cachedResult) {
        logger.debug('Template file cache hit', { filePath, engineType });
        return cachedResult;
      }
    }
    
    try {
      // Get the appropriate engine
      const engine = this.getEngine(engineType);
      
      // Add helpers to context for engines that need it
      const enhancedContext = {
        ...context,
        helpers: Object.fromEntries(this.helpers),
        partials: Object.fromEntries(this.partials)
      };
      
      // Render the template file
      const result = await engine.renderFile(resolvedPath, enhancedContext, options);
      
      // Cache the result if caching is enabled
      if (useCache) {
        const cacheKey = this._generateCacheKey(resolvedPath, context, { ...options, engine: engineType });
        cache.put(cacheKey, result, this.cacheTTL);
      }
      
      return result;
    } catch (error) {
      logger.error('Template file render error', { error, filePath });
      throw new Error(`Failed to render template file '${filePath}': ${error.message}`);
    }
  }
  
  /**
   * Precompile a template for faster rendering
   * @param {string} template - Template string
   * @param {Object} options - Compile options
   * @param {string} options.engine - Template engine to use (default: 'simple')
   * @returns {Function} - Compiled template function
   */
  precompile(template, options = {}) {
    const engineType = options.engine || 'simple';
    
    try {
      // Get the appropriate engine
      const engine = this.getEngine(engineType);
      
      // Compile the template
      return engine.compile(template, options);
    } catch (error) {
      logger.error('Template precompile error', { error, template: template.substring(0, 100) });
      throw new Error(`Failed to precompile template: ${error.message}`);
    }
  }
  
  /**
   * Validate a template for syntax errors
   * @param {string} template - Template string
   * @param {Object} options - Validation options
   * @param {string} options.engine - Template engine to use (default: 'simple')
   * @returns {Object} - Validation result
   */
  validateTemplate(template, options = {}) {
    const engineType = options.engine || 'simple';
    
    try {
      // Get the appropriate engine
      const engine = this.getEngine(engineType);
      
      // Try to compile the template
      engine.compile(template, options);
      
      // Check for unclosed tags in simple engine
      if (engineType === 'simple') {
        const errors = this._validateSimpleTemplate(template);
        if (errors.length > 0) {
          return {
            valid: false,
            errors
          };
        }
      }
      
      return {
        valid: true,
        errors: []
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          message: error.message,
          line: error.lineNumber,
          column: error.columnNumber
        }]
      };
    }
  }
  
  /**
   * Validate a simple template for syntax errors
   * @private
   * @param {string} template - Template string
   * @returns {Array} - Array of errors
   */
  _validateSimpleTemplate(template) {
    const errors = [];
    
    // Check for unclosed tags
    const openTags = [];
    const tagRegex = /\{\{#(if|each)\s+([^}]+)\}\}|\{\{\/(if|each)\}\}/g;
    let match;
    let lineNumber = 1;
    let lastIndex = 0;
    
    while ((match = tagRegex.exec(template)) !== null) {
      // Count lines up to this match
      lineNumber += (template.substring(lastIndex, match.index).match(/\n/g) || []).length;
      lastIndex = match.index;
      
      if (match[0].startsWith('{{#')) {
        // Opening tag
        openTags.push({
          type: match[1],
          line: lineNumber
        });
      } else {
        // Closing tag
        const closeType = match[3];
        
        if (openTags.length === 0) {
          errors.push({
            message: `Unexpected closing tag {{/${closeType}}}`,
            line: lineNumber
          });
        } else {
          const lastTag = openTags.pop();
          
          if (lastTag.type !== closeType) {
            errors.push({
              message: `Mismatched closing tag {{/${closeType}}}, expected {{/${lastTag.type}}}`,
              line: lineNumber
            });
          }
        }
      }
    }
    
    // Check for any remaining open tags
    for (const tag of openTags) {
      errors.push({
        message: `Unclosed tag {{#${tag.type}}}`,
        line: tag.line
      });
    }
    
    return errors;
  }
  
  /**
   * Clear the template cache
   */
  clearCache() {
    // Clear all cache entries with our prefix
    const keys = cache.keys();
    
    for (const key of keys) {
      if (key.startsWith(this.cacheKeyPrefix)) {
        cache.del(key);
      }
    }
    
    logger.debug('Template cache cleared');
  }
}

module.exports = TemplateEngine;
