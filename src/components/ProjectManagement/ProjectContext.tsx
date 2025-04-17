import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Project, ProjectContextType, Template, Phase, ValidationRule } from './types';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  templates: Template[];
  isLoading: boolean;
  error: string | null;
  success: string | null;
}

interface ProjectSettings {
  validation: {
    rules: ValidationRule[];
    autoMerge: boolean;
    requireApproval: boolean;
  };
  concurrent: {
    enabled: boolean;
    maxFeatures: number;
    activeFeatures: number;
  };
  templates: Template[];
  phases: Phase[];
  timing: {
    estimatedTime: number;
    elapsedTime: number;
    startTime?: Date;
    endTime?: Date;
  };
}

const defaultValidationRules: ValidationRule[] = [
  { type: 'test', value: true, enabled: true },
  { type: 'lint', value: true, enabled: true },
  { type: 'coverage', value: 80, enabled: true },
  { type: 'custom', value: '', enabled: false },
];

const defaultProjectSettings: ProjectSettings = {
  validation: {
    rules: defaultValidationRules,
    autoMerge: false,
    requireApproval: true,
  },
  concurrent: {
    enabled: false,
    maxFeatures: 5,
    activeFeatures: 0,
  },
  templates: [],
  phases: [],
  timing: {
    estimatedTime: 0,
    elapsedTime: 0,
  },
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ProjectState>({
    projects: [],
    selectedProject: null,
    templates: [],
    isLoading: false,
    error: null,
    success: null,
  });

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  };

  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error }));
  };

  const setSuccess = (success: string | null) => {
    setState(prev => ({ ...prev, success }));
  };

  const addProject = useCallback((project: Project) => {
    setState(prev => ({
      ...prev,
      projects: [...prev.projects, project],
      success: `Project "${project.name}" added successfully`,
    }));
  }, []);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setState(prev => ({
      ...prev,
      projects: prev.projects.map(project =>
        project.id === id ? { ...project, ...updates } : project
      ),
      selectedProject:
        prev.selectedProject?.id === id
          ? { ...prev.selectedProject, ...updates }
          : prev.selectedProject,
      success: `Project "${prev.projects.find(p => p.id === id)?.name}" updated successfully`,
    }));
  }, []);

  const removeProject = useCallback((id: string) => {
    setState(prev => {
      const projectName = prev.projects.find(p => p.id === id)?.name;
      return {
        ...prev,
        projects: prev.projects.filter(project => project.id !== id),
        selectedProject: prev.selectedProject?.id === id ? null : prev.selectedProject,
        success: `Project "${projectName}" removed successfully`,
      };
    });
  }, []);

  const setSelectedProject = useCallback((project: Project | null) => {
    setState(prev => ({ ...prev, selectedProject: project }));
  }, []);

  const importProjects = useCallback(async (files: FileList) => {
    setLoading(true);
    setError(null);

    try {
      const importedProjects = await Promise.all(
        Array.from(files).map(async file => {
          const content = await file.text();
          let projectData;

          try {
            projectData = JSON.parse(content);
          } catch (e) {
            throw new Error(`Invalid project file format: ${file.name}`);
          }

          const project: Project = {
            id: crypto.randomUUID(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            description: projectData.description || '',
            isInitialized: false,
            isInitializing: false,
            error: null,
            templateStatus: {
              total: 0,
              completed: 0,
            },
            settings: {
              ...defaultProjectSettings,
              templates: projectData.templates || [],
              phases: projectData.phases || [],
              timing: {
                ...defaultProjectSettings.timing,
                estimatedTime: projectData.estimatedTime || 0,
              },
            },
          };

          return project;
        })
      );

      setState(prev => ({
        ...prev,
        projects: [...prev.projects, ...importedProjects],
        success: `${importedProjects.length} project(s) imported successfully`,
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to import projects');
    } finally {
      setLoading(false);
    }
  }, []);

  const initializeProject = useCallback(async (id: string) => {
    setError(null);
    updateProject(id, { isInitializing: true });

    try {
      const project = state.projects.find(p => p.id === id);
      if (!project) throw new Error('Project not found');

      const phases: Phase[] = [
        {
          id: crypto.randomUUID(),
          name: 'Structure Analysis',
          description: 'Analyze and document existing codebase structure',
          status: 'pending',
          template: {
            id: 'structure-current',
            name: 'GenerateSTRUCTURE\'current\'.promptp',
            description: 'Template for analyzing current code structure',
            parameters: {},
          },
          validation: {
            rules: defaultValidationRules,
            autoMerge: true,
            requireApproval: false,
          },
          estimatedTime: 5,
          concurrentFeatures: false,
          maxConcurrentFeatures: 1,
        },
        {
          id: crypto.randomUUID(),
          name: 'Feature Suggestions',
          description: 'Generate potential feature enhancements',
          status: 'pending',
          template: {
            id: 'structure-suggested',
            name: 'generateSTRUCTURE\'suggested\'.prompt',
            description: 'Template for generating suggested features',
            parameters: {},
          },
          validation: {
            rules: defaultValidationRules,
            autoMerge: true,
            requireApproval: false,
          },
          estimatedTime: 10,
          concurrentFeatures: false,
          maxConcurrentFeatures: 1,
        },
        {
          id: crypto.randomUUID(),
          name: 'Step Generation',
          description: 'Create implementation plan with concurrent components',
          status: 'pending',
          template: {
            id: 'generate-step',
            name: 'GenerateSTEP.prompt',
            description: 'Template for generating implementation steps',
            parameters: {},
          },
          validation: {
            rules: defaultValidationRules,
            autoMerge: true,
            requireApproval: false,
          },
          estimatedTime: 15,
          concurrentFeatures: false,
          maxConcurrentFeatures: 1,
        },
      ];

      const settings: ProjectSettings = {
        ...defaultProjectSettings,
        phases,
        timing: {
          ...defaultProjectSettings.timing,
          startTime: new Date(),
          estimatedTime: phases.reduce((total, phase) => total + phase.estimatedTime, 0),
        },
      };

      updateProject(id, {
        isInitialized: true,
        isInitializing: false,
        settings,
        templateStatus: {
          total: phases.length,
          completed: 0,
        },
      });

      setSuccess(`Project "${project.name}" initialized successfully`);
    } catch (error) {
      updateProject(id, {
        isInitializing: false,
        error: error instanceof Error ? error.message : 'Failed to initialize project',
      });
      setError(error instanceof Error ? error.message : 'Failed to initialize project');
    }
  }, [state.projects, updateProject]);

  const refreshProject = useCallback(async (id: string) => {
    setError(null);
    updateProject(id, { isInitializing: true });

    try {
      const project = state.projects.find(p => p.id === id);
      if (!project) throw new Error('Project not found');

      if (project.settings?.timing.startTime) {
        const now = new Date();
        const elapsedTime = Math.floor(
          (now.getTime() - new Date(project.settings.timing.startTime).getTime()) / 60000
        );

        updateProject(id, {
          isInitializing: false,
          error: null,
          settings: {
            ...project.settings,
            timing: {
              ...project.settings.timing,
              elapsedTime,
            },
          },
        });
      } else {
        updateProject(id, {
          isInitializing: false,
          error: null,
        });
      }

      setSuccess(`Project "${project.name}" refreshed successfully`);
    } catch (error) {
      updateProject(id, {
        isInitializing: false,
        error: error instanceof Error ? error.message : 'Failed to refresh project',
      });
      setError(error instanceof Error ? error.message : 'Failed to refresh project');
    }
  }, [state.projects, updateProject]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const templates: Template[] = [
        {
          id: 'structure-current',
          name: 'Current Structure Analysis',
          description: 'Template for analyzing current code structure',
          parameters: {},
        },
        {
          id: 'structure-suggested',
          name: 'Feature Suggestions',
          description: 'Template for generating suggested features',
          parameters: {},
        },
        {
          id: 'generate-step',
          name: 'Step Generation',
          description: 'Template for generating implementation steps',
          parameters: {},
        },
        {
          id: 'feature-implementation',
          name: 'Feature Implementation',
          description: 'Template for implementing individual features',
          parameters: {},
        },
        {
          id: 'phase-validation',
          name: 'Phase Validation',
          description: 'Template for validating phase completion',
          parameters: {},
        },
      ];

      setState(prev => ({
        ...prev,
        templates,
        success: 'Templates loaded successfully',
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const value = {
    projects: state.projects,
    selectedProject: state.selectedProject,
    templates: state.templates,
    isLoading: state.isLoading,
    error: state.error,
    success: state.success,
    addProject,
    updateProject,
    removeProject,
    setSelectedProject,
    importProjects,
    initializeProject,
    refreshProject,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

export default ProjectContext;
