import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const ProjectProgress: React.FC = () => {
  // Sample data - replace with actual data from API
  const data = [
    { name: 'Week 1', completed: 20, total: 100 },
    { name: 'Week 2', completed: 40, total: 100 },
    { name: 'Week 3', completed: 65, total: 100 },
    { name: 'Week 4', completed: 85, total: 100 },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Project Progress
        </Typography>
        <LineChart width={500} height={300} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="completed" stroke="#8884d8" />
          <Line type="monotone" dataKey="total" stroke="#82ca9d" />
        </LineChart>
      </CardContent>
    </Card>
  );
};

export default ProjectProgress;
