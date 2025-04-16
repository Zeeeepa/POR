import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  Typography,
  Switch,
  Button,
  TextField,
  CircularProgress,
  Alert,
} from "@mui/material";

interface Repository {
  id: string;
  name: string;
  isConnected: boolean;
  webhookEnabled: boolean;
  branchProtectionEnabled: boolean;
  prTemplateEnabled: boolean;
  autoMergeEnabled: boolean;
}

export const RepositoryManagement: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Fetch repositories from API
    setLoading(false);
  }, []);

  const handleWebhookToggle = async (repoId: string) => {
    try {
      // TODO: Update webhook configuration
    } catch (err) {
      setError("Failed to update webhook configuration");
    }
  };

  const handleBranchProtectionToggle = async (repoId: string) => {
    try {
      // TODO: Update branch protection settings
    } catch (err) {
      setError("Failed to update branch protection settings");
    }
  };

  const handlePRTemplateToggle = async (repoId: string) => {
    try {
      // TODO: Update PR template settings
    } catch (err) {
      setError("Failed to update PR template settings");
    }
  };

  const handleAutoMergeToggle = async (repoId: string) => {
    try {
      // TODO: Update auto-merge rules
    } catch (err) {
      setError("Failed to update auto-merge rules");
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Repository Management
      </Typography>
      
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {repositories.map((repo) => (
        <Card key={repo.id} sx={{ mb: 2, p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">{repo.name}</Typography>
            <Box>
              <Typography 
                component="span" 
                color={repo.isConnected ? "success.main" : "error.main"}
              >
                {repo.isConnected ? "Connected" : "Disconnected"}
              </Typography>
            </Box>
          </Box>

          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography>Webhook Configuration</Typography>
              <Switch
                checked={repo.webhookEnabled}
                onChange={() => handleWebhookToggle(repo.id)}
              />
            </Box>

            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography>Branch Protection</Typography>
              <Switch
                checked={repo.branchProtectionEnabled}
                onChange={() => handleBranchProtectionToggle(repo.id)}
              />
            </Box>

            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography>PR Template</Typography>
              <Switch
                checked={repo.prTemplateEnabled}
                onChange={() => handlePRTemplateToggle(repo.id)}
              />
            </Box>

            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography>Auto-merge Rules</Typography>
              <Switch
                checked={repo.autoMergeEnabled}
                onChange={() => handleAutoMergeToggle(repo.id)}
              />
            </Box>
          </Box>
        </Card>
      ))}
    </Box>
  );
};
