import React, { useState } from 'react';
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
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Refresh as RefreshIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { ProjectInitializationProps, TemplateFile } from './types';
import { useProject } from './ProjectContext';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(2),
}));

const ProgressWrapper = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));

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

export const ProjectInitialization: React.FC<ProjectInitializationProps> = ({
  project,
  onInitialize,
  onTemplateUpdate,
}) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [templateFiles, setTemplateFiles] = useState<TemplateFile[]>([]);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    const newTemplateFiles: TemplateFile[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      status: 'pending',
    }));

    setTemplateFiles(newTemplateFiles);
    onTemplateUpdate(newTemplateFiles);
  };

  const handleInitialize = async () => {
    if (isInitializing) return;

    setIsInitializing(true);
    setProgress(0);

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
    } catch (error) {
      console.error('Initialization error:', error);
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

  const canInitialize = templateFiles.length > 0 && !isInitializing;

  return (
    <StyledPaper>
      <Typography variant="h6" gutterBottom>
        Project Initialization
      </Typography>

      <Box sx={{ mb: 3 }}>
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

      {templateFiles.length > 0 && (
        <>
          <Typography variant="subtitle1" gutterBottom>
            Template Files
          </Typography>
          <List>
            {templateFiles.map((file) => (
              <ListItem
                key={file.id}
                secondaryAction={
                  file.status === 'error' && (
                    <IconButton
                      edge="end"
                      onClick={() => {
                        setTemplateFiles((prev) =>
                          prev.map((f) =>
                            f.id === file.id ? { ...f, status: 'pending' } : f
                          )
                        );
                      }}
                    >
                      <RefreshIcon />
                    </IconButton>
                  )
                }
              >
                <ListItemIcon>
                  <StatusIcon status={file.status} />
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={file.error}
                  secondaryTypographyProps={{
                    color: 'error',
                  }}
                />
              </ListItem>
            ))}
          </List>

          <ProgressWrapper>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="textSecondary">
                {isInitializing
                  ? `Initializing... ${Math.round(progress)}%`
                  : 'Ready to initialize'}
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
    </StyledPaper>
  );
};

export default ProjectInitialization;
