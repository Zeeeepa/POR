import React, { useState, useEffect } from 'react';
import {
  Box,
  Tab,
  Tabs,
  TextField,
  Button,
  IconButton,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  FormControlLabel,
  Switch,
  Select,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Refresh as RefreshIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  MoreVert as MoreIcon,
  Code as CodeIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useProject } from './ProjectContext';
import { ProjectListProps, Project, Template, Phase } from './types';

const ProjectTabPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
}));

const SearchBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

const StatusIndicator = styled('span')<{ status: 'initialized' | 'not_initialized' | 'error' | 'in_progress' }>(
  ({ theme, status }) => ({
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: (() => {
      switch (status) {
        case 'initialized':
          return theme.palette.success.main;
        case 'not_initialized':
          return theme.palette.warning.main;
        case 'error':
          return theme.palette.error.main;
        case 'in_progress':
          return theme.palette.info.main;
        default:
          return theme.palette.grey[400];
      }
    })(),
    marginRight: theme.spacing(1),
    boxShadow: `0 0 8px ${(() => {
      switch (status) {
        case 'initialized':
          return theme.palette.success.main;
        case 'not_initialized':
          return theme.palette.warning.main;
        case 'error':
          return theme.palette.error.main;
        case 'in_progress':
          return theme.palette.info.main;
        default:
          return theme.palette.grey[400];
      }
    })()}`,
  })
);

const TabLabel = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const ProjectCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

const ProjectContent = styled(CardContent)({
  flexGrow: 1,
});

interface ProjectSettingsDialogProps {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (project: Project) => void;
  templates: Template[];
}

