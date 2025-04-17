const fs = require('fs').promises;
const path = require('path');

class TemplateManager {
    constructor(templatesDir = 'templates') {
        this.templatesDir = templatesDir;
    }

    async init() {
        try {
            await fs.mkdir(this.templatesDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') {
                throw new Error(`Failed to initialize templates directory: ${error.message}`);
            }
        }
    }

    async saveTemplate(name, content) {
        if (!name || !content) {
            throw new Error('Template name and content are required');
        }
        
        const templatePath = path.join(this.templatesDir, `${name}.template`);
        await fs.writeFile(templatePath, content, 'utf8');
    }

    async loadTemplate(name) {
        if (!name) {
            throw new Error('Template name is required');
        }

        const templatePath = path.join(this.templatesDir, `${name}.template`);
        try {
            return await fs.readFile(templatePath, 'utf8');
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Template "${name}" not found`);
            }
            throw error;
        }
    }

    async listTemplates() {
        const files = await fs.readdir(this.templatesDir);
        return files
            .filter(file => file.endsWith('.template'))
            .map(file => file.replace('.template', ''));
    }

    async deleteTemplate(name) {
        if (!name) {
            throw new Error('Template name is required');
        }

        const templatePath = path.join(this.templatesDir, `${name}.template`);
        try {
            await fs.unlink(templatePath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Template "${name}" not found`);
            }
            throw error;
        }
    }
}

module.exports = TemplateManager;
