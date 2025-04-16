import React, { useState } from 'react';
import { Button, Table, Space, Input, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, CheckOutlined } from '@ant-design/icons';
import styled from 'styled-components';

interface InputPoint {
  id: string;
  x: number;
  y: number;
  label: string;
}

const ConfigContainer = styled.div\`
  padding: 20px;
\`;

const ControlPanel = styled.div\`
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
\`;

const CoordinateDisplay = styled.div\`
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 20px;
\`;

export const InputConfigInterface: React.FC = () => {
  const [points, setPoints] = useState<InputPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<InputPoint | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handlePointSelection = () => {
    setIsSelecting(true);
    message.info('Click anywhere to select an input point');
    // In a real implementation, this would hook into the canvas/workspace click events
  };

  const handlePointAdd = (x: number, y: number) => {
    const newPoint: InputPoint = {
      id: Date.now().toString(),
      x,
      y,
      label: \`Point \${points.length + 1}\`,
    };
    setPoints([...points, newPoint]);
    setIsSelecting(false);
  };

  const handlePointEdit = (point: InputPoint) => {
    setSelectedPoint(point);
  };

  const handlePointDelete = (pointId: string) => {
    setPoints(points.filter(p => p.id !== pointId));
  };

  const handlePointTest = (point: InputPoint) => {
    message.info(\`Testing point at coordinates (\${point.x}, \${point.y})\`);
    // Implement actual point testing logic here
  };

  const columns = [
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: 'X',
      dataIndex: 'x',
      key: 'x',
    },
    {
      title: 'Y',
      dataIndex: 'y',
      key: 'y',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: InputPoint) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => handlePointEdit(record)}
          />
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => handlePointDelete(record.id)}
          />
          <Button
            icon={<CheckOutlined />}
            onClick={() => handlePointTest(record)}
          >
            Test
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <ConfigContainer>
      <ControlPanel>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handlePointSelection}
          disabled={isSelecting}
        >
          Select Input Point
        </Button>
      </ControlPanel>

      {selectedPoint && (
        <CoordinateDisplay>
          Selected Point: ({selectedPoint.x}, {selectedPoint.y})
        </CoordinateDisplay>
      )}

      <Table
        dataSource={points}
        columns={columns}
        rowKey="id"
        pagination={false}
      />
    </ConfigContainer>
  );
};
