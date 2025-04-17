import React from "react";
import styled, { keyframes } from "styled-components";
import {
  Tooltip,
  Box,
  Typography,
  CircularProgress,
  Chip,
  LinearProgress,
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from "@mui/material";
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Pause as PauseIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
} from "@mui/icons-material";
import { PhaseStatus } from "../../types/phase";

const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const StatusContainer = styled.div<{ status: PhaseStatus }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 16px;
  background-color: ${({ status }) => {
    switch (status) {
      case "pending":
        return "rgba(158, 158, 158, 0.1)";
      case "in_progress":
        return "rgba(33, 150, 243, 0.1)";
      case "completed":
        return "rgba(76, 175, 80, 0.1)";
      case "failed":
        return "rgba(244, 67, 54, 0.1)";
      default:
        return "rgba(158, 158, 158, 0.1)";
    }
  }};
  animation: ${({ status }) =>
    status === "in_progress" ? `${pulse} 2s infinite` : "none"};
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;

const StatusDot = styled.div<{ status: PhaseStatus }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: ${({ status }) => {
    switch (status) {
      case "pending":
        return "#9e9e9e";
      case "in_progress":
        return "#2196f3";
      case "completed":
        return "#4caf50";
      case "failed":
        return "#f44336";
      default:
        return "#9e9e9e";
    }
  }};
  box-shadow: 0 0 8px ${({ status }) => {
    switch (status) {
      case "pending":
        return "rgba(158, 158, 158, 0.5)";
      case "in_progress":
        return "rgba(33, 150, 243, 0.5)";
      case "completed":
        return "rgba(76, 175, 80, 0.5)";
      case "failed":
        return "rgba(244, 67, 54, 0.5)";
      default:
        return "rgba(158, 158, 158, 0.5)";
    }
  }};
  transition: all 0.2s ease;
