const fs = require('fs').promises;
const path = require('path');

class TemplateManager {
    constructor() {
        this.templates = {
            global: new Map(),
            projects: new Map()
        };
        this.phases = new Map();
    }

    async addTemplate(name, template, { category = 'global', projectId = null, variables = {} } = {}) {
        if (!name || !template) {
            throw new Error('Template name and content are required');
        }

        const templateObj = {
            content: template,
            variables,
            metadata: {
                createdAt: new Date(),
                lastModified: new Date(),
                category
            }
        };

        if (projectId) {
            if (!this.templates.projects.has(projectId)) {
                this.templates.projects.set(projectId, new Map());
            }
            this.templates.projects.get(projectId).set(name, templateObj);
        } else {
            this.templates.global.set(name, templateObj);
        }
    }

    getTemplate(name, { projectId = null } = {}) {
        let template;
        
        if (projectId && this.templates.projects.has(projectId)) {
            template = this.templates.projects.get(projectId).get(name);
        }
        
        if (!template) {
            template = this.templates.global.get(name);
        }

        if (!template) {
            throw new Error(`Template "${name}" not found`);
        }

        return template;
    }

    listTemplates({ projectId = null, category = null } = {}) {
        const templates = [];

        for (const [name, template] of this.templates.global.entries()) {
            if (!category || template.metadata.category === category) {
                templates.push({
                    name,
                    ...template,
                    scope: 'global'
                });
            }
        }

        if (projectId && this.templates.projects.has(projectId)) {
            for (const [name, template] of this.templates.projects.get(projectId).entries()) {
                if (!category || template.metadata.category === category) {
                    templates.push({
                        name,
                        ...template,
                        scope: 'project'
                    });
                }
            }
        }

        return templates;
    }

    setPhase(projectId, phaseName, config) {
        if (!projectId || !phaseName || !config) {
            throw new Error('Project ID, phase name, and configuration are required');
        }

        if (!this.phases.has(projectId)) {
            this.phases.set(projectId, new Map());
        }

        const phaseConfig = {
            ...config,
            metadata: {
                createdAt: new Date(),
                lastModified: new Date()
            }
        };

        this.phases.get(projectId).set(phaseName, phaseConfig);
    }

    getPhase(projectId, phaseName) {
        if (!this.phases.has(projectId)) {
            throw new Error(`No phases found for project "${projectId}"`);
        }

        const projectPhases = this.phases.get(projectId);
        if (!projectPhases.has(phaseName)) {
            throw new Error(`Phase "${phaseName}" not found for project "${projectId}"`);
        }

        return projectPhases.get(phaseName);
    }

    listPhases(projectId) {
        if (!this.phases.has(projectId)) {
            return [];
        }

        const projectPhases = this.phases.get(projectId);
        return Array.from(projectPhases.entries()).map(([name, config]) => ({
            name,
            ...config
        }));
    }

    deleteTemplate(name, { projectId = null } = {}) {
        let deleted = false;

        if (projectId && this.templates.projects.has(projectId)) {
            deleted = this.templates.projects.get(projectId).delete(name);
        }

        if (!deleted) {
            deleted = this.templates.global.delete(name);
        }

        if (!deleted) {
            throw new Error(`Template "${name}" not found`);
        }
    }

    updateTemplate(name, newTemplate, { projectId = null, variables = {} } = {}) {
        const templateMap = projectId && this.templates.projects.has(projectId) 
            ? this.templates.projects.get(projectId)
            : this.templates.global;

        if (!templateMap.has(name)) {
            throw new Error(`Template "${name}" not found`);
        }

        const existingTemplate = templateMap.get(name);
        const updatedTemplate = {
            ...existingTemplate,
            content: newTemplate,
            variables: { ...existingTemplate.variables, ...variables },
            metadata: {
                ...existingTemplate.metadata,
                lastModified: new Date()
            }
        };

        templateMap.set(name, updatedTemplate);
    }

    exportProjectConfig(projectId) {
        const projectTemplates = this.templates.projects.get(projectId) || new Map();
        const projectPhases = this.phases.get(projectId) || new Map();

        return {
            templates: Array.from(projectTemplates.entries()),
            phases: Array.from(projectPhases.entries())
        };
    }

    importProjectConfig(projectId, config) {
        const { templates = [], phases = [] } = config;

        if (!this.templates.projects.has(projectId)) {
            this.templates.projects.set(projectId, new Map());
        }
        const projectTemplates = this.templates.projects.get(projectId);
        templates.forEach(([name, template]) => {
            projectTemplates.set(name, {
                ...template,
                metadata: {
                    ...template.metadata,
                    importedAt: new Date()
                }
            });
        });

        if (!this.phases.has(projectId)) {
            this.phases.set(projectId, new Map());
        }
        const projectPhases = this.phases.get(projectId);
        phases.forEach(([name, phase]) => {
            projectPhases.set(name, {
                ...phase,
                metadata: {
                    ...phase.metadata,
                    importedAt: new Date()
                }
            });
        });
    }
}

module.exports = TemplateManager;
