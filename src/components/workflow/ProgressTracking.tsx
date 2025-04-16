import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  Chip,
  Card,
  CardContent
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info
} from '@mui/icons-material';

interface Phase {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

interface PRStatus {
  id: string;
  title: string;
  status: 'open' | 'merged' | 'closed';
  url: string;
}

interface WebhookEvent {
  id: string;
  type: string;
  status: 'success' | 'error';
  timestamp: string;
  message: string;
}

interface Statistics {
  totalPhases: number;
  completedPhases: number;
  failedPhases: number;
  successRate: number;
}

export const ProgressTracking: React.FC = () => {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [prs, setPRs] = useState<PRStatus[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [stats, setStats] = useState<Statistics>({
    totalPhases: 0,
    completedPhases: 0,
    failedPhases: 0,
    successRate: 0
  });

  useEffect(() => {
    setPhases([
      { id: '1', name: 'Phase 1', progress: 100, status: 'completed' },
      { id: '2', name: 'Phase 2', progress: 60, status: 'in_progress' },
      { id: '3', name: 'Phase 3', progress: 0, status: 'pending' }
    ]);

    setPRs([
      { id: '1', title: 'Feature A', status: 'merged', url: '#' },
      { id: '2', title: 'Feature B', status: 'open', url: '#' }
    ]);

    setWebhookEvents([
      { 
        id: '1', 
        type: 'deploy', 
        status: 'success', 
        timestamp: new Date().toISOString(),
        message: 'Deployment successful'
      },
      { 
        id: '2', 
        type: 'build', 
        status: 'error', 
        timestamp: new Date().toISOString(),
        message: 'Build failed: missing dependency'
      }
    ]);

    setStats({
      totalPhases: 10,
      completedPhases: 7,
      failedPhases: 1,
      successRate: 70
    });
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
      case 'merged':
        return <CheckCircle color="success" />;
      case 'error':
      case 'failed':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      default:
        return <Info color="info" />;
    }
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Phase Progress
            </Typography>
            {phases.map((phase) => (
              <Box key={phase.id} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body1">{phase.name}</Typography>
                  <Chip 
                    label={phase.status}
                    size="small"
                    sx={{ ml: 1 }}
                    color={phase.status === 'error' ? 'error' : 'default'}
                  />
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={phase.progress}
                  color={phase.status === 'error' ? 'error' : 'primary'}
                />
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              PR Status
            </Typography>
            <List>
              {prs.map((pr) => (
                <ListItem key={pr.id}>
                  <ListItemIcon>
                    {getStatusIcon(pr.status)}
                  </ListItemIcon>
                  <ListItemText 
                    primary={pr.title}
                    secondary={`Status: ${pr.status}`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Webhook Activity
            </Typography>
            <List>
              {webhookEvents.map((event) => (
                <ListItem key={event.id}>
                  <Alert 
                    severity={event.status === 'success' ? 'success' : 'error'}
                    sx={{ width: '100%' }}
                  >
                    <Typography variant="body2">
                      {event.type}: {event.message}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {new Date(event.timestamp).toLocaleString()}
                    </Typography>
                  </Alert>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Phases
                  </Typography>
                  <Typography variant="h4">
                    {stats.totalPhases}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Completed
                  </Typography>
                  <Typography variant="h4">
                    {stats.completedPhases}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Failed
                  </Typography>
                  <Typography variant="h4" color="error">
                    {stats.failedPhases}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Success Rate
                  </Typography>
                  <Typography variant="h4">
                    {stats.successRate}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};