`;

interface PhaseStatusIndicatorProps {
  status: PhaseStatus;
  showLabel?: boolean;
  showIcon?: boolean;
  size?: "small" | "medium";
  progress?: number;
  error?: string;
  warning?: string;
  info?: string;
  template?: {
    name: string;
    description: string;
  };
  validation?: {
    rules: {
      type: string;
      enabled: boolean;
      value: any;
    }[];
    autoMerge: boolean;
    requireApproval: boolean;
  };
  concurrent?: {
    enabled: boolean;
    maxFeatures: number;
    activeFeatures: number;
  };
  estimatedTime?: number;
  elapsedTime?: number;
  onStart?: () => void;
  onStop?: () => void;
  onRefresh?: () => void;
  onSettings?: () => void;
}

const getStatusColor = (status: PhaseStatus) => {
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

const getStatusIcon = (status: PhaseStatus) => {
  switch (status) {
    case "completed":
      return <CheckIcon color="success" />;
    case "failed":
      return <ErrorIcon color="error" />;
    case "in_progress":
      return <ScheduleIcon color="info" />;
    case "pending":
      return <PauseIcon color="disabled" />;
    default:
      return null;
  }
};

const getStatusText = (status: PhaseStatus) => {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const PhaseStatusIndicator: React.FC<PhaseStatusIndicatorProps> = ({
  status,
  showLabel = false,
  showIcon = false,
  size = "medium",
  progress,
  error,
  warning,
  info,
  template,
  validation,
  concurrent,
  estimatedTime,
  elapsedTime,
  onStart,
  onStop,
  onRefresh,
  onSettings,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  const statusText = getStatusText(status);
  const tooltipContent = (
    <Box>
      <Typography variant="body2">{statusText}</Typography>
      {progress !== undefined && (
        <Typography variant="body2">Progress: {progress}%</Typography>
      )}
      {error && (
        <Typography variant="body2" color="error">
          Error: {error}
        </Typography>
      )}
      {warning && (
        <Typography variant="body2" color="warning">
          Warning: {warning}
        </Typography>
      )}
      {info && (
        <Typography variant="body2" color="info">
          Info: {info}
        </Typography>
      )}
    </Box>
  );

  const renderPopoverContent = () => (
    <Box sx={{ width: 320, p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Phase Status
      </Typography>
      <List>
        <ListItem>
          <ListItemIcon>
            {status === "in_progress" ? <StopIcon /> : <StartIcon />}
          </ListItemIcon>
          <ListItemText
            primary={status === "in_progress" ? "Stop Phase" : "Start Phase"}
            secondary={
              status === "in_progress"
                ? "Click to stop the phase"
                : "Click to start the phase"
            }
          />
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              status === "in_progress" ? onStop?.() : onStart?.();
              handleClose();
            }}
          >
            {status === "in_progress" ? <StopIcon /> : <StartIcon />}
          </IconButton>
        </ListItem>
        <Divider />
        {template && (
          <ListItem>
            <ListItemIcon>
              <CodeIcon />
            </ListItemIcon>
            <ListItemText
              primary={template.name}
              secondary={template.description}
            />
          </ListItem>
        )}
        {validation && (
          <ListItem>
            <ListItemIcon>
              <WarningIcon />
            </ListItemIcon>
            <ListItemText
              primary="Validation Rules"
              secondary={
                <Box>
                  {validation.rules
                    .filter((r) => r.enabled)
                    .map((rule) => (
                      <Chip
                        key={rule.type}
                        size="small"
                        label={`${rule.type}: ${rule.value}`}
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    ))}
                  {validation.autoMerge && (
                    <Chip
                      size="small"
                      label="Auto Merge"
                      color="success"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  )}
                  {validation.requireApproval && (
                    <Chip
                      size="small"
                      label="Requires Approval"
                      color="warning"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  )}
                </Box>
              }
            />
          </ListItem>
        )}
        {concurrent && concurrent.enabled && (
          <ListItem>
            <ListItemIcon>
              <InfoIcon />
            </ListItemIcon>
            <ListItemText
              primary="Concurrent Features"
              secondary={`${concurrent.activeFeatures} / ${concurrent.maxFeatures} features active`}
            />
          </ListItem>
        )}
        {(estimatedTime || elapsedTime) && (
          <ListItem>
            <ListItemIcon>
              <ScheduleIcon />
            </ListItemIcon>
            <ListItemText
              primary="Time"
              secondary={
                <Box>
                  {estimatedTime && (
                    <Typography variant="body2">
                      Estimated: {estimatedTime}m
                    </Typography>
                  )}
                  {elapsedTime && (
                    <Typography variant="body2">
                      Elapsed: {elapsedTime}m
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
        )}
        <Divider />
        <ListItem>
          <ListItemIcon>
            <RefreshIcon />
          </ListItemIcon>
          <ListItemText primary="Refresh" secondary="Update phase status" />
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh?.();
              handleClose();
            }}
          >
            <RefreshIcon />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="Settings" secondary="Configure phase" />
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onSettings?.();
              handleClose();
            }}
          >
            <SettingsIcon />
          </IconButton>
        </ListItem>
      </List>
    </Box>
  );

  if (showLabel) {
    return (
      <>
        <Tooltip title={tooltipContent} arrow>
          <Chip
            size={size}
            label={statusText}
            color={getStatusColor(status)}
            icon={showIcon ? getStatusIcon(status) : undefined}
            onClick={handleClick}
            {...(status === "in_progress" && progress !== undefined
              ? {
                  deleteIcon: (
                    <Box position="relative" display="inline-flex">
                      <CircularProgress
                        variant="determinate"
                        value={progress}
                        size={16}
                      />
                    </Box>
                  ),
                  onDelete: () => {}, // Required for deleteIcon to show
                }
              : {})}
            {...(error || warning || info
              ? {
                  deleteIcon: error ? (
                    <ErrorIcon color="error" />
                  ) : warning ? (
                    <WarningIcon color="warning" />
                  ) : (
                    <InfoIcon color="info" />
                  ),
                  onDelete: () => {}, // Required for deleteIcon to show
                }
              : {})}
          />
        </Tooltip>
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "center",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "center",
          }}
        >
          {renderPopoverContent()}
        </Popover>
      </>
    );
  }

  return (
    <>
      <Tooltip title={tooltipContent} arrow>
        <StatusContainer status={status} onClick={handleClick}>
          <StatusDot status={status} />
          {showIcon && getStatusIcon(status)}
          {status === "in_progress" && progress !== undefined && (
            <Box position="relative" display="inline-flex">
              <CircularProgress
                variant="determinate"
                value={progress}
                size={16}
              />
            </Box>
          )}
          {(error || warning || info) && (
            <Box color={error ? "error.main" : warning ? "warning.main" : "info.main"}>
              {error ? (
                <ErrorIcon fontSize="small" />
              ) : warning ? (
                <WarningIcon fontSize="small" />
              ) : (
                <InfoIcon fontSize="small" />
              )}
            </Box>
          )}
        </StatusContainer>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        {renderPopoverContent()}
      </Popover>
    </>
  );
};

export default PhaseStatusIndicator;
