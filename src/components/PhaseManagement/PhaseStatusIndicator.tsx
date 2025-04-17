import React from "react";
import styled, { keyframes } from "styled-components";
import {
  Tooltip,
  Box,
  Typography,
  CircularProgress,
  Chip,
} from "@mui/material";
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Pause as PauseIcon,
  Warning as WarningIcon,
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
`;

interface PhaseStatusIndicatorProps {
  status: PhaseStatus;
  showLabel?: boolean;
  showIcon?: boolean;
  size?: "small" | "medium";
  progress?: number;
  error?: string;
  warning?: string;
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
  return status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

const PhaseStatusIndicator: React.FC<PhaseStatusIndicatorProps> = ({
  status,
  showLabel = false,
  showIcon = false,
  size = "medium",
  progress,
  error,
  warning,
}) => {
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
    </Box>
  );

  if (showLabel) {
    return (
      <Tooltip title={tooltipContent} arrow>
        <Chip
          size={size}
          label={statusText}
          color={getStatusColor(status)}
          icon={showIcon ? getStatusIcon(status) : undefined}
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
          {...(error || warning
            ? {
                deleteIcon: error ? (
                  <ErrorIcon color="error" />
                ) : (
                  <WarningIcon color="warning" />
                ),
                onDelete: () => {}, // Required for deleteIcon to show
              }
            : {})}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipContent} arrow>
      <StatusContainer status={status}>
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
        {(error || warning) && (
          <Box color={error ? "error.main" : "warning.main"}>
            {error ? <ErrorIcon fontSize="small" /> : <WarningIcon fontSize="small" />}
          </Box>
        )}
      </StatusContainer>
    </Tooltip>
  );
};

export default PhaseStatusIndicator;
