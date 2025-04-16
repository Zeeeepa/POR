import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const ErrorAnalysis: React.FC = () => {
  // Sample data - replace with actual data from API
  const data = [
    { name: 'Mon', errors: 5 },
    { name: 'Tue', errors: 3 },
    { name: 'Wed', errors: 7 },
    { name: 'Thu', errors: 2 },
    { name: 'Fri', errors: 4 },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Error Frequency Analysis
        </Typography>
        <AreaChart width={300} height={300} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey="errors" stroke="#ff4d4f" fill="#ff7875" />
        </AreaChart>
      </CardContent>
    </Card>
  );
};

export default ErrorAnalysis;
