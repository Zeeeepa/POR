// Project Types
export interface Project {
  id: string;
  name: string;
  isInitialized: boolean;
  templateStatus: {
    total: number;
    completed: number;
  };
  settings?: ProjectSettings;
}

export interface ProjectSettings {
  templatePath?: string;
  outputPath?: string;
  customSettings?: Record<string, unknown>;
}

export interface TemplateFile {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

// Context Types
export interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setSelectedProject: (project: Project | null) => void;
  importProjects: (files: FileList) => Promise<void>;
  initializeProject: (id: string) => Promise<void>;
}

// Component Props Types
export interface ProjectListProps {
  onProjectSelect?: (project: Project) => void;
}

export interface ProjectInitializationProps {
  project: Project;
  onInitialize: () => Promise<void>;
  onTemplateUpdate: (templateFiles: TemplateFile[]) => void;
}
