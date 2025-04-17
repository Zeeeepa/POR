/**
 * CursorAutomation class for managing cursor positions and automation
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const robot = require('robotjs');

class CursorAutomation extends EventEmitter {
    constructor(options = {}) {
        super();
        this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'cursor-positions');
        this.positions = new Map();
        this.activeCursors = [];
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        // Load saved positions
        this.loadPositions();
    }
    
    /**
     * Load saved cursor positions
     */
    loadPositions() {
        try {
            const positionsFile = path.join(this.dataDir, 'positions.json');
            
            if (fs.existsSync(positionsFile)) {
                const positions = JSON.parse(fs.readFileSync(positionsFile, 'utf8'));
                positions.forEach(pos => this.positions.set(pos.id, pos));
            }
        } catch (error) {
            console.error('Error loading positions:', error);
        }
    }
    
    /**
     * Save cursor positions
     */
    savePositions() {
        try {
            const positionsFile = path.join(this.dataDir, 'positions.json');
            fs.writeFileSync(positionsFile, JSON.stringify(Array.from(this.positions.values()), null, 2));
        } catch (error) {
            console.error('Error saving positions:', error);
        }
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
     * Update a position
     * @param {string} id - Position ID
     * @param {Object} updates - Position updates
     * @returns {Object|null} - Updated position or null if not found
     */
    updatePosition(id, updates) {
        const position = this.positions.get(id);
        
        if (!position) {
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
            return false;
        }
        
        this.positions.delete(id);
        this.savePositions();
        
        // Emit position deleted event
        this.emit('positionDeleted', position);
        
        return true;
    }
    
    /**
     * Move cursor to a saved position
     * @param {string} positionId - Position ID
     * @returns {boolean} - True if moved, false if position not found
     */
    moveCursorToPosition(positionId) {
        const position = this.positions.get(positionId);
        
        if (!position) {
            return false;
        }
        
        robot.moveMouse(position.x, position.y);
        return true;
    }
    
    /**
     * Click at current cursor position
     * @param {string} button - Mouse button ('left', 'right', 'middle')
     * @param {boolean} doubleClick - Whether to double click
     */
    clickAtCurrentPosition(button = 'left', doubleClick = false) {
        robot.mouseClick(button, doubleClick);
    }
    
    /**
     * Type text at current cursor position
     * @param {string} text - Text to type
     */
    typeAtCurrentPosition(text) {
        robot.typeString(text);
    }
    
    /**
     * Sleep for a specified duration
     * @param {number} ms - Milliseconds to sleep
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CursorAutomation;
