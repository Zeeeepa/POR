import React, { useState } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Typography,
  Button,
  Grid,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  PlayArrow as TestIcon,
  Save as SaveIcon,
} from "@mui/icons-material";

interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
}

interface Phase {
  id: string;
  name: string;
  templateId?: string;
  parameters?: Record<string, string>;
}

interface TemplateAssignmentProps {
  phases: Phase[];
  templates: Template[];
  onAssign: (phaseId: string, templateId: string, parameters: Record<string, string>) => void;
  onTest: (phaseId: string, templateId: string, parameters: Record<string, string>) => void;
}

export const TemplateAssignment: React.FC<TemplateAssignmentProps> = ({
  phases,
  templates,
  onAssign,
  onTest,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<Phase | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [parameters, setParameters] = useState<Record<string, string>>({});

  const handlePhaseSelect = (phase: Phase) => {
    setSelectedPhase(phase);
    if (phase.templateId) {
      const template = templates.find((t) => t.id === phase.templateId);
      setSelectedTemplate(template || null);
      setParameters(phase.parameters || {});
    } else {
      setSelectedTemplate(null);
      setParameters({});
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    // Extract parameters from template content
    const paramRegex = /\${([^}]+)}/g;
    const params: Record<string, string> = {};
    let match;
    while ((match = paramRegex.exec(template.content)) !== null) {
      params[match[1]] = parameters[match[1]] || "";
    }
    setParameters(params);
  };

  const handleParameterChange = (key: string, value: string) => {
    setParameters((prev) => ({ ...prev, [key]: value }));
  };

  const handleTest = () => {
    if (selectedPhase && selectedTemplate) {
      onTest(selectedPhase.id, selectedTemplate.id, parameters);
    }
  };

  const handleSave = () => {
    if (selectedPhase && selectedTemplate) {
      onAssign(selectedPhase.id, selectedTemplate.id, parameters);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Phase Selection
            </Typography>
            {phases.map((phase) => (
              <Accordion
                key={phase.id}
                expanded={selectedPhase?.id === phase.id}
                onChange={() => handlePhaseSelect(phase)}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>{phase.name}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Template</InputLabel>
                    <Select
                      value={selectedTemplate?.id || ""}
                      label="Template"
                      onChange={(e) => {
                        const template = templates.find((t) => t.id === e.target.value);
                        if (template) handleTemplateSelect(template);
                      }}
                    >
                      {templates.map((template) => (
                        <MenuItem key={template.id} value={template.id}>
                          {template.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </AccordionDetails>
              </Accordion>
            ))}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Parameter Configuration
            </Typography>
            {selectedTemplate ? (
              <>
                {Object.keys(parameters).map((key) => (
                  <TextField
                    key={key}
                    fullWidth
                    label={key}
                    value={parameters[key]}
                    onChange={(e) => handleParameterChange(key, e.target.value)}
                    sx={{ mb: 2 }}
                  />
                ))}
                <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                  <Button
                    variant="outlined"
                    startIcon={<TestIcon />}
                    onClick={handleTest}
                  >
                    Test
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                </Box>
              </>
            ) : (
              <Typography color="text.secondary">
                Select a phase and template to configure parameters
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
