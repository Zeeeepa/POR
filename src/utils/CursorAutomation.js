/**
 * CursorAutomation.js
 * Handles cursor position capture and text input automation for external chat interfaces
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const robot = require('robotjs');
const logger = require('./logger');

class CursorAutomation {
  constructor() {
    this.configDir = path.join(process.cwd(), 'config');
    this.cursorConfigPath = path.join(this.configDir, 'cursor_positions.json');
    this.inputPositions = {};
    this.loadPositions();
  }

  /**
   * Load saved cursor positions from config
   */
  loadPositions() {
    try {
      if (fs.existsSync(this.cursorConfigPath)) {
        this.inputPositions = fs.readJsonSync(this.cursorConfigPath);
        logger.info(`Loaded ${Object.keys(this.inputPositions).length} cursor positions`);
      } else {
        logger.info('No cursor positions found, creating new config');
        fs.ensureDirSync(this.configDir);
        fs.writeJsonSync(this.cursorConfigPath, {}, { spaces: 2 });
      }
    } catch (error) {
      logger.error(`Failed to load cursor positions: ${error.message}`);
      this.inputPositions = {};
    }
  }

  /**
   * Save cursor positions to config
   */
  savePositions() {
    try {
      fs.writeJsonSync(this.cursorConfigPath, this.inputPositions, { spaces: 2 });
      logger.info(`Saved ${Object.keys(this.inputPositions).length} cursor positions`);
      return true;
    } catch (error) {
      logger.error(`Failed to save cursor positions: ${error.message}`);
      return false;
    }
  }

  /**
   * Capture current cursor position
   * @param {string} name - Name for this input position
   * @returns {Object} Position data
   */
  captureCurrentPosition(name) {
    try {
      // Get current mouse position
      const mousePos = robot.getMousePos();
      
      // Save position with name
      this.inputPositions[name] = {
        x: mousePos.x,
        y: mousePos.y,
        capturedAt: new Date().toISOString()
      };
      
      this.savePositions();
      logger.info(`Captured position for ${name}: (${mousePos.x}, ${mousePos.y})`);
      
      return this.inputPositions[name];
    } catch (error) {
      logger.error(`Failed to capture cursor position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send text to specified input position
   * @param {string} positionName - Name of the input position
   * @param {string} text - Text to send
   * @returns {Promise<boolean>} Success status
   */
  async sendTextToPosition(positionName, text) {
    try {
      // Check if position exists
      if (!this.inputPositions[positionName]) {
        throw new Error(`Position '${positionName}' not found`);
      }
      
      const position = this.inputPositions[positionName];
      
      // Move mouse to position
      robot.moveMouse(position.x, position.y);
      
      // Click at position
      robot.mouseClick();
      
      // Small delay to ensure focus
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Type or paste text
      if (text.length > 50) {
        // For longer text, use clipboard (faster and more reliable)
        await this.pasteTextViaClipboard(text);
      } else {
        // For short text, type directly
        robot.typeString(text);
      }
      
      logger.info(`Sent text to position ${positionName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send text to position: ${error.message}`);
      return false;
    }
  }

  /**
   * Paste text via clipboard (for longer texts)
   * @param {string} text - Text to paste
   * @returns {Promise<void>}
   */
  async pasteTextViaClipboard(text) {
    // Platform-specific clipboard handling
    if (process.platform === 'win32') {
      // Windows - use PowerShell to set clipboard
      const escapedText = text.replace(/"/g, '`"').replace(/\$/g, '`$');
      await execAsync(`powershell -command "Set-Clipboard -Value '${escapedText}'"`, { shell: true });
    } else if (process.platform === 'darwin') {
      // macOS - use pbcopy
      const { exec } = require('child_process');
      const proc = exec('pbcopy');
      proc.stdin.write(text);
      proc.stdin.end();
      await new Promise(resolve => proc.on('close', resolve));
    } else {
      // Linux - use xclip if available
      try {
        const { exec } = require('child_process');
        const proc = exec('xclip -selection clipboard');
        proc.stdin.write(text);
        proc.stdin.end();
        await new Promise(resolve => proc.on('close', resolve));
      } catch (error) {
        logger.error('Failed to use xclip, falling back to typing');
        robot.typeString(text);
        return;
      }
    }
    
    // Small delay to ensure clipboard is set
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Paste with keyboard shortcut
    if (process.platform === 'darwin') {
      robot.keyTap('v', 'command');
    } else {
      robot.keyTap('v', 'control');
    }
    
    // Wait for paste to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Get all saved input positions
   * @returns {Object} All position data
   */
  getAllPositions() {
    return { ...this.inputPositions };
  }

  /**
   * Remove a saved position
   * @param {string} name - Name of position to remove
   * @returns {boolean} Success status
   */
  removePosition(name) {
    if (this.inputPositions[name]) {
      delete this.inputPositions[name];
      this.savePositions();
      logger.info(`Removed position ${name}`);
      return true;
    }
    return false;
  }
}

module.exports = new CursorAutomation(); 