// Project Types
export interface Project {
  id: string;
  name: string;
  description: string;
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;
  templateStatus: {
    total: number;
    completed: number;
  };
  settings: ProjectSettings;
}

export interface ValidationRule {
  type: 'test' | 'lint' | 'coverage' | 'custom';
  value: string | number;
  enabled: boolean;
}

export interface ValidationSettings {
  rules: ValidationRule[];
  autoMerge: boolean;
  requireApproval: boolean;
}

export interface ConcurrentSettings {
  enabled: boolean;
  maxFeatures: number;
  activeFeatures: number;
  rateLimit: number;
  retrySettings: {
    maxAttempts: number;
    delayBetweenAttempts: number;
  };
}

export interface TimingSettings {
  estimatedTime: number;
  elapsedTime: number;
  startTime?: Date;
  endTime?: Date;
  phases: {
    [phaseId: string]: {
      estimatedTime: number;
      elapsedTime: number;
      startTime?: Date;
      endTime?: Date;
    };
  };
}

export interface ProjectSettings {
  templatePath?: string;
  outputPath?: string;
  validation: ValidationSettings;
  concurrent: ConcurrentSettings;
  timing: TimingSettings;
  templates: Template[];
  phases: Phase[];
  customSettings?: Record<string, unknown>;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
  validation?: ValidationSettings;
  concurrent?: ConcurrentSettings;
  timing?: {
    estimatedTime: number;
  };
}

export interface TemplateFile {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
  template: Template;
  settings?: Record<string, any>;
}

export interface Phase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
  progress?: number;
  estimatedTime: number;
  validation: ValidationSettings;
  concurrent: ConcurrentSettings;
  template?: Template;
  features: Feature[];
  dependencies: string[];
  timing: {
    estimatedTime: number;
    elapsedTime: number;
    startTime?: Date;
    endTime?: Date;
  };
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
  progress?: number;
  estimatedTime: number;
  validation: ValidationSettings;
  dependencies: string[];
  template?: Template;
  settings?: Record<string, any>;
  timing: {
    estimatedTime: number;
    elapsedTime: number;
    startTime?: Date;
    endTime?: Date;
  };
}

// Context Types
export interface ProjectContextType {
  projects: Project[];
  selectedProject: Project | null;
  templates: Template[];
  isLoading: boolean;
  error: string | null;
  success: string | null;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setSelectedProject: (project: Project | null) => void;
  importProjects: (files: FileList) => Promise<void>;
  initializeProject: (id: string) => Promise<void>;
  refreshProject: (id: string) => Promise<void>;
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

export interface PhaseProps {
  phase: Phase;
  onPhaseStart: () => Promise<void>;
  onPhaseStop: () => Promise<void>;
  onPhaseUpdate: (updates: Partial<Phase>) => void;
  onPhaseDelete: () => void;
  onFeatureAdd: () => void;
  onFeatureUpdate: (featureId: string, updates: Partial<Feature>) => void;
  onFeatureDelete: (featureId: string) => void;
  isRunning: boolean;
}

export interface FeatureProps {
  feature: Feature;
  onFeatureStart: () => Promise<void>;
  onFeatureStop: () => Promise<void>;
  onFeatureUpdate: (updates: Partial<Feature>) => void;
  onFeatureDelete: () => void;
  isRunning: boolean;
}

export interface ProjectSettingsProps {
  project: Project;
  onSettingsUpdate: (settings: ProjectSettings) => void;
  onSettingsCancel: () => void;
  isRunning: boolean;
}

export interface TemplateProps {
  template: Template;
  onTemplateSelect: () => void;
  onTemplateUpdate: (updates: Partial<Template>) => void;
  onTemplateDelete: () => void;
  isSelected: boolean;
}

export interface ValidationProps {
  validation: ValidationSettings;
  onValidationUpdate: (updates: Partial<ValidationSettings>) => void;
  isRunning: boolean;
}

export interface ConcurrentProps {
  concurrent: ConcurrentSettings;
  onConcurrentUpdate: (updates: Partial<ConcurrentSettings>) => void;
  isRunning: boolean;
}

export interface TimingProps {
  timing: TimingSettings;
  onTimingUpdate: (updates: Partial<TimingSettings>) => void;
  isRunning: boolean;
}

export interface ProjectErrorProps {
  error: string;
  onErrorDismiss: () => void;
}

export interface ProjectLoadingProps {
  message?: string;
}

export interface ProjectSuccessProps {
  message: string;
  onSuccessDismiss: () => void;
}

export interface ProjectConfirmationProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export interface ProjectDialogProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  isOpen: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
}

export interface ProjectActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  variant?: 'text' | 'outlined' | 'contained';
  disabled?: boolean;
  loading?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export interface ProjectStatusChipProps {
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  label?: string;
  size?: 'small' | 'medium';
  showIcon?: boolean;
  progress?: number;
  error?: string;
  warning?: string;
  info?: string;
}

export interface ProjectProgressProps {
  value: number;
  variant?: 'determinate' | 'indeterminate';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  label?: string;
}

export interface ProjectTooltipProps {
  title: string;
  children: React.ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  arrow?: boolean;
}

export interface ProjectMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  isOpen: boolean;
  items: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    divider?: boolean;
  }[];
}

export interface ProjectTabsProps {
  value: number;
  onChange: (event: React.SyntheticEvent, newValue: number) => void;
  tabs: {
    label: string;
    icon?: React.ReactNode;
    disabled?: boolean;
  }[];
}

export interface ProjectGridProps {
  items: React.ReactNode[];
  spacing?: number;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

export interface ProjectSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export interface ProjectFilterProps {
  filters: {
    label: string;
    value: string;
    options: {
      label: string;
      value: string;
    }[];
    onChange: (value: string) => void;
  }[];
}

export interface ProjectSortProps {
  value: string;
  onChange: (value: string) => void;
  options: {
    label: string;
    value: string;
  }[];
}

export interface ProjectPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

export interface ProjectEmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ProjectErrorStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ProjectLoadingStateProps {
  title: string;
  description?: string;
}

export interface ProjectSuccessStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}
