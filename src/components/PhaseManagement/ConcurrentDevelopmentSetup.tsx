import React, { useState } from "react";
import styled from "styled-components";
import {
  List,
  ListItem,
  ListItemText,
  TextField,
  Slider,
  Typography,
  Paper,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Grid,
  Box,
  Tooltip,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { ConcurrentFeature } from "../../types/phase";

const Container = styled.div`
  padding: 20px;
`;

const FeatureItem = styled(Paper)`
  margin: 10px 0;
  padding: 15px;
  position: relative;
`;

const ControlsContainer = styled.div`
  margin-top: 20px;
`;

const ActionButton = styled(Button)`
  margin: 8px;
`;

const StatusChip = styled(Chip)`
  position: absolute;
  top: 10px;
  right: 10px;
`;

interface ValidationRule {
  type: 'test' | 'lint' | 'coverage' | 'custom';
  value: string | number;
  enabled: boolean;
}

interface FeatureValidation {
  rules: ValidationRule[];
  autoMerge: boolean;
  requireApproval: boolean;
}

interface EnhancedConcurrentFeature extends ConcurrentFeature {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  validation: FeatureValidation;
  template?: string;
  description: string;
  estimatedTime: number;
}

interface ConcurrentDevelopmentSetupProps {
  features: EnhancedConcurrentFeature[];
  onFeaturesChange: (features: EnhancedConcurrentFeature[]) => void;
  templates: { id: string; name: string }[];
  onStartConcurrentDevelopment: () => void;
  onStopConcurrentDevelopment: () => void;
  isRunning: boolean;
}

const defaultValidation: FeatureValidation = {
  rules: [
    { type: 'test', value: true, enabled: true },
    { type: 'lint', value: true, enabled: true },
    { type: 'coverage', value: 80, enabled: true },
    { type: 'custom', value: '', enabled: false },
  ],
  autoMerge: false,
  requireApproval: true,
};

const ConcurrentDevelopmentSetup: React.FC<ConcurrentDevelopmentSetupProps> = ({
  features,
  onFeaturesChange,
  templates,
  onStartConcurrentDevelopment,
  onStopConcurrentDevelopment,
  isRunning,
}) => {
  const [editingFeature, setEditingFeature] = useState<EnhancedConcurrentFeature | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleFeatureChange = (index: number, field: keyof EnhancedConcurrentFeature, value: any) => {
    const updatedFeatures = [...features];
    updatedFeatures[index] = {
      ...updatedFeatures[index],
      [field]: value,
    };
    onFeaturesChange(updatedFeatures);
  };

  const handleAddFeature = () => {
    const newFeature: EnhancedConcurrentFeature = {
      id: `feature-${Date.now()}`,
      name: "",
      description: "",
      dependencies: [],
      priority: 1,
      rateLimit: 10,
      status: 'pending',
      validation: { ...defaultValidation },
      estimatedTime: 5,
    };
    setEditingFeature(newFeature);
    setDialogOpen(true);
  };

  const handleEditFeature = (feature: EnhancedConcurrentFeature) => {
    setEditingFeature(feature);
    setDialogOpen(true);
  };

  const handleSaveFeature = () => {
    if (editingFeature) {
      const featureIndex = features.findIndex(f => f.id === editingFeature.id);
      if (featureIndex === -1) {
        onFeaturesChange([...features, editingFeature]);
      } else {
        const updatedFeatures = [...features];
        updatedFeatures[featureIndex] = editingFeature;
        onFeaturesChange(updatedFeatures);
      }
    }
    setDialogOpen(false);
    setEditingFeature(null);
  };

  const handleDeleteFeature = (index: number) => {
    const updatedFeatures = features.filter((_, i) => i !== index);
    onFeaturesChange(updatedFeatures);
  };

  const handleDependencyChange = (index: number, value: string) => {
    const dependencies = value.split(",").map((dep) => dep.trim());
    handleFeatureChange(index, "dependencies", dependencies);
  };

  const getStatusColor = (status: EnhancedConcurrentFeature['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'in_progress': return 'info';
      default: return 'default';
    }
  };

  const renderFeatureDialog = () => (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
      <DialogTitle>
        {editingFeature?.id ? 'Edit Feature' : 'Add New Feature'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Feature Name"
              value={editingFeature?.name || ''}
              onChange={(e) => setEditingFeature(prev => prev ? { ...prev, name: e.target.value } : null)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={editingFeature?.description || ''}
              onChange={(e) => setEditingFeature(prev => prev ? { ...prev, description: e.target.value } : null)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Template</InputLabel>
              <Select
                value={editingFeature?.template || ''}
                onChange={(e) => setEditingFeature(prev => prev ? { ...prev, template: e.target.value as string } : null)}
              >
                {templates.map(template => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Dependencies (comma-separated)"
              value={editingFeature?.dependencies.join(", ") || ''}
              onChange={(e) => setEditingFeature(prev => prev ? {
                ...prev,
                dependencies: e.target.value.split(",").map(d => d.trim())
              } : null)}
              margin="normal"
            />
          </Grid>
          <Grid item xs={6}>
            <Typography gutterBottom>Priority</Typography>
            <Slider
              value={editingFeature?.priority || 1}
              onChange={(_, value) => setEditingFeature(prev => prev ? { ...prev, priority: value as number } : null)}
              min={1}
              max={10}
              step={1}
              marks
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={6}>
            <Typography gutterBottom>Rate Limit (requests/min)</Typography>
            <Slider
              value={editingFeature?.rateLimit || 10}
              onChange={(_, value) => setEditingFeature(prev => prev ? { ...prev, rateLimit: value as number } : null)}
              min={1}
              max={100}
              step={1}
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={6}>
            <Typography gutterBottom>Estimated Time (minutes)</Typography>
            <Slider
              value={editingFeature?.estimatedTime || 5}
              onChange={(_, value) => setEditingFeature(prev => prev ? { ...prev, estimatedTime: value as number } : null)}
              min={1}
              max={60}
              step={1}
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Validation Rules
            </Typography>
            {editingFeature?.validation.rules.map((rule, index) => (
              <Box key={rule.type} mb={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={rule.enabled}
                      onChange={(e) => {
                        if (editingFeature) {
                          const updatedRules = [...editingFeature.validation.rules];
                          updatedRules[index] = { ...rule, enabled: e.target.checked };
                          setEditingFeature({
                            ...editingFeature,
                            validation: { ...editingFeature.validation, rules: updatedRules }
                          });
                        }
                      }}
                    />
                  }
                  label={rule.type.charAt(0).toUpperCase() + rule.type.slice(1)}
                />
                {rule.type === 'coverage' && rule.enabled && (
                  <Slider
                    value={rule.value as number}
                    onChange={(_, value) => {
                      if (editingFeature) {
                        const updatedRules = [...editingFeature.validation.rules];
                        updatedRules[index] = { ...rule, value };
                        setEditingFeature({
                          ...editingFeature,
                          validation: { ...editingFeature.validation, rules: updatedRules }
                        });
                      }
                    }}
                    min={0}
                    max={100}
                    step={1}
                    valueLabelDisplay="auto"
                  />
                )}
                {rule.type === 'custom' && rule.enabled && (
                  <TextField
                    fullWidth
                    label="Custom Validation Command"
                    value={rule.value}
                    onChange={(e) => {
                      if (editingFeature) {
                        const updatedRules = [...editingFeature.validation.rules];
                        updatedRules[index] = { ...rule, value: e.target.value };
                        setEditingFeature({
                          ...editingFeature,
                          validation: { ...editingFeature.validation, rules: updatedRules }
                        });
                      }
                    }}
                    margin="normal"
                  />
                )}
              </Box>
            ))}
            <FormControlLabel
              control={
                <Switch
                  checked={editingFeature?.validation.autoMerge || false}
                  onChange={(e) => setEditingFeature(prev => prev ? {
                    ...prev,
                    validation: { ...prev.validation, autoMerge: e.target.checked }
                  } : null)}
                />
              }
              label="Auto-merge on validation success"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={editingFeature?.validation.requireApproval || false}
                  onChange={(e) => setEditingFeature(prev => prev ? {
                    ...prev,
                    validation: { ...prev.validation, requireApproval: e.target.checked }
                  } : null)}
                />
              }
              label="Require approval before merge"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setDialogOpen(false)} color="secondary">
          Cancel
        </Button>
        <Button onClick={handleSaveFeature} color="primary" variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Container>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Concurrent Development Setup</Typography>
        <Box>
          <ActionButton
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddFeature}
            disabled={isRunning}
          >
            Add Feature
          </ActionButton>
          <ActionButton
            variant="contained"
            color={isRunning ? "error" : "success"}
            startIcon={isRunning ? <StopIcon /> : <StartIcon />}
            onClick={isRunning ? onStopConcurrentDevelopment : onStartConcurrentDevelopment}
          >
            {isRunning ? "Stop Development" : "Start Development"}
          </ActionButton>
        </Box>
      </Box>

      <List>
        {features.map((feature, index) => (
          <FeatureItem key={feature.id} elevation={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="h6">{feature.name}</Typography>
                <Typography color="textSecondary" gutterBottom>
                  {feature.description}
                </Typography>
                <Typography variant="body2">
                  Dependencies: {feature.dependencies.join(", ") || "None"}
                </Typography>
                <Typography variant="body2">
                  Priority: {feature.priority} | Rate Limit: {feature.rateLimit} req/min
                </Typography>
                {feature.template && (
                  <Typography variant="body2">
                    Template: {templates.find(t => t.id === feature.template)?.name}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box display="flex" justifyContent="flex-end">
                  <Tooltip title="Edit Feature">
                    <IconButton
                      onClick={() => handleEditFeature(feature)}
                      size="small"
                      disabled={isRunning}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Feature">
                    <IconButton
                      onClick={() => handleDeleteFeature(index)}
                      size="small"
                      color="error"
                      disabled={isRunning}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                  {feature.status === 'failed' && (
                    <Tooltip title="Retry Feature">
                      <IconButton
                        onClick={() => handleFeatureChange(index, 'status', 'pending')}
                        size="small"
                        color="primary"
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <Box mt={1}>
                  <StatusChip
                    label={feature.status}
                    color={getStatusColor(feature.status)}
                    size="small"
                  />
                  {feature.validation.rules.some(r => r.enabled) && (
                    <Tooltip title="Validation Rules Enabled">
                      <Chip
                        icon={<WarningIcon />}
                        label="Validation"
                        size="small"
                        variant="outlined"
                        style={{ marginLeft: 8 }}
                      />
                    </Tooltip>
                  )}
                </Box>
              </Grid>
            </Grid>
          </FeatureItem>
        ))}
      </List>

      {renderFeatureDialog()}

      <ControlsContainer>
        <Typography variant="h6" gutterBottom>
          Global Settings
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography gutterBottom>Queue Priority</Typography>
            <Slider
              defaultValue={5}
              min={1}
              max={10}
              step={1}
              marks
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography gutterBottom>Concurrent Features Limit</Typography>
            <Slider
              defaultValue={5}
              min={1}
              max={20}
              step={1}
              valueLabelDisplay="auto"
            />
          </Grid>
        </Grid>
      </ControlsContainer>
    </Container>
  );
};

export default ConcurrentDevelopmentSetup;
