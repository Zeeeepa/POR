cat > src/models/CursorPositionManager.js << 'EOL'
/**
 * Enhanced Cursor Position Manager
 * Manages named cursor positions for automated workflows
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const robot = require('robotjs');
class CursorPositionManager {
    /**
     * Initialize the Cursor Position Manager
     * @param {Object} options - Configuration options
     * @param {string} options.positionsDir - Directory to store cursor positions
     * @param {boolean} options.enableMultiCursor - Whether to enable multi-cursor support
     * @param {number} options.maxCursors - Maximum number of concurrent cursors
     * @param {string} options.cursorSpeed - Speed of cursor movement (slow, medium, fast, instant)
     * @param {boolean} options.showCursorPath - Whether to show cursor movement path
     */
    constructor(options = {}) {
        this.positionsDir = options.positionsDir || path.join(process.cwd(), 'data', 'cursor-positions');
        this.enableMultiCursor = options.enableMultiCursor || false;
        this.maxCursors = options.maxCursors || 1;
        this.cursorSpeed = options.cursorSpeed || 'medium';
        this.showCursorPath = options.showCursorPath || false;
        this.positions = [];
        this.activeCursors = [];
        
        // Ensure positions directory exists
        if (!fs.existsSync(this.positionsDir)) {
            fs.mkdirSync(this.positionsDir, { recursive: true });
        }
        
        // Initialize positions
        this.loadPositions();
        
        // Set up speed mappings
        this.speedMappings = {
            slow: 10,
            medium: 20,
            fast: 40,
            instant: 0
        };
    }
    
    /**
     * Load all cursor positions from the positions directory
     */
    loadPositions() {
        try {
            const files = fs.readdirSync(this.positionsDir);
            this.positions = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const positionPath = path.join(this.positionsDir, file);
                    const positionData = JSON.parse(fs.readFileSync(positionPath, 'utf8'));
                    this.positions.push(positionData);
                }
            }
            
            // Sort positions by name
            this.positions.sort((a, b) => a.name.localeCompare(b.name));
            
            return this.positions;
        } catch (error) {
            console.error('Error loading cursor positions:', error);
            return [];
        }
    }
    
    /**
     * Get all cursor positions
     * @param {Object} filters - Optional filters to apply
     * @returns {Array} - Array of cursor positions
     */
    getPositions(filters = {}) {
        let filteredPositions = [...this.positions];
        
        // Apply filters
        if (filters.group) {
            filteredPositions = filteredPositions.filter(p => p.group === filters.group);
        }
        
        if (filters.application) {
            filteredPositions = filteredPositions.filter(p => p.application === filters.application);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredPositions = filteredPositions.filter(p => 
                p.name.toLowerCase().includes(searchTerm) || 
                (p.description && p.description.toLowerCase().includes(searchTerm))
            );
        }
        
        return filteredPositions;
    }
    
    /**
     * Get a cursor position by ID
     * @param {string} id - Position ID
     * @returns {Object|null} - Position object or null if not found
     */
    getPositionById(id) {
        return this.positions.find(p => p.id === id) || null;
    }
    
    /**
     * Get a cursor position by name
     * @param {string} name - Position name
     * @returns {Object|null} - Position object or null if not found
     */
    getPositionByName(name) {
        return this.positions.find(p => p.name === name) || null;
    }
    
    /**
     * Create a new cursor position
     * @param {Object} positionData - Position data
     * @returns {Object} - Created position
     */
    createPosition(positionData) {
        const newPosition = {
            id: positionData.id || uuidv4(),
            name: positionData.name,
            description: positionData.description || '',
            x: positionData.x,
            y: positionData.y,
            application: positionData.application || '',
            group: positionData.group || 'default',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Save position to file
        const positionPath = path.join(this.positionsDir, `${newPosition.id}.json`);
        fs.writeFileSync(positionPath, JSON.stringify(newPosition, null, 2));
        
        // Add to positions array
        this.positions.push(newPosition);
        
        return newPosition;
    }
    
    /**
     * Update an existing cursor position
     * @param {string} id - Position ID
     * @param {Object} positionData - Updated position data
     * @returns {Object|null} - Updated position or null if not found
     */
    updatePosition(id, positionData) {
        const positionIndex = this.positions.findIndex(p => p.id === id);
        
        if (positionIndex === -1) {
            return null;
        }
        
        const existingPosition = this.positions[positionIndex];
        
        // Update position
        const updatedPosition = {
            ...existingPosition,
            name: positionData.name || existingPosition.name,
            description: positionData.description !== undefined ? positionData.description : existingPosition.description,
            x: positionData.x !== undefined ? positionData.x : existingPosition.x,
            y: positionData.y !== undefined ? positionData.y : existingPosition.y,
            application: positionData.application !== undefined ? positionData.application : existingPosition.application,
            group: positionData.group || existingPosition.group,
            updatedAt: new Date().toISOString()
        };
        
        // Save updated position
        const positionPath = path.join(this.positionsDir, `${id}.json`);
        fs.writeFileSync(positionPath, JSON.stringify(updatedPosition, null, 2));
        
        // Update positions array
        this.positions[positionIndex] = updatedPosition;
        
        return updatedPosition;
    }
    
    /**
     * Delete a cursor position
     * @param {string} id - Position ID
     * @returns {boolean} - True if deleted, false if not found
     */
    deletePosition(id) {
        const positionIndex = this.positions.findIndex(p => p.id === id);
        
        if (positionIndex === -1) {
            return false;
        }
        
        // Remove position file
        const positionPath = path.join(this.positionsDir, `${id}.json`);
        fs.unlinkSync(positionPath);
        
        // Remove from positions array
        this.positions.splice(positionIndex, 1);
        
        return true;
    }
    
    /**
     * Capture the current cursor position
     * @param {string} name - Name for the new position
     * @param {Object} options - Additional options
     * @returns {Object} - Created position
     */
    captureCurrentPosition(name, options = {}) {
        // Get current mouse position
        const mousePos = robot.getMousePos();
        
        // Create new position
        return this.createPosition({
            name: name,
            description: options.description || '',
            x: mousePos.x,
            y: mousePos.y,
            application: options.application || '',
            group: options.group || 'default'
        });
    }
    
    /**
     * Move cursor to a named position
     * @param {string} positionId - Position ID or name
     * @param {Object} options - Movement options
     * @returns {boolean} - True if moved successfully
     */
    moveCursorToPosition(positionId, options = {}) {
        // Find position by ID or name
        let position = this.getPositionById(positionId);
        if (!position) {
            position = this.getPositionByName(positionId);
        }
        
        if (!position) {
            return false;
        }
        
        // Check if we can create another cursor
        if (this.enableMultiCursor && this.activeCursors.length >= this.maxCursors) {
            console.warn(`Maximum number of cursors (${this.maxCursors}) reached`);
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
            this._smoothMoveCursor(position.x, position.y, speedValue, options.callback);
        }
        
        // Add to active cursors if multi-cursor is enabled
        if (this.enableMultiCursor) {
            this.activeCursors.push({
                id: uuidv4(),
                position: position,
                createdAt: new Date().toISOString()
            });
        }
        
        return true;
    }
    
    /**
     * Move cursor smoothly to a position
     * @private
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     * @param {number} speed - Movement speed
     * @param {Function} callback - Optional callback after movement
     */
    _smoothMoveCursor(targetX, targetY, speed, callback) {
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
            
            // Show cursor path if enabled
            if (this.showCursorPath) {
                // Implementation would depend on the UI framework
                // This is a placeholder for the actual implementation
                this._showCursorPathPoint(x, y);
            }
            
            // Small delay between steps
            if (i < steps) {
                this._sleep(10);
            }
        }
        
        // Ensure final position is exact
        robot.moveMouse(targetX, targetY);
        
        // Call callback if provided
        if (typeof callback === 'function') {
            callback();
        }
    }
    
    /**
     * Show a point on the cursor path
     * @private
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    _showCursorPathPoint(x, y) {
        // This is a placeholder for the actual implementation
        // The implementation would depend on the UI framework
        console.log(`Cursor path point: (${x}, ${y})`);
    }
    
    /**
     * Sleep for a specified number of milliseconds
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
     * Click at the current cursor position
     * @param {string} button - Mouse button to click (left, right, middle)
     * @param {boolean} doubleClick - Whether to perform a double click
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
            return true;
        } catch (error) {
            console.error('Error clicking at current position:', error);
            return false;
        }
    }
    
    /**
     * Click at a named position
     * @param {string} positionId - Position ID or name
     * @param {string} button - Mouse button to click (left, right, middle)
     * @param {boolean} doubleClick - Whether to perform a double click
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
     * Type text at the current cursor position
     * @param {string} text - Text to type
     * @returns {boolean} - True if typed successfully
     */
    typeAtCurrentPosition(text) {
        try {
            robot.typeString(text);
            return true;
        } catch (error) {
            console.error('Error typing at current position:', error);
            return false;
        }
    }
    
    /**
     * Type text at a named position
     * @param {string} positionId - Position ID or name
     * @param {string} text - Text to type
     * @returns {boolean} - True if typed successfully
     */
    typeAtPosition(positionId, text) {
        // Move cursor to position
        const moved = this.moveCursorToPosition(positionId);
        
        if (!moved) {
            return false;
        }
        
        // Click to focus
        this.clickAtCurrentPosition();
        
        // Type text
        return this.typeAtCurrentPosition(text);
    }
    
    /**
     * Import cursor positions from a file or data
     * @param {Array|Object} data - Position data to import
     * @param {Object} options - Import options
     * @returns {Object} - Import results
     */
    importPositions(data, options = {}) {
        const positions = Array.isArray(data) ? data : [data];
        const results = {
            imported: [],
            skipped: [],
            errors: []
        };
        
        for (const position of positions) {
            try {
                // Check if position with same name exists
                const existingPosition = this.getPositionByName(position.name);
                
                if (existingPosition && !options.overwrite) {
                    results.skipped.push({
                        name: position.name,
                        reason: 'Position with same name already exists'
                    });
                    continue;
                }
                
                if (existingPosition && options.overwrite) {
                    // Update existing position
                    const updated = this.updatePosition(existingPosition.id, position);
                    if (updated) {
                        results.imported.push(updated);
                    } else {
                        results.errors.push({
                            name: position.name,
                            error: 'Failed to update existing position'
                        });
                    }
                } else {
                    // Create new position
                    const newPosition = this.createPosition({
                        ...position,
                        id: options.keepId && position.id ? position.id : undefined
                    });
                    results.imported.push(newPosition);
                }
            } catch (error) {
                results.errors.push({
                    name: position.name || 'Unknown',
                    error: error.message
                });
            }
        }
        
        return results;
    }
    
    /**
     * Export cursor positions to a file
     * @param {Array} positionIds - Array of position IDs to export
     * @param {string} outputPath - Path to save the exported positions
     * @returns {boolean} - True if export successful
     */
    exportPositions(positionIds, outputPath) {
        try {
            const positionsToExport = positionIds
                ? this.positions.filter(p => positionIds.includes(p.id))
                : this.positions;
            
            fs.writeFileSync(outputPath, JSON.stringify(positionsToExport, null, 2));
            return true;
        } catch (error) {
            console.error('Error exporting cursor positions:', error);
            return false;
        }
    }
    
    /**
     * Get all active cursors
     * @returns {Array} - Array of active cursors
     */
    getActiveCursors() {
        return this.activeCursors;
    }
    
    /**
     * Remove an active cursor
     * @param {string} cursorId - Cursor ID
     * @returns {boolean} - True if removed successfully
     */
    removeActiveCursor(cursorId) {
        const cursorIndex = this.activeCursors.findIndex(c => c.id === cursorId);
        
        if (cursorIndex === -1) {
            return false;
        }
        
        // Remove from active cursors
        this.activeCursors.splice(cursorIndex, 1);
        
        return true;
    }
    
    /**
     * Clear all active cursors
     */
    clearActiveCursors() {
        this.activeCursors = [];
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
     * Get positions for a specific application
     * @param {string} applicationName - Application name
     * @returns {Array} - Array of positions for the application
     */
    getPositionsForApplication(applicationName) {
        return this.positions.filter(p => p.application === applicationName);
    }
    
    /**
     * Get positions for a specific group
     * @param {string} groupName - Group name
     * @returns {Array} - Array of positions for the group
     */
    getPositionsForGroup(groupName) {
        return this.positions.filter(p => p.group === groupName);
    }
}
module.exports = CursorPositionManager;
EOL