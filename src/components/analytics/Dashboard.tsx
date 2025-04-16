import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import ProjectProgress from './metrics/ProjectProgress';
import TemplateStats from './metrics/TemplateStats';
import PRSuccessRate from './metrics/PRSuccessRate';
import PhaseCompletion from './metrics/PhaseCompletion';
import ErrorAnalysis from './metrics/ErrorAnalysis';

const AnalyticsDashboard: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Analytics Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ProjectProgress />
        </Grid>
        <Grid item xs={12} md={6}>
          <TemplateStats />
        </Grid>
        <Grid item xs={12} md={4}>
          <PRSuccessRate />
        </Grid>
        <Grid item xs={12} md={4}>
          <PhaseCompletion />
        </Grid>
        <Grid item xs={12} md={4}>
          <ErrorAnalysis />
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsDashboard;
