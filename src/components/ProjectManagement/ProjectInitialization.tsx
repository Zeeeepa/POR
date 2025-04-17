import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Refresh as RefreshIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  ProjectInitializationProps,
  TemplateFile,
  Template,
  ValidationSettings,
  ConcurrentSettings,
} from './types';
import { useProject } from './ProjectContext';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(2),
}));

const ProgressWrapper = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

const TemplateCard = styled(Card)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4],
  },
}));

const TemplateContent = styled(CardContent)({
  flexGrow: 1,
});

const StatusIcon = ({ status }: { status: TemplateFile['status'] }) => {
  switch (status) {
    case 'completed':
      return <CheckCircleIcon color="success" />;
    case 'error':
      return <ErrorIcon color="error" />;
    case 'processing':
      return <PendingIcon color="primary" />;
    default:
      return <PendingIcon color="disabled" />;
  }
};

interface TemplateSettingsDialogProps {
  open: boolean;
  template: Template | null;
  onClose: () => void;
  onSave: (template: Template) => void;
}

const TemplateSettingsDialog: React.FC<TemplateSettingsDialogProps> = ({
  open,
  template,
  onClose,
  onSave,
}) => {
  const [editedTemplate, setEditedTemplate] = useState<Template | null>(null);

  useEffect(() => {
    setEditedTemplate(template);
  }, [template]);

  if (!editedTemplate) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Template Settings - {editedTemplate.name}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Name"
              value={editedTemplate.name}
              onChange={(e) =>
                setEditedTemplate({ ...editedTemplate, name: e.target.value })
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
              value={editedTemplate.description}
              onChange={(e) =>
                setEditedTemplate({
                  ...editedTemplate,
                  description: e.target.value,
                })
              }
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Parameters
            </Typography>
            {Object.entries(editedTemplate.parameters).map(([key, value]) => (
              <Box key={key} mb={2}>
                <TextField
                  fullWidth
                  label={key}
                  value={value}
                  onChange={(e) =>
                    setEditedTemplate({
                      ...editedTemplate,
                      parameters: {
                        ...editedTemplate.parameters,
                        [key]: e.target.value,
                      },
                    })
                  }
                  margin="normal"
                />
              </Box>
            ))}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            onSave(editedTemplate);
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

export const ProjectInitialization: React.FC<ProjectInitializationProps> = ({
  project,
  onInitialize,
  onTemplateUpdate,
}) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [templateFiles, setTemplateFiles] = useState<TemplateFile[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    try {
      const newTemplateFiles: TemplateFile[] = await Promise.all(
        Array.from(files).map(async (file) => {
          const content = await file.text();
          let templateData;

          try {
            templateData = JSON.parse(content);
          } catch (e) {
            throw new Error(`Invalid template file format: ${file.name}`);
          }

          const template: Template = {
            id: crypto.randomUUID(),
            name: file.name.replace(/\.[^/.]+$/, ''),
            description: templateData.description || '',
            parameters: templateData.parameters || {},
          };

          return {
            id: crypto.randomUUID(),
            name: file.name,
            status: 'pending',
            template,
            settings: templateData.settings || {},
          };
        })
      );

      setTemplateFiles(newTemplateFiles);
      onTemplateUpdate(newTemplateFiles);
      setSuccess('Template files uploaded successfully');
    } catch (error) {
      console.error('File upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload files');
    }
  };

  const handleInitialize = async () => {
    if (isInitializing) return;

    setIsInitializing(true);
    setProgress(0);
    setError(null);

    try {
      // Simulate initialization process
      const totalSteps = templateFiles.length;
      for (let i = 0; i < templateFiles.length; i++) {
        setTemplateFiles((prev) =>
          prev.map((file, index) =>
            index === i ? { ...file, status: 'processing' } : file
          )
        );

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setTemplateFiles((prev) =>
          prev.map((file, index) =>
            index === i ? { ...file, status: 'completed' } : file
          )
        );

        setProgress(((i + 1) / totalSteps) * 100);
      }

      await onInitialize();
      setSuccess('Project initialized successfully');
    } catch (error) {
      console.error('Initialization error:', error);
      setError(error instanceof Error ? error.message : 'Initialization failed');
      setTemplateFiles((prev) =>
        prev.map((file) =>
          file.status === 'processing'
            ? { ...file, status: 'error', error: 'Initialization failed' }
            : file
        )
      );
    } finally {
      setIsInitializing(false);
    }
  };

  const handleTemplateSettings = (template: Template) => {
    setSelectedTemplate(template);
    setSettingsDialogOpen(true);
  };

  const handleTemplateDelete = (templateId: string) => {
    setTemplateFiles((prev) =>
      prev.filter((file) => file.template.id !== templateId)
    );
  };

  const handleTemplateSave = (template: Template) => {
    setTemplateFiles((prev) =>
      prev.map((file) =>
        file.template.id === template.id
          ? { ...file, template }
          : file
      )
    );
  };

  const canInitialize = templateFiles.length > 0 && !isInitializing;

  return (
    <StyledPaper>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">Project Initialization</Typography>
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadIcon />}
          disabled={isInitializing}
        >
          Upload Template Files
          <input
            type="file"
            multiple
            hidden
            onChange={handleFileUpload}
            accept=".json,.yaml,.yml"
          />
        </Button>
      </Box>

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

      {templateFiles.length > 0 && (
        <>
          <Typography variant="subtitle1" gutterBottom>
            Template Files
          </Typography>

          <Grid container spacing={2}>
            {templateFiles.map((file) => (
              <Grid item xs={12} sm={6} md={4} key={file.id}>
                <TemplateCard>
                  <TemplateContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="h6">{file.template.name}</Typography>
                        <Typography color="textSecondary" variant="body2" gutterBottom>
                          {file.template.description || 'No description'}
                        </Typography>
                      </Box>
                      <StatusIcon status={file.status} />
                    </Box>

                    <Box mt={2}>
                      <Chip
                        size="small"
                        label={file.status}
                        color={
                          file.status === 'completed'
                            ? 'success'
                            : file.status === 'error'
                            ? 'error'
                            : file.status === 'processing'
                            ? 'info'
                            : 'default'
                        }
                        sx={{ mr: 1, mb: 1 }}
                      />
                      {Object.keys(file.template.parameters).length > 0 && (
                        <Tooltip title="Has Parameters">
                          <Chip
                            size="small"
                            icon={<InfoIcon />}
                            label="Parameters"
                            variant="outlined"
                            sx={{ mr: 1, mb: 1 }}
                          />
                        </Tooltip>
                      )}
                      {file.settings && Object.keys(file.settings).length > 0 && (
                        <Tooltip title="Has Settings">
                          <Chip
                            size="small"
                            icon={<SettingsIcon />}
                            label="Settings"
                            variant="outlined"
                            sx={{ mb: 1 }}
                          />
                        </Tooltip>
                      )}
                    </Box>

                    {file.error && (
                      <Box mt={2}>
                        <Typography color="error" variant="body2">
                          {file.error}
                        </Typography>
                      </Box>
                    )}
                  </TemplateContent>

                  <Divider />

                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<SettingsIcon />}
                      onClick={() => handleTemplateSettings(file.template)}
                    >
                      Settings
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleTemplateDelete(file.template.id)}
                    >
                      Delete
                    </Button>
                    {file.status === 'error' && (
                      <Button
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={() => {
                          setTemplateFiles((prev) =>
                            prev.map((f) =>
                              f.id === file.id ? { ...f, status: 'pending', error: undefined } : f
                            )
                          );
                        }}
                      >
                        Retry
                      </Button>
                    )}
                  </CardActions>
                </TemplateCard>
              </Grid>
            ))}
          </Grid>

          <ProgressWrapper>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2" color="textSecondary">
                {isInitializing
                  ? `Initializing... ${Math.round(progress)}%`
                  : 'Ready to initialize'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {`${templateFiles.filter((f) => f.status === 'completed').length} / ${
                  templateFiles.length
                } templates processed`}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </ProgressWrapper>

          <Button
            variant="contained"
            color="primary"
            onClick={handleInitialize}
            disabled={!canInitialize}
            fullWidth
          >
            {isInitializing ? 'Initializing...' : 'Initialize Project'}
          </Button>
        </>
      )}

      <TemplateSettingsDialog
        open={settingsDialogOpen}
        template={selectedTemplate}
        onClose={() => {
          setSettingsDialogOpen(false);
          setSelectedTemplate(null);
        }}
        onSave={handleTemplateSave}
      />
    </StyledPaper>
  );
};

export default ProjectInitialization;
