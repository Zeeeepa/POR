/**
 * CursorAutomation class for managing cursor positions and automation
 * Enhanced with additional functionality and error handling
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const robot = require('robotjs');
const logger = require('./logger');

class CursorAutomation extends EventEmitter {
    constructor(options = {}) {
        super();
        this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'cursor-positions');
        this.positions = new Map();
        this.activeCursors = [];
        this.enableMultiCursor = options.enableMultiCursor || false;
        this.maxCursors = options.maxCursors || 1;
        this.cursorSpeed = options.cursorSpeed || 'medium';
        
        // Speed mappings for cursor movement
        this.speedMappings = {
            slow: 10,
            medium: 20,
            fast: 40,
            instant: 0
        };
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        // Load saved positions
        this.loadPositions();
    }
    
    /**
     * Load saved cursor positions
     * @returns {Map} Loaded positions
     */
    loadPositions() {
        try {
            const positionsFile = path.join(this.dataDir, 'positions.json');
            
            if (fs.existsSync(positionsFile)) {
                const positions = JSON.parse(fs.readFileSync(positionsFile, 'utf8'));
                positions.forEach(pos => this.positions.set(pos.id, pos));
                logger.info(`Loaded ${positions.length} cursor positions`);
            } else {
                logger.info('No saved cursor positions found');
            }
            
            return this.positions;
        } catch (error) {
            logger.error('Error loading positions:', error);
            return new Map();
        }
    }
    
    /**
     * Save cursor positions
     * @returns {boolean} Success status
     */
    savePositions() {
        try {
            const positionsFile = path.join(this.dataDir, 'positions.json');
            fs.writeFileSync(positionsFile, JSON.stringify(Array.from(this.positions.values()), null, 2));
            logger.info(`Saved ${this.positions.size} cursor positions`);
            return true;
        } catch (error) {
            logger.error('Error saving positions:', error);
            return false;
        }
    }
    
    /**
     * Get all cursor positions
     * @param {Object} filters - Optional filters
     * @returns {Array} Array of position objects
     */
    getAllPositions(filters = {}) {
        let positions = Array.from(this.positions.values());
        
        // Apply filters if provided
        if (filters.group) {
            positions = positions.filter(p => p.group === filters.group);
        }
        
        if (filters.application) {
            positions = positions.filter(p => p.application === filters.application);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            positions = positions.filter(p => 
                p.name.toLowerCase().includes(searchTerm) || 
                (p.description && p.description.toLowerCase().includes(searchTerm))
            );
        }
        
        return positions;
    }
    
    /**
     * Add a new cursor position
     * @param {Object} position - Position data
     * @returns {Object} - Created position
     */
    addPosition(position) {
        const newPosition = {
            id: uuidv4(),
            name: position.name,
            x: position.x,
            y: position.y,
            description: position.description || '',
            application: position.application || '',
            group: position.group || 'default',
            createdAt: new Date().toISOString()
        };
        
        this.positions.set(newPosition.id, newPosition);
        this.savePositions();
        
        // Emit position added event
        this.emit('positionAdded', newPosition);
        logger.info(`Added cursor position: ${position.name} at (${position.x}, ${position.y})`);
        
        return newPosition;
    }
    
    /**
     * Get a position by ID
     * @param {string} id - Position ID
     * @returns {Object|null} - Position data or null if not found
     */
    getPositionById(id) {
        return this.positions.get(id) || null;
    }
    
    /**
     * Get a position by name
     * @param {string} name - Position name
     * @returns {Object|null} - Position data or null if not found
     */
    getPositionByName(name) {
        return Array.from(this.positions.values()).find(p => p.name === name) || null;
    }
    
    /**
     * Update a position
     * @param {string} id - Position ID
     * @param {Object} updates - Position updates
     * @returns {Object|null} - Updated position or null if not found
     */
    updatePosition(id, updates) {
        const position = this.positions.get(id);
        
        if (!position) {
            logger.warn(`Position not found: ${id}`);
            return null;
        }
        
        const updatedPosition = {
            ...position,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        this.positions.set(id, updatedPosition);
        this.savePositions();
        
        // Emit position updated event
        this.emit('positionUpdated', updatedPosition);
        logger.info(`Updated cursor position: ${position.name}`);
        
        return updatedPosition;
    }
    
    /**
     * Delete a position
     * @param {string} id - Position ID
     * @returns {boolean} - True if deleted, false if not found
     */
    deletePosition(id) {
        const position = this.positions.get(id);
        
        if (!position) {
            logger.warn(`Position not found: ${id}`);
            return false;
        }
        
        this.positions.delete(id);
        this.savePositions();
        
        // Emit position deleted event
        this.emit('positionDeleted', position);
        logger.info(`Deleted cursor position: ${position.name}`);
        
        return true;
    }
    
    /**
     * Save a position with a specific name
     * @param {string} name - Position name
     * @param {Object} coordinates - Position coordinates {x, y}
     * @param {Object} metadata - Additional metadata
     * @returns {Object} - Saved position
     */
    savePosition(name, coordinates, metadata = {}) {
        // Check if position with this name already exists
        const existingPosition = this.getPositionByName(name);
        
        if (existingPosition) {
            // Update existing position
            return this.updatePosition(existingPosition.id, {
                x: coordinates.x,
                y: coordinates.y,
                ...metadata
            });
        } else {
            // Create new position
            return this.addPosition({
                name,
                x: coordinates.x,
                y: coordinates.y,
                ...metadata
            });
        }
    }
    
    /**
     * Capture the current cursor position
     * @param {string} name - Position name
     * @param {Object} metadata - Additional metadata
     * @returns {Object} - Captured position
     */
    captureCurrentPosition(name, metadata = {}) {
        try {
            // Get current mouse position
            const mousePos = robot.getMousePos();
            
            // Save position
            return this.savePosition(name, mousePos, metadata);
        } catch (error) {
            logger.error(`Error capturing cursor position: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Move cursor to a saved position
     * @param {string} positionId - Position ID or name
     * @param {Object} options - Movement options
     * @returns {boolean} - True if moved, false if position not found
     */
    moveCursorToPosition(positionId, options = {}) {
        // Find position by ID or name
        let position = this.getPositionById(positionId);
        if (!position) {
            position = this.getPositionByName(positionId);
        }
        
        if (!position) {
            logger.warn(`Position not found: ${positionId}`);
            return false;
        }
        
        try {
            // Check if we can create another cursor
            if (this.enableMultiCursor && this.activeCursors.length >= this.maxCursors) {
                logger.warn(`Maximum number of cursors (${this.maxCursors}) reached`);
                return false;
            }
            
            // Get movement speed
            const speed = options.speed || this.cursorSpeed;
            const speedValue = this.speedMappings[speed] || this.speedMappings.medium;
            
            // Move cursor
            if (speedValue === 0 || speed === 'instant') {
                // Instant movement
                robot.moveMouse(position.x, position.y);
            } else {
                // Smooth movement
                this._smoothMoveCursor(position.x, position.y, speedValue);
            }
            
            // Add to active cursors if multi-cursor is enabled
            if (this.enableMultiCursor) {
                this.activeCursors.push({
                    id: uuidv4(),
                    position: position,
                    createdAt: new Date().toISOString()
                });
            }
            
            logger.info(`Moved cursor to position: ${position.name} at (${position.x}, ${position.y})`);
            return true;
        } catch (error) {
            logger.error(`Error moving cursor to position ${positionId}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Click at current cursor position
     * @param {string} button - Mouse button ('left', 'right', 'middle')
     * @param {boolean} doubleClick - Whether to double click
     * @returns {boolean} - True if clicked successfully
     */
    clickAtCurrentPosition(button = 'left', doubleClick = false) {
        try {
            if (doubleClick) {
                robot.mouseClick(button);
                this._sleep(100);
                robot.mouseClick(button);
            } else {
                robot.mouseClick(button);
            }
            
            logger.info(`Clicked ${doubleClick ? 'double ' : ''}${button} button at current position`);
            return true;
        } catch (error) {
            logger.error(`Error clicking at current position: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Click at a named position
     * @param {string} positionId - Position ID or name
     * @param {string} button - Mouse button ('left', 'right', 'middle')
     * @param {boolean} doubleClick - Whether to double click
     * @returns {boolean} - True if clicked successfully
     */
    clickAtPosition(positionId, button = 'left', doubleClick = false) {
        // Move cursor to position
        const moved = this.moveCursorToPosition(positionId);
        
        if (!moved) {
            return false;
        }
        
        // Click at position
        return this.clickAtCurrentPosition(button, doubleClick);
    }
    
    /**
     * Type text at current cursor position
     * @param {string} text - Text to type
     * @returns {boolean} - True if typed successfully
     */
    typeAtCurrentPosition(text) {
        try {
            robot.typeString(text);
            logger.info('Typed text at current position');
            return true;
        } catch (error) {
            logger.error(`Error typing at current position: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Send text to a position
     * @param {string} positionId - Position ID or name
     * @param {string} text - Text to send
     * @param {Object} options - Options for sending text
     * @returns {Promise<boolean>} - True if sent successfully
     */
    async sendTextToPosition(positionId, text, options = {}) {
        try {
            // Default options
            const opts = {
                clickBeforeTyping: true,
                clickAfterTyping: false,
                delay: 0,
                ...options
            };
            
            // Move cursor to position
            const moved = this.moveCursorToPosition(positionId);
            
            if (!moved) {
                return false;
            }
            
            // Click to focus if needed
            if (opts.clickBeforeTyping) {
                this.clickAtCurrentPosition();
            }
            
            // Add delay if specified
            if (opts.delay > 0) {
                await this._asyncSleep(opts.delay);
            }
            
            // Type text
            const typed = this.typeAtCurrentPosition(text);
            
            if (!typed) {
                return false;
            }
            
            // Click after typing if needed
            if (opts.clickAfterTyping) {
                this.clickAtCurrentPosition();
            }
            
            logger.info(`Sent text to position: ${positionId}`);
            return true;
        } catch (error) {
            logger.error(`Error sending text to position ${positionId}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Get the current screen size
     * @returns {Object} - Screen size {width, height}
     */
    getScreenSize() {
        return robot.getScreenSize();
    }
    
    /**
     * Check if a position is valid (within screen bounds)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} - True if position is valid
     */
    isValidPosition(x, y) {
        const screenSize = this.getScreenSize();
        return x >= 0 && x < screenSize.width && y >= 0 && y < screenSize.height;
    }
    
    /**
     * Move cursor smoothly to a position
     * @private
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     * @param {number} speed - Movement speed
     */
    _smoothMoveCursor(targetX, targetY, speed) {
        const currentPos = robot.getMousePos();
        const startX = currentPos.x;
        const startY = currentPos.y;
        
        // Calculate distance
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate number of steps based on distance and speed
        const steps = Math.max(Math.floor(distance / speed), 1);
        
        // Move cursor in steps
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = Math.round(startX + dx * t);
            const y = Math.round(startY + dy * t);
            
            robot.moveMouse(x, y);
            
            // Small delay between steps
            if (i < steps) {
                this._sleep(10);
            }
        }
        
        // Ensure final position is exact
        robot.moveMouse(targetX, targetY);
    }
    
    /**
     * Sleep for a specified duration (blocking)
     * @private
     * @param {number} ms - Milliseconds to sleep
     */
    _sleep(ms) {
        const start = Date.now();
        while (Date.now() - start < ms) {
            // Busy wait
        }
    }
    
    /**
     * Sleep for a specified duration (non-blocking)
     * @private
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} - Promise that resolves after the specified time
     */
    _asyncSleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CursorAutomation;
