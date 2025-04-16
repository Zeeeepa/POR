import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Grid,
} from '@mui/material';

interface GlobalSettingsProps {
  onSave: (settings: GlobalSettingsData) => void;
}

interface GlobalSettingsData {
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
  };
  defaultTemplate: {
    name: string;
    autoApply: boolean;
  };
  githubIntegration: {
    enabled: boolean;
    webhookUrl: string;
    apiToken: string;
  };
  inputAutomation: {
    enabled: boolean;
    validationRules: string;
  };
  errorHandling: {
    retryAttempts: number;
    logLevel: string;
  };
}

export const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onSave }) => {
  const [settings, setSettings] = useState<GlobalSettingsData>({
    rateLimiting: {
      enabled: true,
      requestsPerMinute: 60,
    },
    defaultTemplate: {
      name: 'Default Template',
      autoApply: true,
    },
    githubIntegration: {
      enabled: true,
      webhookUrl: '',
      apiToken: '',
    },
    inputAutomation: {
      enabled: true,
      validationRules: '{}',
    },
    errorHandling: {
      retryAttempts: 3,
      logLevel: 'error',
    },
  });

  const handleSave = () => {
    onSave(settings);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Global Settings
        </Typography>

        <Box mt={3}>
          <Typography variant="h6">Rate Limiting</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.rateLimiting.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        rateLimiting: {
                          ...settings.rateLimiting,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                }
                label="Enable Rate Limiting"
              />
            </Grid>
            <Grid item>
              <TextField
                type="number"
                label="Requests per Minute"
                value={settings.rateLimiting.requestsPerMinute}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rateLimiting: {
                      ...settings.rateLimiting,
                      requestsPerMinute: parseInt(e.target.value),
                    },
                  })
                }
                disabled={!settings.rateLimiting.enabled}
              />
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="h6">Default Template</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Template Name"
                value={settings.defaultTemplate.name}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultTemplate: {
                      ...settings.defaultTemplate,
                      name: e.target.value,
                    },
                  })
                }
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.defaultTemplate.autoApply}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultTemplate: {
                          ...settings.defaultTemplate,
                          autoApply: e.target.checked,
                        },
                      })
                    }
                  />
                }
                label="Auto Apply Template"
              />
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="h6">GitHub Integration</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.githubIntegration.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        githubIntegration: {
                          ...settings.githubIntegration,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                }
                label="Enable GitHub Integration"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Webhook URL"
                value={settings.githubIntegration.webhookUrl}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    githubIntegration: {
                      ...settings.githubIntegration,
                      webhookUrl: e.target.value,
                    },
                  })
                }
                disabled={!settings.githubIntegration.enabled}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="password"
                label="API Token"
                value={settings.githubIntegration.apiToken}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    githubIntegration: {
                      ...settings.githubIntegration,
                      apiToken: e.target.value,
                    },
                  })
                }
                disabled={!settings.githubIntegration.enabled}
              />
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="h6">Input Automation</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.inputAutomation.enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inputAutomation: {
                          ...settings.inputAutomation,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                }
                label="Enable Input Automation"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Validation Rules (JSON)"
                value={settings.inputAutomation.validationRules}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inputAutomation: {
                      ...settings.inputAutomation,
                      validationRules: e.target.value,
                    },
                  })
                }
                disabled={!settings.inputAutomation.enabled}
              />
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="h6">Error Handling</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                type="number"
                label="Retry Attempts"
                value={settings.errorHandling.retryAttempts}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    errorHandling: {
                      ...settings.errorHandling,
                      retryAttempts: parseInt(e.target.value),
                    },
                  })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Log Level"
                value={settings.errorHandling.logLevel}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    errorHandling: {
                      ...settings.errorHandling,
                      logLevel: e.target.value,
                    },
                  })
                }
                SelectProps={{
                  native: true,
                }}
              >
                <option value="error">Error</option>
                <option value="warn">Warning</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </TextField>
            </Grid>
          </Grid>
        </Box>

        <Box mt={3}>
          <Button variant="contained" color="primary" onClick={handleSave}>
            Save Settings
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};
