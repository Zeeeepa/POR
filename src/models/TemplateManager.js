const fs = require('fs').promises;
const path = require('path');

class TemplateManager {
    constructor() {
        this.templates = new Map();
    }

    // Add a new template
    addTemplate(name, template) {
        if (!name || !template) {
            throw new Error('Template name and content are required');
        }
        this.templates.set(name, template);
    }

    // Get a template by name
    getTemplate(name) {
        if (!this.templates.has(name)) {
            throw new Error(`Template "${name}" not found`);
        }
        return this.templates.get(name);
    }

    // List all available templates
    listTemplates() {
        return Array.from(this.templates.keys());
    }

    // Delete a template
    deleteTemplate(name) {
        if (!this.templates.has(name)) {
            throw new Error(`Template "${name}" not found`);
        }
        this.templates.delete(name);
    }

    // Update an existing template
    updateTemplate(name, newTemplate) {
        if (!this.templates.has(name)) {
            throw new Error(`Template "${name}" not found`);
        }
        this.templates.set(name, newTemplate);
    }
}

module.exports = TemplateManager;
