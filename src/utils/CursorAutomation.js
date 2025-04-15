/**
 * CursorAutomation.js
 * Handles cursor automation for text input at specific positions
 */

const robotjs = require('robotjs');
const logger = require('./logger');
const config = require('./config');
const fs = require('fs-extra');
const path = require('path');

class CursorAutomation {
  /**
   * Initialize the CursorAutomation instance
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.defaultDelay=10] - Default delay between keystrokes in ms
   */
  constructor(options = {}) {
    this.positions = {};
    this.defaultDelay = options.defaultDelay || 10; // ms between keystrokes
    this.positionsFile = path.join(process.cwd(), 'cursor_positions.json');
    
    // Load saved positions
    this.loadPositions();
  }

  /**
   * Load saved positions from file
   * @returns {Object} Loaded positions
   */
  loadPositions() {
    try {
      if (fs.existsSync(this.positionsFile)) {
        const data = fs.readFileSync(this.positionsFile, 'utf8');
        this.positions = JSON.parse(data);
        logger.info(`Loaded ${Object.keys(this.positions).length} cursor positions`);
      } else {
        logger.info('No saved cursor positions found');
        this.positions = {};
      }
      return this.positions;
    } catch (error) {
      logger.error(`Failed to load cursor positions: ${error.message}`);
      this.positions = {};
      return {};
    }
  }
  
  /**
   * Save positions to file
   * @returns {boolean} Success status
   */
  savePositionsToFile() {
    try {
      fs.writeFileSync(this.positionsFile, JSON.stringify(this.positions, null, 2));
      logger.info(`Saved ${Object.keys(this.positions).length} cursor positions`);
      return true;
    } catch (error) {
      logger.error(`Failed to save cursor positions: ${error.message}`);
      return false;
    }
  }

