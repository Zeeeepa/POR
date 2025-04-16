import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
} from "@mui/material";

interface PullRequest {
  id: string;
  title: string;
  status: "open" | "closed" | "merged";
  validationStatus: "pending" | "success" | "failure";
  hasConflicts: boolean;
  approvalCount: number;
  requiredApprovals: number;
}

export const PRManagement: React.FC = () => {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    // TODO: Fetch pull requests from API
    setLoading(false);
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  const handleMerge = async (prId: string) => {
    try {
      // TODO: Merge pull request
    } catch (err) {
      setError("Failed to merge pull request");
    }
  };

  const handleResolveConflicts = async (prId: string) => {
    try {
      // TODO: Open conflict resolution interface
    } catch (err) {
      setError("Failed to open conflict resolution interface");
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
        Pull Request Management
      </Typography>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Tabs value={selectedTab} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label="Open" />
        <Tab label="Closed" />
        <Tab label="Merged" />
      </Tabs>

      {pullRequests.map((pr) => (
        <Card key={pr.id} sx={{ mb: 2, p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">{pr.title}</Typography>
            <Typography
              component="span"
              color={
                pr.status === "merged"
                  ? "success.main"
                  : pr.status === "closed"
                  ? "error.main"
                  : "primary.main"
              }
            >
              {pr.status.charAt(0).toUpperCase() + pr.status.slice(1)}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography>Validation Status</Typography>
              <Typography
                color={
                  pr.validationStatus === "success"
                    ? "success.main"
                    : pr.validationStatus === "failure"
                    ? "error.main"
                    : "warning.main"
                }
              >
                {pr.validationStatus.charAt(0).toUpperCase() + pr.validationStatus.slice(1)}
              </Typography>
            </Box>

            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography>Approvals</Typography>
              <Typography>
                {pr.approvalCount} / {pr.requiredApprovals}
              </Typography>
            </Box>

            {pr.hasConflicts && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                This pull request has merge conflicts that need to be resolved.
              </Alert>
            )}

            <Box display="flex" gap={2} justifyContent="flex-end">
              {pr.hasConflicts && (
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => handleResolveConflicts(pr.id)}
                >
                  Resolve Conflicts
                </Button>
              )}
              <Button
                variant="contained"
                color="primary"
                disabled={
                  pr.status !== "open" ||
                  pr.hasConflicts ||
                  pr.validationStatus !== "success" ||
                  pr.approvalCount < pr.requiredApprovals
                }
                onClick={() => handleMerge(pr.id)}
              >
                Merge
              </Button>
            </Box>
          </Box>
        </Card>
      ))}
    </Box>
  );
};
