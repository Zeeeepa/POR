/**
 * Template engine utility for rendering Handlebars templates
 */

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

class TemplateEngine {
  constructor() {
    this.templateCache = {};
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers
   */
  registerHelpers() {
    // Equality comparison helper
    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
    });
    
    // Array contains helper
    Handlebars.registerHelper('ifContains', function(arr, value, options) {
      if (!arr) return options.inverse(this);
      return (arr.indexOf(value) > -1) ? options.fn(this) : options.inverse(this);
    });

    // Date formatting helper
    Handlebars.registerHelper('formatDate', function(date, format) {
      if (!date) return '';
      const d = new Date(date);
      
      // Simple formatting - can be expanded with more complex formats
      return d.toLocaleString();
    });

    // JSON stringify helper
    Handlebars.registerHelper('json', function(context) {
      return JSON.stringify(context, null, 2);
    });

    // Markdown section helper
    Handlebars.registerHelper('markdown', function(context) {
      return context;
    });
  }

  /**
   * Get a compiled template from cache or load and compile it
   * @param {string} templatePath - Path to the template file
   * @returns {Function} Compiled Handlebars template
   */
  getTemplate(templatePath) {
    const fullPath = path.isAbsolute(templatePath) 
      ? templatePath
      : path.join(process.cwd(), templatePath);
    
    if (this.templateCache[fullPath]) {
      return this.templateCache[fullPath];
    }
    
    try {
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Template file does not exist: ${fullPath}`);
      }
      
      const templateContent = fs.readFileSync(fullPath, 'utf-8');
      const template = Handlebars.compile(templateContent);
      this.templateCache[fullPath] = template;
      return template;
    } catch (error) {
      console.error(`Error loading template ${fullPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Render a template with the provided data
   * @param {string} templatePath - Path to the template file
   * @param {Object} data - Data to populate the template
   * @returns {string} Rendered template content
   */
  render(templatePath, data = {}) {
    try {
      const template = this.getTemplate(templatePath);
      return template(data);
    } catch (error) {
      console.error(`Error rendering template ${templatePath}:`, error);
      throw error;
    }
  }

  /**
   * Render a template string directly (not from a file)
   * @param {string} templateString - Handlebars template string
   * @param {Object} data - Data to populate the template
   * @returns {string} Rendered content
   */
  renderString(templateString, data = {}) {
    try {
      const template = Handlebars.compile(templateString);
      return template(data);
    } catch (error) {
      console.error('Error rendering template string:', error);
      throw error;
    }
  }
}

module.exports = new TemplateEngine();