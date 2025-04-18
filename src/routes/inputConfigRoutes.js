/**
 * Input Configuration API Routes
 */
const express = require('express');
const router = express.Router();
const InputConfigManager = require('../components/InputConfiguration/InputConfigManager');
const UnifiedCursorManager = require('../utils/UnifiedCursorManager');
const logger = require('../utils/logger');

// Initialize managers
const cursorManager = new UnifiedCursorManager();
const inputConfigManager = new InputConfigManager({ cursorManager });

// Get all input points
router.get('/points', (req, res) => {
  try {
    const inputPoints = inputConfigManager.getAllInputPoints();
    const defaultInputPoint = inputConfigManager.getDefaultInputPoint()?.name || null;
    
    res.json({
      success: true,
      inputPoints,
      defaultInputPoint
    });
  } catch (error) {
    logger.error('Error getting input points:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get a specific input point
router.get('/points/:name', (req, res) => {
  try {
    const inputPoint = inputConfigManager.getInputPoint(req.params.name);
    
    if (!inputPoint) {
      return res.status(404).json({
        success: false,
        error: 'Input point not found'
      });
    }
    
    res.json({
      success: true,
      inputPoint
    });
  } catch (error) {
    logger.error('Error getting input point:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add a new input point
router.post('/points', (req, res) => {
  try {
    const { name, x, y, description, application } = req.body;
    
    if (!name || typeof x !== 'number' || typeof y !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Name and coordinates are required'
      });
    }
    
    const inputPoint = inputConfigManager.addInputPoint({
      name,
      x,
      y,
      description,
      application
    });
    
    res.json({
      success: true,
      inputPoint
    });
  } catch (error) {
    logger.error('Error adding input point:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update an input point
router.put('/points/:name', (req, res) => {
  try {
    const { x, y, description, application } = req.body;
    
    const updatedInputPoint = inputConfigManager.updateInputPoint(req.params.name, {
      x,
      y,
      description,
      application
    });
    
    if (!updatedInputPoint) {
      return res.status(404).json({
        success: false,
        error: 'Input point not found'
      });
    }
    
    res.json({
      success: true,
      inputPoint: updatedInputPoint
    });
  } catch (error) {
    logger.error('Error updating input point:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete an input point
router.delete('/points/:name', (req, res) => {
  try {
    const success = inputConfigManager.deleteInputPoint(req.params.name);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Input point not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Input point deleted'
    });
  } catch (error) {
    logger.error('Error deleting input point:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Set default input point
router.post('/points/:name/default', (req, res) => {
  try {
    const success = inputConfigManager.setDefaultInputPoint(req.params.name);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Input point not found'
      });
    }
    
    res.json({
      success: true,
      message: `${req.params.name} set as default input point`
    });
  } catch (error) {
    logger.error('Error setting default input point:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test an input point
router.post('/points/:name/test', (req, res) => {
  try {
    const success = inputConfigManager.testInputPoint(req.params.name);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Input point not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Test click sent to input point'
    });
  } catch (error) {
    logger.error('Error testing input point:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Capture current cursor position
router.post('/capture', (req, res) => {
  try {
    const { name, description, application } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }
    
    const inputPoint = inputConfigManager.captureInputPoint(name, {
      description,
      application
    });
    
    res.json({
      success: true,
      inputPoint
    });
  } catch (error) {
    logger.error('Error capturing input point:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get automation settings
router.get('/settings', (req, res) => {
  try {
    const settings = inputConfigManager.getAutomationSettings();
    
    res.json({
      success: true,
      ...settings
    });
  } catch (error) {
    logger.error('Error getting automation settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update automation settings
router.post('/settings', (req, res) => {
  try {
    const { clickDelay, typeDelay, enableAutomation } = req.body;
    
    const settings = inputConfigManager.updateAutomationSettings({
      clickDelay,
      typeDelay,
      enableAutomation
    });
    
    res.json({
      success: true,
      ...settings
    });
  } catch (error) {
    logger.error('Error updating automation settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
