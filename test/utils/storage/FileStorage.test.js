/**
 * FileStorage.test.js
 * Tests for the FileStorage adapter
 */

const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs-extra');
const path = require('path');
const FileStorage = require('../../../src/utils/storage/FileStorage');

describe('FileStorage', () => {
  let storage;
  let tempDir;
  
  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = path.join(__dirname, '..', '..', 'temp-data');
    
    // Stub fs methods to avoid actual file operations
    sinon.stub(fs, 'ensureDirSync');
    sinon.stub(fs, 'pathExists').resolves(false);
    sinon.stub(fs, 'readFile').resolves('{}');
    sinon.stub(fs, 'writeFile').resolves();
    sinon.stub(fs, 'remove').resolves();
    
    // Create storage instance
    storage = new FileStorage({ directory: tempDir });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultStorage = new FileStorage();
      expect(defaultStorage.directory).to.equal('./data');
      expect(defaultStorage.webhooksFile).to.equal(path.join('./data', 'webhooks.json'));
      expect(defaultStorage.eventLogFile).to.equal(path.join('./data', 'event-log.json'));
      expect(defaultStorage.statsFile).to.equal(path.join('./data', 'stats.json'));
      expect(fs.ensureDirSync.calledWith('./data')).to.be.true;
    });
    
    it('should initialize with custom directory', () => {
      expect(storage.directory).to.equal(tempDir);
      expect(storage.webhooksFile).to.equal(path.join(tempDir, 'webhooks.json'));
      expect(storage.eventLogFile).to.equal(path.join(tempDir, 'event-log.json'));
      expect(storage.statsFile).to.equal(path.join(tempDir, 'stats.json'));
      expect(fs.ensureDirSync.calledWith(tempDir)).to.be.true;
    });
  });
  
  describe('getWebhooks', () => {
    it('should return empty object if file does not exist', async () => {
      const webhooks = await storage.getWebhooks();
      expect(webhooks).to.deep.equal({});
      expect(fs.pathExists.calledWith(storage.webhooksFile)).to.be.true;
      expect(fs.readFile.called).to.be.false;
    });
    
    it('should read and parse webhooks file if it exists', async () => {
      fs.pathExists.resolves(true);
      fs.readFile.resolves('{"test": "webhook"}');
      
      const webhooks = await storage.getWebhooks();
      expect(webhooks).to.deep.equal({ test: 'webhook' });
      expect(fs.pathExists.calledWith(storage.webhooksFile)).to.be.true;
      expect(fs.readFile.calledWith(storage.webhooksFile, 'utf8')).to.be.true;
    });
    
    it('should return empty object on error', async () => {
      fs.pathExists.resolves(true);
      fs.readFile.rejects(new Error('Test error'));
      
      const webhooks = await storage.getWebhooks();
      expect(webhooks).to.deep.equal({});
    });
  });
  
  describe('saveWebhooks', () => {
    it('should write webhooks to file', async () => {
      const webhooks = { test: 'webhook' };
      await storage.saveWebhooks(webhooks);
      
      expect(fs.writeFile.calledOnce).to.be.true;
      expect(fs.writeFile.firstCall.args[0]).to.equal(storage.webhooksFile);
      expect(fs.writeFile.firstCall.args[1]).to.equal(JSON.stringify(webhooks, null, 2));
      expect(fs.writeFile.firstCall.args[2]).to.equal('utf8');
    });
    
    it('should handle errors gracefully', async () => {
      fs.writeFile.rejects(new Error('Test error'));
      
      // Should not throw
      await storage.saveWebhooks({ test: 'webhook' });
      expect(fs.writeFile.calledOnce).to.be.true;
    });
  });
  
  describe('getEventLog', () => {
    it('should return empty object if file does not exist', async () => {
      const eventLog = await storage.getEventLog();
      expect(eventLog).to.deep.equal({});
      expect(fs.pathExists.calledWith(storage.eventLogFile)).to.be.true;
      expect(fs.readFile.called).to.be.false;
    });
    
    it('should read and parse event log file if it exists', async () => {
      fs.pathExists.resolves(true);
      fs.readFile.resolves('{"event1": {"id": "event1"}}');
      
      const eventLog = await storage.getEventLog();
      expect(eventLog).to.deep.equal({ event1: { id: 'event1' } });
      expect(fs.pathExists.calledWith(storage.eventLogFile)).to.be.true;
      expect(fs.readFile.calledWith(storage.eventLogFile, 'utf8')).to.be.true;
    });
  });
  
  describe('saveEventLog', () => {
    it('should write event log to file', async () => {
      const eventLog = { event1: { id: 'event1' } };
      await storage.saveEventLog(eventLog);
      
      expect(fs.writeFile.calledOnce).to.be.true;
      expect(fs.writeFile.firstCall.args[0]).to.equal(storage.eventLogFile);
      expect(fs.writeFile.firstCall.args[1]).to.equal(JSON.stringify(eventLog, null, 2));
    });
  });
  
  describe('getStats', () => {
    it('should return empty object if file does not exist', async () => {
      const stats = await storage.getStats();
      expect(stats).to.deep.equal({});
      expect(fs.pathExists.calledWith(storage.statsFile)).to.be.true;
    });
    
    it('should read and parse stats file if it exists', async () => {
      fs.pathExists.resolves(true);
      fs.readFile.resolves('{"github": {"received": 10}}');
      
      const stats = await storage.getStats();
      expect(stats).to.deep.equal({ github: { received: 10 } });
      expect(fs.pathExists.calledWith(storage.statsFile)).to.be.true;
      expect(fs.readFile.calledWith(storage.statsFile, 'utf8')).to.be.true;
    });
  });
  
  describe('saveStats', () => {
    it('should write stats to file', async () => {
      const stats = { github: { received: 10 } };
      await storage.saveStats(stats);
      
      expect(fs.writeFile.calledOnce).to.be.true;
      expect(fs.writeFile.firstCall.args[0]).to.equal(storage.statsFile);
      expect(fs.writeFile.firstCall.args[1]).to.equal(JSON.stringify(stats, null, 2));
    });
  });
  
  describe('clearAll', () => {
    it('should remove all data files', async () => {
      await storage.clearAll();
      
      expect(fs.remove.callCount).to.equal(3);
      expect(fs.remove.calledWith(storage.webhooksFile)).to.be.true;
      expect(fs.remove.calledWith(storage.eventLogFile)).to.be.true;
      expect(fs.remove.calledWith(storage.statsFile)).to.be.true;
    });
    
    it('should handle errors gracefully', async () => {
      fs.remove.rejects(new Error('Test error'));
      
      // Should not throw
      await storage.clearAll();
      expect(fs.remove.callCount).to.equal(3);
    });
  });
});
