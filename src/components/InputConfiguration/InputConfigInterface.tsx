import React, { useState, useEffect } from 'react';
import axios from 'axios';
import styled from 'styled-components';

interface InputPoint {
  name: string;
  x: number;
  y: number;
  description: string;
  application: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AutomationSettings {
  clickDelay: number;
  typeDelay: number;
  enableAutomation: boolean;
}

const ConfigContainer = styled.div`
  padding: 20px;
`;

const ControlPanel = styled.div`
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  align-items: center;
`;

const FormGroup = styled.div`
  margin-bottom: 15px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const Button = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  background-color: #4caf50;
  color: white;
  
  &:hover {
    background-color: #45a049;
  }
  
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const CancelButton = styled(Button)`
  background-color: #f44336;
  
  &:hover {
    background-color: #d32f2f;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  
  th, td {
    padding: 8px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }
  
  th {
    background-color: #f0f0f0;
  }
  
  tr.default-point {
    background-color: #e6f7ff;
  }
`;

const Message = styled.div<{ type: 'success' | 'error' | 'info' }>`
  padding: 10px;
  margin-bottom: 15px;
  border-radius: 4px;
  background-color: ${props => 
    props.type === 'success' ? '#dff0d8' : 
    props.type === 'error' ? '#f2dede' : '#d9edf7'};
  color: ${props => 
    props.type === 'success' ? '#3c763d' : 
    props.type === 'error' ? '#a94442' : '#31708f'};
  border: 1px solid ${props => 
    props.type === 'success' ? '#d6e9c6' : 
    props.type === 'error' ? '#ebccd1' : '#bce8f1'};
`;

const InputConfigInterface: React.FC = () => {
  // State for input points
  const [inputPoints, setInputPoints] = useState<InputPoint[]>([]);
  const [defaultInputPoint, setDefaultInputPoint] = useState<string | null>(null);
  const [selectedInputPoint, setSelectedInputPoint] = useState<InputPoint | null>(null);
  
  // State for new input point form
  const [newInputPoint, setNewInputPoint] = useState<Partial<InputPoint>>({
    name: '',
    description: '',
    application: ''
  });
  
  // State for automation settings
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>({
    clickDelay: 500,
    typeDelay: 10,
    enableAutomation: true
  });
  
  // State for UI
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  
  // Load input points and settings on component mount
  useEffect(() => {
    loadInputPoints();
    loadAutomationSettings();
  }, []);
  
  // Load input points from API
  const loadInputPoints = async () => {
    try {
      const response = await axios.get('/api/input-config/points');
      if (response.data.success) {
        setInputPoints(response.data.inputPoints);
        setDefaultInputPoint(response.data.defaultInputPoint);
      } else {
        showMessage('Failed to load input points: ' + response.data.error, 'error');
      }
    } catch (error) {
      showMessage('Error loading input points', 'error');
    }
  };
  
  // Load automation settings from API
  const loadAutomationSettings = async () => {
    try {
      const response = await axios.get('/api/input-config/settings');
      if (response.data.success) {
        setAutomationSettings({
          clickDelay: response.data.clickDelay,
          typeDelay: response.data.typeDelay,
          enableAutomation: response.data.enableAutomation
        });
      } else {
        showMessage('Failed to load automation settings: ' + response.data.error, 'error');
      }
    } catch (error) {
      showMessage('Error loading automation settings', 'error');
    }
  };
  
  // Show message with auto-hide
  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(text);
    setMessageType(type);
    
    // Auto-hide message after 5 seconds
    setTimeout(() => {
      setMessage('');
    }, 5000);
  };
  
  // Handle input change for new input point form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewInputPoint(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle input change for automation settings
  const handleSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setAutomationSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : parseInt(value, 10)
    }));
  };
  
  // Start capturing cursor position
  const startCapturing = () => {
    if (!newInputPoint.name) {
      showMessage('Please enter a name for the input point', 'error');
      return;
    }
    
    setIsCapturing(true);
    showMessage('Move your cursor to the desired position and press Enter', 'info');
    
    // Add event listener for Enter key
    const handleKeyPress = async (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        
        // Remove event listener
        window.removeEventListener('keydown', handleKeyPress);
        
        // Capture position
        try {
          const response = await axios.post('/api/input-config/capture', {
            name: newInputPoint.name,
            description: newInputPoint.description,
            application: newInputPoint.application
          });
          
          if (response.data.success) {
            // Add new input point to list
            setInputPoints(prev => [...prev, response.data.inputPoint]);
            
            // Reset form
            setNewInputPoint({
              name: '',
              description: '',
              application: ''
            });
            
            showMessage('Input point captured successfully', 'success');
          } else {
            showMessage('Failed to capture input point: ' + response.data.error, 'error');
          }
        } catch (error) {
          showMessage('Failed to capture input point', 'error');
        }
        
        setIsCapturing(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
  };
  
  // Cancel capturing
  const cancelCapturing = () => {
    setIsCapturing(false);
    showMessage('Capturing cancelled', 'info');
  };
  
  // Select an input point for editing
  const selectInputPoint = (inputPoint: InputPoint) => {
    setSelectedInputPoint(inputPoint);
  };
  
  // Update an input point
  const updateInputPoint = async () => {
    if (!selectedInputPoint) return;
    
    try {
      const response = await axios.put(`/api/input-config/points/${selectedInputPoint.name}`, selectedInputPoint);
      
      if (response.data.success) {
        // Update input points list
        setInputPoints(prev => prev.map(p => 
          p.name === selectedInputPoint.name ? response.data.inputPoint : p
        ));
        
        // Reset selected input point
        setSelectedInputPoint(null);
        
        showMessage('Input point updated successfully', 'success');
      } else {
        showMessage('Failed to update input point: ' + response.data.error, 'error');
      }
    } catch (error) {
      showMessage('Failed to update input point', 'error');
    }
  };
  
  // Delete an input point
  const deleteInputPoint = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete the input point "${name}"?`)) {
      return;
    }
    
    try {
      const response = await axios.delete(`/api/input-config/points/${name}`);
      
      if (response.data.success) {
        // Remove from input points list
        setInputPoints(prev => prev.filter(p => p.name !== name));
        
        // Reset selected input point if it was deleted
        if (selectedInputPoint?.name === name) {
          setSelectedInputPoint(null);
        }
        
        showMessage('Input point deleted successfully', 'success');
      } else {
        showMessage('Failed to delete input point: ' + response.data.error, 'error');
      }
    } catch (error) {
      showMessage('Failed to delete input point', 'error');
    }
  };
  
  // Set default input point
  const setAsDefault = async (name: string) => {
    try {
      const response = await axios.post(`/api/input-config/points/${name}/default`);
      
      if (response.data.success) {
        // Update default input point
        setDefaultInputPoint(name);
        
        showMessage(`${name} set as default input point`, 'success');
      } else {
        showMessage('Failed to set default input point: ' + response.data.error, 'error');
      }
    } catch (error) {
      showMessage('Failed to set default input point', 'error');
    }
  };
  
  // Test an input point
  const testInputPoint = async (name: string) => {
    try {
      const response = await axios.post(`/api/input-config/points/${name}/test`);
      
      if (response.data.success) {
        showMessage('Test click sent to input point', 'success');
      } else {
        showMessage('Failed to test input point: ' + response.data.error, 'error');
      }
    } catch (error) {
      showMessage('Failed to test input point', 'error');
    }
  };
  
  // Save automation settings
  const saveAutomationSettings = async () => {
    try {
      const response = await axios.post('/api/input-config/settings', automationSettings);
      
      if (response.data.success) {
        showMessage('Automation settings saved successfully', 'success');
      } else {
        showMessage('Failed to save automation settings: ' + response.data.error, 'error');
      }
    } catch (error) {
      showMessage('Failed to save automation settings', 'error');
    }
  };
  
  return (
    <ConfigContainer>
      <h1>Input Configuration</h1>
      
      {/* Message display */}
      {message && (
        <Message type={messageType}>
          {message}
        </Message>
      )}
      
      <div className="input-config-container">
        {/* Input Points List */}
        <div>
          <h2>Input Points</h2>
          
          {inputPoints.length === 0 ? (
            <p>No input points configured yet. Add one using the form.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Coordinates</th>
                  <th>Description</th>
                  <th>Application</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inputPoints.map(point => (
                  <tr key={point.name} className={defaultInputPoint === point.name ? 'default-point' : ''}>
                    <td>{point.name}</td>
                    <td>({point.x}, {point.y})</td>
                    <td>{point.description}</td>
                    <td>{point.application}</td>
                    <td>
                      <Button onClick={() => selectInputPoint(point)}>Edit</Button>
                      <Button onClick={() => deleteInputPoint(point.name)}>Delete</Button>
                      <Button onClick={() => testInputPoint(point.name)}>Test</Button>
                      {defaultInputPoint !== point.name && (
                        <Button onClick={() => setAsDefault(point.name)}>Set as Default</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
        
        {/* Add New Input Point */}
        <div>
          <h2>Add New Input Point</h2>
          
          <FormGroup>
            <Label htmlFor="name">Name:</Label>
            <Input
              type="text"
              id="name"
              name="name"
              value={newInputPoint.name}
              onChange={handleInputChange}
              disabled={isCapturing}
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="description">Description:</Label>
            <Input
              type="text"
              id="description"
              name="description"
              value={newInputPoint.description}
              onChange={handleInputChange}
              disabled={isCapturing}
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="application">Application:</Label>
            <Input
              type="text"
              id="application"
              name="application"
              value={newInputPoint.application}
              onChange={handleInputChange}
              disabled={isCapturing}
            />
          </FormGroup>
          
          {isCapturing ? (
            <CancelButton onClick={cancelCapturing}>
              Cancel Capturing
            </CancelButton>
          ) : (
            <Button onClick={startCapturing}>
              Capture Position
            </Button>
          )}
        </div>
        
        {/* Edit Input Point */}
        {selectedInputPoint && (
          <div>
            <h2>Edit Input Point</h2>
            
            <FormGroup>
              <Label htmlFor="edit-name">Name:</Label>
              <Input
                type="text"
                id="edit-name"
                value={selectedInputPoint.name}
                disabled
              />
            </FormGroup>
            
            <FormGroup>
              <Label htmlFor="edit-x">X Coordinate:</Label>
              <Input
                type="number"
                id="edit-x"
                value={selectedInputPoint.x}
                onChange={(e) => setSelectedInputPoint({
                  ...selectedInputPoint,
                  x: parseInt(e.target.value, 10)
                })}
              />
            </FormGroup>
            
            <FormGroup>
              <Label htmlFor="edit-y">Y Coordinate:</Label>
              <Input
                type="number"
                id="edit-y"
                value={selectedInputPoint.y}
                onChange={(e) => setSelectedInputPoint({
                  ...selectedInputPoint,
                  y: parseInt(e.target.value, 10)
                })}
              />
            </FormGroup>
            
            <FormGroup>
              <Label htmlFor="edit-description">Description:</Label>
              <Input
                type="text"
                id="edit-description"
                value={selectedInputPoint.description}
                onChange={(e) => setSelectedInputPoint({
                  ...selectedInputPoint,
                  description: e.target.value
                })}
              />
            </FormGroup>
            
            <FormGroup>
              <Label htmlFor="edit-application">Application:</Label>
              <Input
                type="text"
                id="edit-application"
                value={selectedInputPoint.application}
                onChange={(e) => setSelectedInputPoint({
                  ...selectedInputPoint,
                  application: e.target.value
                })}
              />
            </FormGroup>
            
            <div className="button-group">
              <Button onClick={updateInputPoint}>
                Save Changes
              </Button>
              <CancelButton onClick={() => setSelectedInputPoint(null)}>
                Cancel
              </CancelButton>
            </div>
          </div>
        )}
        
        {/* Automation Settings */}
        <div>
          <h2>Automation Settings</h2>
          
          <FormGroup>
            <Label htmlFor="clickDelay">Click Delay (ms):</Label>
            <Input
              type="number"
              id="clickDelay"
              name="clickDelay"
              value={automationSettings.clickDelay}
              onChange={handleSettingChange}
              min="0"
              max="5000"
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="typeDelay">Type Delay (ms):</Label>
            <Input
              type="number"
              id="typeDelay"
              name="typeDelay"
              value={automationSettings.typeDelay}
              onChange={handleSettingChange}
              min="0"
              max="1000"
            />
          </FormGroup>
          
          <FormGroup>
            <Label htmlFor="enableAutomation">
              <Input
                type="checkbox"
                id="enableAutomation"
                name="enableAutomation"
                checked={automationSettings.enableAutomation}
                onChange={handleSettingChange}
              />
              Enable Automation
            </Label>
          </FormGroup>
          
          <Button onClick={saveAutomationSettings}>
            Save Settings
          </Button>
        </div>
      </div>
    </ConfigContainer>
  );
};

export default InputConfigInterface;
