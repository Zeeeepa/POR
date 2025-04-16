import React, { useState } from "react";
import styled from "styled-components";
import { Button, Paper, Box } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
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
`;

const AddButton = styled(Button)`
  margin-bottom: 20px;
`;

const defaultPhase: Phase = {
  id: "",
  name: "",
  status: "pending",
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
};

const PhaseManagement: React.FC = () => {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [features, setFeatures] = useState<ConcurrentFeature[]>([]);

  const handleAddPhase = () => {
    const newPhase: Phase = {
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

  const handlePhaseSelect = (phase: Phase) => {
    setSelectedPhase(phase);
  };

  const handlePhaseSave = (updatedPhase: Phase) => {
    setPhases(phases.map((p) => (p.id === updatedPhase.id ? updatedPhase : p)));
    setSelectedPhase(null);
  };

  return (
    <Container>
      <Section>
        <AddButton
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddPhase}
        >
          Add Phase
        </AddButton>

        <PhaseList
          phases={phases}
          onPhaseReorder={handlePhaseReorder}
          onPhaseSelect={handlePhaseSelect}
        />
      </Section>

      <Section>
        {selectedPhase ? (
          <PhaseConfigurationPanel
            phase={selectedPhase}
            templates={[]} // Add your templates here
            onSave={handlePhaseSave}
            onCancel={() => setSelectedPhase(null)}
          />
        ) : (
          <Box textAlign="center">Select a phase to configure</Box>
        )}
      </Section>

      <Section style={{ gridColumn: "1 / -1" }}>
        <ConcurrentDevelopmentSetup
          features={features}
          onFeaturesChange={setFeatures}
        />
      </Section>
    </Container>
  );
};

export default PhaseManagement;
