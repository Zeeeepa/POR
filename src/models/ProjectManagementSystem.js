/**
 * ProjectManagementSystem.js
 * Comprehensive multi-project management system with support for
 * project metadata, initialization, status tracking, dependencies, and templates
 */

const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../utils/config');
const MultiProjectManager = require('./MultiProjectManager');
const ProjectManager = require('../framework/ProjectManager');
const { 
  ProjectManagementError,
  ProjectNotFoundError,
  ProjectExistsError,
  ProjectValidationError,
  ProjectOperationError,
  ProjectDependencyError
} = require('../errors/ProjectManagementError');

/**
 * ProjectManagementSystem class
 * Provides a comprehensive API for managing multiple projects
 */
class ProjectManagementSystem {
  /**
   * Create a new ProjectManagementSystem
   * @param {Object} [options] - Configuration options
   * @param {string} [options.projectsDir] - Directory for storing projects
   * @param {string} [options.configDir] - Directory for storing configuration
   * @param {boolean} [options.enableCaching] - Enable project data caching
   * @param {number} [options.cacheTTL] - Cache time-to-live in milliseconds
   */
  constructor(options = {}) {
    this.options = {
      projectsDir: options.projectsDir || path.join(process.cwd(), 'projects'),
      configDir: options.configDir || path.join(process.cwd(), 'config'),
      enableCaching: options.enableCaching !== undefined ? options.enableCaching : true,
      cacheTTL: options.cacheTTL || 5 * 60 * 1000, // 5 minutes default
      ...options
    };
    
    // Ensure directories exist
    fs.ensureDirSync(this.options.projectsDir);
    fs.ensureDirSync(this.options.configDir);
    
    // Initialize the MultiProjectManager
    this.multiProjectManager = new MultiProjectManager({
      projectsDir: this.options.projectsDir,
      configDir: this.options.configDir
    });
    
    // Initialize the ProjectManager for individual project operations
    this.projectManager = new ProjectManager({
      projectsDir: this.options.projectsDir
    });
    
    // Initialize cache
    this.cache = {
      projects: new Map(),
      lastUpdated: new Map()
    };
    
    // Initialize project dependencies tracking
    this.dependencies = new Map();
    
    // Initialize project templates
    this.templates = new Map();
    this.loadTemplates();
    
    logger.info('ProjectManagementSystem initialized');
  }
  
  /**
   * Load project templates from the templates directory
   * @private
   */
  async loadTemplates() {
    try {
      const templatesDir = path.join(this.options.configDir, 'templates');
      fs.ensureDirSync(templatesDir);
      
      const templateFiles = await fs.readdir(templatesDir);
      
      for (const file of templateFiles) {
        if (file.endsWith('.json')) {
          const templatePath = path.join(templatesDir, file);
          const templateData = await fs.readJson(templatePath);
          
          if (templateData.id && templateData.name) {
            this.templates.set(templateData.id, templateData);
            logger.debug(`Loaded template: ${templateData.name} (${templateData.id})`);
          }
        }
      }
      
      logger.info(`Loaded ${this.templates.size} project templates`);
    } catch (error) {
      logger.error(`Failed to load project templates: ${error.message}`);
    }
  }
  
