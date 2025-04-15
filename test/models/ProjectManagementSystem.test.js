/**
 * ProjectManagementSystem.test.js
 * Unit tests for the ProjectManagementSystem class
 */

const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const ProjectManagementSystem = require('../../src/models/ProjectManagementSystem');
const { 
  ProjectNotFoundError,
  ProjectExistsError,
  ProjectValidationError
} = require('../../src/errors/ProjectManagementError');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  ensureDir: jest.fn().mockResolvedValue(),
  pathExists: jest.fn().mockResolvedValue(true),
  readdir: jest.fn().mockResolvedValue([]),
  readJson: jest.fn().mockResolvedValue({}),
  writeJson: jest.fn().mockResolvedValue(),
  writeFile: jest.fn().mockResolvedValue(),
  copy: jest.fn().mockResolvedValue(),
  stat: jest.fn().mockResolvedValue({ size: 1000, isDirectory: () => false })
}));

jest.mock('../../src/models/MultiProjectManager', () => {
  return jest.fn().mockImplementation(() => ({
    getAllProjectTabs: jest.fn().mockReturnValue([
      { id: 'tab1', projectName: 'project1', status: 'active', addedAt: '2023-01-01T00:00:00Z' },
      { id: 'tab2', projectName: 'project2', status: 'initialized', addedAt: '2023-01-02T00:00:00Z' }
    ]),
    getProjectByName: jest.fn().mockImplementation((name) => {
      if (name === 'project1') {
        return { id: 'tab1', projectName: 'project1', status: 'active' };
      } else if (name === 'project2') {
        return { id: 'tab2', projectName: 'project2', status: 'initialized' };
      }
      return null;
    }),
    addProjectTab: jest.fn().mockImplementation((data) => ({
      id: 'new-tab-id',
      projectName: data.projectName,
      status: 'added',
      addedAt: new Date().toISOString()
    })),
    removeProjectTab: jest.fn().mockReturnValue(true),
    initializeProject: jest.fn().mockReturnValue(true),
    checkProjectInitialization: jest.fn().mockResolvedValue({ isInitialized: true, details: {} })
  }));
});

jest.mock('../../src/framework/ProjectManager', () => {
  return jest.fn().mockImplementation(() => ({
    addProject: jest.fn().mockResolvedValue({ config: { name: 'test-project' }, path: '/projects/test-project' }),
    getProject: jest.fn().mockResolvedValue({ config: { name: 'test-project' }, path: '/projects/test-project' })
  }));
});

