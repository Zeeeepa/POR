/**
 * InputConfigManager.js
 * Manages input configuration for cursor positions and automation
 */

const fs = require('fs-extra');
const path = require('path');
const EventEmitter = require('events');
const logger = require('../../utils/logger');
const UnifiedCursorManager = require('../../utils/UnifiedCursorManager');

class InputConfigManager extends EventEmitter {
  /**
   * Initialize the Input Configuration Manager
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    super();
    this.configDir = options.configDir || path.join(process.cwd(), 'data', 'input-config');
    this.configFile = path.join(this.configDir, 'input-config.json');
    this.cursorManager = options.cursorManager || new UnifiedCursorManager();
    
    // Default configuration
    this.config = {
      inputPoints: [],
      defaultInputPoint: null,
      clickDelay: 500,
      typeDelay: 10,
      enableAutomation: true
    };
    
    // Ensure config directory exists
    fs.ensureDirSync(this.configDir);
    
    // Load configuration
    this.loadConfig();
  }
  
  /**
   * Load input configuration
   * @returns {Object} Loaded configuration
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        this.config = {
          ...this.config,
          ...config
        };
        logger.info('Input configuration loaded');
      } else {
        logger.info('No input configuration found, using defaults');
        this.saveConfig();
      }
      
      // Sync input points with cursor manager
      this.syncInputPointsWithCursorManager();
      
      return this.config;
    } catch (error) {
      logger.error('Error loading input configuration:', error);
      return this.config;
    }
  }
  
  /**
   * Save input configuration
   * @returns {boolean} Success status
   */
  saveConfig() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
      logger.info('Input configuration saved');
      return true;
    } catch (error) {
      logger.error('Error saving input configuration:', error);
      return false;
    }
  }
  
  /**
   * Sync input points with cursor manager
   */
  syncInputPointsWithCursorManager() {
    // Get all cursor positions
    const cursorPositions = this.cursorManager.getAllPositions();
    
    // Add any missing input points to cursor manager
    for (const inputPoint of this.config.inputPoints) {
      const existingPosition = cursorPositions.find(p => p.name === inputPoint.name);
      
      if (!existingPosition) {
        this.cursorManager.savePosition(
          inputPoint.name,
          { x: inputPoint.x, y: inputPoint.y },
          {
            description: inputPoint.description,
            application: inputPoint.application,
            group: 'input-points'
          }
        );
      }
    }
    
    // Update input points from cursor manager
    const updatedInputPoints = [];
    for (const position of cursorPositions) {
      if (position.group === 'input-points') {
        updatedInputPoints.push({
          name: position.name,
          x: position.x,
          y: position.y,
          description: position.description,
          application: position.application
        });
      }
    }
    
    // Update config if there are changes
    if (updatedInputPoints.length > 0) {
      this.config.inputPoints = updatedInputPoints;
      this.saveConfig();
    }
  }
  
  /**
   * Get all input points
   * @returns {Array} Input points
   */
  getAllInputPoints() {
    return this.config.inputPoints;
  }
  
  /**
   * Get an input point by name
   * @param {string} name - Input point name
   * @returns {Object|null} Input point or null if not found
   */
  getInputPoint(name) {
    return this.config.inputPoints.find(p => p.name === name) || null;
  }
  
  /**
   * Add a new input point
   * @param {Object} inputPoint - Input point data
   * @returns {Object} Added input point
   */
  addInputPoint(inputPoint) {
    if (!inputPoint.name) {
      throw new Error('Input point name is required');
    }
    
    if (typeof inputPoint.x !== 'number' || typeof inputPoint.y !== 'number') {
      throw new Error('Valid coordinates (x, y) are required');
    }
    
    // Check if input point already exists
    const existingIndex = this.config.inputPoints.findIndex(p => p.name === inputPoint.name);
    
    if (existingIndex !== -1) {
      // Update existing input point
      this.config.inputPoints[existingIndex] = {
        ...this.config.inputPoints[existingIndex],
        ...inputPoint
      };
      
      // Save to cursor manager
      this.cursorManager.updatePosition(inputPoint.name, {
        x: inputPoint.x,
        y: inputPoint.y,
        description: inputPoint.description,
        application: inputPoint.application,
        group: 'input-points'
      });
      
      // Save configuration
      this.saveConfig();
      
      // Emit event
      this.emit('inputPointUpdated', this.config.inputPoints[existingIndex]);
      
      return this.config.inputPoints[existingIndex];
    } else {
      // Add new input point
      const newInputPoint = {
        name: inputPoint.name,
        x: inputPoint.x,
        y: inputPoint.y,
        description: inputPoint.description || '',
        application: inputPoint.application || '',
        createdAt: new Date().toISOString()
      };
      
      // Add to input points
      this.config.inputPoints.push(newInputPoint);
      
      // If this is the first input point, set it as default
      if (this.config.inputPoints.length === 1 && !this.config.defaultInputPoint) {
        this.config.defaultInputPoint = newInputPoint.name;
      }
      
      // Save to cursor manager
      this.cursorManager.savePosition(
        newInputPoint.name,
        { x: newInputPoint.x, y: newInputPoint.y },
        {
          description: newInputPoint.description,
          application: newInputPoint.application,
          group: 'input-points'
        }
      );
      
      // Save configuration
      this.saveConfig();
      
      // Emit event
      this.emit('inputPointAdded', newInputPoint);
      
      return newInputPoint;
    }
  }
  
  /**
   * Update an input point
   * @param {string} name - Input point name
   * @param {Object} updates - Input point updates
   * @returns {Object|null} Updated input point or null if not found
   */
  updateInputPoint(name, updates) {
    const index = this.config.inputPoints.findIndex(p => p.name === name);
    
    if (index === -1) {
      return null;
    }
    
    // Update input point
    const updatedInputPoint = {
      ...this.config.inputPoints[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Update in input points array
    this.config.inputPoints[index] = updatedInputPoint;
    
    // Update in cursor manager
    this.cursorManager.updatePosition(name, {
      x: updatedInputPoint.x,
      y: updatedInputPoint.y,
      description: updatedInputPoint.description,
      application: updatedInputPoint.application
    });
    
    // Save configuration
    this.saveConfig();
    
    // Emit event
    this.emit('inputPointUpdated', updatedInputPoint);
    
    return updatedInputPoint;
  }
  
  /**
   * Delete an input point
   * @param {string} name - Input point name
   * @returns {boolean} Success status
   */
  deleteInputPoint(name) {
    const index = this.config.inputPoints.findIndex(p => p.name === name);
    
    if (index === -1) {
      return false;
    }
    
    // Get input point before deleting
    const inputPoint = this.config.inputPoints[index];
    
    // Remove from input points array
    this.config.inputPoints.splice(index, 1);
    
    // If this was the default input point, update default
    if (this.config.defaultInputPoint === name) {
      this.config.defaultInputPoint = this.config.inputPoints.length > 0
        ? this.config.inputPoints[0].name
        : null;
    }
    
    // Delete from cursor manager
    this.cursorManager.deletePosition(name);
    
    // Save configuration
    this.saveConfig();
    
    // Emit event
    this.emit('inputPointDeleted', inputPoint);
    
    return true;
  }
  
  /**
   * Set the default input point
   * @param {string} name - Input point name
   * @returns {boolean} Success status
   */
  setDefaultInputPoint(name) {
    // Check if input point exists
    const inputPoint = this.getInputPoint(name);
    
    if (!inputPoint) {
      return false;
    }
    
    // Set as default
    this.config.defaultInputPoint = name;
    
    // Save configuration
    this.saveConfig();
    
    // Emit event
    this.emit('defaultInputPointChanged', name);
    
    return true;
  }
  
  /**
   * Get the default input point
   * @returns {Object|null} Default input point or null if not set
   */
  getDefaultInputPoint() {
    if (!this.config.defaultInputPoint) {
      return null;
    }
    
    return this.getInputPoint(this.config.defaultInputPoint);
  }
  
  /**
   * Capture the current cursor position as an input point
   * @param {string} name - Input point name
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Captured input point
   */
  captureInputPoint(name, metadata = {}) {
    // Capture current position
    const position = this.cursorManager.captureCurrentPosition(name, {
      ...metadata,
      group: 'input-points'
    });
    
    // Add as input point
    const inputPoint = this.addInputPoint({
      name: position.name,
      x: position.x,
      y: position.y,
      description: position.description,
      application: position.application
    });
    
    return inputPoint;
  }
  
  /**
   * Test an input point by clicking at its position
   * @param {string} name - Input point name
   * @returns {boolean} Success status
   */
  testInputPoint(name) {
    const inputPoint = this.getInputPoint(name);
    
    if (!inputPoint) {
      return false;
    }
    
    // Move cursor to position and click
    return this.cursorManager.clickAtPosition(name);
  }
  
  /**
   * Send text to an input point
   * @param {string} name - Input point name
   * @param {string} text - Text to send
   * @param {Object} options - Options for sending text
   * @returns {Promise<boolean>} Success status
   */
  async sendTextToInputPoint(name, text, options = {}) {
    const inputPoint = this.getInputPoint(name);
    
    if (!inputPoint) {
      return false;
    }
    
    // Send text to position
    return this.cursorManager.sendTextToPosition(name, text, options);
  }
  
  /**
   * Update automation settings
   * @param {Object} settings - Automation settings
   * @returns {Object} Updated settings
   */
  updateAutomationSettings(settings) {
    // Update settings
    if (settings.clickDelay !== undefined) {
      this.config.clickDelay = settings.clickDelay;
    }
    
    if (settings.typeDelay !== undefined) {
      this.config.typeDelay = settings.typeDelay;
    }
    
    if (settings.enableAutomation !== undefined) {
      this.config.enableAutomation = settings.enableAutomation;
    }
    
    // Save configuration
    this.saveConfig();
    
    // Emit event
    this.emit('automationSettingsUpdated', {
      clickDelay: this.config.clickDelay,
      typeDelay: this.config.typeDelay,
      enableAutomation: this.config.enableAutomation
    });
    
    return {
      clickDelay: this.config.clickDelay,
      typeDelay: this.config.typeDelay,
      enableAutomation: this.config.enableAutomation
    };
  }
  
  /**
   * Get automation settings
   * @returns {Object} Automation settings
   */
  getAutomationSettings() {
    return {
      clickDelay: this.config.clickDelay,
      typeDelay: this.config.typeDelay,
      enableAutomation: this.config.enableAutomation
    };
  }
}

module.exports = InputConfigManager;
