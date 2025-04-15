cat > src/models/TemplateManager.js << 'EOL'
/**
 * Template Manager for handling template operations
 * Provides functionality for creating, editing, and managing templates
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
class TemplateManager {
    /**
     * Initialize the Template Manager
     * @param {Object} options - Configuration options
     * @param {string} options.templatesDir - Directory to store templates
     * @param {boolean} options.enableVersioning - Whether to enable template versioning
     * @param {number} options.maxVersions - Maximum number of versions to keep
     */
    constructor(options = {}) {
        this.templatesDir = options.templatesDir || path.join(process.cwd(), 'data', 'templates');
        this.enableVersioning = options.enableVersioning || false;
        this.maxVersions = options.maxVersions || 10;
        this.templates = [];
        
        // Ensure templates directory exists
        if (!fs.existsSync(this.templatesDir)) {
            fs.mkdirSync(this.templatesDir, { recursive: true });
        }
        
        // Initialize templates
        this.loadTemplates();
    }
    
    /**
     * Load all templates from the templates directory
     */
    loadTemplates() {
        try {
            const files = fs.readdirSync(this.templatesDir);
            this.templates = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const templatePath = path.join(this.templatesDir, file);
                    const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
                    this.templates.push(templateData);
                }
            }
            
            // Sort templates by name
            this.templates.sort((a, b) => a.name.localeCompare(b.name));
            
            return this.templates;
        } catch (error) {
            console.error('Error loading templates:', error);
            return [];
        }
    }
    
    /**
     * Get all templates
     * @param {Object} filters - Optional filters to apply
     * @returns {Array} - Array of templates
     */
    getTemplates(filters = {}) {
        let filteredTemplates = [...this.templates];
        
        // Apply filters
        if (filters.category) {
            filteredTemplates = filteredTemplates.filter(t => t.category === filters.category);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredTemplates = filteredTemplates.filter(t => 
                t.name.toLowerCase().includes(searchTerm) || 
                (t.description && t.description.toLowerCase().includes(searchTerm))
            );
        }
        
        return filteredTemplates;
    }
    
    /**
     * Get a template by ID
     * @param {string} id - Template ID
     * @returns {Object|null} - Template object or null if not found
     */
    getTemplateById(id) {
        return this.templates.find(t => t.id === id) || null;
    }
    
    /**
     * Get a template by name
     * @param {string} name - Template name
     * @returns {Object|null} - Template object or null if not found
     */
    getTemplateByName(name) {
        return this.templates.find(t => t.name === name) || null;
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
        
        // Add to templates array
        this.templates.push(newTemplate);
        
        return newTemplate;
    }
    
    /**
     * Update an existing template
     * @param {string} id - Template ID
     * @param {Object} templateData - Updated template data
     * @returns {Object|null} - Updated template or null if not found
     */
    updateTemplate(id, templateData) {
        const templateIndex = this.templates.findIndex(t => t.id === id);
        
        if (templateIndex === -1) {
            return null;
        }
        
        const existingTemplate = this.templates[templateIndex];
        
        // Handle versioning if enabled
        if (this.enableVersioning) {
            this._createTemplateVersion(existingTemplate);
        }
        
        // Update template
        const updatedTemplate = {
            ...existingTemplate,
            name: templateData.name || existingTemplate.name,
            description: templateData.description !== undefined ? templateData.description : existingTemplate.description,
            content: templateData.content || existingTemplate.content,
            variables: templateData.variables || existingTemplate.variables,
            category: templateData.category || existingTemplate.category,
            updatedAt: new Date().toISOString(),
            version: existingTemplate.version + 1
        };
        
        // Save updated template
        const templatePath = path.join(this.templatesDir, `${id}.json`);
        fs.writeFileSync(templatePath, JSON.stringify(updatedTemplate, null, 2));
        
        // Update templates array
        this.templates[templateIndex] = updatedTemplate;
        
        return updatedTemplate;
    }
    
    /**
     * Delete a template
     * @param {string} id - Template ID
     * @returns {boolean} - True if deleted, false if not found
     */
    deleteTemplate(id) {
        const templateIndex = this.templates.findIndex(t => t.id === id);
        
        if (templateIndex === -1) {
            return false;
        }
        
        // Remove template file
        const templatePath = path.join(this.templatesDir, `${id}.json`);
        fs.unlinkSync(templatePath);
        
        // Remove from templates array
        this.templates.splice(templateIndex, 1);
        
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
     * Duplicate a template
     * @param {string} id - Template ID to duplicate
     * @param {string} newName - Name for the duplicated template
     * @returns {Object|null} - Duplicated template or null if not found
     */
    duplicateTemplate(id, newName) {
        const template = this.getTemplateById(id);
        
        if (!template) {
            return null;
        }
        
        // Create new template based on existing one
        const duplicatedTemplate = {
            ...template,
            id: uuidv4(),
            name: newName || `${template.name} (Copy)`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
        };
        
        // Save duplicated template
        const templatePath = path.join(this.templatesDir, `${duplicatedTemplate.id}.json`);
        fs.writeFileSync(templatePath, JSON.stringify(duplicatedTemplate, null, 2));
        
        // Add to templates array
        this.templates.push(duplicatedTemplate);
        
        return duplicatedTemplate;
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
                const existingTemplate = this.getTemplateByName(template.name);
                
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
            const templatesToExport = templateIds
                ? this.templates.filter(t => templateIds.includes(t.id))
                : this.templates;
            
            fs.writeFileSync(outputPath, JSON.stringify(templatesToExport, null, 2));
            return true;
        } catch (error) {
            console.error('Error exporting templates:', error);
            return false;
        }
    }
    
    /**
     * Process a template with variables
     * @param {string} templateId - Template ID
     * @param {Object} variables - Variables to replace in the template
     * @returns {string|null} - Processed template content or null if not found
     */
    processTemplate(templateId, variables = {}) {
        const template = this.getTemplateById(templateId);
        
        if (!template) {
            return null;
        }
        
        let processedContent = template.content;
        
        // Replace variables in the template
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            processedContent = processedContent.replace(regex, value);
        }
        
        return processedContent;
    }
    
    /**
     * Extract variables from template content
     * @param {string} content - Template content
     * @returns {Array} - Array of variable names
     */
    extractVariables(content) {
        const variableRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
        const variables = new Set();
        let match;
        
        while ((match = variableRegex.exec(content)) !== null) {
            variables.add(match[1]);
        }
        
        return Array.from(variables);
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
}
module.exports = TemplateManager;
EOL