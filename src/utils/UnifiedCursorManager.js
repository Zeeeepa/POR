/**
 * UnifiedCursorManager.js
 * A unified cursor management system that combines functionality from
 * CursorAutomation and CursorPositionManager into a single, consistent API.
 */
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const robot = require('robotjs');
const logger = require('./logger');

class UnifiedCursorManager extends EventEmitter {
    /**
     * Initialize the Unified Cursor Manager
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        super();
        this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'cursor-positions');
        this.enableMultiCursor = options.enableMultiCursor || false;
        this.maxCursors = options.maxCursors || 1;
        this.cursorSpeed = options.cursorSpeed || 'medium';
        this.showCursorPath = options.showCursorPath || false;
        this.positions = new Map();
        this.activeCursors = [];
        
        // Speed mappings for cursor movement
        this.speedMappings = {
            slow: 10,
            medium: 20,
            fast: 40,
            instant: 0
        };
        
        // Ensure data directory exists
        fs.ensureDirSync(this.dataDir);
        
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
                positions.forEach(pos => this.positions.set(pos.name, pos));
                logger.info(`Loaded ${positions.length} cursor positions`);
            } else {
                logger.info('No saved cursor positions found');
            }
            
            return this.positions;
        } catch (error) {
            logger.error('Error loading cursor positions:', error);
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
            logger.error('Error saving cursor positions:', error);
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
     * Get a position by name
     * @param {string} name - Position name
     * @returns {Object|null} Position object or null if not found
     */
    getPosition(name) {
        return this.positions.get(name) || null;
    }
    
    /**
     * Save a cursor position
     * @param {string} name - Position name
     * @param {Object} coordinates - Position coordinates {x, y}
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Saved position
     */
    savePosition(name, coordinates, metadata = {}) {
        if (!name) {
            throw new Error('Position name is required');
        }
        
        if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number') {
            throw new Error('Valid coordinates (x, y) are required');
        }
        
        const position = {
            id: uuidv4(),
            name,
            x: coordinates.x,
            y: coordinates.y,
            description: metadata.description || '',
            application: metadata.application || '',
            group: metadata.group || 'default',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save to positions map
        this.positions.set(name, position);
        
        // Save to disk
        this.savePositions();
        
        // Emit event
        this.emit('positionSaved', position);
        
        logger.info(`Saved cursor position: ${name} at (${coordinates.x}, ${coordinates.y})`);
        return position;
    }
    
