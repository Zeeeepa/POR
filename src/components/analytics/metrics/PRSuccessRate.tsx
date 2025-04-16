import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const PRSuccessRate: React.FC = () => {
  // Sample data - replace with actual data from API
  const data = [
    { name: 'Successful', value: 75 },
    { name: 'Failed', value: 15 },
    { name: 'Pending', value: 10 },
  ];

  const COLORS = ['#0088FE', '#FF8042', '#FFBB28'];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          PR Success Rate
        </Typography>
        <PieChart width={300} height={300}>
          <Pie
            data={data}
            cx={150}
            cy={150}
            labelLine={false}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </CardContent>
    </Card>
  );
};

export default PRSuccessRate;
