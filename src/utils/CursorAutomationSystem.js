/**
 * CursorAutomationSystem.js
 * A comprehensive cursor automation system for simulating mouse and keyboard interactions
 * 
 * This module provides a robust API for:
 * - Mouse movement and click simulation
 * - Keyboard input simulation
 * - Screen position capture and storage
 * - Coordinate transformation for different resolutions
 * - Sequence recording and playback
 * - Error handling and recovery
 * 
 * @module CursorAutomationSystem
 * @requires robotjs
 * @requires fs
 * @requires path
 * @requires events
 * @requires uuid
 */

const robot = require('robotjs');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('./logger');

/**
 * Custom error types for the CursorAutomationSystem
 */
class CursorAutomationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CursorAutomationError';
  }
}

class InvalidPositionError extends CursorAutomationError {
  constructor(x, y, message = `Invalid position: (${x}, ${y})`) {
    super(message);
    this.name = 'InvalidPositionError';
    this.coordinates = { x, y };
  }
}

class PositionNotFoundError extends CursorAutomationError {
  constructor(name, message = `Position not found: ${name}`) {
    super(message);
    this.name = 'PositionNotFoundError';
    this.positionName = name;
  }
}

class SequenceError extends CursorAutomationError {
  constructor(sequenceId, message = `Error in sequence: ${sequenceId}`) {
    super(message);
    this.name = 'SequenceError';
    this.sequenceId = sequenceId;
  }
}

/**
 * CursorAutomationSystem class
 * Provides a comprehensive API for cursor automation
 */
class CursorAutomationSystem extends EventEmitter {
  /**
   * Create a new CursorAutomationSystem instance
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.dataDir - Directory to store position and sequence data
   * @param {number} options.defaultDelay - Default delay between actions in ms
   * @param {boolean} options.safeMode - Enable safe mode (additional validation)
   * @param {Object} options.screenConfig - Screen configuration
   * @param {number} options.screenConfig.width - Reference screen width
   * @param {number} options.screenConfig.height - Reference screen height
   */
  constructor(options = {}) {
    super();
    
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'cursor-automation');
    this.defaultDelay = options.defaultDelay || 100;
    this.safeMode = options.safeMode !== undefined ? options.safeMode : true;
    
    // Screen configuration for coordinate transformation
    this.screenConfig = options.screenConfig || {
      width: 1920,
      height: 1080
    };
    
    // Store saved positions
    this.positions = new Map();
    
    // Store active recording
    this.recording = null;
    
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Load saved positions
    this.loadPositions();
    
