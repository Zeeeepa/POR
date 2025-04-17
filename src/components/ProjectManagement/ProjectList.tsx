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
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useProject } from './ProjectContext';
import { ProjectListProps, Project } from './types';

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
}

const ProjectSettingsDialog: React.FC<ProjectSettingsDialogProps> = ({
  open,
  project,
  onClose,
  onSave,
}) => {
  const [editedProject, setEditedProject] = useState<Project | null>(null);

  useEffect(() => {
    setEditedProject(project);
  }, [project]);

  if (!editedProject) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
  } = useProject();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedProjectForSettings, setSelectedProjectForSettings] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProjectForMenu, setSelectedProjectForMenu] = useState<Project | null>(null);

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
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        <StatusIndicator status={getProjectStatus(project)} />
                        {project.name}
                      </Typography>
                      <Typography color="textSecondary" variant="body2" gutterBottom>
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
                        project.templateStatus.completed === project.templateStatus.total
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
        <Typography variant="body1" color="textSecondary" align="center" sx={{ mt: 4 }}>
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
      />
    </Box>
  );
};

export default ProjectList;
