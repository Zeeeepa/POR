cat > src/utils/templateEngine.js << 'EOL'
/**
 * Enhanced Template Engine
 * Provides advanced variable support and template processing
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
class TemplateEngine {
    /**
     * Initialize the Template Engine
     * @param {Object} options - Configuration options
     * @param {string} options.templatesDir - Directory to store templates
     * @param {boolean} options.enableVersioning - Whether to enable template versioning
     * @param {number} options.maxVersions - Maximum number of versions to keep
     */
    constructor(options = {}) {
        this.templatesDir = options.templatesDir || path.join(process.cwd(), 'data', 'templates');
        this.enableVersioning = options.enableVersioning || false;
        this.maxVersions = options.maxVersions || 10;
        this.templates = new Map();
        this.helpers = new Map();
        
        // Ensure templates directory exists
        if (!fs.existsSync(this.templatesDir)) {
            fs.mkdirSync(this.templatesDir, { recursive: true });
        }
        
        // Register built-in helpers
        this._registerBuiltInHelpers();
        
        // Load templates
        this.loadTemplates();
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
        
        // Date helpers
        this.registerHelper('date', (format = 'YYYY-MM-DD') => {
            const now = new Date();
            return this._formatDate(now, format);
        });
        
        // Conditional helpers
        this.registerHelper('if', (condition, trueValue, falseValue) => {
            return condition ? trueValue : (falseValue || '');
        });
        
        // Math helpers
        this.registerHelper('add', (a, b) => Number(a) + Number(b));
        this.registerHelper('subtract', (a, b) => Number(a) - Number(b));
        this.registerHelper('multiply', (a, b) => Number(a) * Number(b));
        this.registerHelper('divide', (a, b) => Number(b) !== 0 ? Number(a) / Number(b) : 0);
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
     * Load templates from the templates directory
     */
    loadTemplates() {
        try {
            const files = fs.readdirSync(this.templatesDir);
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const templatePath = path.join(this.templatesDir, file);
                    const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                    this.templates.set(templateData.id, templateData);
                }
            }
            
            console.log(`Loaded ${this.templates.size} templates`);
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }
    
    /**
     * Register a helper function
     * @param {string} name - Helper name
     * @param {Function} fn - Helper function
     */
    registerHelper(name, fn) {
        this.helpers.set(name, fn);
    }
    
    /**
     * Get a helper function by name
     * @param {string} name - Helper name
     * @returns {Function|null} - Helper function or null if not found
     */
    getHelper(name) {
        return this.helpers.get(name) || null;
    }
    
    /**
     * Get a template by ID
     * @param {string} id - Template ID
     * @returns {Object|null} - Template object or null if not found
     */
    getTemplate(id) {
        return this.templates.get(id) || null;
    }
    
    /**
     * Get a template by name
     * @param {string} name - Template name
     * @returns {Object|null} - Template object or null if not found
     */
    getTemplateByName(name) {
        for (const template of this.templates.values()) {
            if (template.name === name) {
                return template;
            }
        }
        
        return null;
    }
    
    /**
     * Get all templates
     * @param {Object} filters - Optional filters
     * @returns {Array} - Array of templates
     */
    getAllTemplates(filters = {}) {
        let templates = Array.from(this.templates.values());
        
        // Apply filters
        if (filters.category) {
            templates = templates.filter(t => t.category === filters.category);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            templates = templates.filter(t => 
                t.name.toLowerCase().includes(searchTerm) || 
                (t.description && t.description.toLowerCase().includes(searchTerm))
            );
        }
        
        return templates;
    }
    
    /**
     * Create a new template
     * @param {Object} templateData - Template data
     * @returns {Object} - Created template
     */
    createTemplate(templateData) {
        const newTemplate = {
            id: templateData.id || uuidv4(),
            name: templateData.name,
            description: templateData.description || '',
            content: templateData.content,
            variables: templateData.variables || [],
            category: templateData.category || 'general',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
        };
        
        // Save template to file
        const templatePath = path.join(this.templatesDir, `${newTemplate.id}.json`);
        fs.writeFileSync(templatePath, JSON.stringify(newTemplate, null, 2));
        
        // Add to templates map
        this.templates.set(newTemplate.id, newTemplate);
        
        return newTemplate;
    }
    
    /**
     * Update an existing template
     * @param {string} id - Template ID
     * @param {Object} templateData - Updated template data
     * @returns {Object|null} - Updated template or null if not found
     */
    updateTemplate(id, templateData) {
        const template = this.getTemplate(id);
        
        if (!template) {
            return null;
        }
        
        // Handle versioning if enabled
        if (this.enableVersioning) {
            this._createTemplateVersion(template);
        }
        
        // Update template
        const updatedTemplate = {
            ...template,
            name: templateData.name || template.name,
            description: templateData.description !== undefined ? templateData.description : template.description,
            content: templateData.content || template.content,
            variables: templateData.variables || template.variables,
            category: templateData.category || template.category,
            updatedAt: new Date().toISOString(),
            version: template.version + 1
        };
        
        // Save updated template
        const templatePath = path.join(this.templatesDir, `${id}.json`);
        fs.writeFileSync(templatePath, JSON.stringify(updatedTemplate, null, 2));
        
        // Update templates map
        this.templates.set(id, updatedTemplate);
        
        return updatedTemplate;
    }
    
    /**
     * Delete a template
     * @param {string} id - Template ID
     * @returns {boolean} - True if deleted, false if not found
     */
    deleteTemplate(id) {
        const template = this.getTemplate(id);
        
        if (!template) {
            return false;
        }
        
        // Remove template file
        const templatePath = path.join(this.templatesDir, `${id}.json`);
        fs.unlinkSync(templatePath);
        
        // Remove from templates map
        this.templates.delete(id);
        
        // Remove version files if versioning is enabled
        if (this.enableVersioning) {
            const versionDir = path.join(this.templatesDir, 'versions', id);
            if (fs.existsSync(versionDir)) {
                const versionFiles = fs.readdirSync(versionDir);
                for (const file of versionFiles) {
                    fs.unlinkSync(path.join(versionDir, file));
                }
                fs.rmdirSync(versionDir);
            }
        }
        
        return true;
    }
    
    /**
     * Create a version of a template
     * @private
     * @param {Object} template - Template to version
     */
    _createTemplateVersion(template) {
        // Create versions directory if it doesn't exist
        const versionsDir = path.join(this.templatesDir, 'versions', template.id);
        if (!fs.existsSync(versionsDir)) {
            fs.mkdirSync(versionsDir, { recursive: true });
        }
        
        // Save current version
        const versionPath = path.join(versionsDir, `v${template.version}.json`);
        fs.writeFileSync(versionPath, JSON.stringify(template, null, 2));
        
        // Limit number of versions
        if (this.maxVersions > 0) {
            const versionFiles = fs.readdirSync(versionsDir)
                .filter(file => file.startsWith('v') && file.endsWith('.json'))
                .sort((a, b) => {
                    const versionA = parseInt(a.substring(1, a.length - 5));
                    const versionB = parseInt(b.substring(1, b.length - 5));
                    return versionB - versionA; // Sort descending
                });
            
            // Remove oldest versions if exceeding max
            if (versionFiles.length > this.maxVersions) {
                for (let i = this.maxVersions; i < versionFiles.length; i++) {
                    fs.unlinkSync(path.join(versionsDir, versionFiles[i]));
                }
            }
        }
    }
    
    /**
     * Get template versions
     * @param {string} id - Template ID
     * @returns {Array} - Array of template versions
     */
    getTemplateVersions(id) {
        const versionsDir = path.join(this.templatesDir, 'versions', id);
        
        if (!fs.existsSync(versionsDir)) {
            return [];
        }
        
        try {
            const versionFiles = fs.readdirSync(versionsDir)
                .filter(file => file.startsWith('v') && file.endsWith('.json'))
                .sort((a, b) => {
                    const versionA = parseInt(a.substring(1, a.length - 5));
                    const versionB = parseInt(b.substring(1, b.length - 5));
                    return versionB - versionA; // Sort descending
                });
            
            return versionFiles.map(file => {
                const versionPath = path.join(versionsDir, file);
                return JSON.parse(fs.readFileSync(versionPath, 'utf8'));
            });
        } catch (error) {
            console.error(`Error getting template versions for ${id}:`, error);
            return [];
        }
    }
    
    /**
     * Restore a template version
     * @param {string} id - Template ID
     * @param {number} version - Version number to restore
     * @returns {Object|null} - Restored template or null if not found
     */
    restoreTemplateVersion(id, version) {
        const versionsDir = path.join(this.templatesDir, 'versions', id);
        const versionPath = path.join(versionsDir, `v${version}.json`);
        
        if (!fs.existsSync(versionPath)) {
            return null;
        }
        
        try {
            // Read version file
            const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
            
            // Update template with version data but increment version
            return this.updateTemplate(id, {
                ...versionData,
                version: versionData.version // Keep original version number for reference
            });
        } catch (error) {
            console.error(`Error restoring template version ${version} for ${id}:`, error);
            return null;
        }
    }
    
    /**
     * Process a template with variables
     * @param {string} templateId - Template ID or name
     * @param {Object} variables - Variables to replace in the template
     * @returns {string|null} - Processed template content or null if not found
     */
    processTemplate(templateId, variables = {}) {
        // Get template by ID or name
        let template = this.getTemplate(templateId);
        if (!template) {
            template = this.getTemplateByName(templateId);
        }
        
        if (!template) {
            return null;
        }
        
        let processedContent = template.content;
        
        // Process variable expressions
        processedContent = this._processVariableExpressions(processedContent, variables);
        
        // Process helper expressions
        processedContent = this._processHelperExpressions(processedContent, variables);
        
        // Process simple variables
        processedContent = this._processSimpleVariables(processedContent, variables);
        
        return processedContent;
    }
    
    /**
     * Process simple variable placeholders in a string
     * @private
     * @param {string} content - Template content
     * @param {Object} variables - Variables to replace
     * @returns {string} - Processed content
     */
    _processSimpleVariables(content, variables) {
        return content.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (match, varName) => {
            // Handle nested variable names (e.g. user.name)
            const parts = varName.split('.');
            let value = variables;
            
            for (const part of parts) {
                if (value === undefined || value === null) {
                    return match; // Keep original if parent is undefined
                }
                
                value = value[part];
                
                if (value === undefined) {
                    return match; // Keep original if variable not found
                }
            }
            
            return value !== null && value !== undefined ? value : match;
        });
    }
    
    /**
     * Process variable expressions in a string
     * @private
     * @param {string} content - Template content
     * @param {Object} variables - Variables to replace
     * @returns {string} - Processed content
     */
    _processVariableExpressions(content, variables) {
        return content.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\?\s*([^:}]+)(?:\s*:\s*([^}]+))?\s*\}\}/g, (match, varName, trueValue, falseValue = '') => {
            // Handle nested variable names (e.g. user.name)
            const parts = varName.split('.');
            let value = variables;
            
            for (const part of parts) {
                if (value === undefined || value === null) {
                    return falseValue.trim(); // Return false value if parent is undefined
                }
                
                value = value[part];
                
                if (value === undefined) {
                    return falseValue.trim(); // Return false value if variable not found
                }
            }
            
            return value ? trueValue.trim() : falseValue.trim();
        });
    }
    
    /**
     * Process helper expressions in a string
     * @private
     * @param {string} content - Template content
     * @param {Object} variables - Variables to replace
     * @returns {string} - Processed content
     */
    _processHelperExpressions(content, variables) {
        return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s+([^}]+)\s*\}\}/g, (match, helperName, argsStr) => {
            const helper = this.getHelper(helperName);
            
            if (!helper) {
                return match; // Keep original if helper not found
            }
            
            try {
                // Parse arguments
                const args = this._parseHelperArgs(argsStr, variables);
                
                // Call helper function with arguments
                const result = helper(...args);
                
                return result !== undefined && result !== null ? result : match;
            } catch (error) {
                console.error(`Error processing helper ${helperName}:`, error);
                return match;
            }
        });
    }
    
    /**
     * Parse helper arguments
     * @private
     * @param {string} argsStr - Arguments string
     * @param {Object} variables - Variables to replace
     * @returns {Array} - Parsed arguments
     */
    _parseHelperArgs(argsStr, variables) {
        const args = [];
        let currentArg = '';
        let inString = false;
        let stringChar = '';
        
        for (let i = 0; i < argsStr.length; i++) {
            const char = argsStr[i];
            
            if ((char === '"' || char === "'") && (i === 0 || argsStr[i - 1] !== '\\')) {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                    stringChar = '';
                } else {
                    currentArg += char;
                }
            } else if (char === ' ' && !inString) {
                if (currentArg) {
                    args.push(this._evaluateArg(currentArg, variables));
                    currentArg = '';
                }
            } else {
                currentArg += char;
            }
        }
        
        if (currentArg) {
            args.push(this._evaluateArg(currentArg, variables));
        }
        
        return args;
    }
    
    /**
     * Evaluate a helper argument
     * @private
     * @param {string} arg - Argument string
     * @param {Object} variables - Variables to replace
     * @returns {*} - Evaluated argument
     */
    _evaluateArg(arg, variables) {
        // Check if it's a string literal
        if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
            return arg.slice(1, -1);
        }
        
        // Check if it's a number
        if (/^-?\d+(\.\d+)?$/.test(arg)) {
            return parseFloat(arg);
        }
        
        // Check if it's a boolean
        if (arg === 'true') return true;
        if (arg === 'false') return false;
        
        // Check if it's a variable
        if (/^[a-zA-Z0-9_\.]+$/.test(arg)) {
            // Handle nested variable names (e.g. user.name)
            const parts = arg.split('.');
            let value = variables;
            
            for (const part of parts) {
                if (value === undefined || value === null) {
                    return undefined;
                }
                
                value = value[part];
            }
            
            return value;
        }
        
        // Return as is
        return arg;
    }
    
    /**
     * Extract variables from template content
     * @param {string} content - Template content
     * @returns {Array} - Array of variable names
     */
    extractVariables(content) {
        const variables = new Set();
        
        // Extract simple variables
        const simpleVarRegex = /\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g;
        let match;
        
        while ((match = simpleVarRegex.exec(content)) !== null) {
            variables.add(match[1]);
        }
        
        // Extract conditional variables
        const condVarRegex = /\{\{\s*([a-zA-Z0-9_\.]+)\s*\?\s*([^:}]+)(?:\s*:\s*([^}]+))?\s*\}\}/g;
        
        while ((match = condVarRegex.exec(content)) !== null) {
            variables.add(match[1]);
        }
        
        // Extract helper variables
        const helperVarRegex = /\{\{\s*([a-zA-Z0-9_]+)\s+([^}]+)\s*\}\}/g;
        
        while ((match = helperVarRegex.exec(content)) !== null) {
            const argsStr = match[2];
            
            // Extract variables from helper arguments
            const argVarRegex = /\b([a-zA-Z0-9_\.]+)\b/g;
            let argMatch;
            
            while ((argMatch = argVarRegex.exec(argsStr)) !== null) {
                const arg = argMatch[1];
                
                // Skip if it's a number, boolean, or helper name
                if (!/^-?\d+(\.\d+)?$/.test(arg) && arg !== 'true' && arg !== 'false' && !this.helpers.has(arg)) {
                    variables.add(arg);
                }
            }
        }
        
        return Array.from(variables);
    }
    
    /**
     * Import templates from a file or data
     * @param {Array|Object} data - Template data to import
     * @param {Object} options - Import options
     * @returns {Object} - Import results
     */
    importTemplates(data, options = {}) {
        const templates = Array.isArray(data) ? data : [data];
        const results = {
            imported: [],
            skipped: [],
            errors: []
        };
        
        for (const template of templates) {
            try {
                // Check if template with same name exists
                let existingTemplate = null;
                
                for (const tpl of this.templates.values()) {
                    if (tpl.name === template.name) {
                        existingTemplate = tpl;
                        break;
                    }
                }
                
                if (existingTemplate && !options.overwrite) {
                    results.skipped.push({
                        name: template.name,
                        reason: 'Template with same name already exists'
                    });
                    continue;
                }
                
                if (existingTemplate && options.overwrite) {
                    // Update existing template
                    const updated = this.updateTemplate(existingTemplate.id, template);
                    if (updated) {
                        results.imported.push(updated);
                    } else {
                        results.errors.push({
                            name: template.name,
                            error: 'Failed to update existing template'
                        });
                    }
                } else {
                    // Create new template
                    const newTemplate = this.createTemplate({
                        ...template,
                        id: options.keepId && template.id ? template.id : undefined
                    });
                    results.imported.push(newTemplate);
                }
            } catch (error) {
                results.errors.push({
                    name: template.name || 'Unknown',
                    error: error.message
                });
            }
        }
        
        return results;
    }
    
    /**
     * Export templates to a file
     * @param {Array} templateIds - Array of template IDs to export
     * @param {string} outputPath - Path to save the exported templates
     * @returns {boolean} - True if export successful
     */
    exportTemplates(templateIds, outputPath) {
        try {
            let templatesToExport = [];
            
            if (templateIds && templateIds.length > 0) {
                // Export specific templates
                for (const id of templateIds) {
                    const template = this.getTemplate(id);
                    if (template) {
                        templatesToExport.push(template);
                    }
                }
            } else {
                // Export all templates
                templatesToExport = Array.from(this.templates.values());
            }
            
            fs.writeFileSync(outputPath, JSON.stringify(templatesToExport, null, 2));
            return true;
        } catch (error) {
            console.error('Error exporting templates:', error);
            return false;
        }
    }
}
module.exports = TemplateEngine;
EOL
