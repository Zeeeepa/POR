import React, { createContext, useContext, useState, useCallback } from 'react';
import { Project, ProjectContextType } from './types';

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const addProject = useCallback((project: Project) => {
    setProjects(prev => [...prev, project]);
  }, []);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev =>
      prev.map(project =>
        project.id === id ? { ...project, ...updates } : project
      )
    );
  }, []);

  const removeProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(project => project.id !== id));
  }, []);

  const importProjects = useCallback(async (files: FileList) => {
    const importedProjects = await Promise.all(
      Array.from(files).map(async file => {
        const project: Project = {
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          isInitialized: false,
          templateStatus: {
            total: 0,
            completed: 0
          }
        };
        return project;
      })
    );

    setProjects(prev => [...prev, ...importedProjects]);
  }, []);

  const initializeProject = useCallback(async (id: string) => {
    updateProject(id, {
      isInitialized: true,
      templateStatus: {
        total: 1,
        completed: 1
      }
    });
  }, [updateProject]);

  const value = {
    projects,
    selectedProject,
    addProject,
    updateProject,
    removeProject,
    setSelectedProject,
    importProjects,
    initializeProject
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
