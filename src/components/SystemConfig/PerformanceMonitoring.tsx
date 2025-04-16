import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Paper,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PerformanceMetrics {
  systemStatus: {
    cpu: number;
    memory: number;
    disk: number;
    status: 'healthy' | 'warning' | 'error';
  };
  resourceUsage: {
    cpuHistory: Array<{ time: string; usage: number }>;
    memoryHistory: Array<{ time: string; usage: number }>;
  };
  queuePerformance: {
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
  };
  errorMetrics: {
    errorRate: number;
    errorsByType: Record<string, number>;
  };
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
}

interface PerformanceMonitoringProps {
  metrics: PerformanceMetrics;
}

export const PerformanceMonitoring: React.FC<PerformanceMonitoringProps> = ({
  metrics,
}) => {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Performance Monitoring
      </Typography>

      <Grid container spacing={3}>
        {/* System Status */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Status
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography>CPU Usage</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={metrics.systemStatus.cpu}
                    color={metrics.systemStatus.cpu > 80 ? 'error' : 'primary'}
                  />
                  <Typography variant="body2">{metrics.systemStatus.cpu}%</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography>Memory Usage</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={metrics.systemStatus.memory}
                    color={metrics.systemStatus.memory > 80 ? 'error' : 'primary'}
                  />
                  <Typography variant="body2">{metrics.systemStatus.memory}%</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography>Disk Usage</Typography>
                  <LinearProgress
                    variant="determinate"
                    value={metrics.systemStatus.disk}
                    color={metrics.systemStatus.disk > 80 ? 'error' : 'primary'}
                  />
                  <Typography variant="body2">{metrics.systemStatus.disk}%</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Resource Usage Charts */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Resource Usage History
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.resourceUsage.cpuHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="usage"
                      stroke="#8884d8"
                      name="CPU Usage"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Queue Performance */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Queue Performance
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Active Jobs
                    </Typography>
                    <Typography variant="h4">
                      {metrics.queuePerformance.activeJobs}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Completed Jobs
                    </Typography>
                    <Typography variant="h4">
                      {metrics.queuePerformance.completedJobs}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Failed Jobs
                    </Typography>
                    <Typography variant="h4">
                      {metrics.queuePerformance.failedJobs}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Avg. Processing Time
                    </Typography>
                    <Typography variant="h4">
                      {metrics.queuePerformance.averageProcessingTime}ms
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Error Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Error Metrics
              </Typography>
              <Typography variant="body1">
                Error Rate: {metrics.errorMetrics.errorRate}%
              </Typography>
              <Box mt={2}>
                <Typography variant="subtitle2">Errors by Type:</Typography>
                {Object.entries(metrics.errorMetrics.errorsByType).map(
                  ([type, count]) => (
                    <Box key={type} display="flex" justifyContent="space-between" mt={1}>
                      <Typography>{type}:</Typography>
                      <Typography>{count}</Typography>
                    </Box>
                  )
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Response Time */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Response Time
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={4}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Average
                    </Typography>
                    <Typography variant="h4">{metrics.responseTime.average}ms</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      95th Percentile
                    </Typography>
                    <Typography variant="h4">{metrics.responseTime.p95}ms</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      99th Percentile
                    </Typography>
                    <Typography variant="h4">{metrics.responseTime.p99}ms</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
