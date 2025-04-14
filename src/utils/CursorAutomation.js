/**
 * CursorAutomation.js
 * Handles cursor automation for text input at specific positions
 */

const robotjs = require('robotjs');
const logger = require('./logger');

class CursorAutomation {
  constructor() {
    this.positions = {};
    this.defaultDelay = 10; // ms between keystrokes
  }

  /**
   * Capture the current cursor position
   * @param {string} name - Name for this position
   * @returns {Object} Position object
   */
  captureCurrentPosition(name) {
    try {
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
      logger.error(`Failed to capture cursor position: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get a saved position by name
   * @param {string} name - Position name
   * @returns {Object|null} Position object or null if not found
   */
  getPosition(name) {
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
   */
  moveToPosition(positionName) {
    try {
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
      return false;
    }
  }
  
  /**
   * Click at a saved position
   * @param {string} positionName - Position name
   * @param {string} button - Mouse button ('left', 'right', 'middle')
   * @param {boolean} doubleClick - Whether to double click
   * @returns {boolean} Success status
   */
  clickAtPosition(positionName, button = 'left', doubleClick = false) {
    try {
      // Move to position
      if (!this.moveToPosition(positionName)) {
        return false;
      }
      
      // Click
      robotjs.mouseClick(button, doubleClick);
      
      logger.info(`Clicked at position "${positionName}" (button: ${button}, double: ${doubleClick})`);
      return true;
    } catch (error) {
      logger.error(`Failed to click at position: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Type text at the current cursor position
   * @param {string} text - Text to type
   * @param {number} delay - Delay between keystrokes in ms
   * @returns {boolean} Success status
   */
  typeText(text, delay = this.defaultDelay) {
    try {
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
      return false;
    }
  }
  
  /**
   * Send text to a specific position
   * @param {string} positionName - Position name
   * @param {string} text - Text to send
   * @param {number} delay - Delay between keystrokes in ms
   * @returns {Promise<boolean>} Success status
   */
  async sendTextToPosition(positionName, text, delay = this.defaultDelay) {
    try {
      // Click at position
      if (!this.clickAtPosition(positionName)) {
        return false;
      }
      
      // Type text
      if (!this.typeText(text, delay)) {
        return false;
      }
      
      logger.info(`Sent text to position "${positionName}" (${text.length} characters)`);
      return true;
    } catch (error) {
      logger.error(`Failed to send text to position: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Press a key combination
   * @param {Array<string>} keys - Array of keys to press
   * @returns {boolean} Success status
   */
  pressKeys(keys) {
    try {
      // Press keys
      robotjs.keyTap(keys[0], keys.slice(1));
      
      logger.info(`Pressed keys: ${keys.join('+')}`);
      return true;
    } catch (error) {
      logger.error(`Failed to press keys: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Clear a text field at a position
   * @param {string} positionName - Position name
   * @returns {boolean} Success status
   */
  clearTextField(positionName) {
    try {
      // Click at position
      if (!this.clickAtPosition(positionName)) {
        return false;
      }
      
      // Select all text (Ctrl+A)
      robotjs.keyTap('a', ['control']);
      
      // Delete selected text
      robotjs.keyTap('delete');
      
      logger.info(`Cleared text field at position "${positionName}"`);
      return true;
    } catch (error) {
      logger.error(`Failed to clear text field: ${error.message}`);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new CursorAutomation();
