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
      throw new Error(`Failed to initialize templates directory: ${error.message}`);
    }
  }

  async saveTemplate(name, content) {
    try {
      const filePath = path.join(this.templatesDir, `${name}.template`);
      await fs.writeFile(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save template ${name}: ${error.message}`);
    }
  }

  async loadTemplate(name) {
    try {
      const filePath = path.join(this.templatesDir, `${name}.template`);
      return await fs.readFile(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to load template ${name}: ${error.message}`);
    }
  }

  async listTemplates() {
    try {
      const files = await fs.readdir(this.templatesDir);
      return files
        .filter(file => file.endsWith('.template'))
        .map(file => file.replace('.template', ''));
    } catch (error) {
      throw new Error(`Failed to list templates: ${error.message}`);
    }
  }

  async deleteTemplate(name) {
    try {
      const filePath = path.join(this.templatesDir, `${name}.template`);
      await fs.unlink(filePath);
    } catch (error) {
      throw new Error(`Failed to delete template ${name}: ${error.message}`);
    }
  }
}

module.exports = TemplateManager;
