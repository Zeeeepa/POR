/**
 * Enhanced CursorAutomation class for managing cursor positions and automation
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
        this.activeCursors = new Map(); // Map of project ID to cursor positions
        this.isCapturing = false;
        this.captureCallback = null;
        
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        
        // Load saved positions
        this.loadPositions();
        
        // Initialize mouse position listener
        this._initMouseListener();
    }
    
    /**
     * Initialize mouse position listener for coordinate capture
     * @private
     */
    _initMouseListener() {
        // Listen for mouse clicks when in capture mode
        process.on('mouseclick', (event) => {
            if (this.isCapturing && this.captureCallback) {
                const mousePos = robot.getMousePos();
                this.captureCallback({
                    x: mousePos.x,
                    y: mousePos.y,
                    timestamp: new Date().toISOString()
                });
                this.isCapturing = false;
                this.captureCallback = null;
            }
        });
    }
    
    /**
     * Start capturing mouse coordinates
     * @param {Function} callback - Callback to handle captured coordinates
     */
    startCapture(callback) {
        if (this.isCapturing) {
            throw new Error('Already capturing mouse position');
        }
        this.isCapturing = true;
        this.captureCallback = callback;
    }
    
    /**
     * Cancel ongoing coordinate capture
     */
    cancelCapture() {
        this.isCapturing = false;
        this.captureCallback = null;
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
     * Add a new cursor position with project context
     * @param {Object} position - Position data
     * @param {string} projectId - Project identifier
     * @returns {Object} - Created position
     */
    addPosition(position, projectId) {
        const newPosition = {
            id: uuidv4(),
            name: position.name,
            x: position.x,
            y: position.y,
            description: position.description || '',
            application: position.application || '',
            group: position.group || 'default',
            projectId,
            createdAt: new Date().toISOString(),
            type: position.type || 'input', // 'input', 'button', etc.
            validationRules: position.validationRules || [], // Rules for validating the position
            retrySettings: {
                maxAttempts: position.retrySettings?.maxAttempts || 3,
                delayBetweenAttempts: position.retrySettings?.delayBetweenAttempts || 1000
            }
        };
        
        this.positions.set(newPosition.id, newPosition);
        
        // Add to active cursors for the project
        if (projectId) {
            if (!this.activeCursors.has(projectId)) {
                this.activeCursors.set(projectId, new Set());
            }
            this.activeCursors.get(projectId).add(newPosition.id);
        }
        
        this.savePositions();
        this.emit('positionAdded', newPosition);
        
        return newPosition;
    }
    
    /**
     * Get positions for a specific project
     * @param {string} projectId - Project identifier
     * @returns {Array} - Array of positions for the project
     */
    getProjectPositions(projectId) {
        return Array.from(this.positions.values())
            .filter(pos => pos.projectId === projectId);
    }
    
    /**
     * Set active cursor position for a project
     * @param {string} projectId - Project identifier
     * @param {string} positionId - Position identifier
     */
    setActivePosition(projectId, positionId) {
        if (!this.positions.has(positionId)) {
            throw new Error(`Position ${positionId} not found`);
        }
        
        if (!this.activeCursors.has(projectId)) {
            this.activeCursors.set(projectId, new Set());
        }
        
        this.activeCursors.get(projectId).add(positionId);
        this.emit('activePositionSet', { projectId, positionId });
    }
    
    /**
     * Remove active cursor position for a project
     * @param {string} projectId - Project identifier
     * @param {string} positionId - Position identifier
     */
    removeActivePosition(projectId, positionId) {
        if (this.activeCursors.has(projectId)) {
            this.activeCursors.get(projectId).delete(positionId);
            this.emit('activePositionRemoved', { projectId, positionId });
        }
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
        
        // Remove from active cursors if present
        if (position.projectId && this.activeCursors.has(position.projectId)) {
            this.activeCursors.get(position.projectId).delete(id);
        }
        
        this.positions.delete(id);
        this.savePositions();
        this.emit('positionDeleted', position);
        
        return true;
    }
    
    /**
     * Move cursor to a saved position with validation and retry
     * @param {string} positionId - Position ID
     * @param {Object} options - Movement options
     * @returns {Promise<boolean>} - True if moved successfully
     */
    async moveCursorToPosition(positionId, options = {}) {
        const position = this.positions.get(positionId);
        
        if (!position) {
            return false;
        }
        
        const {
            validate = true,
            retry = true,
            retryAttempts = position.retrySettings.maxAttempts,
            retryDelay = position.retrySettings.delayBetweenAttempts
        } = options;
        
        let attempts = 0;
        
        while (attempts < retryAttempts) {
            robot.moveMouse(position.x, position.y);
            
            if (!validate || await this._validatePosition(position)) {
                return true;
            }
            
            if (!retry || attempts >= retryAttempts - 1) {
                break;
            }
            
            attempts++;
            await this._sleep(retryDelay);
        }
        
        return false;
    }
    
    /**
     * Validate cursor position
     * @param {Object} position - Position to validate
     * @returns {Promise<boolean>} - True if position is valid
     * @private
     */
    async _validatePosition(position) {
        const currentPos = robot.getMousePos();
        const tolerance = 5; // Pixel tolerance for position validation
        
        return Math.abs(currentPos.x - position.x) <= tolerance &&
               Math.abs(currentPos.y - position.y) <= tolerance;
    }
    
    /**
     * Click at current cursor position with retry logic
     * @param {Object} options - Click options
     * @returns {Promise<boolean>} - True if click was successful
     */
    async clickAtCurrentPosition(options = {}) {
        const {
            button = 'left',
            doubleClick = false,
            retry = true,
            retryAttempts = 3,
            retryDelay = 1000
        } = options;
        
        let attempts = 0;
        
        while (attempts < retryAttempts) {
            try {
                robot.mouseClick(button, doubleClick);
                return true;
            } catch (error) {
                if (!retry || attempts >= retryAttempts - 1) {
                    console.error('Click failed:', error);
                    return false;
                }
                
                attempts++;
                await this._sleep(retryDelay);
            }
        }
        
        return false;
    }
    
    /**
     * Type text at current cursor position with validation
     * @param {string} text - Text to type
     * @param {Object} options - Typing options
     * @returns {Promise<boolean>} - True if typing was successful
     */
    async typeAtCurrentPosition(text, options = {}) {
        const {
            delay = 0,
            validateInput = false,
            retry = true,
            retryAttempts = 3,
            retryDelay = 1000
        } = options;
        
        let attempts = 0;
        
        while (attempts < retryAttempts) {
            try {
                if (delay > 0) {
                    for (const char of text) {
                        robot.typeString(char);
                        await this._sleep(delay);
                    }
                } else {
                    robot.typeString(text);
                }
                
                if (!validateInput) {
                    return true;
                }
                
                // Add input validation logic here if needed
                return true;
            } catch (error) {
                if (!retry || attempts >= retryAttempts - 1) {
                    console.error('Typing failed:', error);
                    return false;
                }
                
                attempts++;
                await this._sleep(retryDelay);
            }
        }
        
        return false;
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
