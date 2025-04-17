import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Project, ProjectContextType, Template } from './types';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  templates: Template[];
  isLoading: boolean;
  error: string | null;
}

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ProjectState>({
    projects: [],
    selectedProject: null,
    templates: [],
    isLoading: false,
    error: null,
  });

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  };

  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error }));
  };

  const addProject = useCallback((project: Project) => {
    setState(prev => ({
      ...prev,
      projects: [...prev.projects, project],
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
    }));
  }, []);

  const removeProject = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      projects: prev.projects.filter(project => project.id !== id),
      selectedProject: prev.selectedProject?.id === id ? null : prev.selectedProject,
    }));
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
              validation: {
                rules: [
                  { type: 'test', value: true, enabled: true },
                  { type: 'lint', value: true, enabled: true },
                  { type: 'coverage', value: 80, enabled: true },
                  { type: 'custom', value: '', enabled: false },
                ],
                autoMerge: false,
                requireApproval: true,
              },
              concurrent: {
                enabled: false,
                maxFeatures: 5,
              },
              templates: projectData.templates || [],
            },
          };

          return project;
        })
      );

      setState(prev => ({
        ...prev,
        projects: [...prev.projects, ...importedProjects],
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
      // Simulate project initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      updateProject(id, {
        isInitialized: true,
        isInitializing: false,
        templateStatus: {
          total: 1,
          completed: 1,
        },
      });
    } catch (error) {
      updateProject(id, {
        isInitializing: false,
        error: error instanceof Error ? error.message : 'Failed to initialize project',
      });
    }
  }, [updateProject]);

  const refreshProject = useCallback(async (id: string) => {
    setError(null);
    updateProject(id, { isInitializing: true });

    try {
      // Simulate project refresh
      await new Promise(resolve => setTimeout(resolve, 1000));

      updateProject(id, {
        isInitializing: false,
        error: null,
      });
    } catch (error) {
      updateProject(id, {
        isInitializing: false,
        error: error instanceof Error ? error.message : 'Failed to refresh project',
      });
    }
  }, [updateProject]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate loading templates
      await new Promise(resolve => setTimeout(resolve, 1000));

      const templates: Template[] = [
        {
          id: 'template-1',
          name: 'Basic Project',
          description: 'A basic project template with common settings',
          parameters: {},
        },
        {
          id: 'template-2',
          name: 'Full Stack App',
          description: 'A full stack application template with frontend and backend',
          parameters: {},
        },
      ];

      setState(prev => ({ ...prev, templates }));
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
