/**
 * CursorAutomationSystem.test.js
 * Unit tests for the CursorAutomationSystem module
 */

const CursorAutomationSystem = require('../CursorAutomationSystem');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Mock dependencies
jest.mock('robotjs', () => ({
  getScreenSize: jest.fn().mockReturnValue({ width: 1920, height: 1080 }),
  getMousePos: jest.fn().mockReturnValue({ x: 500, y: 500 }),
  moveMouse: jest.fn(),
  mouseToggle: jest.fn(),
  typeString: jest.fn(),
  keyToggle: jest.fn()
}));

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Create temp directory for tests
const TEST_DATA_DIR = path.join(os.tmpdir(), 'cursor-automation-test');

describe('CursorAutomationSystem', () => {
  let cursorSystem;
  
  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    
    // Create test data directory
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    
    // Create instance
    cursorSystem = new CursorAutomationSystem({
      dataDir: TEST_DATA_DIR
    });
  });
  
  afterEach(() => {
    // Clean up test data directory
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });
  
  describe('constructor', () => {
    test('should initialize with default options', () => {
      const system = new CursorAutomationSystem();
      expect(system.safeMode).toBe(true);
      expect(system.defaultDelay).toBe(100);
      expect(system.screenConfig).toEqual({ width: 1920, height: 1080 });
    });
    
    test('should initialize with custom options', () => {
      const system = new CursorAutomationSystem({
        dataDir: TEST_DATA_DIR,
        defaultDelay: 200,
        safeMode: false,
        screenConfig: { width: 3840, height: 2160 }
      });
      
      expect(system.dataDir).toBe(TEST_DATA_DIR);
      expect(system.defaultDelay).toBe(200);
      expect(system.safeMode).toBe(false);
      expect(system.screenConfig).toEqual({ width: 3840, height: 2160 });
    });
  });
  
  describe('moveTo', () => {
    test('should move cursor to absolute coordinates', () => {
      const robot = require('robotjs');
      
      cursorSystem.moveTo(100, 200);
      
      expect(robot.moveMouse).toHaveBeenCalledWith(100, 200);
    });
    
    test('should move cursor to relative coordinates', () => {
      const robot = require('robotjs');
      robot.getMousePos.mockReturnValue({ x: 100, y: 100 });
      
      cursorSystem.moveTo(50, 50, { relative: true });
      
      expect(robot.moveMouse).toHaveBeenCalledWith(150, 150);
    });
    
    test('should transform coordinates if requested', () => {
      const robot = require('robotjs');
      robot.getScreenSize.mockReturnValue({ width: 3840, height: 2160 });
      
      cursorSystem.moveTo(100, 100, { transform: true });
      
      // Expected: 100 * (3840/1920) = 200, 100 * (2160/1080) = 200
      expect(robot.moveMouse).toHaveBeenCalledWith(200, 200);
    });
    
    test('should throw error for invalid position in safe mode', () => {
      const robot = require('robotjs');
      robot.getScreenSize.mockReturnValue({ width: 1000, height: 1000 });
      
      expect(() => {
        cursorSystem.moveTo(2000, 2000);
      }).toThrow('Invalid position');
    });
    
    test('should use smooth movement if requested', () => {
      const robot = require('robotjs');
      const spyOnSmoothMove = jest.spyOn(cursorSystem, '_smoothMove');
      
      cursorSystem.moveTo(100, 200, { smooth: true, speed: 75 });
      
      expect(spyOnSmoothMove).toHaveBeenCalledWith(100, 200, 75);
    });
  });
  
  describe('click', () => {
    test('should perform a left click by default', () => {
      const robot = require('robotjs');
      
      cursorSystem.click();
      
      expect(robot.mouseToggle).toHaveBeenCalledWith('down', 'left');
      expect(robot.mouseToggle).toHaveBeenCalledWith('up', 'left');
    });
    
    test('should perform a right click when specified', () => {
      const robot = require('robotjs');
      
      cursorSystem.click('right');
      
      expect(robot.mouseToggle).toHaveBeenCalledWith('down', 'right');
      expect(robot.mouseToggle).toHaveBeenCalledWith('up', 'right');
    });
    
    test('should use custom delay when specified', () => {
      const robot = require('robotjs');
      const spyOnSleep = jest.spyOn(cursorSystem, '_sleep');
      
      cursorSystem.click('left', { delay: 50 });
      
      expect(spyOnSleep).toHaveBeenCalledWith(50);
    });
  });
  
  describe('doubleClick', () => {
    test('should perform two clicks in succession', () => {
      const spyOnClick = jest.spyOn(cursorSystem, 'click');
      const spyOnSleep = jest.spyOn(cursorSystem, '_sleep');
      
      cursorSystem.doubleClick('left', { delay: 75 });
      
      expect(spyOnClick).toHaveBeenCalledTimes(2);
      expect(spyOnSleep).toHaveBeenCalledWith(75);
    });
  });
  
  describe('dragTo', () => {
    test('should perform a drag operation', () => {
      const robot = require('robotjs');
      const spyOnMoveTo = jest.spyOn(cursorSystem, 'moveTo');
      
      cursorSystem.dragTo(100, 100, 200, 200);
      
      expect(spyOnMoveTo).toHaveBeenCalledTimes(2);
      expect(spyOnMoveTo).toHaveBeenNthCalledWith(1, 100, 100, expect.any(Object));
      expect(spyOnMoveTo).toHaveBeenNthCalledWith(2, 200, 200, expect.any(Object));
      expect(robot.mouseToggle).toHaveBeenCalledWith('down', 'left');
      expect(robot.mouseToggle).toHaveBeenCalledWith('up', 'left');
    });
    
    test('should use specified button for drag', () => {
      const robot = require('robotjs');
      
      cursorSystem.dragTo(100, 100, 200, 200, { button: 'right' });
      
      expect(robot.mouseToggle).toHaveBeenCalledWith('down', 'right');
      expect(robot.mouseToggle).toHaveBeenCalledWith('up', 'right');
    });
  });
  
  describe('typeText', () => {
    test('should type the specified text', () => {
      const robot = require('robotjs');
      
      cursorSystem.typeText('Hello World');
      
      expect(robot.typeString).toHaveBeenCalledTimes(11); // One call per character
    });
    
    test('should apply modifiers if specified', () => {
      const robot = require('robotjs');
      
      cursorSystem.typeText('a', { modifiers: ['shift', 'control'] });
      
      expect(robot.keyToggle).toHaveBeenCalledWith('shift', 'down');
      expect(robot.keyToggle).toHaveBeenCalledWith('control', 'down');
      expect(robot.keyToggle).toHaveBeenCalledWith('shift', 'up');
      expect(robot.keyToggle).toHaveBeenCalledWith('control', 'up');
    });
  });
  
  describe('position management', () => {
    test('should capture and retrieve positions', () => {
      const robot = require('robotjs');
      robot.getMousePos.mockReturnValue({ x: 123, y: 456 });
      
      const position = cursorSystem.capturePosition('testPosition', {
        description: 'Test position',
        group: 'test'
      });
      
      expect(position.name).toBe('testPosition');
      expect(position.x).toBe(123);
      expect(position.y).toBe(456);
      expect(position.description).toBe('Test position');
      expect(position.group).toBe('test');
      
      const retrieved = cursorSystem.getPosition('testPosition');
      expect(retrieved).toEqual(position);
    });
    
    test('should delete positions', () => {
      const robot = require('robotjs');
      robot.getMousePos.mockReturnValue({ x: 123, y: 456 });
      
      const position = cursorSystem.capturePosition('testPosition');
      expect(cursorSystem.positions.size).toBe(1);
      
      const result = cursorSystem.deletePosition('testPosition');
      expect(result).toBe(true);
      expect(cursorSystem.positions.size).toBe(0);
    });
    
    test('should throw error when getting non-existent position', () => {
      expect(() => {
        cursorSystem.getPosition('nonExistentPosition');
      }).toThrow('Position not found');
    });
  });
  
  describe('sequence recording and playback', () => {
    test('should record and play sequences', () => {
      // Start recording
      const recording = cursorSystem.recordSequence({
        name: 'testSequence',
        description: 'Test sequence'
      });
      
      expect(recording.name).toBe('testSequence');
      expect(cursorSystem.recording).not.toBeNull();
      
      // Perform some actions
      cursorSystem.moveTo(100, 100);
      cursorSystem.click('left');
      cursorSystem.typeText('test');
      
      // Stop recording
      const sequence = cursorSystem.stopRecording();
      
      expect(sequence.actions.length).toBe(3);
      expect(sequence.actions[0].type).toBe('move');
      expect(sequence.actions[1].type).toBe('click');
      expect(sequence.actions[2].type).toBe('type');
      expect(cursorSystem.recording).toBeNull();
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Play sequence
      const spyOnMoveTo = jest.spyOn(cursorSystem, 'moveTo');
      const spyOnClick = jest.spyOn(cursorSystem, 'click');
      const spyOnTypeText = jest.spyOn(cursorSystem, 'typeText');
      
      cursorSystem.playSequence(sequence);
      
      expect(spyOnMoveTo).toHaveBeenCalledTimes(1);
      expect(spyOnClick).toHaveBeenCalledTimes(1);
      expect(spyOnTypeText).toHaveBeenCalledTimes(1);
    });
    
    test('should throw error when starting recording while already recording', () => {
      cursorSystem.recordSequence();
      
      expect(() => {
        cursorSystem.recordSequence();
      }).toThrow('Already recording a sequence');
    });
    
    test('should throw error when stopping recording while not recording', () => {
      expect(() => {
        cursorSystem.stopRecording();
      }).toThrow('Not currently recording');
    });
  });
  
  describe('coordinate transformation', () => {
    test('should transform coordinates based on screen resolution', () => {
      const robot = require('robotjs');
      robot.getScreenSize.mockReturnValue({ width: 3840, height: 2160 });
      
      const transformed = cursorSystem.transformCoordinates(100, 100);
      
      expect(transformed).toEqual({ x: 200, y: 200 });
    });
    
    test('should validate positions correctly', () => {
      const robot = require('robotjs');
      robot.getScreenSize.mockReturnValue({ width: 1000, height: 1000 });
      
      expect(cursorSystem.isValidPosition(500, 500)).toBe(true);
      expect(cursorSystem.isValidPosition(-10, 500)).toBe(false);
      expect(cursorSystem.isValidPosition(500, 1500)).toBe(false);
    });
  });
});
