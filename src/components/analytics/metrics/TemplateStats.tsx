import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const TemplateStats: React.FC = () => {
  // Sample data - replace with actual data from API
  const data = [
    { name: 'Template A', usage: 45 },
    { name: 'Template B', usage: 30 },
    { name: 'Template C', usage: 25 },
    { name: 'Template D', usage: 15 },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Template Usage Statistics
        </Typography>
        <BarChart width={500} height={300} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="usage" fill="#8884d8" />
        </BarChart>
      </CardContent>
    </Card>
  );
};

export default TemplateStats;
