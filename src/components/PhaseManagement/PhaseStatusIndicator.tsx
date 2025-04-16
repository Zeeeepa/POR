import React from "react";
import styled from "styled-components";
import { PhaseStatus } from "../../types/phase";

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
`;

interface PhaseStatusIndicatorProps {
  status: PhaseStatus;
}

const PhaseStatusIndicator: React.FC<PhaseStatusIndicatorProps> = ({ status }) => {
  return <StatusDot status={status} title={status.replace("_", " ")} />;
};

export default PhaseStatusIndicator;
