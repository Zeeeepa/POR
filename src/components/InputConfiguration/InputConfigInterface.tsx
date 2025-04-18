import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
      setInputPoints(response.data.inputPoints);
      setDefaultInputPoint(response.data.defaultInputPoint);
    } catch (error) {
      showMessage('Failed to load input points', 'error');
    }
  };
  
  // Load automation settings from API
  const loadAutomationSettings = async () => {
    try {
      const response = await axios.get('/api/input-config/settings');
      setAutomationSettings(response.data);
    } catch (error) {
      showMessage('Failed to load automation settings', 'error');
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
          
          // Add new input point to list
          setInputPoints(prev => [...prev, response.data]);
          
          // Reset form
          setNewInputPoint({
            name: '',
            description: '',
            application: ''
          });
          
          showMessage('Input point captured successfully', 'success');
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
      
      // Update input points list
      setInputPoints(prev => prev.map(p => 
        p.name === selectedInputPoint.name ? response.data : p
      ));
      
      // Reset selected input point
      setSelectedInputPoint(null);
      
      showMessage('Input point updated successfully', 'success');
    } catch (error) {
      showMessage('Failed to update input point', 'error');
    }
  };
  
  // Delete an input point
  const deleteInputPoint = async (name: string) => {
    try {
      await axios.delete(`/api/input-config/points/${name}`);
      
      // Remove from input points list
      setInputPoints(prev => prev.filter(p => p.name !== name));
      
      // Reset selected input point if it was deleted
      if (selectedInputPoint?.name === name) {
        setSelectedInputPoint(null);
      }
      
      showMessage('Input point deleted successfully', 'success');
    } catch (error) {
      showMessage('Failed to delete input point', 'error');
    }
  };
  
  // Set default input point
  const setAsDefault = async (name: string) => {
    try {
      await axios.post(`/api/input-config/points/${name}/default`);
      
      // Update default input point
      setDefaultInputPoint(name);
      
      showMessage(`${name} set as default input point`, 'success');
    } catch (error) {
      showMessage('Failed to set default input point', 'error');
    }
  };
  
  // Test an input point
  const testInputPoint = async (name: string) => {
    try {
      await axios.post(`/api/input-config/points/${name}/test`);
      showMessage('Test click sent to input point', 'success');
    } catch (error) {
      showMessage('Failed to test input point', 'error');
    }
  };
  
  // Save automation settings
  const saveAutomationSettings = async () => {
    try {
      await axios.post('/api/input-config/settings', automationSettings);
      showMessage('Automation settings saved successfully', 'success');
    } catch (error) {
      showMessage('Failed to save automation settings', 'error');
    }
  };
  
  return (
    <div className="input-config-interface">
      <h1>Input Configuration</h1>
      
      {/* Message display */}
      {message && (
        <div className={`message message-${messageType}`}>
          {message}
        </div>
      )}
      
      <div className="input-config-container">
        {/* Input Points List */}
        <div className="input-points-list">
          <h2>Input Points</h2>
          
          <table>
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
                    <button onClick={() => selectInputPoint(point)}>Edit</button>
                    <button onClick={() => deleteInputPoint(point.name)}>Delete</button>
                    <button onClick={() => testInputPoint(point.name)}>Test</button>
                    {defaultInputPoint !== point.name && (
                      <button onClick={() => setAsDefault(point.name)}>Set as Default</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Add New Input Point */}
        <div className="add-input-point">
          <h2>Add New Input Point</h2>
          
          <div className="form-group">
            <label htmlFor="name">Name:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={newInputPoint.name}
              onChange={handleInputChange}
              disabled={isCapturing}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description:</label>
            <input
              type="text"
              id="description"
              name="description"
              value={newInputPoint.description}
              onChange={handleInputChange}
              disabled={isCapturing}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="application">Application:</label>
            <input
              type="text"
              id="application"
              name="application"
              value={newInputPoint.application}
              onChange={handleInputChange}
              disabled={isCapturing}
            />
          </div>
          
          {isCapturing ? (
            <button onClick={cancelCapturing} className="cancel-button">
              Cancel Capturing
            </button>
          ) : (
            <button onClick={startCapturing} className="capture-button">
              Capture Position
            </button>
          )}
        </div>
        
        {/* Edit Input Point */}
        {selectedInputPoint && (
          <div className="edit-input-point">
            <h2>Edit Input Point</h2>
            
            <div className="form-group">
              <label htmlFor="edit-name">Name:</label>
              <input
                type="text"
                id="edit-name"
                value={selectedInputPoint.name}
                disabled
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="edit-x">X Coordinate:</label>
              <input
                type="number"
                id="edit-x"
                value={selectedInputPoint.x}
                onChange={(e) => setSelectedInputPoint({
                  ...selectedInputPoint,
                  x: parseInt(e.target.value, 10)
                })}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="edit-y">Y Coordinate:</label>
              <input
                type="number"
                id="edit-y"
                value={selectedInputPoint.y}
                onChange={(e) => setSelectedInputPoint({
                  ...selectedInputPoint,
                  y: parseInt(e.target.value, 10)
                })}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="edit-description">Description:</label>
              <input
                type="text"
                id="edit-description"
                value={selectedInputPoint.description}
                onChange={(e) => setSelectedInputPoint({
                  ...selectedInputPoint,
                  description: e.target.value
                })}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="edit-application">Application:</label>
              <input
                type="text"
                id="edit-application"
                value={selectedInputPoint.application}
                onChange={(e) => setSelectedInputPoint({
                  ...selectedInputPoint,
                  application: e.target.value
                })}
              />
            </div>
            
            <div className="button-group">
              <button onClick={updateInputPoint} className="save-button">
                Save Changes
              </button>
              <button onClick={() => setSelectedInputPoint(null)} className="cancel-button">
                Cancel
              </button>
            </div>
          </div>
        )}
        
        {/* Automation Settings */}
        <div className="automation-settings">
          <h2>Automation Settings</h2>
          
          <div className="form-group">
            <label htmlFor="clickDelay">Click Delay (ms):</label>
            <input
              type="number"
              id="clickDelay"
              name="clickDelay"
              value={automationSettings.clickDelay}
              onChange={handleSettingChange}
              min="0"
              max="5000"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="typeDelay">Type Delay (ms):</label>
            <input
              type="number"
              id="typeDelay"
              name="typeDelay"
              value={automationSettings.typeDelay}
              onChange={handleSettingChange}
              min="0"
              max="1000"
            />
          </div>
          
          <div className="form-group checkbox">
            <label htmlFor="enableAutomation">
              <input
                type="checkbox"
                id="enableAutomation"
                name="enableAutomation"
                checked={automationSettings.enableAutomation}
                onChange={handleSettingChange}
              />
              Enable Automation
            </label>
          </div>
          
          <button onClick={saveAutomationSettings} className="save-button">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputConfigInterface;