const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({
  open,
  project,
  onClose,
  onSave,
  templates,
}) => {
  const [editedProject, setEditedProject] = useState<Project | null>(null);

  useEffect(() => {
    setEditedProject(project);
  }, [project]);

  if (!editedProject) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Project Settings - {editedProject.name}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Project Name"
              value={editedProject.name}
              onChange={(e) =>
                setEditedProject({ ...editedProject, name: e.target.value })
              }
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={editedProject.description || ''}
              onChange={(e) =>
                setEditedProject({
                  ...editedProject,
                  description: e.target.value,
                })
              }
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Templates
            </Typography>
            <Grid container spacing={1}>
              {templates.map((template) => (
                <Grid item key={template.id}>
                  <Chip
                    label={template.name}
                    variant={
                      editedProject.settings.templates.some(
                        (t) => t.id === template.id
                      )
                        ? 'filled'
                        : 'outlined'
                    }
                    onClick={() => {
                      const isSelected = editedProject.settings.templates.some(
                        (t) => t.id === template.id
                      );
                      setEditedProject({
                        ...editedProject,
                        settings: {
                          ...editedProject.settings,
                          templates: isSelected
                            ? editedProject.settings.templates.filter(
                                (t) => t.id !== template.id
                              )
                            : [...editedProject.settings.templates, template],
                        },
                      });
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Validation Settings
            </Typography>
            {editedProject.settings.validation.rules.map((rule, index) => (
              <Box key={rule.type} mb={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={rule.enabled}
                      onChange={(e) => {
                        const updatedRules = [
                          ...editedProject.settings.validation.rules,
                        ];
                        updatedRules[index] = {
                          ...rule,
                          enabled: e.target.checked,
                        };
                        setEditedProject({
                          ...editedProject,
                          settings: {
                            ...editedProject.settings,
                            validation: {
                              ...editedProject.settings.validation,
                              rules: updatedRules,
                            },
                          },
                        });
                      }}
                    />
                  }
                  label={rule.type.charAt(0).toUpperCase() + rule.type.slice(1)}
                />
                {rule.type === 'coverage' && rule.enabled && (
                  <TextField
                    fullWidth
                    type="number"
                    label="Coverage Threshold (%)"
                    value={rule.value}
                    onChange={(e) => {
                      const updatedRules = [
                        ...editedProject.settings.validation.rules,
                      ];
                      updatedRules[index] = {
                        ...rule,
                        value: parseInt(e.target.value),
                      };
                      setEditedProject({
                        ...editedProject,
                        settings: {
                          ...editedProject.settings,
                          validation: {
                            ...editedProject.settings.validation,
                            rules: updatedRules,
                          },
                        },
                      });
                    }}
                    margin="normal"
                  />
                )}
                {rule.type === 'custom' && rule.enabled && (
                  <TextField
                    fullWidth
                    label="Custom Validation Command"
                    value={rule.value}
                    onChange={(e) => {
                      const updatedRules = [
                        ...editedProject.settings.validation.rules,
                      ];
                      updatedRules[index] = {
                        ...rule,
                        value: e.target.value,
                      };
                      setEditedProject({
                        ...editedProject,
                        settings: {
                          ...editedProject.settings,
                          validation: {
                            ...editedProject.settings.validation,
                            rules: updatedRules,
                          },
                        },
                      });
                    }}
                    margin="normal"
                  />
                )}
              </Box>
            ))}
            <FormControlLabel
              control={
                <Switch
                  checked={editedProject.settings.validation.autoMerge}
                  onChange={(e) =>
                    setEditedProject({
                      ...editedProject,
                      settings: {
                        ...editedProject.settings,
                        validation: {
                          ...editedProject.settings.validation,
                          autoMerge: e.target.checked,
                        },
                      },
                    })
                  }
                />
              }
              label="Auto-merge on validation success"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editedProject.settings.validation.requireApproval}
                  onChange={(e) =>
                    setEditedProject({
                      ...editedProject,
                      settings: {
                        ...editedProject.settings,
                        validation: {
                          ...editedProject.settings.validation,
                          requireApproval: e.target.checked,
                        },
                      },
                    })
                  }
                />
              }
              label="Require approval before merge"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Concurrent Development
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={editedProject.settings.concurrent.enabled}
                  onChange={(e) =>
                    setEditedProject({
                      ...editedProject,
                      settings: {
                        ...editedProject.settings,
                        concurrent: {
                          ...editedProject.settings.concurrent,
                          enabled: e.target.checked,
                        },
                      },
                    })
                  }
                />
              }
              label="Enable concurrent development"
            />
            {editedProject.settings.concurrent.enabled && (
              <>
                <TextField
                  fullWidth
                  type="number"
                  label="Max Concurrent Features"
                  value={editedProject.settings.concurrent.maxFeatures}
                  onChange={(e) =>
                    setEditedProject({
                      ...editedProject,
                      settings: {
                        ...editedProject.settings,
                        concurrent: {
                          ...editedProject.settings.concurrent,
                          maxFeatures: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  margin="normal"
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Rate Limit (requests/min)"
                  value={editedProject.settings.concurrent.rateLimit}
                  onChange={(e) =>
                    setEditedProject({
                      ...editedProject,
                      settings: {
                        ...editedProject.settings,
                        concurrent: {
                          ...editedProject.settings.concurrent,
                          rateLimit: parseInt(e.target.value),
                        },
                      },
                    })
                  }
                  margin="normal"
                />
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Retry Settings
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Retry Attempts"
                    value={
                      editedProject.settings.concurrent.retrySettings.maxAttempts
                    }
                    onChange={(e) =>
                      setEditedProject({
                        ...editedProject,
                        settings: {
                          ...editedProject.settings,
                          concurrent: {
                            ...editedProject.settings.concurrent,
                            retrySettings: {
                              ...editedProject.settings.concurrent.retrySettings,
                              maxAttempts: parseInt(e.target.value),
                            },
                          },
                        },
                      })
                    }
                    margin="normal"
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label="Delay Between Attempts (ms)"
                    value={
                      editedProject.settings.concurrent.retrySettings
                        .delayBetweenAttempts
                    }
                    onChange={(e) =>
                      setEditedProject({
                        ...editedProject,
                        settings: {
                          ...editedProject.settings,
                          concurrent: {
                            ...editedProject.settings.concurrent,
                            retrySettings: {
                              ...editedProject.settings.concurrent.retrySettings,
                              delayBetweenAttempts: parseInt(e.target.value),
                            },
                          },
                        },
                      })
                    }
                    margin="normal"
                  />
                </Box>
              </>
            )}
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Timing Settings
            </Typography>
            <TextField
              fullWidth
              type="number"
              label="Estimated Time (minutes)"
              value={editedProject.settings.timing.estimatedTime}
              onChange={(e) =>
                setEditedProject({
                  ...editedProject,
                  settings: {
                    ...editedProject.settings,
                    timing: {
                      ...editedProject.settings.timing,
                      estimatedTime: parseInt(e.target.value),
                    },
                  },
                })
              }
              margin="normal"
            />
            {editedProject.settings.timing.elapsedTime > 0 && (
              <Typography variant="body2" color="textSecondary">
                Elapsed Time: {editedProject.settings.timing.elapsedTime} minutes
              </Typography>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            onSave(editedProject);
            onClose();
          }}
          color="primary"
          variant="contained"
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const ProjectList: React.FC<ProjectListProps> = ({ onProjectSelect }) => {
  const {
    projects,
    selectedProject,
    setSelectedProject,
    importProjects,
    deleteProject,
    updateProject,
    templates,
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedProjectForSettings, setSelectedProjectForSettings] =
    useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProjectForMenu, setSelectedProjectForMenu] =
    useState<Project | null>(null);

  const handleProjectImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    setIsImporting(true);
    try {
      await importProjects(files);
      setSuccess('Projects imported successfully');
    } catch (error) {
      console.error('Error importing projects:', error);
      setError('Failed to import projects');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
    if (filteredProjects[newValue]) {
      setSelectedProject(filteredProjects[newValue]);
      onProjectSelect?.(filteredProjects[newValue]);
    }
  };

  const handleProjectDelete = async (project: Project) => {
    try {
      await deleteProject(project.id);
      setSuccess('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      setError('Failed to delete project');
    }
  };

  const handleProjectUpdate = async (project: Project) => {
    try {
      await updateProject(project);
      setSuccess('Project updated successfully');
    } catch (error) {
      console.error('Error updating project:', error);
      setError('Failed to update project');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, project: Project) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedProjectForMenu(project);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedProjectForMenu(null);
  };

  const getProjectStatus = (project: Project) => {
    if (project.error) return 'error';
    if (project.isInitializing) return 'in_progress';
    return project.isInitialized ? 'initialized' : 'not_initialized';
  };

  const getProjectProgress = (project: Project) => {
    if (!project.settings.phases.length) return 0;
    const completedPhases = project.settings.phases.filter(
      (phase) => phase.status === 'completed'
    ).length;
    return (completedPhases / project.settings.phases.length) * 100;
  };

  const getProjectTiming = (project: Project) => {
    const { timing } = project.settings;
    if (!timing.startTime) return null;

    const elapsedTime = timing.elapsedTime;
    const estimatedTime = timing.estimatedTime;
    const progress = (elapsedTime / estimatedTime) * 100;

    return {
      elapsedTime,
      estimatedTime,
      progress,
      isOvertime: elapsedTime > estimatedTime,
    };
  };

  return (
    <Box>
      <SearchBar>
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon color="action" />,
          }}
        />
        <Button
          variant="contained"
          component="label"
          disabled={isImporting}
          startIcon={isImporting ? <CircularProgress size={20} /> : <AddIcon />}
        >
          Import Projects
          <input
            type="file"
            multiple
            hidden
            onChange={handleProjectImport}
            accept=".json,.yaml,.yml"
          />
        </Button>
      </SearchBar>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {filteredProjects.length > 0 ? (
        <Grid container spacing={2}>
          {filteredProjects.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <ProjectCard>
                <ProjectContent>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="flex-start"
                  >
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        <StatusIndicator status={getProjectStatus(project)} />
                        {project.name}
                      </Typography>
                      <Typography
                        color="textSecondary"
                        variant="body2"
                        gutterBottom
                      >
                        {project.description || 'No description'}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, project)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Box>

                  <Box mt={2}>
                    <Chip
                      size="small"
                      label={`Templates: ${project.templateStatus.completed}/${project.templateStatus.total}`}
                      color={
                        project.templateStatus.completed ===
                        project.templateStatus.total
                          ? 'success'
                          : 'default'
                      }
                      sx={{ mr: 1, mb: 1 }}
                    />
                    <Chip
                      size="small"
                      label={project.isInitialized ? 'Initialized' : 'Not Initialized'}
                      color={project.isInitialized ? 'success' : 'warning'}
                      sx={{ mr: 1, mb: 1 }}
                    />
                    {project.settings.concurrent.enabled && (
                      <Tooltip
                        title={`${project.settings.concurrent.activeFeatures}/${project.settings.concurrent.maxFeatures} features active`}
                      >
                        <Chip
                          size="small"
                          label="Concurrent"
                          color="info"
                          variant="outlined"
                          sx={{ mr: 1, mb: 1 }}
                        />
                      </Tooltip>
                    )}
                    {project.error && (
                      <Tooltip title={project.error}>
                        <Chip
                          size="small"
                          label="Error"
                          color="error"
                          icon={<WarningIcon />}
                          sx={{ mb: 1 }}
                        />
                      </Tooltip>
                    )}
                  </Box>

                  {project.settings.phases.length > 0 && (
                    <Box mt={2}>
                      <Typography variant="body2" gutterBottom>
                        Phases Progress
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={getProjectProgress(project)}
                      />
                      <Typography variant="caption" color="textSecondary">
                        {project.settings.phases.filter(
                          (phase) => phase.status === 'completed'
                        ).length}{' '}
                        / {project.settings.phases.length} phases completed
                      </Typography>
                    </Box>
                  )}

                  {project.isInitialized && (
                    <Box mt={2}>
                      <Typography variant="body2" gutterBottom>
                        Timing
                      </Typography>
                      {getProjectTiming(project) && (
                        <>
                          <LinearProgress
                            variant="determinate"
                            value={getProjectTiming(project)!.progress}
                            color={
                              getProjectTiming(project)!.isOvertime
                                ? 'error'
                                : 'primary'
                            }
                          />
                          <Typography variant="caption" color="textSecondary">
                            {getProjectTiming(project)!.elapsedTime} /{' '}
                            {getProjectTiming(project)!.estimatedTime} minutes
                          </Typography>
                        </>
                      )}
                    </Box>
                  )}

                  {project.isInitializing && (
                    <Box mt={2}>
                      <LinearProgress />
                    </Box>
                  )}
                </ProjectContent>

                <CardActions>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => {
                      setSelectedProjectForSettings(project);
                      setSettingsDialogOpen(true);
                    }}
                  >
                    Settings
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleProjectDelete(project)}
                  >
                    Delete
                  </Button>
                </CardActions>
              </ProjectCard>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography
          variant="body1"
          color="textSecondary"
          align="center"
          sx={{ mt: 4 }}
        >
          No projects found. Import projects to get started.
        </Typography>
      )}

      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (selectedProjectForMenu) {
              setSelectedProjectForSettings(selectedProjectForMenu);
              setSettingsDialogOpen(true);
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedProjectForMenu) {
              handleProjectDelete(selectedProjectForMenu);
            }
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
        {selectedProjectForMenu?.isInitialized && (
          <MenuItem
            onClick={() => {
              // Implement project refresh
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Refresh</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <ProjectSettingsDialog
        open={settingsDialogOpen}
        project={selectedProjectForSettings}
        onClose={() => {
          setSettingsDialogOpen(false);
          setSelectedProjectForSettings(null);
        }}
        onSave={handleProjectUpdate}
        templates={templates}
      />
    </Box>
  );
};

export default ProjectList;