    logger.info('CursorAutomationSystem initialized');
  }
  
  /**
   * Load saved positions from file
   * @private
   */
  loadPositions() {
    try {
      const positionsFile = path.join(this.dataDir, 'positions.json');
      
      if (fs.existsSync(positionsFile)) {
        const positions = JSON.parse(fs.readFileSync(positionsFile, 'utf8'));
        
        positions.forEach(position => {
          this.positions.set(position.id, position);
        });
        
        logger.info(`Loaded ${this.positions.size} saved positions`);
      }
    } catch (error) {
      logger.error('Error loading positions:', error);
    }
  }
  
  /**
   * Save positions to file
   * @private
   */
  savePositions() {
    try {
      const positionsFile = path.join(this.dataDir, 'positions.json');
      const positions = Array.from(this.positions.values());
      
      fs.writeFileSync(positionsFile, JSON.stringify(positions, null, 2));
    } catch (error) {
      logger.error('Error saving positions:', error);
      throw new CursorAutomationError('Failed to save positions');
    }
  }
  
  /**
   * Get the current screen size
   * 
   * @returns {Object} Screen size {width, height}
   */
  getScreenSize() {
    return robot.getScreenSize();
  }
  
  /**
   * Transform coordinates based on screen resolution
   * 
   * @param {number} x - X coordinate in reference resolution
   * @param {number} y - Y coordinate in reference resolution
   * @returns {Object} Transformed coordinates {x, y}
   */
  transformCoordinates(x, y) {
    const screenSize = this.getScreenSize();
    const scaleX = screenSize.width / this.screenConfig.width;
    const scaleY = screenSize.height / this.screenConfig.height;
    
    return {
      x: Math.round(x * scaleX),
      y: Math.round(y * scaleY)
    };
  }
  
  /**
   * Check if coordinates are valid (within screen bounds)
   * 
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if coordinates are valid
   */
  isValidPosition(x, y) {
    const screenSize = this.getScreenSize();
    return x >= 0 && x < screenSize.width && y >= 0 && y < screenSize.height;
  }
  
  /**
   * Move cursor to specified coordinates
   * 
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {Object} options - Movement options
   * @param {boolean} options.transform - Transform coordinates based on screen resolution
   * @param {boolean} options.relative - Use relative movement instead of absolute
   * @param {number} options.speed - Movement speed (1-100, default: 50)
   * @param {boolean} options.smooth - Use smooth movement
   * @returns {Object} New cursor position {x, y}
   * @throws {InvalidPositionError} If position is invalid
   */
  moveTo(x, y, options = {}) {
    try {
      let targetX = x;
      let targetY = y;
      
      // Handle relative movement
      if (options.relative) {
        const currentPos = robot.getMousePos();
        targetX = currentPos.x + x;
        targetY = currentPos.y + y;
      }
      
      // Transform coordinates if needed
      if (options.transform) {
        const transformed = this.transformCoordinates(targetX, targetY);
        targetX = transformed.x;
        targetY = transformed.y;
      }
      
      // Validate position if in safe mode
      if (this.safeMode && !this.isValidPosition(targetX, targetY)) {
        throw new InvalidPositionError(targetX, targetY);
      }
      
      // Move the cursor
      if (options.smooth) {
        this._smoothMove(targetX, targetY, options.speed || 50);
      } else {
        robot.moveMouse(targetX, targetY);
      }
      
      // Record action if recording
      if (this.recording) {
        this.recording.actions.push({
          type: 'move',
          x: targetX,
          y: targetY,
          options: { ...options },
          timestamp: Date.now()
        });
      }
      
      // Emit event
      this.emit('move', { x: targetX, y: targetY });
      
      return { x: targetX, y: targetY };
    } catch (error) {
      if (error instanceof InvalidPositionError) {
        throw error;
      }
      
      logger.error('Error moving cursor:', error);
      throw new CursorAutomationError(`Failed to move cursor: ${error.message}`);
    }
  }
  
  /**
   * Perform a smooth mouse movement (internal method)
   * 
   * @param {number} targetX - Target X coordinate
   * @param {number} targetY - Target Y coordinate
   * @param {number} speed - Movement speed (1-100)
   * @private
   */
  _smoothMove(targetX, targetY, speed) {
    const currentPos = robot.getMousePos();
    const startX = currentPos.x;
    const startY = currentPos.y;
    
    // Calculate distance
    const distance = Math.sqrt(
      Math.pow(targetX - startX, 2) + Math.pow(targetY - startY, 2)
    );
    
    // Calculate number of steps based on distance and speed
    // Higher speed means fewer steps
    const steps = Math.max(10, Math.floor(distance / (speed / 10)));
    
    // Perform movement in steps
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      const x = Math.round(startX + (targetX - startX) * progress);
      const y = Math.round(startY + (targetY - startY) * progress);
      
      robot.moveMouse(x, y);
      
      // Small delay between steps
      this._sleep(5);
    }
    
    // Ensure we end up exactly at the target position
    robot.moveMouse(targetX, targetY);
  }
  
  /**
   * Perform a mouse click
   * 
   * @param {string} button - Mouse button ('left', 'right', 'middle')
   * @param {Object} options - Click options
   * @param {number} options.delay - Delay between press and release in ms
   * @returns {boolean} True if successful
   * @throws {CursorAutomationError} If click fails
   */
  click(button = 'left', options = {}) {
    try {
      const delay = options.delay || 10;
      
      // Perform click
      robot.mouseToggle('down', button);
      this._sleep(delay);
      robot.mouseToggle('up', button);
      
      // Record action if recording
      if (this.recording) {
        const position = robot.getMousePos();
        this.recording.actions.push({
          type: 'click',
          button,
          position,
          options: { ...options },
          timestamp: Date.now()
        });
      }
      
      // Emit event
      this.emit('click', { button, position: robot.getMousePos() });
      
      return true;
    } catch (error) {
      logger.error('Error performing click:', error);
      throw new CursorAutomationError(`Failed to perform click: ${error.message}`);
    }
  }
  
  /**
   * Perform a double click
   * 
   * @param {string} button - Mouse button ('left', 'right', 'middle')
   * @param {Object} options - Click options
   * @param {number} options.delay - Delay between clicks in ms
   * @returns {boolean} True if successful
   * @throws {CursorAutomationError} If double click fails
   */
  doubleClick(button = 'left', options = {}) {
    try {
      const delay = options.delay || 50;
      
      // Perform first click
      this.click(button);
      
      // Wait between clicks
      this._sleep(delay);
      
      // Perform second click
      this.click(button);
      
      // Record action if recording
      if (this.recording) {
        const position = robot.getMousePos();
        this.recording.actions.push({
          type: 'doubleClick',
          button,
          position,
          options: { ...options },
          timestamp: Date.now()
        });
      }
      
      // Emit event
      this.emit('doubleClick', { button, position: robot.getMousePos() });
      
      return true;
    } catch (error) {
      logger.error('Error performing double click:', error);
      throw new CursorAutomationError(`Failed to perform double click: ${error.message}`);
    }
  }
  
  /**
   * Perform a drag operation
   * 
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {number} endX - End X coordinate
   * @param {number} endY - End Y coordinate
   * @param {Object} options - Drag options
   * @param {string} options.button - Mouse button ('left', 'right', 'middle')
   * @param {boolean} options.transform - Transform coordinates based on screen resolution
   * @param {boolean} options.smooth - Use smooth movement
   * @param {number} options.speed - Movement speed (1-100, default: 50)
   * @returns {boolean} True if successful
   * @throws {InvalidPositionError} If position is invalid
   * @throws {CursorAutomationError} If drag fails
   */
  dragTo(startX, startY, endX, endY, options = {}) {
    try {
      const button = options.button || 'left';
      
      // Move to start position
      this.moveTo(startX, startY, {
        transform: options.transform,
        smooth: options.smooth,
        speed: options.speed
      });
      
      // Press mouse button
      robot.mouseToggle('down', button);
      
      // Small delay
      this._sleep(50);
      
      // Move to end position
      this.moveTo(endX, endY, {
        transform: options.transform,
        smooth: options.smooth || true,
        speed: options.speed
      });
      
      // Small delay
      this._sleep(50);
      
      // Release mouse button
      robot.mouseToggle('up', button);
      
      // Record action if recording
      if (this.recording) {
        this.recording.actions.push({
          type: 'drag',
          startX,
          startY,
          endX,
          endY,
          button,
          options: { ...options },
          timestamp: Date.now()
        });
      }
      
      // Emit event
      this.emit('drag', {
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        button
      });
      
      return true;
    } catch (error) {
      if (error instanceof InvalidPositionError) {
        throw error;
      }
      
      logger.error('Error performing drag:', error);
      throw new CursorAutomationError(`Failed to perform drag: ${error.message}`);
    }
  }
  
  /**
   * Type text at current position
   * 
   * @param {string} text - Text to type
   * @param {Object} options - Type options
   * @param {number} options.delay - Delay between keystrokes in ms
   * @param {boolean} options.modifiers - Keyboard modifiers to apply (e.g., ['control', 'shift'])
   * @returns {boolean} True if successful
   * @throws {CursorAutomationError} If typing fails
   */
  typeText(text, options = {}) {
    try {
      const delay = options.delay || 10;
      
      // Apply modifiers if specified
      if (options.modifiers && Array.isArray(options.modifiers)) {
        options.modifiers.forEach(modifier => {
          robot.keyToggle(modifier, 'down');
        });
      }
      
      // Type text
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        robot.typeString(char);
        this._sleep(delay);
      }
      
      // Release modifiers if specified
      if (options.modifiers && Array.isArray(options.modifiers)) {
        options.modifiers.forEach(modifier => {
          robot.keyToggle(modifier, 'up');
        });
      }
      
      // Record action if recording
      if (this.recording) {
        const position = robot.getMousePos();
        this.recording.actions.push({
          type: 'type',
          text,
          position,
          options: { ...options },
          timestamp: Date.now()
        });
      }
      
      // Emit event
      this.emit('type', { text, position: robot.getMousePos() });
      
      return true;
    } catch (error) {
      logger.error('Error typing text:', error);
      throw new CursorAutomationError(`Failed to type text: ${error.message}`);
    }
  }
  
  /**
   * Capture current cursor position
   * 
   * @param {string} name - Name for the saved position
   * @param {Object} options - Capture options
   * @param {string} options.description - Description of the position
   * @param {string} options.group - Group for the position
   * @returns {Object} Saved position
   * @throws {CursorAutomationError} If capture fails
   */
  capturePosition(name, options = {}) {
    try {
      if (!name) {
        throw new Error('Position name is required');
      }
      
      // Get current position
      const position = robot.getMousePos();
      
      // Create position object
      const positionData = {
        id: uuidv4(),
        name,
        x: position.x,
        y: position.y,
        description: options.description || '',
        group: options.group || 'default',
        createdAt: new Date().toISOString()
      };
      
      // Check if position with same name exists
      for (const pos of this.positions.values()) {
        if (pos.name === name) {
          // Update existing position
          positionData.id = pos.id;
          break;
        }
      }
      
      // Save position
      this.positions.set(positionData.id, positionData);
      this.savePositions();
      
      // Emit event
      this.emit('positionCaptured', positionData);
      
      return positionData;
    } catch (error) {
      logger.error('Error capturing position:', error);
      throw new CursorAutomationError(`Failed to capture position: ${error.message}`);
    }
  }
  
  /**
   * Get a saved position by name or ID
   * 
   * @param {string} nameOrId - Name or ID of the position
   * @returns {Object} Position data
   * @throws {PositionNotFoundError} If position not found
   */
  getPosition(nameOrId) {
    // Check if position exists by ID
    if (this.positions.has(nameOrId)) {
      return this.positions.get(nameOrId);
    }
    
    // Check if position exists by name
    for (const position of this.positions.values()) {
      if (position.name === nameOrId) {
        return position;
      }
    }
    
    throw new PositionNotFoundError(nameOrId);
  }
  
  /**
   * Delete a saved position
   * 
   * @param {string} nameOrId - Name or ID of the position
   * @returns {boolean} True if deleted, false if not found
   */
  deletePosition(nameOrId) {
    try {
      let positionId = nameOrId;
      
      // Find position by name if not found by ID
      if (!this.positions.has(nameOrId)) {
        for (const position of this.positions.values()) {
          if (position.name === nameOrId) {
            positionId = position.id;
            break;
          }
        }
      }
      
      // Delete position
      if (this.positions.has(positionId)) {
        const position = this.positions.get(positionId);
        this.positions.delete(positionId);
        this.savePositions();
        
        // Emit event
        this.emit('positionDeleted', position);
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error deleting position:', error);
      return false;
    }
  }
  
  /**
   * Start recording a new automation sequence
   * 
   * @param {Object} options - Recording options
   * @param {string} options.name - Name for the sequence
   * @param {string} options.description - Description of the sequence
   * @returns {Object} Recording session info
   * @throws {CursorAutomationError} If recording fails to start
   */
  recordSequence(options = {}) {
    try {
      // Check if already recording
      if (this.recording) {
        throw new Error('Already recording a sequence');
      }
      
      // Create recording session
      this.recording = {
        id: uuidv4(),
        name: options.name || `Sequence_${new Date().toISOString().replace(/[:.]/g, '-')}`,
        description: options.description || '',
        startedAt: new Date().toISOString(),
        actions: [],
        options: { ...options }
      };
      
      // Emit event
      this.emit('recordingStarted', this.recording);
      
      return {
        id: this.recording.id,
        name: this.recording.name,
        startedAt: this.recording.startedAt
      };
    } catch (error) {
      logger.error('Error starting recording:', error);
      throw new CursorAutomationError(`Failed to start recording: ${error.message}`);
    }
  }
  
  /**
   * Stop recording and save the sequence
   * 
   * @returns {Object} Recorded sequence
   * @throws {CursorAutomationError} If not recording or save fails
   */
  stopRecording() {
    try {
      // Check if recording
      if (!this.recording) {
        throw new Error('Not currently recording');
      }
      
      // Update recording
      this.recording.completedAt = new Date().toISOString();
      
      // Save sequence
      const sequencesDir = path.join(this.dataDir, 'sequences');
      
      if (!fs.existsSync(sequencesDir)) {
        fs.mkdirSync(sequencesDir, { recursive: true });
      }
      
      const sequenceFile = path.join(sequencesDir, `${this.recording.id}.json`);
      fs.writeFileSync(sequenceFile, JSON.stringify(this.recording, null, 2));
      
      // Get recorded sequence
      const sequence = { ...this.recording };
      
      // Clear recording
      this.recording = null;
      
      // Emit event
      this.emit('recordingStopped', sequence);
      
      return sequence;
    } catch (error) {
      logger.error('Error stopping recording:', error);
      throw new CursorAutomationError(`Failed to stop recording: ${error.message}`);
    }
  }
  
  /**
   * Play a recorded sequence
   * 
   * @param {string|Object} sequence - Sequence ID, name, or sequence object
   * @param {Object} options - Playback options
   * @param {number} options.speed - Playback speed multiplier (0.5 = half speed, 2 = double speed)
   * @param {boolean} options.ignoreErrors - Continue playback on errors
   * @returns {boolean} True if played successfully
   * @throws {SequenceError} If sequence playback fails
   */
  playSequence(sequence, options = {}) {
    try {
      let sequenceData;
      
      // Get sequence data
      if (typeof sequence === 'string') {
        // Load sequence from file
        const sequencesDir = path.join(this.dataDir, 'sequences');
        const sequenceFile = path.join(sequencesDir, `${sequence}.json`);
        
        // If not found by ID, try to find by name
        if (!fs.existsSync(sequenceFile)) {
          const files = fs.readdirSync(sequencesDir);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const data = JSON.parse(fs.readFileSync(path.join(sequencesDir, file), 'utf8'));
              
              if (data.name === sequence) {
                sequenceData = data;
                break;
              }
            }
          }
          
          if (!sequenceData) {
            throw new Error(`Sequence not found: ${sequence}`);
          }
        } else {
          sequenceData = JSON.parse(fs.readFileSync(sequenceFile, 'utf8'));
        }
      } else if (typeof sequence === 'object') {
        sequenceData = sequence;
      } else {
        throw new Error('Invalid sequence parameter');
      }
      
      // Emit event
      this.emit('sequenceStarted', sequenceData);
      
      // Play sequence
      const speed = options.speed || 1;
      
      for (let i = 0; i < sequenceData.actions.length; i++) {
        const action = sequenceData.actions[i];
        
        try {
          // Calculate delay
          let delay = 0;
          
          if (i < sequenceData.actions.length - 1) {
            delay = (sequenceData.actions[i + 1].timestamp - action.timestamp) / speed;
          }
          
          // Execute action
          switch (action.type) {
            case 'move':
              this.moveTo(action.x, action.y, action.options);
              break;
              
            case 'click':
              if (action.position) {
                this.moveTo(action.position.x, action.position.y);
              }
              this.click(action.button, action.options);
              break;
              
            case 'doubleClick':
              if (action.position) {
                this.moveTo(action.position.x, action.position.y);
              }
              this.doubleClick(action.button, action.options);
              break;
              
            case 'drag':
              this.dragTo(
                action.startX,
                action.startY,
                action.endX,
                action.endY,
                action.options
              );
              break;
              
            case 'type':
              if (action.position) {
                this.moveTo(action.position.x, action.position.y);
              }
              this.typeText(action.text, action.options);
              break;
              
            default:
              logger.warn(`Unknown action type: ${action.type}`);
          }
          
          // Wait before next action
          if (delay > 0) {
            this._sleep(delay);
          }
        } catch (actionError) {
          logger.error(`Error executing action ${i}:`, actionError);
          
          // Emit action error event
          this.emit('actionError', {
            sequence: sequenceData,
            action,
            index: i,
            error: actionError
          });
          
          if (!options.ignoreErrors) {
            throw new SequenceError(
              sequenceData.id,
              `Error at action ${i}: ${actionError.message}`
            );
          }
        }
      }
      
      // Emit sequence completed event
      this.emit('sequenceCompleted', sequenceData);
      
      return true;
    } catch (error) {
      logger.error('Error playing sequence:', error);
      
      // Emit sequence error event
      this.emit('sequenceError', {
        sequence,
        error
      });
      
      if (error instanceof SequenceError) {
        throw error;
      }
      
      throw new SequenceError(
        typeof sequence === 'string' ? sequence : 'unknown',
        `Failed to play sequence: ${error.message}`
      );
    }
  }
  
  /**
   * Get all saved sequences
   * 
   * @returns {Array} Array of sequences
   */
  getAllSequences() {
    try {
      const sequencesDir = path.join(this.dataDir, 'sequences');
      
      if (!fs.existsSync(sequencesDir)) {
        return [];
      }
      
      const files = fs.readdirSync(sequencesDir);
      const sequences = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const sequence = JSON.parse(
              fs.readFileSync(path.join(sequencesDir, file), 'utf8')
            );
            sequences.push(sequence);
          } catch (error) {
            logger.error(`Error reading sequence file ${file}:`, error);
          }
        }
      }
      
      return sequences;
    } catch (error) {
      logger.error('Error getting sequences:', error);
      return [];
    }
  }
  
  /**
   * Delete a saved sequence
   * 
   * @param {string} sequenceId - Sequence ID
   * @returns {boolean} True if deleted, false if not found
   */
  deleteSequence(sequenceId) {
    try {
      const sequencesDir = path.join(this.dataDir, 'sequences');
      const sequenceFile = path.join(sequencesDir, `${sequenceId}.json`);
      
      if (fs.existsSync(sequenceFile)) {
        fs.unlinkSync(sequenceFile);
        
        // Emit event
        this.emit('sequenceDeleted', { id: sequenceId });
        
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error deleting sequence:', error);
      return false;
    }
  }
  
  /**
   * Sleep for a specified duration
   * 
   * @param {number} ms - Duration in milliseconds
   * @private
   */
  _sleep(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      // Busy wait
    }
  }
}

module.exports = CursorAutomationSystem;
