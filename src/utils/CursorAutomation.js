const { mouse, screen } = require('robotjs');

class CursorAutomation {
    constructor() {
        // Initialize robotjs
        try {
            // Test if robotjs is working
            const { width, height } = screen.getSize();
            if (!width || !height) {
                throw new Error('Failed to get screen size');
            }
        } catch (error) {
            throw new Error(`Failed to initialize robotjs: ${error.message}. Please ensure robotjs is properly installed by running: npm install robotjs`);
        }
    }

    /**
     * Move cursor to specific coordinates
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    moveTo(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('X and Y coordinates must be numbers');
        }
        mouse.moveTo(x, y);
    }

    /**
     * Get current cursor position
     * @returns {{x: number, y: number}} Current cursor position
     */
    getPosition() {
        return mouse.getPos();
    }

    /**
     * Click at current cursor position
     * @param {string} button - Mouse button to click ('left', 'right', 'middle')
     * @param {boolean} double - Whether to perform a double click
     */
    click(button = 'left', double = false) {
        const validButtons = ['left', 'right', 'middle'];
        if (!validButtons.includes(button)) {
            throw new Error(`Invalid mouse button. Must be one of: ${validButtons.join(', ')}`);
        }

        if (double) {
            mouse.click(button);
            mouse.click(button);
        } else {
            mouse.click(button);
        }
    }

    /**
     * Drag cursor from current position to target coordinates
     * @param {number} targetX - Target X coordinate
     * @param {number} targetY - Target Y coordinate
     */
    dragTo(targetX, targetY) {
        if (typeof targetX !== 'number' || typeof targetY !== 'number') {
            throw new Error('Target coordinates must be numbers');
        }

        mouse.toggleButton('left', true); // Press left button
        mouse.dragTo(targetX, targetY);
        mouse.toggleButton('left', false); // Release left button
    }

    /**
     * Scroll the mouse wheel
     * @param {number} amount - Scroll amount (positive for up, negative for down)
     */
    scroll(amount) {
        if (typeof amount !== 'number') {
            throw new Error('Scroll amount must be a number');
        }
        mouse.scrollMouse(0, amount);
    }
}

module.exports = CursorAutomation;
