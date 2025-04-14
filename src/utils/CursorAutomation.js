/**
 * CursorAutomation.js
 * Handles cursor automation for text input at specific positions
 */

const robotjs = require('robotjs');
const logger = require('./logger');
const config = require('./config');

class CursorAutomation {
  /**
   * Initialize the CursorAutomation instance
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.defaultDelay=10] - Default delay between keystrokes in ms
   */
  constructor(options = {}) {
    this.positions = {};
    this.defaultDelay = options.defaultDelay || 10; // ms between keystrokes
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
      
      const position = {
        name,
        x: mouse.x,
        y: mouse.y,
        capturedAt: new Date().toISOString()
      };
      
      // Save position
      this.positions[name] = position;
      
      logger.info(`Captured cursor position "${name}" at x:${mouse.x}, y:${mouse.y}`);
      return position;
    } catch (error) {
      logger.logError('Failed to capture cursor position', error);
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
      logger.logError('Failed to move to position', error);
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
      logger.logError('Failed to click at position', error);
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
      logger.logError('Failed to type text', error);
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
      logger.logError('Failed to send text to position', error);
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
      logger.logError('Failed to press keys', error);
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
      logger.logError('Failed to clear text field', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new CursorAutomation();
