import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const PhaseCompletion: React.FC = () => {
  // Sample data - replace with actual data from API
  const data = [
    { name: 'Phase 1', time: 24 },
    { name: 'Phase 2', time: 18 },
    { name: 'Phase 3', time: 32 },
    { name: 'Phase 4', time: 15 },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Phase Completion Times
        </Typography>
        <BarChart width={300} height={300} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="time" fill="#82ca9d" name="Hours" />
        </BarChart>
      </CardContent>
    </Card>
  );
};

export default PhaseCompletion;