  /**
   * Create a new project
   * @param {string} name - Project name
   * @param {Object} [options] - Project options
   * @param {string} [options.description] - Project description
   * @param {string} [options.repoUrl] - Repository URL
   * @param {string} [options.templateId] - Template ID to initialize with
   * @param {Object} [options.metadata] - Additional project metadata
   * @param {boolean} [options.isLocal] - Whether the project is local or remote
   * @returns {Promise<Object>} Created project
   * @throws {ProjectExistsError} If project with the same name already exists
   * @throws {ProjectValidationError} If project data is invalid
   * @throws {ProjectOperationError} If project creation fails
   */
  async createProject(name, options = {}) {
    try {
      logger.info(`Creating project: ${name}`);
      
      // Validate project name
      if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new ProjectValidationError('Project name is required');
      }
      
      // Check if project already exists
      const existingProject = await this.getProject(name).catch(() => null);
      if (existingProject) {
        throw new ProjectExistsError(name);
      }
      
      // Generate a unique ID for the project
      const projectId = options.id || uuidv4();
      
      // Prepare project data
      const projectData = {
        id: projectId,
        name: name,
        description: options.description || '',
        repoUrl: options.repoUrl || null,
        isLocal: options.isLocal !== undefined ? options.isLocal : !options.repoUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: options.metadata || {},
        status: 'created'
      };
      
      // Create the project
      let project;
      
      if (options.repoUrl) {
        // Remote project with repository
        project = await this.multiProjectManager.addProjectTab({
          repoUrl: options.repoUrl,
          projectName: name
        });
      } else {
        // Local project without repository
        const projectPath = path.join(this.options.projectsDir, name);
        fs.ensureDirSync(projectPath);
        
        // Create project configuration file
        const configPath = path.join(projectPath, 'project.json');
        await fs.writeJson(configPath, projectData, { spaces: 2 });
        
        // Add to MultiProjectManager
        project = await this.multiProjectManager.addProjectTab({
          projectName: name,
          isLocal: true
        });
      }
      
      // Initialize with template if specified
      if (options.templateId) {
        await this.initializeProject(projectId, options.templateId);
      }
      
      // Update cache
      if (this.options.enableCaching) {
        this.cache.projects.set(projectId, { ...projectData, project });
        this.cache.lastUpdated.set(projectId, Date.now());
      }
      
      logger.info(`Project created: ${name} (${projectId})`);
      return { ...projectData, project };
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error;
      }
      