    /**
     * Update an existing position
     * @param {string} name - Position name
     * @param {Object} updates - Position updates
     * @returns {Object|null} Updated position or null if not found
     */
    updatePosition(name, updates) {
        const position = this.positions.get(name);
        
        if (!position) {
            logger.warn(`Position not found: ${name}`);
            return null;
        }
        
        const updatedPosition = {
            ...position,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        // Update in positions map
        this.positions.set(name, updatedPosition);
        
        // Save to disk
        this.savePositions();
        
        // Emit event
        this.emit('positionUpdated', updatedPosition);
        
        logger.info(`Updated cursor position: ${name}`);
        return updatedPosition;
    }
    
    /**
     * Delete a position
     * @param {string} name - Position name
     * @returns {boolean} Success status
     */
    deletePosition(name) {
        if (!this.positions.has(name)) {
            logger.warn(`Position not found: ${name}`);
            return false;
        }
        
        // Get position before deleting
        const position = this.positions.get(name);
        
        // Delete from positions map
        this.positions.delete(name);
        
        // Save to disk
        this.savePositions();
        
        // Emit event
        this.emit('positionDeleted', position);
        
        logger.info(`Deleted cursor position: ${name}`);
        return true;
    }
    
    /**
     * Capture the current cursor position
     * @param {string} name - Position name
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Captured position
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
     * @param {string} name - Position name
     * @param {Object} options - Movement options
     * @returns {boolean} Success status
     */
    moveCursorToPosition(name, options = {}) {
        const position = this.positions.get(name);
        
        if (!position) {
            logger.warn(`Position not found: ${name}`);
            return false;
        }
        
        try {
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
            
            logger.info(`Moved cursor to position: ${name} at (${position.x}, ${position.y})`);
            return true;
        } catch (error) {
            logger.error(`Error moving cursor to position ${name}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Click at the current cursor position
     * @param {string} button - Mouse button (left, right, middle)
     * @param {boolean} doubleClick - Whether to double click
     * @returns {boolean} Success status
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
     * @param {string} name - Position name
     * @param {string} button - Mouse button (left, right, middle)
     * @param {boolean} doubleClick - Whether to double click
     * @returns {boolean} Success status
     */
    clickAtPosition(name, button = 'left', doubleClick = false) {
        // Move cursor to position
        const moved = this.moveCursorToPosition(name);
        
        if (!moved) {
            return false;
        }
        
        // Click at position
        return this.clickAtCurrentPosition(button, doubleClick);
    }
    
    /**
     * Send text to a position
     * @param {string} name - Position name
     * @param {string} text - Text to send
     * @param {Object} options - Options for sending text
     * @returns {Promise<boolean>} Success status
     */
    async sendTextToPosition(name, text, options = {}) {
        try {
            // Default options
            const opts = {
                clickBeforeTyping: true,
                clickAfterTyping: false,
                delay: 0,
                ...options
            };
            
            // Move cursor to position
            const moved = this.moveCursorToPosition(name);
            
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
            robot.typeString(text);
            
            // Click after typing if needed
            if (opts.clickAfterTyping) {
                this.clickAtCurrentPosition();
            }
            
            logger.info(`Sent text to position: ${name}`);
            return true;
        } catch (error) {
            logger.error(`Error sending text to position ${name}: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Import positions from a file
     * @param {string} filePath - Path to import file
     * @param {Object} options - Import options
     * @returns {Object} Import results
     */
    importPositions(filePath, options = {}) {
        try {
            // Read positions from file
            const importedPositions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            const results = {
                imported: [],
                skipped: [],
                errors: []
            };
            
            // Process each position
            for (const pos of importedPositions) {
                try {
                    // Check if position already exists
                    if (this.positions.has(pos.name) && !options.overwrite) {
                        results.skipped.push({
                            name: pos.name,
                            reason: 'Position already exists'
                        });
                        continue;
                    }
                    
                    // Save position
                    const savedPosition = this.savePosition(
                        pos.name,
                        { x: pos.x, y: pos.y },
                        {
                            description: pos.description,
                            application: pos.application,
                            group: pos.group
                        }
                    );
                    
                    results.imported.push(savedPosition);
                } catch (error) {
                    results.errors.push({
                        name: pos.name,
                        error: error.message
                    });
                }
            }
            
            logger.info(`Imported ${results.imported.length} positions, skipped ${results.skipped.length}, errors ${results.errors.length}`);
            return results;
        } catch (error) {
            logger.error(`Error importing positions: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Export positions to a file
     * @param {string} filePath - Path to export file
     * @param {Array} positionNames - Names of positions to export (all if not specified)
     * @returns {boolean} Success status
     */
    exportPositions(filePath, positionNames = null) {
        try {
            let positionsToExport;
            
            if (positionNames) {
                positionsToExport = positionNames
                    .map(name => this.positions.get(name))
                    .filter(Boolean);
            } else {
                positionsToExport = Array.from(this.positions.values());
            }
            
            fs.writeFileSync(filePath, JSON.stringify(positionsToExport, null, 2));
            
            logger.info(`Exported ${positionsToExport.length} positions to ${filePath}`);
            return true;
        } catch (error) {
            logger.error(`Error exporting positions: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Get the current screen size
     * @returns {Object} Screen size {width, height}
     */
    getScreenSize() {
        return robot.getScreenSize();
    }
    
    /**
     * Check if a position is valid (within screen bounds)
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {boolean} Whether the position is valid
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
     * Sleep for a specified number of milliseconds (blocking)
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
     * Sleep for a specified number of milliseconds (non-blocking)
     * @private
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after the specified time
     */
    _asyncSleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = UnifiedCursorManager;
