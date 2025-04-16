import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Paper,
  Grid,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Save as SaveIcon,
  Preview as PreviewIcon,
  History as HistoryIcon,
  Check as ValidIcon,
  Error as InvalidIcon,
} from "@mui/icons-material";

interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
  version: number;
  isValid: boolean;
  lastModified: Date;
}

interface TemplateEditorProps {
  template?: Template;
  onSave: (template: Partial<Template>) => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSave }) => {
  const [name, setName] = useState(template?.name || "");
  const [content, setContent] = useState(template?.content || "");
  const [category, setCategory] = useState(template?.category || "");
  const [previewMode, setPreviewMode] = useState(false);
  const [isValid, setIsValid] = useState(template?.isValid ?? true);

  // Validate template content when it changes
  useEffect(() => {
    validateTemplate(content);
  }, [content]);

  const validateTemplate = (templateContent: string) => {
    try {
      // Add your template validation logic here
      // For example, check for valid variable syntax, required sections, etc.
      const isValidTemplate = templateContent.length > 0; // Basic validation
      setIsValid(isValidTemplate);
      return isValidTemplate;
    } catch (error) {
      setIsValid(false);
      return false;
    }
  };

  const handleSave = () => {
    if (validateTemplate(content)) {
      onSave({
        name,
        content,
        category,
        version: (template?.version || 0) + 1,
        isValid,
        lastModified: new Date(),
      });
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                label="Template Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                sx={{ mb: 2 }}
              />
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={category}
                  label="Category"
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <MenuItem value="workflow">Workflow</MenuItem>
                  <MenuItem value="documentation">Documentation</MenuItem>
                  <MenuItem value="code">Code</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                multiline
                rows={12}
                label="Template Content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                sx={{ fontFamily: "monospace" }}
              />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box>
                <Tooltip title={isValid ? "Template is valid" : "Template has errors"}>
                  <IconButton color={isValid ? "success" : "error"}>
                    {isValid ? <ValidIcon /> : <InvalidIcon />}
                  </IconButton>
                </Tooltip>
                <Button
                  startIcon={<PreviewIcon />}
                  onClick={() => setPreviewMode(!previewMode)}
                  sx={{ mr: 1 }}
                >
                  Preview
                </Button>
                <Button
                  startIcon={<HistoryIcon />}
                  onClick={() => {/* Implement version history view */}}
                >
                  History
                </Button>
              </Box>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={!isValid}
              >
                Save
              </Button>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: "100%" }}>
            {previewMode ? (
              <Box>
                <Typography variant="h6" gutterBottom>Preview</Typography>
                <Box sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                  {content}
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" gutterBottom>Variable Insertion</Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Available variables:
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setContent(content + "${projectName}")}
                  sx={{ mr: 1, mb: 1 }}
                >
                  Project Name
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setContent(content + "${phase}")}
                  sx={{ mr: 1, mb: 1 }}
                >
                  Phase
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setContent(content + "${date}")}
                  sx={{ mb: 1 }}
                >
                  Date
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
