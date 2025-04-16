import React, { useState } from "react";
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Container,
} from "@mui/material";
import { TemplateEditor } from "./TemplateEditor";
import { TemplateList } from "./TemplateList";
import { TemplateAssignment } from "./TemplateAssignment";

interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
  version: number;
  isValid: boolean;
  lastModified: Date;
}

interface Phase {
  id: string;
  name: string;
  templateId?: string;
  parameters?: Record<string, string>;
}

export const TemplateManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [phases] = useState<Phase[]>([
    { id: "1", name: "Requirements Analysis" },
    { id: "2", name: "Design" },
    { id: "3", name: "Implementation" },
    { id: "4", name: "Testing" },
  ]);

  const handleTemplateCreate = (template: Partial<Template>) => {
    const newTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      ...template,
      version: 1,
      lastModified: new Date(),
    } as Template;
    setTemplates([...templates, newTemplate]);
    setSelectedTemplate(null);
    setActiveTab(0); // Switch back to list view
  };

  const handleTemplateEdit = (template: Template) => {
    setSelectedTemplate(template);
    setActiveTab(1); // Switch to editor
  };

  const handleTemplateUpdate = (updatedTemplate: Partial<Template>) => {
    if (selectedTemplate) {
      const updated = templates.map((t) =>
        t.id === selectedTemplate.id ? { ...t, ...updatedTemplate } : t
      );
      setTemplates(updated);
      setSelectedTemplate(null);
      setActiveTab(0); // Switch back to list view
    }
  };

  const handleTemplateDelete = (templateId: string) => {
    setTemplates(templates.filter((t) => t.id !== templateId));
  };

  const handleTemplateAssign = (
    phaseId: string,
    templateId: string,
    parameters: Record<string, string>
  ) => {
    // Implement template assignment logic
    console.log("Assigning template", { phaseId, templateId, parameters });
  };

  const handleTemplateTest = (
    phaseId: string,
    templateId: string,
    parameters: Record<string, string>
  ) => {
    // Implement template testing logic
    console.log("Testing template", { phaseId, templateId, parameters });
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ width: "100%", mt: 3 }}>
        <Typography variant="h4" gutterBottom>
          Template Management
        </Typography>
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="template management tabs"
          >
            <Tab label="Templates" />
            <Tab label="Editor" />
            <Tab label="Assignment" />
          </Tabs>
        </Box>

        {activeTab === 0 && (
          <TemplateList
            templates={templates}
            onEdit={handleTemplateEdit}
            onDelete={handleTemplateDelete}
          />
        )}

        {activeTab === 1 && (
          <TemplateEditor
            template={selectedTemplate}
            onSave={selectedTemplate ? handleTemplateUpdate : handleTemplateCreate}
          />
        )}

        {activeTab === 2 && (
          <TemplateAssignment
            phases={phases}
            templates={templates}
            onAssign={handleTemplateAssign}
            onTest={handleTemplateTest}
          />
        )}
      </Box>
    </Container>
  );
};
