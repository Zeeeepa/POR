import React from "react";
import styled from "styled-components";
import {
  TextField,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
} from "@mui/material";
import { Phase, Template } from "../../types/phase";

const PanelContainer = styled.div`
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const FormSection = styled.div`
  margin-bottom: 20px;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
`;

interface PhaseConfigurationPanelProps {
  phase: Phase;
  templates: Template[];
  onSave: (phase: Phase) => void;
  onCancel: () => void;
}

const PhaseConfigurationPanel: React.FC<PhaseConfigurationPanelProps> = ({
  phase,
  templates,
  onSave,
  onCancel,
}) => {
  const [editedPhase, setEditedPhase] = React.useState<Phase>({ ...phase });

  const handleChange = (field: keyof Phase, value: any) => {
    setEditedPhase((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <PanelContainer>
      <FormSection>
        <TextField
          fullWidth
          label="Phase Name"
          value={editedPhase.name}
          onChange={(e) => handleChange("name", e.target.value)}
          margin="normal"
        />
      </FormSection>

      <FormSection>
        <FormControl fullWidth margin="normal">
          <InputLabel>Template</InputLabel>
          <Select
            value={editedPhase.template?.id || ""}
            onChange={(e) =>
              handleChange(
                "template",
                templates.find((t) => t.id === e.target.value)
              )
            }
          >
            {templates.map((template) => (
              <MenuItem key={template.id} value={template.id}>
                {template.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FormSection>

      <FormSection>
        <TextField
          fullWidth
          label="Expected Output"
          multiline
          rows={3}
          value={editedPhase.expectedOutput}
          onChange={(e) => handleChange("expectedOutput", e.target.value)}
          margin="normal"
        />
      </FormSection>

      <FormSection>
        <FormControlLabel
          control={
            <Switch
              checked={editedPhase.codeAnalysisEnabled}
              onChange={(e) =>
                handleChange("codeAnalysisEnabled", e.target.checked)
              }
            />
          }
          label="Enable Code Analysis"
        />
      </FormSection>

      <FormSection>
        <FormControlLabel
          control={
            <Switch
              checked={editedPhase.autoMergeSettings.enabled}
              onChange={(e) =>
                handleChange("autoMergeSettings", {
                  ...editedPhase.autoMergeSettings,
                  enabled: e.target.checked,
                })
              }
            />
          }
          label="Enable Auto-merge"
        />
        {editedPhase.autoMergeSettings.enabled && (
          <FormControl fullWidth margin="normal">
            <InputLabel>Merge Strategy</InputLabel>
            <Select
              value={editedPhase.autoMergeSettings.strategy}
              onChange={(e) =>
                handleChange("autoMergeSettings", {
                  ...editedPhase.autoMergeSettings,
                  strategy: e.target.value,
                })
              }
            >
              <MenuItem value="squash">Squash</MenuItem>
              <MenuItem value="merge">Merge</MenuItem>
              <MenuItem value="rebase">Rebase</MenuItem>
            </Select>
          </FormControl>
        )}
      </FormSection>

      <ButtonContainer>
        <Button variant="outlined" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => onSave(editedPhase)}
        >
          Save Changes
        </Button>
      </ButtonContainer>
    </PanelContainer>
  );
};

export default PhaseConfigurationPanel;