      logger.error(`Failed to create project: ${error.message}`);
      throw new ProjectOperationError(`Failed to create project: ${error.message}`, {
        operation: 'createProject'
      });
    }
  }
  
  /**
   * Delete a project
   * @param {string} id - Project ID or name
   * @returns {Promise<boolean>} Success status
   * @throws {ProjectNotFoundError} If project is not found
   * @throws {ProjectOperationError} If project deletion fails
   */
  async deleteProject(id) {
    try {
      logger.info(`Deleting project: ${id}`);
      
      // Get project
      const project = await this.getProject(id);
      
      // Remove project tab
      const tabId = this.multiProjectManager.getAllProjectTabs()
        .find(tab => tab.projectName === project.name)?.id;
      
      if (!tabId) {
        throw new ProjectNotFoundError(id);
      }
      
      const success = this.multiProjectManager.removeProjectTab(tabId);
      
      if (!success) {
        throw new Error(`Failed to remove project tab: ${tabId}`);
      }
      
      // Remove from cache
      if (this.options.enableCaching) {
        this.cache.projects.delete(id);
        this.cache.lastUpdated.delete(id);
      }
      
      // Remove from dependencies
      this.dependencies.delete(id);
      
      logger.info(`Project deleted: ${id}`);
      return true;
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error;
      }
      
      logger.error(`Failed to delete project: ${error.message}`);
      throw new ProjectOperationError(`Failed to delete project: ${error.message}`, {
        operation: 'deleteProject'
      });
    }
  }
  
  /**
   * Get a project by ID or name
   * @param {string} id - Project ID or name
   * @returns {Promise<Object>} Project data
   * @throws {ProjectNotFoundError} If project is not found
   */
  async getProject(id) {
    try {
      // Check cache first if enabled
      if (this.options.enableCaching) {
        const cachedProject = this.cache.projects.get(id);
        const lastUpdated = this.cache.lastUpdated.get(id);
        
        if (cachedProject && lastUpdated && (Date.now() - lastUpdated) < this.options.cacheTTL) {
          return cachedProject;
        }
      }
      
      // Try to get by ID first
      let project = this.multiProjectManager.getAllProjectTabs()
        .find(tab => tab.id === id);
      
      // If not found, try by name
      if (!project) {
        project = this.multiProjectManager.getProjectByName(id);
      }
      
      if (!project) {
        throw new ProjectNotFoundError(id);
      }
      
      // Get project configuration
      const projectPath = path.join(this.options.projectsDir, project.projectName);
      const configPath = path.join(projectPath, 'project.json');
      
      let projectData = {
        id: project.id,
        name: project.projectName,
        description: '',
        createdAt: project.addedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: project.status || 'unknown'
      };
      
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        projectData = { ...projectData, ...config };
      }
      
      // Update cache
      if (this.options.enableCaching) {
        this.cache.projects.set(id, projectData);
        this.cache.lastUpdated.set(id, Date.now());
      }
      
      return projectData;
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error;
      }
      
      logger.error(`Failed to get project: ${error.message}`);
      throw new ProjectNotFoundError(id);
    }
  }
  
  /**
   * List all projects with optional filtering
   * @param {Object} [options] - Filtering options
   * @param {string} [options.status] - Filter by status
   * @param {boolean} [options.isLocal] - Filter by local/remote status
   * @param {string} [options.search] - Search term for name/description
   * @param {string} [options.sortBy] - Sort field (name, createdAt, updatedAt)
   * @param {string} [options.sortOrder] - Sort order (asc, desc)
   * @returns {Promise<Array<Object>>} List of projects
   */
  async listProjects(options = {}) {
    try {
      logger.info('Listing projects');
      
      // Get all project tabs
      const projectTabs = this.multiProjectManager.getAllProjectTabs();
      
      // Get detailed project data
      const projects = await Promise.all(
        projectTabs.map(async (tab) => {
          try {
            return await this.getProject(tab.id);
          } catch (error) {
            logger.warn(`Failed to get project details for ${tab.projectName}: ${error.message}`);
            return null;
          }
        })
      );
      
      // Filter out null values
      let filteredProjects = projects.filter(project => project !== null);
      
      // Apply filters
      if (options.status) {
        filteredProjects = filteredProjects.filter(project => 
          project.status === options.status
        );
      }
      
      if (options.isLocal !== undefined) {
        filteredProjects = filteredProjects.filter(project => 
          project.isLocal === options.isLocal
        );
      }
      
      if (options.search) {
        const searchTerm = options.search.toLowerCase();
        filteredProjects = filteredProjects.filter(project => 
          project.name.toLowerCase().includes(searchTerm) || 
          (project.description && project.description.toLowerCase().includes(searchTerm))
        );
      }
      
      // Apply sorting
      if (options.sortBy) {
        const sortField = options.sortBy;
        const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
        
        filteredProjects.sort((a, b) => {
          if (a[sortField] < b[sortField]) return -1 * sortOrder;
          if (a[sortField] > b[sortField]) return 1 * sortOrder;
          return 0;
        });
      }
      
      logger.info(`Found ${filteredProjects.length} projects`);
      return filteredProjects;
    } catch (error) {
      logger.error(`Failed to list projects: ${error.message}`);
      throw new ProjectOperationError(`Failed to list projects: ${error.message}`, {
        operation: 'listProjects'
      });
    }
  }
  
  /**
   * Initialize a project with a template
   * @param {string} id - Project ID or name
   * @param {string} [templateId] - Template ID (optional)
   * @returns {Promise<Object>} Initialized project
   * @throws {ProjectNotFoundError} If project is not found
   * @throws {ProjectOperationError} If initialization fails
   */
  async initializeProject(id, templateId) {
    try {
      logger.info(`Initializing project: ${id}`);
      
      // Get project
      const project = await this.getProject(id);
      
      // Get project tab
      const tab = this.multiProjectManager.getAllProjectTabs()
        .find(tab => tab.projectName === project.name);
      
      if (!tab) {
        throw new ProjectNotFoundError(id);
      }
      
      // Initialize project
      let success;
      
      if (templateId && this.templates.has(templateId)) {
        // Initialize with specific template
        const template = this.templates.get(templateId);
        
        // Apply template files
        const projectPath = path.join(this.options.projectsDir, project.name);
        
        // Create template files
        for (const file of template.files || []) {
          const filePath = path.join(projectPath, file.path);
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(filePath, file.content || '');
        }
        
        // Update project metadata
        const configPath = path.join(projectPath, 'project.json');
        const projectConfig = await fs.readJson(configPath);
        
        projectConfig.template = {
          id: templateId,
          name: template.name,
          appliedAt: new Date().toISOString()
        };
        
        await fs.writeJson(configPath, projectConfig, { spaces: 2 });
        
        // Mark as initialized
        success = await this.multiProjectManager.initializeProject(tab.id);
      } else {
        // Use default initialization
        success = await this.multiProjectManager.initializeProject(tab.id);
      }
      
      if (!success) {
        throw new Error('Project initialization failed');
      }
      
      // Update cache
      if (this.options.enableCaching) {
        this.cache.projects.delete(id);
        this.cache.lastUpdated.delete(id);
      }
      
      // Get updated project
      const updatedProject = await this.getProject(id);
      
      logger.info(`Project initialized: ${id}`);
      return updatedProject;
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error;
      }
      
      logger.error(`Failed to initialize project: ${error.message}`);
      throw new ProjectOperationError(`Failed to initialize project: ${error.message}`, {
        operation: 'initializeProject'
      });
    }
  }
  
  /**
   * Update project properties
   * @param {string} id - Project ID or name
   * @param {Object} properties - Properties to update
   * @returns {Promise<Object>} Updated project
   * @throws {ProjectNotFoundError} If project is not found
   * @throws {ProjectValidationError} If properties are invalid
   * @throws {ProjectOperationError} If update fails
   */
  async updateProject(id, properties) {
    try {
      logger.info(`Updating project: ${id}`);
      
      // Get project
      const project = await this.getProject(id);
      
      // Validate properties
      const validProperties = [
        'name', 'description', 'metadata', 'status'
      ];
      
      const invalidProperties = Object.keys(properties)
        .filter(key => !validProperties.includes(key));
      
      if (invalidProperties.length > 0) {
        throw new ProjectValidationError(`Invalid properties: ${invalidProperties.join(', ')}`);
      }
      
      // Update project configuration
      const projectPath = path.join(this.options.projectsDir, project.name);
      const configPath = path.join(projectPath, 'project.json');
      
      let projectConfig = {};
      
      if (await fs.pathExists(configPath)) {
        projectConfig = await fs.readJson(configPath);
      }
      
      // Apply updates
      const updatedConfig = {
        ...projectConfig,
        ...properties,
        updatedAt: new Date().toISOString()
      };
      
      await fs.writeJson(configPath, updatedConfig, { spaces: 2 });
      
      // Update cache
      if (this.options.enableCaching) {
        this.cache.projects.delete(id);
        this.cache.lastUpdated.delete(id);
      }
      
      // Get updated project
      const updatedProject = await this.getProject(id);
      
      logger.info(`Project updated: ${id}`);
      return updatedProject;
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error;
      }
      
      logger.error(`Failed to update project: ${error.message}`);
      throw new ProjectOperationError(`Failed to update project: ${error.message}`, {
        operation: 'updateProject'
      });
    }
  }
  
  /**
   * Clone an existing project
   * @param {string} id - Source project ID or name
   * @param {string} newName - New project name
   * @returns {Promise<Object>} Cloned project
   * @throws {ProjectNotFoundError} If source project is not found
   * @throws {ProjectExistsError} If project with new name already exists
   * @throws {ProjectOperationError} If cloning fails
   */
  async cloneProject(id, newName) {
    try {
      logger.info(`Cloning project ${id} to ${newName}`);
      
      // Get source project
      const sourceProject = await this.getProject(id);
      
      // Check if target project already exists
      const existingProject = await this.getProject(newName).catch(() => null);
      if (existingProject) {
        throw new ProjectExistsError(newName);
      }
      
      // Create new project
      const clonedProject = await this.createProject(newName, {
        description: `Clone of ${sourceProject.name}: ${sourceProject.description}`,
        repoUrl: sourceProject.repoUrl,
        isLocal: sourceProject.isLocal,
        metadata: { ...sourceProject.metadata, clonedFrom: sourceProject.id }
      });
      
      // Copy project files
      const sourceProjectPath = path.join(this.options.projectsDir, sourceProject.name);
      const targetProjectPath = path.join(this.options.projectsDir, newName);
      
      // Copy all files except project.json and git directory
      const files = await fs.readdir(sourceProjectPath);
      
      for (const file of files) {
        if (file !== 'project.json' && file !== '.git') {
          const sourcePath = path.join(sourceProjectPath, file);
          const targetPath = path.join(targetProjectPath, file);
          
          await fs.copy(sourcePath, targetPath);
        }
      }
      
      logger.info(`Project cloned: ${id} -> ${newName}`);
      return clonedProject;
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error;
      }
      
      logger.error(`Failed to clone project: ${error.message}`);
      throw new ProjectOperationError(`Failed to clone project: ${error.message}`, {
        operation: 'cloneProject'
      });
    }
  }
  
  /**
   * Get project status and metrics
   * @param {string} id - Project ID or name
   * @returns {Promise<Object>} Project status and metrics
   * @throws {ProjectNotFoundError} If project is not found
   */
  async getProjectStatus(id) {
    try {
      logger.info(`Getting status for project: ${id}`);
      
      // Get project
      const project = await this.getProject(id);
      
      // Get project tab
      const tab = this.multiProjectManager.getAllProjectTabs()
        .find(tab => tab.projectName === project.name);
      
      if (!tab) {
        throw new ProjectNotFoundError(id);
      }
      
      // Get project status
      const projectPath = path.join(this.options.projectsDir, project.name);
      
      // Get file statistics
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {}
      };
      
      const countFiles = async (dir) => {
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          const itemPath = path.join(dir, item);
          
          // Skip .git directory
          if (item === '.git') continue;
          
          const stat = await fs.stat(itemPath);
          
          if (stat.isDirectory()) {
            await countFiles(itemPath);
          } else {
            stats.totalFiles++;
            stats.totalSize += stat.size;
            
            // Count file types
            const ext = path.extname(item).toLowerCase();
            stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
          }
        }
      };
      
      await countFiles(projectPath);
      
      // Get initialization status
      const initStatus = await this.multiProjectManager.checkProjectInitialization(tab.id);
      
      // Get dependencies
      const dependencies = this.dependencies.get(id) || [];
      
      // Compile status
      const status = {
        id: project.id,
        name: project.name,
        status: project.status,
        isInitialized: initStatus.isInitialized,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        stats,
        dependencies,
        tab
      };
      
      logger.info(`Got status for project: ${id}`);
      return status;
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error;
      }
      
      logger.error(`Failed to get project status: ${error.message}`);
      throw new ProjectOperationError(`Failed to get project status: ${error.message}`, {
        operation: 'getProjectStatus'
      });
    }
  }
  
  /**
   * Set project dependencies
   * @param {string} id - Project ID or name
   * @param {Array<string>} dependencies - Array of project IDs that this project depends on
   * @returns {Promise<Object>} Updated project with dependencies
   * @throws {ProjectNotFoundError} If project or any dependency is not found
   * @throws {ProjectDependencyError} If dependency cycle is detected
   */
  async setProjectDependencies(id, dependencies) {
    try {
      logger.info(`Setting dependencies for project: ${id}`);
      
      // Get project
      const project = await this.getProject(id);
      
      // Validate dependencies
      const validatedDependencies = [];
      
      for (const depId of dependencies) {
        try {
          const dependency = await this.getProject(depId);
          validatedDependencies.push({
            id: dependency.id,
            name: dependency.name
          });
        } catch (error) {
          throw new ProjectNotFoundError(depId, { 
            details: { context: 'dependency validation' } 
          });
        }
      }
      
      // Check for circular dependencies
      const checkCircular = (projectId, depId, visited = new Set()) => {
        if (projectId === depId) return true;
        if (visited.has(depId)) return false;
        
        visited.add(depId);
        const depDependencies = this.dependencies.get(depId) || [];
        
        for (const dep of depDependencies) {
          if (checkCircular(projectId, dep.id, visited)) {
            return true;
          }
        }
        
        return false;
      };
      
      for (const dep of validatedDependencies) {
        if (checkCircular(id, dep.id)) {
          throw new ProjectDependencyError(
            `Circular dependency detected: ${project.name} -> ${dep.name}`,
            { dependencies: validatedDependencies }
          );
        }
      }
      
      // Set dependencies
      this.dependencies.set(id, validatedDependencies);
      
      // Update project configuration
      const projectPath = path.join(this.options.projectsDir, project.name);
      const configPath = path.join(projectPath, 'project.json');
      
      let projectConfig = {};
      
      if (await fs.pathExists(configPath)) {
        projectConfig = await fs.readJson(configPath);
      }
      
      // Apply updates
      const updatedConfig = {
        ...projectConfig,
        dependencies: validatedDependencies,
        updatedAt: new Date().toISOString()
      };
      
      await fs.writeJson(configPath, updatedConfig, { spaces: 2 });
      
      // Update cache
      if (this.options.enableCaching) {
        this.cache.projects.delete(id);
        this.cache.lastUpdated.delete(id);
      }
      
      // Get updated project
      const updatedProject = await this.getProject(id);
      
      logger.info(`Dependencies set for project: ${id}`);
      return {
        ...updatedProject,
        dependencies: validatedDependencies
      };
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error;
      }
      
      logger.error(`Failed to set project dependencies: ${error.message}`);
      throw new ProjectOperationError(`Failed to set project dependencies: ${error.message}`, {
        operation: 'setProjectDependencies'
      });
    }
  }
  
  /**
   * Validate project structure and configuration
   * @param {string} id - Project ID or name
   * @returns {Promise<Object>} Validation results
   * @throws {ProjectNotFoundError} If project is not found
   */
  async validateProject(id) {
    try {
      logger.info(`Validating project: ${id}`);
      
      // Get project
      const project = await this.getProject(id);
      
      // Get project tab
      const tab = this.multiProjectManager.getAllProjectTabs()
        .find(tab => tab.projectName === project.name);
      
      if (!tab) {
        throw new ProjectNotFoundError(id);
      }
      
      // Validate project structure
      const projectPath = path.join(this.options.projectsDir, project.name);
      
      // Required files/directories
      const requiredItems = [
        'project.json',
        'README.md'
      ];
      
      const validationResults = {
        id: project.id,
        name: project.name,
        isValid: true,
        errors: [],
        warnings: [],
        details: {}
      };
      
      // Check required files
      for (const item of requiredItems) {
        const itemPath = path.join(projectPath, item);
        const exists = await fs.pathExists(itemPath);
        
        validationResults.details[item] = exists;
        
        if (!exists) {
          validationResults.isValid = false;
          validationResults.errors.push(`Missing required file: ${item}`);
        }
      }
      
      // Check initialization status
      const initStatus = await this.multiProjectManager.checkProjectInitialization(tab.id);
      validationResults.details.initialization = initStatus;
      
      if (!initStatus.isInitialized) {
        validationResults.warnings.push('Project is not fully initialized');
      }
      
      // Check dependencies
      const dependencies = this.dependencies.get(id) || [];
      validationResults.details.dependencies = dependencies;
      
      for (const dep of dependencies) {
        try {
          await this.getProject(dep.id);
        } catch (error) {
          validationResults.isValid = false;
          validationResults.errors.push(`Missing dependency: ${dep.name} (${dep.id})`);
        }
      }
      
      logger.info(`Validated project: ${id}`);
      return validationResults;
    } catch (error) {
      if (error instanceof ProjectManagementError) {
        throw error;
      }
      
      logger.error(`Failed to validate project: ${error.message}`);
      throw new ProjectOperationError(`Failed to validate project: ${error.message}`, {
        operation: 'validateProject'
      });
    }
  }
  
  /**
   * Clear the project cache
   * @returns {boolean} Success status
   */
  clearCache() {
    try {
      this.cache.projects.clear();
      this.cache.lastUpdated.clear();
      logger.info('Project cache cleared');
      return true;
    } catch (error) {
      logger.error(`Failed to clear cache: ${error.message}`);
      return false;
    }
  }
}

module.exports = ProjectManagementSystem;
