import React, { useState, useEffect } from "react";
import styled from "styled-components";
import {
  Button,
  Paper,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  IconButton,
} from "@mui/material";
import {
  Add as AddIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { Phase, ConcurrentFeature } from "../../types/phase";
import PhaseList from "./PhaseList";
import PhaseConfigurationPanel from "./PhaseConfigurationPanel";
import ConcurrentDevelopmentSetup from "./ConcurrentDevelopmentSetup";

const Container = styled.div`
  padding: 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
`;

const Section = styled(Paper)`
  padding: 20px;
  position: relative;
`;

const ActionButton = styled(Button)`
  margin: 8px;
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
`;

interface Template {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, any>;
}

interface ValidationRule {
  type: 'test' | 'lint' | 'coverage' | 'custom';
  value: string | number;
  enabled: boolean;
}

interface PhaseValidation {
  rules: ValidationRule[];
  autoMerge: boolean;
  requireApproval: boolean;
}

interface EnhancedPhase extends Phase {
  validation: PhaseValidation;
  template?: string;
  description: string;
  estimatedTime: number;
  concurrentFeatures: boolean;
  maxConcurrentFeatures: number;
  retrySettings: {
    maxAttempts: number;
    delayBetweenAttempts: number;
  };
}

const defaultValidation: PhaseValidation = {
  rules: [
    { type: 'test', value: true, enabled: true },
    { type: 'lint', value: true, enabled: true },
    { type: 'coverage', value: 80, enabled: true },
    { type: 'custom', value: '', enabled: false },
  ],
  autoMerge: false,
  requireApproval: true,
};

const defaultPhase: EnhancedPhase = {
  id: "",
  name: "",
  status: "pending",
  description: "",
  expectedOutput: "",
  codeAnalysisEnabled: false,
  autoMergeSettings: {
    enabled: false,
    strategy: "squash",
  },
  successCriteria: {
    lintingPassed: true,
    customChecks: [],
  },
  validation: { ...defaultValidation },
  estimatedTime: 30,
  concurrentFeatures: false,
  maxConcurrentFeatures: 5,
  retrySettings: {
    maxAttempts: 3,
    delayBetweenAttempts: 1000,
  },
};

interface PhaseManagementProps {
  projectId: string;
  templates: Template[];
  onPhaseStart: (phase: EnhancedPhase) => Promise<void>;
  onPhaseStop: (phase: EnhancedPhase) => Promise<void>;
}

const PhaseManagement: React.FC<PhaseManagementProps> = ({
  projectId,
  templates,
  onPhaseStart,
  onPhaseStop,
}) => {
  const [phases, setPhases] = useState<EnhancedPhase[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<EnhancedPhase | null>(null);
  const [features, setFeatures] = useState<ConcurrentFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const loadPhases = async () => {
      try {
        setLoading(true);
        // Add API call to load phases
        // const loadedPhases = await api.loadPhases(projectId);
        // setPhases(loadedPhases);
      } catch (err) {
        setError("Failed to load phases");
      } finally {
        setLoading(false);
      }
    };

    loadPhases();
  }, [projectId]);

  const handleAddPhase = () => {
    const newPhase: EnhancedPhase = {
      ...defaultPhase,
      id: `phase-${Date.now()}`,
    };
    setPhases([...phases, newPhase]);
    setSelectedPhase(newPhase);
  };

  const handlePhaseReorder = (startIndex: number, endIndex: number) => {
    const reorderedPhases = [...phases];
    const [removed] = reorderedPhases.splice(startIndex, 1);
    reorderedPhases.splice(endIndex, 0, removed);
    setPhases(reorderedPhases);
  };

  const handlePhaseSelect = (phase: EnhancedPhase) => {
    setSelectedPhase(phase);
  };

  const handlePhaseSave = async (updatedPhase: EnhancedPhase) => {
    try {
      setLoading(true);
      // Add API call to save phase
      // await api.savePhase(projectId, updatedPhase);
      setPhases(phases.map((p) => (p.id === updatedPhase.id ? updatedPhase : p)));
      setSelectedPhase(null);
      setSuccess("Phase saved successfully");
    } catch (err) {
      setError("Failed to save phase");
    } finally {
      setLoading(false);
    }
  };

  const handleStartPhase = async (phase: EnhancedPhase) => {
    try {
      setLoading(true);
      await onPhaseStart(phase);
      setPhases(
        phases.map((p) =>
          p.id === phase.id ? { ...p, status: "in_progress" } : p
        )
      );
      setIsRunning(true);
      setSuccess("Phase started successfully");
    } catch (err) {
      setError("Failed to start phase");
    } finally {
      setLoading(false);
    }
  };

  const handleStopPhase = async (phase: EnhancedPhase) => {
    try {
      setLoading(true);
      await onPhaseStop(phase);
      setPhases(
        phases.map((p) =>
          p.id === phase.id ? { ...p, status: "pending" } : p
        )
      );
      setIsRunning(false);
      setSuccess("Phase stopped successfully");
    } catch (err) {
      setError("Failed to stop phase");
    } finally {
      setLoading(false);
    }
  };

  const handleStartConcurrentDevelopment = async () => {
    try {
      setLoading(true);
      // Add API call to start concurrent development
      setIsRunning(true);
      setSuccess("Concurrent development started successfully");
    } catch (err) {
      setError("Failed to start concurrent development");
    } finally {
      setLoading(false);
    }
  };

  const handleStopConcurrentDevelopment = async () => {
    try {
      setLoading(true);
      // Add API call to stop concurrent development
      setIsRunning(false);
      setSuccess("Concurrent development stopped successfully");
    } catch (err) {
      setError("Failed to stop concurrent development");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Section>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">Phases</Typography>
          <ActionButton
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddPhase}
            disabled={isRunning}
          >
            Add Phase
          </ActionButton>
        </Box>

        <PhaseList
          phases={phases}
          onPhaseReorder={handlePhaseReorder}
          onPhaseSelect={handlePhaseSelect}
          onPhaseStart={handleStartPhase}
          onPhaseStop={handleStopPhase}
          isRunning={isRunning}
        />

        {loading && (
          <LoadingOverlay>
            <CircularProgress />
          </LoadingOverlay>
        )}
      </Section>

      <Section>
        {selectedPhase ? (
          <PhaseConfigurationPanel
            phase={selectedPhase}
            templates={templates}
            onSave={handlePhaseSave}
            onCancel={() => setSelectedPhase(null)}
            isRunning={isRunning}
          />
        ) : (
          <Box textAlign="center">
            <Typography color="textSecondary">
              Select a phase to configure
            </Typography>
          </Box>
        )}
      </Section>

      <Section style={{ gridColumn: "1 / -1" }}>
        <ConcurrentDevelopmentSetup
          features={features}
          onFeaturesChange={setFeatures}
          templates={templates}
          onStartConcurrentDevelopment={handleStartConcurrentDevelopment}
          onStopConcurrentDevelopment={handleStopConcurrentDevelopment}
          isRunning={isRunning}
        />
      </Section>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success">
          {success}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PhaseManagement;
