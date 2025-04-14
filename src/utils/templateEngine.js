/**
 * templateEngine.js
 * Handles template rendering with variable substitution
 */

const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');
const config = require('./config');
const moment = require('moment');

/**
 * Template engine for rendering templates with Handlebars
 */
class TemplateEngine {
  /**
   * Initialize the template engine and register helpers
   */
  constructor() {
    // Register custom helpers
    this.registerHelpers();
  }
  
  /**
   * Register custom Handlebars helpers
   */
  registerHelpers() {
    // Format date helper
    Handlebars.registerHelper('formatDate', function(date, format) {
      if (!date) return '';
      
      try {
        if (typeof moment === 'function') {
          return moment(date).format(format || 'YYYY-MM-DD HH:mm:ss');
        }
        
        const dateObj = new Date(date);
        
        // Simple format implementation
        if (format === 'short') {
          return dateObj.toLocaleDateString();
        } else if (format === 'long') {
          return dateObj.toLocaleString();
        } else {
          return dateObj.toISOString();
        }
      } catch (error) {
        logger.logError('Error formatting date', error);
        return date;
      }
    });
    
    // Conditional helper
    Handlebars.registerHelper('ifCond', function(v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return (v1 == v2) ? options.fn(this) : options.inverse(this);
        case '===':
          return (v1 === v2) ? options.fn(this) : options.inverse(this);
        case '!=':
          return (v1 != v2) ? options.fn(this) : options.inverse(this);
        case '!==':
          return (v1 !== v2) ? options.fn(this) : options.inverse(this);
        case '<':
          return (v1 < v2) ? options.fn(this) : options.inverse(this);
        case '<=':
          return (v1 <= v2) ? options.fn(this) : options.inverse(this);
        case '>':
          return (v1 > v2) ? options.fn(this) : options.inverse(this);
        case '>=':
          return (v1 >= v2) ? options.fn(this) : options.inverse(this);
        case '&&':
          return (v1 && v2) ? options.fn(this) : options.inverse(this);
        case '||':
          return (v1 || v2) ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });
    
    // JSON stringify helper
    Handlebars.registerHelper('json', function(context) {
      return JSON.stringify(context, null, 2);
    });
    
    // Environment check helper
    Handlebars.registerHelper('ifEnv', function(env, options) {
      return (config.server.env === env) ? options.fn(this) : options.inverse(this);
    });
    
    // Array length helper
    Handlebars.registerHelper('length', function(array) {
      return Array.isArray(array) ? array.length : 0;
    });
    
    // Truncate text helper
    Handlebars.registerHelper('truncate', function(text, length) {
      if (!text) return '';
      if (text.length <= length) return text;
      return text.substring(0, length) + '...';
    });
  }
  
  /**
   * Render a template string with variables
   * @param {string} templateString - Template string to render
   * @param {Object} [variables={}] - Variables to use in template
   * @returns {string} Rendered template
   * @throws {Error} If rendering fails
   */
  renderString(templateString, variables = {}) {
    try {
      if (!templateString || typeof templateString !== 'string') {
        throw new Error('Template string must be a non-empty string');
      }
      
      const template = Handlebars.compile(templateString);
      return template(variables);
    } catch (error) {
      logger.logError('Failed to render template string', error);
      throw error;
    }
  }
  
  /**
   * Render a template file with variables
   * @param {string} templatePath - Path to template file
   * @param {Object} [variables={}] - Variables to use in template
   * @returns {Promise<string>} Rendered template
   * @throws {Error} If rendering fails
   */
  async renderFile(templatePath, variables = {}) {
    try {
      if (!templatePath || typeof templatePath !== 'string') {
        throw new Error('Template path must be a non-empty string');
      }
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }
      
      const templateString = await fs.readFile(templatePath, 'utf8');
      return this.renderString(templateString, variables);
    } catch (error) {
      logger.logError(`Failed to render template file: ${templatePath}`, error);
      throw error;
    }
  }
  
  /**
   * Render a template file and save to destination
   * @param {string} templatePath - Path to template file
   * @param {string} destPath - Destination path
   * @param {Object} [variables={}] - Variables to use in template
   * @returns {Promise<boolean>} Success status
   * @throws {Error} If rendering or saving fails
   */
  async renderToFile(templatePath, destPath, variables = {}) {
    try {
      if (!templatePath || typeof templatePath !== 'string') {
        throw new Error('Template path must be a non-empty string');
      }
      
      if (!destPath || typeof destPath !== 'string') {
        throw new Error('Destination path must be a non-empty string');
      }
      
      const rendered = await this.renderFile(templatePath, variables);
      
      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      await fs.ensureDir(destDir);
      
      // Write rendered content to file
      await fs.writeFile(destPath, rendered);
      logger.info(`Rendered template to: ${destPath}`);
      return true;
    } catch (error) {
      logger.logError(`Failed to render template to file: ${destPath}`, error);
      throw error;
    }
  }
}

module.exports = new TemplateEngine();
