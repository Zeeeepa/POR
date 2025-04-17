import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import {
  Button,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Typography,
  Tooltip,
  Card,
  CardContent,
  Grid,
  Box,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Mouse as MouseIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const Container = styled.div`
  padding: 20px;
`;

const PositionCard = styled(Card)`
  margin-bottom: 16px;
`;

const ActionButton = styled(Button)`
  margin: 8px;
`;

interface Position {
  id: string;
  name: string;
  x: number;
  y: number;
  description: string;
  type: string;
  projectId?: string;
  validationRules: string[];
  retrySettings: {
    maxAttempts: number;
    delayBetweenAttempts: number;
  };
}

interface InputConfigInterfaceProps {
  projectId?: string;
  onPositionCapture: (position: Omit<Position, 'id'>) => void;
  onPositionDelete: (id: string) => void;
  onPositionUpdate: (id: string, position: Partial<Position>) => void;
  positions: Position[];
}

const InputConfigInterface: React.FC<InputConfigInterfaceProps> = ({
  projectId,
  onPositionCapture,
  onPositionDelete,
  onPositionUpdate,
  positions,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPosition, setNewPosition] = useState<Partial<Position>>({
    name: '',
    description: '',
    type: 'input',
    validationRules: [],
    retrySettings: {
      maxAttempts: 3,
      delayBetweenAttempts: 1000,
    },
  });

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCapturing) {
        setIsCapturing(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isCapturing]);

  const handleStartCapture = () => {
    setIsCapturing(true);
    // Trigger cursor position capture in the main process
    window.electron.ipcRenderer.send('start-cursor-capture');
  };

  const handleCaptureComplete = (coordinates: { x: number; y: number }) => {
    setIsCapturing(false);
    onPositionCapture({
      ...newPosition,
      x: coordinates.x,
      y: coordinates.y,
      projectId,
    });
    setNewPosition({
      name: '',
      description: '',
      type: 'input',
      validationRules: [],
      retrySettings: {
        maxAttempts: 3,
        delayBetweenAttempts: 1000,
      },
    });
    setDialogOpen(false);
  };

  const handleEditPosition = (position: Position) => {
    setEditingPosition(position);
    setDialogOpen(true);
  };

  const handleSavePosition = () => {
    if (editingPosition) {
      onPositionUpdate(editingPosition.id, newPosition);
    } else if (isCapturing) {
      handleStartCapture();
    }
    setDialogOpen(false);
    setEditingPosition(null);
  };

  const handleDeletePosition = (id: string) => {
    onPositionDelete(id);
  };

  const renderPositionDialog = () => (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editingPosition ? 'Edit Position' : 'Add New Position'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Name"
              value={editingPosition?.name || newPosition.name}
              onChange={(e) =>
                setNewPosition({ ...newPosition, name: e.target.value })
              }
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={editingPosition?.description || newPosition.description}
              onChange={(e) =>
                setNewPosition({ ...newPosition, description: e.target.value })
              }
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Type"
              value={editingPosition?.type || newPosition.type}
              onChange={(e) =>
                setNewPosition({ ...newPosition, type: e.target.value })
              }
              margin="normal"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              type="number"
              label="Max Retry Attempts"
              value={
                editingPosition?.retrySettings.maxAttempts ||
                newPosition.retrySettings?.maxAttempts
              }
              onChange={(e) =>
                setNewPosition({
                  ...newPosition,
                  retrySettings: {
                    ...newPosition.retrySettings,
                    maxAttempts: parseInt(e.target.value),
                  },
                })
              }
              margin="normal"
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              fullWidth
              type="number"
              label="Retry Delay (ms)"
              value={
                editingPosition?.retrySettings.delayBetweenAttempts ||
                newPosition.retrySettings?.delayBetweenAttempts
              }
              onChange={(e) =>
                setNewPosition({
                  ...newPosition,
                  retrySettings: {
                    ...newPosition.retrySettings,
                    delayBetweenAttempts: parseInt(e.target.value),
                  },
                })
              }
              margin="normal"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDialogOpen(false)} color="secondary">
          Cancel
        </Button>
        <Button
          onClick={handleSavePosition}
          color="primary"
          variant="contained"
          startIcon={isCapturing ? <MouseIcon /> : <SaveIcon />}
        >
          {isCapturing ? 'Capture Position' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Container>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Input Configuration</Typography>
        <ActionButton
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingPosition(null);
            setDialogOpen(true);
          }}
        >
          Add Position
        </ActionButton>
      </Box>

      {positions.map((position) => (
        <PositionCard key={position.id}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="h6">{position.name}</Typography>
                <Typography color="textSecondary" gutterBottom>
                  {position.description}
                </Typography>
                <Typography variant="body2">
                  Type: {position.type}
                </Typography>
                <Typography variant="body2">
                  Coordinates: ({position.x}, {position.y})
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" justifyContent="flex-end">
                  <Tooltip title="Edit Position">
                    <IconButton
                      onClick={() => handleEditPosition(position)}
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Position">
                    <IconButton
                      onClick={() => handleDeletePosition(position.id)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Test Position">
                    <IconButton
                      onClick={() => {
                        // Implement position testing
                        window.electron.ipcRenderer.send('test-cursor-position', position);
                      }}
                      size="small"
                      color="primary"
                    >
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Box mt={1}>
                  <Typography variant="body2">
                    Retry Settings: {position.retrySettings.maxAttempts} attempts,{' '}
                    {position.retrySettings.delayBetweenAttempts}ms delay
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </PositionCard>
      ))}

      {renderPositionDialog()}

      {isCapturing && (
        <Dialog open={true} onClose={() => setIsCapturing(false)}>
          <DialogTitle>Capturing Cursor Position</DialogTitle>
          <DialogContent>
            <Typography>
              Click on the desired location to capture the cursor position.
              Press ESC to cancel.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setIsCapturing(false)}
              color="secondary"
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
};

export default InputConfigInterface;
