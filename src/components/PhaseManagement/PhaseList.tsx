import React from "react";
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
} from "@mui/icons-material";
import { Phase } from "../../types/phase";
import PhaseStatusIndicator from "./PhaseStatusIndicator";

const PhaseListContainer = styled.div`
  width: 100%;
  max-width: 800px;
  margin: 20px auto;
`;

const PhaseItem = styled(Card)`
  margin: 10px 0;
  cursor: grab;
  position: relative;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
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

interface EnhancedPhase extends Phase {
  validation: {
    rules: {
      type: string;
      enabled: boolean;
      value: any;
    }[];
    autoMerge: boolean;
    requireApproval: boolean;
  };
  description: string;
  estimatedTime: number;
  progress?: number;
  concurrentFeatures: boolean;
  maxConcurrentFeatures: number;
}

interface PhaseListProps {
  phases: EnhancedPhase[];
  onPhaseReorder: (startIndex: number, endIndex: number) => void;
  onPhaseSelect: (phase: EnhancedPhase) => void;
  onPhaseStart: (phase: EnhancedPhase) => void;
  onPhaseStop: (phase: EnhancedPhase) => void;
  onPhaseDelete?: (phase: EnhancedPhase) => void;
  isRunning: boolean;
}

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

export const PhaseList: React.FC<PhaseListProps> = ({
  phases,
  onPhaseReorder,
  onPhaseSelect,
  onPhaseStart,
  onPhaseStop,
  onPhaseDelete,
  isRunning,
}) => {
  const handleDragEnd = (result: any) => {
    if (!result.destination || isRunning) return;
    onPhaseReorder(result.source.index, result.destination.index);
  };

  return (
    <PhaseListContainer>
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
                                    onPhaseSelect(phase);
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
                                <Chip
                                  size="small"
                                  label={`Template: ${phase.template.name}`}
                                  variant="outlined"
                                />
                              )}
                              {phase.concurrentFeatures && (
                                <Tooltip title={`Max ${phase.maxConcurrentFeatures} concurrent features`}>
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
                              <Tooltip title={`Estimated Time: ${phase.estimatedTime} minutes`}>
                                <Chip
                                  size="small"
                                  icon={<ScheduleIcon />}
                                  label={`${phase.estimatedTime}m`}
                                  variant="outlined"
                                />
                              </Tooltip>
                            </Box>
                          </Grid>
                        </Grid>
                        {phase.status === "in_progress" && phase.progress !== undefined && (
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
    </PhaseListContainer>
  );
};

export default PhaseList;