describe('ProjectManagementSystem', () => {
  let pms;
  const testDir = path.join(process.cwd(), 'test-projects');
  const configDir = path.join(process.cwd(), 'test-config');
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    pms = new ProjectManagementSystem({
      projectsDir: testDir,
      configDir: configDir,
      enableCaching: true
    });
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultPms = new ProjectManagementSystem();
      expect(defaultPms.options.projectsDir).toContain('projects');
      expect(defaultPms.options.configDir).toContain('config');
      expect(defaultPms.options.enableCaching).toBe(true);
      expect(defaultPms.options.cacheTTL).toBe(5 * 60 * 1000);
    });
    
    it('should initialize with custom options', () => {
      expect(pms.options.projectsDir).toBe(testDir);
      expect(pms.options.configDir).toBe(configDir);
      expect(pms.options.enableCaching).toBe(true);
      expect(fs.ensureDirSync).toHaveBeenCalledWith(testDir);
      expect(fs.ensureDirSync).toHaveBeenCalledWith(configDir);
    });
  });
  
  describe('createProject', () => {
    it('should create a new project', async () => {
      const result = await pms.createProject('new-project', {
        description: 'Test project',
        repoUrl: 'https://github.com/test/repo'
      });
      
      expect(result.name).toBe('new-project');
      expect(result.description).toBe('Test project');
      expect(result.repoUrl).toBe('https://github.com/test/repo');
      expect(pms.multiProjectManager.addProjectTab).toHaveBeenCalled();
      expect(fs.writeJson).toHaveBeenCalled();
    });
    
    it('should throw ProjectValidationError if name is empty', async () => {
      await expect(pms.createProject('')).rejects.toThrow(ProjectValidationError);
    });
    
    it('should throw ProjectExistsError if project already exists', async () => {
      // Mock getProject to simulate existing project
      pms.getProject = jest.fn().mockResolvedValue({ id: 'existing', name: 'project1' });
      
      await expect(pms.createProject('project1')).rejects.toThrow(ProjectExistsError);
    });
  });
  
  describe('getProject', () => {
    it('should get a project by id', async () => {
      const result = await pms.getProject('tab1');
      
      expect(result.name).toBe('project1');
      expect(result.status).toBe('active');
    });
    
    it('should get a project by name', async () => {
      const result = await pms.getProject('project2');
      
      expect(result.name).toBe('project2');
      expect(result.status).toBe('initialized');
    });
    
    it('should throw ProjectNotFoundError if project not found', async () => {
      await expect(pms.getProject('non-existent')).rejects.toThrow(ProjectNotFoundError);
    });
    
    it('should use cache if available', async () => {
      // Add to cache
      pms.cache.projects.set('cached-project', { id: 'cached-project', name: 'Cached Project' });
      pms.cache.lastUpdated.set('cached-project', Date.now());
      
      const result = await pms.getProject('cached-project');
      
      expect(result.name).toBe('Cached Project');
      // Verify we didn't call the MultiProjectManager
      expect(pms.multiProjectManager.getAllProjectTabs).not.toHaveBeenCalled();
    });
  });
  
  describe('deleteProject', () => {
    it('should delete a project', async () => {
      // Mock getProject to return a valid project
      pms.getProject = jest.fn().mockResolvedValue({ id: 'tab1', name: 'project1' });
      
      const result = await pms.deleteProject('project1');
      
      expect(result).toBe(true);
      expect(pms.multiProjectManager.removeProjectTab).toHaveBeenCalledWith('tab1');
    });
    
    it('should throw ProjectNotFoundError if project not found', async () => {
      // Mock getProject to throw ProjectNotFoundError
      pms.getProject = jest.fn().mockRejectedValue(new ProjectNotFoundError('non-existent'));
      
      await expect(pms.deleteProject('non-existent')).rejects.toThrow(ProjectNotFoundError);
    });
  });
  
  describe('listProjects', () => {
    it('should list all projects', async () => {
      // Mock getProject to return project details
      pms.getProject = jest.fn()
        .mockResolvedValueOnce({ id: 'tab1', name: 'project1', status: 'active' })
        .mockResolvedValueOnce({ id: 'tab2', name: 'project2', status: 'initialized' });
      
      const results = await pms.listProjects();
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('project1');
      expect(results[1].name).toBe('project2');
    });
    
    it('should filter projects by status', async () => {
      // Mock getProject to return project details
      pms.getProject = jest.fn()
        .mockResolvedValueOnce({ id: 'tab1', name: 'project1', status: 'active' })
        .mockResolvedValueOnce({ id: 'tab2', name: 'project2', status: 'initialized' });
      
      const results = await pms.listProjects({ status: 'active' });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('project1');
    });
    
    it('should sort projects', async () => {
      // Mock getProject to return project details
      pms.getProject = jest.fn()
        .mockResolvedValueOnce({ id: 'tab1', name: 'project1', createdAt: '2023-01-02T00:00:00Z' })
        .mockResolvedValueOnce({ id: 'tab2', name: 'project2', createdAt: '2023-01-01T00:00:00Z' });
      
      const results = await pms.listProjects({ sortBy: 'createdAt', sortOrder: 'asc' });
      
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('project2'); // Earlier date should come first
      expect(results[1].name).toBe('project1');
    });
  });
  
  describe('initializeProject', () => {
    it('should initialize a project', async () => {
      // Mock getProject to return a valid project
      pms.getProject = jest.fn().mockResolvedValue({ id: 'tab1', name: 'project1' });
      
      const result = await pms.initializeProject('project1');
      
      expect(pms.multiProjectManager.initializeProject).toHaveBeenCalledWith('tab1');
      expect(result.name).toBe('project1');
    });
    
    it('should initialize a project with a template', async () => {
      // Mock getProject to return a valid project
      pms.getProject = jest.fn().mockResolvedValue({ id: 'tab1', name: 'project1' });
      
      // Add a template
      pms.templates.set('template1', {
        id: 'template1',
        name: 'Test Template',
        files: [
          { path: 'README.md', content: '# Test Project' },
          { path: 'src/index.js', content: 'console.log("Hello World");' }
        ]
      });
      
      const result = await pms.initializeProject('project1', 'template1');
      
      expect(fs.ensureDir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      expect(pms.multiProjectManager.initializeProject).toHaveBeenCalledWith('tab1');
      expect(result.name).toBe('project1');
    });
  });
  
  describe('updateProject', () => {
    it('should update project properties', async () => {
      // Mock getProject to return a valid project
      pms.getProject = jest.fn()
        .mockResolvedValueOnce({ id: 'tab1', name: 'project1' })
        .mockResolvedValueOnce({ id: 'tab1', name: 'project1', description: 'Updated description' });
      
      const result = await pms.updateProject('project1', {
        description: 'Updated description'
      });
      
      expect(fs.writeJson).toHaveBeenCalled();
      expect(result.description).toBe('Updated description');
    });
    
    it('should throw ProjectValidationError for invalid properties', async () => {
      // Mock getProject to return a valid project
      pms.getProject = jest.fn().mockResolvedValue({ id: 'tab1', name: 'project1' });
      
      await expect(pms.updateProject('project1', {
        invalidProperty: 'value'
      })).rejects.toThrow(ProjectValidationError);
    });
  });
  
  describe('cloneProject', () => {
    it('should clone a project', async () => {
      // Mock getProject to return a valid project for source and null for target
      pms.getProject = jest.fn()
        .mockResolvedValueOnce({ id: 'tab1', name: 'project1', description: 'Original project' })
        .mockRejectedValueOnce(new ProjectNotFoundError('clone-project'))
        .mockResolvedValueOnce({ id: 'new-tab-id', name: 'clone-project', description: 'Clone of project1: Original project' });
      
      // Mock createProject
      pms.createProject = jest.fn().mockResolvedValue({
        id: 'new-tab-id',
        name: 'clone-project',
        description: 'Clone of project1: Original project'
      });
      
      const result = await pms.cloneProject('project1', 'clone-project');
      
      expect(pms.createProject).toHaveBeenCalled();
      expect(fs.copy).toHaveBeenCalled();
      expect(result.name).toBe('clone-project');
      expect(result.description).toContain('Clone of project1');
    });
  });
  
  describe('getProjectStatus', () => {
    it('should get project status and metrics', async () => {
      // Mock getProject to return a valid project
      pms.getProject = jest.fn().mockResolvedValue({
        id: 'tab1',
        name: 'project1',
        status: 'active',
        createdAt: '2023-01-01T00:00:00Z',
        updatedAt: '2023-01-02T00:00:00Z'
      });
      
      // Mock fs.readdir to return some files
      fs.readdir.mockResolvedValue(['file1.js', 'file2.md', '.git']);
      
      const result = await pms.getProjectStatus('project1');
      
      expect(result.name).toBe('project1');
      expect(result.status).toBe('active');
      expect(result.isInitialized).toBe(true);
      expect(result.stats.totalFiles).toBe(2); // .git should be skipped
      expect(result.stats.totalSize).toBe(2000); // 2 files * 1000 bytes
    });
  });
  
  describe('setProjectDependencies', () => {
    it('should set project dependencies', async () => {
      // Mock getProject to return valid projects
      pms.getProject = jest.fn()
        .mockResolvedValueOnce({ id: 'tab1', name: 'project1' }) // Main project
        .mockResolvedValueOnce({ id: 'tab2', name: 'project2' }) // Dependency 1
        .mockResolvedValueOnce({ id: 'tab3', name: 'project3' }) // Dependency 2
        .mockResolvedValueOnce({ id: 'tab1', name: 'project1', dependencies: [{ id: 'tab2', name: 'project2' }, { id: 'tab3', name: 'project3' }] }); // Updated project
      
      const result = await pms.setProjectDependencies('project1', ['tab2', 'tab3']);
      
      expect(fs.writeJson).toHaveBeenCalled();
      expect(result.dependencies).toHaveLength(2);
      expect(result.dependencies[0].name).toBe('project2');
      expect(result.dependencies[1].name).toBe('project3');
    });
    
    it('should throw ProjectNotFoundError for non-existent dependency', async () => {
      // Mock getProject to return valid project but throw for dependency
      pms.getProject = jest.fn()
        .mockResolvedValueOnce({ id: 'tab1', name: 'project1' }) // Main project
        .mockRejectedValueOnce(new ProjectNotFoundError('non-existent')); // Dependency not found
      
      await expect(pms.setProjectDependencies('project1', ['non-existent'])).rejects.toThrow(ProjectNotFoundError);
    });
  });
  
  describe('validateProject', () => {
    it('should validate a project', async () => {
      // Mock getProject to return a valid project
      pms.getProject = jest.fn().mockResolvedValue({ id: 'tab1', name: 'project1' });
      
      // Mock fs.pathExists to return true for required files
      fs.pathExists.mockResolvedValue(true);
      
      const result = await pms.validateProject('project1');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
    
    it('should report missing required files', async () => {
      // Mock getProject to return a valid project
      pms.getProject = jest.fn().mockResolvedValue({ id: 'tab1', name: 'project1' });
      
      // Mock fs.pathExists to return false for README.md
      fs.pathExists.mockImplementation((path) => {
        return Promise.resolve(!path.endsWith('README.md'));
      });
      
      const result = await pms.validateProject('project1');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Missing required file');
    });
  });
  
  describe('clearCache', () => {
    it('should clear the project cache', () => {
      // Add some items to cache
      pms.cache.projects.set('project1', { name: 'Project 1' });
      pms.cache.lastUpdated.set('project1', Date.now());
      
      const result = pms.clearCache();
      
      expect(result).toBe(true);
      expect(pms.cache.projects.size).toBe(0);
      expect(pms.cache.lastUpdated.size).toBe(0);
    });
  });
});