  /**
   * Save a cursor position
   * @param {string} name - Name for this position
   * @param {Object} position - Position object with x and y coordinates
   * @returns {Object} Saved position
   * @throws {Error} If name or position is invalid
   */
  savePosition(name, position) {
    try {
      if (!name || typeof name !== 'string') {
        throw new Error('Position name must be a non-empty string');
      }
      
      if (!position || typeof position !== 'object' || 
          typeof position.x !== 'number' || typeof position.y !== 'number') {
        throw new Error('Position must be an object with numeric x and y coordinates');
      }
      
      const savedPosition = {
        name,
        x: position.x,
        y: position.y,
        capturedAt: new Date().toISOString()
      };
      
      // Save position
      this.positions[name] = savedPosition;
      
      // Save to file
      this.savePositionsToFile();
      
      logger.info(`Saved cursor position "${name}" at x:${position.x}, y:${position.y}`);
      return savedPosition;
    } catch (error) {
      logger.error(`Failed to save cursor position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Capture the current cursor position
   * @param {string} name - Name for this position
   * @returns {Object} Position object
   * @throws {Error} If name is invalid or position capture fails
   */
  captureCurrentPosition(name) {
    try {
      if (!name || typeof name !== 'string') {
        throw new Error('Position name must be a non-empty string');
      }
      
      const mouse = robotjs.getMousePos();
      
      // Save position
      return this.savePosition(name, { x: mouse.x, y: mouse.y });
    } catch (error) {
      logger.error(`Failed to capture cursor position: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get a saved position by name
   * @param {string} name - Position name
   * @returns {Object|null} Position object or null if not found
   * @throws {Error} If name is invalid
   */
  getPosition(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Position name must be a non-empty string');
    }
    
    return this.positions[name] || null;
  }
  
  /**
   * Get all saved positions
   * @returns {Object} All positions
   */
  getAllPositions() {
    return { ...this.positions };
  }
  
  /**
   * Move cursor to a saved position
   * @param {string} positionName - Position name
   * @returns {boolean} Success status
   * @throws {Error} If position name is invalid or position not found
   */
  moveToPosition(positionName) {
    try {
      if (!positionName || typeof positionName !== 'string') {
        throw new Error('Position name must be a non-empty string');
      }
      
      const position = this.getPosition(positionName);
      
      if (!position) {
        throw new Error(`Position not found: ${positionName}`);
      }
      
      // Move mouse to position
      robotjs.moveMouse(position.x, position.y);
      
      logger.info(`Moved cursor to position "${positionName}" (x:${position.x}, y:${position.y})`);
      return true;
    } catch (error) {
      logger.error(`Failed to move to position: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Click at a saved position
   * @param {string} positionName - Position name
   * @param {string} [button='left'] - Mouse button ('left', 'right', 'middle')
   * @param {boolean} [doubleClick=false] - Whether to double click
   * @returns {boolean} Success status
   * @throws {Error} If parameters are invalid or operation fails
   */
  clickAtPosition(positionName, button = 'left', doubleClick = false) {
    try {
      if (!positionName || typeof positionName !== 'string') {
        throw new Error('Position name must be a non-empty string');
      }
      
      if (button !== 'left' && button !== 'right' && button !== 'middle') {
        throw new Error('Button must be "left", "right", or "middle"');
      }
      
      // Move to position
      this.moveToPosition(positionName);
      
      // Click
      robotjs.mouseClick(button, doubleClick);
      
      logger.info(`Clicked at position "${positionName}" (button: ${button}, double: ${doubleClick})`);
      return true;
    } catch (error) {
      logger.error(`Failed to click at position: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Type text at the current cursor position
   * @param {string} text - Text to type
   * @param {number} [delay] - Delay between keystrokes in ms
   * @returns {boolean} Success status
   * @throws {Error} If text is invalid or typing fails
   */
  typeText(text, delay = this.defaultDelay) {
    try {
      if (typeof text !== 'string') {
        throw new Error('Text must be a string');
      }
      
      if (typeof delay !== 'number' || delay < 0) {
        throw new Error('Delay must be a non-negative number');
      }
      
      // Type text with delay between keystrokes
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        robotjs.typeString(char);
        
        if (delay > 0 && i < text.length - 1) {
          robotjs.setKeyboardDelay(delay);
        }
      }
      
      logger.info(`Typed text (${text.length} characters)`);
      return true;
    } catch (error) {
      logger.error(`Failed to type text: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Send text to a specific position
   * @param {string} positionName - Position name
   * @param {string} text - Text to send
   * @param {number} [delay] - Delay between keystrokes in ms
   * @returns {Promise<boolean>} Success status
   * @throws {Error} If parameters are invalid or operation fails
   */
  async sendTextToPosition(positionName, text, delay = this.defaultDelay) {
    try {
      if (!positionName || typeof positionName !== 'string') {
        throw new Error('Position name must be a non-empty string');
      }
      
      if (typeof text !== 'string') {
        throw new Error('Text must be a string');
      }
      
      // Click at position
      this.clickAtPosition(positionName);
      
      // Type text
      this.typeText(text, delay);
      
      logger.info(`Sent text to position "${positionName}" (${text.length} characters)`);
      return true;
    } catch (error) {
      logger.error(`Failed to send text to position: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Press a key combination
   * @param {Array<string>} keys - Array of keys to press
   * @returns {boolean} Success status
   * @throws {Error} If keys are invalid or operation fails
   */
  pressKeys(keys) {
    try {
      if (!Array.isArray(keys) || keys.length === 0) {
        throw new Error('Keys must be a non-empty array of strings');
      }
      
      // Press keys
      robotjs.keyTap(keys[0], keys.slice(1));
      
      logger.info(`Pressed keys: ${keys.join('+')}`);
      return true;
    } catch (error) {
      logger.error(`Failed to press keys: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clear a text field at a position
   * @param {string} positionName - Position name
   * @returns {boolean} Success status
   * @throws {Error} If position name is invalid or operation fails
   */
  clearTextField(positionName) {
    try {
      if (!positionName || typeof positionName !== 'string') {
        throw new Error('Position name must be a non-empty string');
      }
      
      // Click at position
      this.clickAtPosition(positionName);
      
      // Select all text (Ctrl+A)
      robotjs.keyTap('a', ['control']);
      
      // Delete selected text
      robotjs.keyTap('delete');
      
      logger.info(`Cleared text field at position "${positionName}"`);
      return true;
    } catch (error) {
      logger.error(`Failed to clear text field: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new CursorAutomation();
