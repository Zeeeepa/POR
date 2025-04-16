import React from "react";
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
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon } from "@mui/icons-material";
import { ConcurrentFeature } from "../../types/phase";

const Container = styled.div`
  padding: 20px;
`;

const FeatureItem = styled(Paper)`
  margin: 10px 0;
  padding: 15px;
`;

const ControlsContainer = styled.div`
  margin-top: 20px;
`;

const AddButton = styled(IconButton)`
  margin-top: 10px;
`;

interface ConcurrentDevelopmentSetupProps {
  features: ConcurrentFeature[];
  onFeaturesChange: (features: ConcurrentFeature[]) => void;
}

const ConcurrentDevelopmentSetup: React.FC<ConcurrentDevelopmentSetupProps> = ({
  features,
  onFeaturesChange,
}) => {
  const handleFeatureChange = (index: number, field: keyof ConcurrentFeature, value: any) => {
    const updatedFeatures = [...features];
    updatedFeatures[index] = {
      ...updatedFeatures[index],
      [field]: value,
    };
    onFeaturesChange(updatedFeatures);
  };

  const handleAddFeature = () => {
    onFeaturesChange([
      ...features,
      {
        id: `feature-${Date.now()}`,
        name: "",
        dependencies: [],
        priority: 1,
        rateLimit: 10,
      },
    ]);
  };

  const handleDeleteFeature = (index: number) => {
    const updatedFeatures = features.filter((_, i) => i !== index);
    onFeaturesChange(updatedFeatures);
  };

  const handleDependencyChange = (index: number, value: string) => {
    const dependencies = value.split(",").map((dep) => dep.trim());
    handleFeatureChange(index, "dependencies", dependencies);
  };

  return (
    <Container>
      <Typography variant="h6" gutterBottom>
        Concurrent Features
      </Typography>

      <List>
        {features.map((feature, index) => (
          <FeatureItem key={feature.id} elevation={1}>
            <ListItem>
              <ListItemText>
                <TextField
                  fullWidth
                  label="Feature Name"
                  value={feature.name}
                  onChange={(e) => handleFeatureChange(index, "name", e.target.value)}
                  margin="normal"
                />

                <TextField
                  fullWidth
                  label="Dependencies (comma-separated)"
                  value={feature.dependencies.join(", ")}
                  onChange={(e) => handleDependencyChange(index, e.target.value)}
                  margin="normal"
                />

                <Typography gutterBottom>Priority</Typography>
                <Slider
                  value={feature.priority}
                  onChange={(_, value) => handleFeatureChange(index, "priority", value)}
                  min={1}
                  max={10}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                />

                <Typography gutterBottom>Rate Limit (requests/min)</Typography>
                <Slider
                  value={feature.rateLimit || 10}
                  onChange={(_, value) => handleFeatureChange(index, "rateLimit", value)}
                  min={1}
                  max={100}
                  step={1}
                  valueLabelDisplay="auto"
                />

                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => handleDeleteFeature(index)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemText>
            </ListItem>
          </FeatureItem>
        ))}
      </List>

      <AddButton color="primary" onClick={handleAddFeature}>
        <AddIcon />
      </AddButton>

      <ControlsContainer>
        <Typography variant="h6" gutterBottom>
          Global Settings
        </Typography>
        <Typography gutterBottom>Queue Priority</Typography>
        <Slider
          defaultValue={5}
          min={1}
          max={10}
          step={1}
          marks
          valueLabelDisplay="auto"
        />
      </ControlsContainer>
    </Container>
  );
};

export default ConcurrentDevelopmentSetup;
