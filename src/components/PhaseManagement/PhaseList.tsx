import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import styled from "styled-components";
import {
  IconButton,
  Typography,
  Box,
  Tooltip,
  Chip,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Divider,
} from "@mui/material";
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Code as CodeIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import { Phase } from "../../types/phase";
import PhaseStatusIndicator from "./PhaseStatusIndicator";

const PhaseListContainer = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 20px auto;
`;

const PhaseItem = styled(Card)`
  margin: 10px 0;
  cursor: grab;
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`;

const DragHandle = styled(DragIcon)`
  cursor: grab;
  margin-right: 8px;
  color: #757575;
`;

const ProgressBar = styled(LinearProgress)`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
`;

interface ValidationRule {
  type: string;
  enabled: boolean;
  value: any;
}

interface ValidationSettings {
  rules: ValidationRule[];
  autoMerge: boolean;
  requireApproval: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
}

interface EnhancedPhase extends Phase {
  validation: ValidationSettings;
  description: string;
  estimatedTime: number;
  progress?: number;
  concurrentFeatures: boolean;
  maxConcurrentFeatures: number;
  template?: Template;
  error?: string;
  settings?: Record<string, any>;
}

interface PhaseListProps {
  phases: EnhancedPhase[];
  onPhaseReorder: (startIndex: number, endIndex: number) => void;
  onPhaseSelect: (phase: EnhancedPhase) => void;
  onPhaseStart: (phase: EnhancedPhase) => void;
  onPhaseStop: (phase: EnhancedPhase) => void;
  onPhaseDelete?: (phase: EnhancedPhase) => void;
  onPhaseAdd?: () => void;
  onPhaseUpdate?: (phase: EnhancedPhase) => void;
  templates: Template[];
  isRunning: boolean;
}

const defaultValidation: ValidationSettings = {
  rules: [
    { type: "test", enabled: true, value: true },
    { type: "lint", enabled: true, value: true },
    { type: "coverage", enabled: true, value: 80 },
    { type: "custom", enabled: false, value: "" },
  ],
  autoMerge: false,
  requireApproval: true,
};

const getStatusColor = (status: Phase["status"]) => {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "in_progress":
      return "info";
    default:
      return "default";
  }
};

const getStatusIcon = (status: Phase["status"]) => {
  switch (status) {
    case "completed":
      return <CheckIcon color="success" />;
    case "failed":
      return <ErrorIcon color="error" />;
    case "in_progress":
      return <ScheduleIcon color="info" />;
    default:
      return null;
  }
};

interface PhaseDialogProps {
  open: boolean;
  phase: EnhancedPhase | null;
  onClose: () => void;
  onSave: (phase: EnhancedPhase) => void;
  templates: Template[];
}

const PhaseDialog: React.FC<PhaseDialogProps> = ({
  open,
  phase,
  onClose,
  onSave,
  templates,
}) => {
  const [editedPhase, setEditedPhase] = useState<EnhancedPhase | null>(null);

  React.useEffect(() => {
    setEditedPhase(phase);
  }, [phase]);

  if (!editedPhase) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editedPhase.id ? "Edit Phase" : "Add New Phase"}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Name"
              value={editedPhase.name}
              onChange={(e) =>
                setEditedPhase({ ...editedPhase, name: e.target.value })
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
              value={editedPhase.description}
              onChange={(e) =>
                setEditedPhase({
                  ...editedPhase,
                  description: e.target.value,
                })
              }
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Template</InputLabel>
              <Select
                value={editedPhase.template?.id || ""}
                onChange={(e) => {
                  const template = templates.find(t => t.id === e.target.value);
                  setEditedPhase({
                    ...editedPhase,
                    template: template,
                  });
                }}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Concurrent Features
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={editedPhase.concurrentFeatures}
                  onChange={(e) =>
                    setEditedPhase({
                      ...editedPhase,
                      concurrentFeatures: e.target.checked,
                    })
                  }
                />
              }
              label="Enable Concurrent Features"
            />
            {editedPhase.concurrentFeatures && (
              <TextField
                fullWidth
                type="number"
                label="Max Concurrent Features"
                value={editedPhase.maxConcurrentFeatures}
                onChange={(e) =>
                  setEditedPhase({
                    ...editedPhase,
                    maxConcurrentFeatures: parseInt(e.target.value),
                  })
                }
                margin="normal"
              />
            )}
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Validation Rules
            </Typography>
            {editedPhase.validation.rules.map((rule, index) => (
              <Box key={rule.type} mb={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={rule.enabled}
                      onChange={(e) => {
                        const updatedRules = [...editedPhase.validation.rules];
                        updatedRules[index] = {
                          ...rule,
                          enabled: e.target.checked,
                        };
                        setEditedPhase({
                          ...editedPhase,
                          validation: {
                            ...editedPhase.validation,
                            rules: updatedRules,
                          },
                        });
                      }}
                    />
                  }
                  label={rule.type.charAt(0).toUpperCase() + rule.type.slice(1)}
                />
                {rule.type === "coverage" && rule.enabled && (
                  <TextField
                    fullWidth
                    type="number"
                    label="Coverage Threshold (%)"
                    value={rule.value}
                    onChange={(e) => {
                      const updatedRules = [...editedPhase.validation.rules];
                      updatedRules[index] = {
                        ...rule,
                        value: parseInt(e.target.value),
                      };
                      setEditedPhase({
                        ...editedPhase,
                        validation: {
                          ...editedPhase.validation,
                          rules: updatedRules,
                        },
                      });
                    }}
                    margin="normal"
                  />
                )}
                {rule.type === "custom" && rule.enabled && (
                  <TextField
                    fullWidth
                    label="Custom Validation Command"
                    value={rule.value}
                    onChange={(e) => {
                      const updatedRules = [...editedPhase.validation.rules];
                      updatedRules[index] = {
                        ...rule,
                        value: e.target.value,
                      };
                      setEditedPhase({
                        ...editedPhase,
                        validation: {
                          ...editedPhase.validation,
                          rules: updatedRules,
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
                  checked={editedPhase.validation.autoMerge}
                  onChange={(e) =>
                    setEditedPhase({
                      ...editedPhase,
                      validation: {
                        ...editedPhase.validation,
                        autoMerge: e.target.checked,
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
                  checked={editedPhase.validation.requireApproval}
                  onChange={(e) =>
                    setEditedPhase({
                      ...editedPhase,
                      validation: {
                        ...editedPhase.validation,
                        requireApproval: e.target.checked,
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
              Timing
            </Typography>
            <TextField
              fullWidth
              type="number"
              label="Estimated Time (minutes)"
              value={editedPhase.estimatedTime}
              onChange={(e) =>
                setEditedPhase({
                  ...editedPhase,
                  estimatedTime: parseInt(e.target.value),
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
            onSave(editedPhase);
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

export const PhaseList: React.FC<PhaseListProps> = ({
  phases,
  onPhaseReorder,
  onPhaseSelect,
  onPhaseStart,
  onPhaseStop,
  onPhaseDelete,
  onPhaseAdd,
  onPhaseUpdate,
  templates,
  isRunning,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<EnhancedPhase | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragEnd = (result: any) => {
    if (!result.destination || isRunning) return;
    onPhaseReorder(result.source.index, result.destination.index);
  };

  const handlePhaseEdit = (phase: EnhancedPhase) => {
    setSelectedPhase(phase);
    setDialogOpen(true);
  };

  const handlePhaseSave = (phase: EnhancedPhase) => {
    try {
      onPhaseUpdate?.(phase);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update phase");
    }
  };

  return (
    <PhaseListContainer>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Phase Management</Typography>
        {onPhaseAdd && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={onPhaseAdd}
            disabled={isRunning}
          >
            Add Phase
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="phase-list">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {phases.map((phase, index) => (
                <Draggable
                  key={phase.id}
                  draggableId={phase.id}
                  index={index}
                  isDragDisabled={isRunning}
                >
                  {(provided) => (
                    <PhaseItem
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      elevation={1}
                    >
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid
                            item
                            xs={12}
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            <div {...provided.dragHandleProps}>
                              <DragHandle />
                            </div>
                            <Box flexGrow={1}>
                              <Typography variant="h6" component="div">
                                {phase.name}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="textSecondary"
                                gutterBottom
                              >
                                {phase.description || "No description"}
                              </Typography>
                            </Box>
                            <Box>
                              <Tooltip
                                title={
                                  phase.status === "in_progress"
                                    ? "Stop Phase"
                                    : "Start Phase"
                                }
                              >
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    phase.status === "in_progress"
                                      ? onPhaseStop(phase)
                                      : onPhaseStart(phase);
                                  }}
                                  disabled={
                                    isRunning && phase.status !== "in_progress"
                                  }
                                >
                                  {phase.status === "in_progress" ? (
                                    <StopIcon color="error" />
                                  ) : (
                                    <StartIcon color="success" />
                                  )}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit Phase">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePhaseEdit(phase);
                                  }}
                                  disabled={isRunning}
                                >
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              {onPhaseDelete && (
                                <Tooltip title="Delete Phase">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPhaseDelete(phase);
                                    }}
                                    disabled={isRunning}
                                  >
                                    <DeleteIcon color="error" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <Box display="flex" gap={1} flexWrap="wrap">
                              <Chip
                                size="small"
                                label={phase.status}
                                color={getStatusColor(phase.status)}
                                icon={getStatusIcon(phase.status)}
                              />
                              {phase.template && (
                                <Tooltip title={phase.template.description}>
                                  <Chip
                                    size="small"
                                    icon={<CodeIcon />}
                                    label={`Template: ${phase.template.name}`}
                                    variant="outlined"
                                  />
                                </Tooltip>
                              )}
                              {phase.concurrentFeatures && (
                                <Tooltip
                                  title={`Max ${phase.maxConcurrentFeatures} concurrent features`}
                                >
                                  <Chip
                                    size="small"
                                    label="Concurrent"
                                    color="info"
                                    variant="outlined"
                                  />
                                </Tooltip>
                              )}
                              {phase.validation.rules.some((r) => r.enabled) && (
                                <Tooltip title="Validation Rules Enabled">
                                  <Chip
                                    size="small"
                                    icon={<WarningIcon />}
                                    label="Validation"
                                    variant="outlined"
                                  />
                                </Tooltip>
                              )}
                              <Tooltip
                                title={`Estimated Time: ${phase.estimatedTime} minutes`}
                              >
                                <Chip
                                  size="small"
                                  icon={<ScheduleIcon />}
                                  label={`${phase.estimatedTime}m`}
                                  variant="outlined"
                                />
                              </Tooltip>
                              {phase.error && (
                                <Tooltip title={phase.error}>
                                  <Chip
                                    size="small"
                                    icon={<ErrorIcon />}
                                    label="Error"
                                    color="error"
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          </Grid>
                        </Grid>
                        {phase.status === "in_progress" &&
                          phase.progress !== undefined && (
                            <ProgressBar
                              variant="determinate"
                              value={phase.progress}
                            />
                          )}
                      </CardContent>
                    </PhaseItem>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <PhaseDialog
        open={dialogOpen}
        phase={selectedPhase}
        onClose={() => {
          setDialogOpen(false);
          setSelectedPhase(null);
        }}
        onSave={handlePhaseSave}
        templates={templates}
      />
    </PhaseListContainer>
  );
};

export default PhaseList;
