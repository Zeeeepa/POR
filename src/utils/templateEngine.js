/**
 * templateEngine.js
 * Handles template rendering with variable substitution
 */

const Handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

/**
 * Template engine for rendering templates with Handlebars
 */
class TemplateEngine {
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
        logger.error(`Error formatting date: ${error.message}`);
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
  }
  
  /**
   * Render a template string with variables
   * @param {string} templateString - Template string to render
   * @param {Object} variables - Variables to use in template
   * @returns {string} Rendered template
   */
  renderString(templateString, variables = {}) {
    try {
      const template = Handlebars.compile(templateString);
      return template(variables);
    } catch (error) {
      logger.error(`Failed to render template string: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Render a template file with variables
   * @param {string} templatePath - Path to template file
   * @param {Object} variables - Variables to use in template
   * @returns {Promise<string>} Rendered template
   */
  async renderFile(templatePath, variables = {}) {
    try {
      const templateString = await fs.readFile(templatePath, 'utf8');
      return this.renderString(templateString, variables);
    } catch (error) {
      logger.error(`Failed to render template file: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Render a template file and save to destination
   * @param {string} templatePath - Path to template file
   * @param {string} destPath - Destination path
   * @param {Object} variables - Variables to use in template
   * @returns {Promise<boolean>} Success status
   */
  async renderToFile(templatePath, destPath, variables = {}) {
    try {
      const rendered = await this.renderFile(templatePath, variables);
      await fs.writeFile(destPath, rendered);
      logger.info(`Rendered template to: ${destPath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to render template to file: ${error.message}`);
      return false;
    }
  }
}

module.exports = new TemplateEngine();
