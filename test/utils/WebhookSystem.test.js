/**
 * WebhookSystem.test.js
 * Tests for the WebhookSystem module
 */

const { expect } = require('chai');
const sinon = require('sinon');
const crypto = require('crypto');
const WebhookSystem = require('../../src/utils/WebhookSystem');
const GitHubWebhookManager = require('../../src/utils/WebhookManager');

describe('WebhookSystem', () => {
  let webhookSystem;
  let mockStorage;
  let mockGitHubManager;
  
  beforeEach(() => {
    // Mock storage adapter
    mockStorage = {
      getWebhooks: sinon.stub().resolves({}),
      saveWebhooks: sinon.stub().resolves(),
      getEventLog: sinon.stub().resolves({}),
      saveEventLog: sinon.stub().resolves(),
      getStats: sinon.stub().resolves({}),
      saveStats: sinon.stub().resolves()
    };
    
    // Mock GitHub webhook manager
    mockGitHubManager = {
      setWebhookUrl: sinon.stub(),
      ensureWebhookExists: sinon.stub().resolves({ success: true, message: 'Webhook created' })
    };
    
    // Stub GitHubWebhookManager constructor
    sinon.stub(GitHubWebhookManager.prototype, 'setWebhookUrl');
    sinon.stub(GitHubWebhookManager.prototype, 'ensureWebhookExists')
      .resolves({ success: true, message: 'Webhook created' });
    
    // Create webhook system instance
    webhookSystem = new WebhookSystem({
      sources: {
        github: {
          token: 'test-token',
          webhookUrl: 'https://example.com/webhook'
        }
      },
      storage: mockStorage
    });
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const system = new WebhookSystem();
      expect(system.options.maxRetries).to.equal(3);
      expect(system.options.retryDelay).to.equal(5000);
      expect(system.webhookManagers).to.be.an('object');
      expect(system.eventHandlers).to.be.an('object');
      expect(system.webhooks).to.be.an('object');
      expect(system.eventLog).to.be.an('object');
      expect(system.stats).to.be.an('object');
    });
    
    it('should initialize with custom options', () => {
      const system = new WebhookSystem({
        maxRetries: 5,
        retryDelay: 10000
      });
      expect(system.options.maxRetries).to.equal(5);
      expect(system.options.retryDelay).to.equal(10000);
    });
    
    it('should initialize GitHub webhook manager if GitHub source is provided', () => {
      expect(webhookSystem.webhookManagers.github).to.be.an.instanceOf(GitHubWebhookManager);
    });
  });
  
  describe('registerWebhook', () => {
    it('should register a new webhook', async () => {
      const result = await webhookSystem.registerWebhook('github', {
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        events: ['push', 'pull_request']
      });
      
      expect(result).to.have.property('id');
      expect(result.success).to.be.true;
      expect(result.message).to.include('Webhook registered successfully');
      expect(mockStorage.saveWebhooks.calledOnce).to.be.true;
      
      const webhookId = result.id;
      expect(webhookSystem.webhooks[webhookId]).to.exist;
      expect(webhookSystem.webhooks[webhookId].source).to.equal('github');
      expect(webhookSystem.webhooks[webhookId].url).to.equal('https://example.com/webhook');
      expect(webhookSystem.webhooks[webhookId].secret).to.equal('test-secret');
      expect(webhookSystem.webhooks[webhookId].events).to.deep.equal(['push', 'pull_request']);
    });
    
    it('should generate a secret if not provided', async () => {
      const result = await webhookSystem.registerWebhook('github', {
        url: 'https://example.com/webhook'
      });
      
      const webhookId = result.id;
      expect(webhookSystem.webhooks[webhookId].secret).to.be.a('string');
      expect(webhookSystem.webhooks[webhookId].secret.length).to.be.at.least(32);
    });
    
    it('should use default events if not provided', async () => {
      const result = await webhookSystem.registerWebhook('github', {
        url: 'https://example.com/webhook'
      });
      
      const webhookId = result.id;
      expect(webhookSystem.webhooks[webhookId].events).to.deep.equal(['*']);
    });
    
    it('should throw an error for unsupported webhook source', async () => {
      try {
        await webhookSystem.registerWebhook('unsupported', {
          url: 'https://example.com/webhook'
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Unsupported webhook source');
      }
    });
    
    it('should register a webhook for a specific repository', async () => {
      const result = await webhookSystem.registerWebhook('github', {
        url: 'https://example.com/webhook',
        repository: 'owner/repo'
      });
      
      expect(result.success).to.be.true;
      expect(GitHubWebhookManager.prototype.ensureWebhookExists.calledOnce).to.be.true;
      expect(GitHubWebhookManager.prototype.ensureWebhookExists.firstCall.args[0]).to.equal('owner/repo');
    });
  });
  
  describe('unregisterWebhook', () => {
    let webhookId;
    
    beforeEach(async () => {
      const result = await webhookSystem.registerWebhook('github', {
        url: 'https://example.com/webhook'
      });
      webhookId = result.id;
      mockStorage.saveWebhooks.reset();
    });
    
    it('should unregister an existing webhook', async () => {
      const result = await webhookSystem.unregisterWebhook(webhookId);
      
      expect(result.success).to.be.true;
      expect(result.message).to.include('unregistered successfully');
      expect(webhookSystem.webhooks[webhookId]).to.be.undefined;
      expect(mockStorage.saveWebhooks.calledOnce).to.be.true;
    });
    
    it('should return false for non-existent webhook ID', async () => {
      const result = await webhookSystem.unregisterWebhook('non-existent-id');
      
      expect(result.success).to.be.false;
      expect(result.message).to.include('not found');
      expect(mockStorage.saveWebhooks.called).to.be.false;
    });
  });
  
  describe('validateWebhook', () => {
    it('should validate GitHub webhook signature correctly', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      const payloadString = JSON.stringify(payload);
      
      // Create a valid signature
      const hmac = crypto.createHmac('sha256', secret);
      const signature = 'sha256=' + hmac.update(payloadString).digest('hex');
      
      const result = webhookSystem.validateWebhook('github', payload, signature, secret);
      expect(result).to.be.true;
    });
    
    it('should reject invalid GitHub webhook signature', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      const invalidSignature = 'sha256=invalid';
      
      const result = webhookSystem.validateWebhook('github', payload, invalidSignature, secret);
      expect(result).to.be.false;
    });
    
    it('should validate generic webhook signature correctly', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      const payloadString = JSON.stringify(payload);
      
      // Create a valid signature
      const hmac = crypto.createHmac('sha256', secret);
      const signature = hmac.update(payloadString).digest('hex');
      
      const result = webhookSystem.validateWebhook('generic', payload, signature, secret);
      expect(result).to.be.true;
    });
  });
  
  describe('processWebhook', () => {
    it('should process a webhook event and return an event ID', async () => {
      const result = await webhookSystem.processWebhook('github', 'push', { test: 'data' });
      
      expect(result.success).to.be.true;
      expect(result.eventId).to.be.a('string');
      expect(result.message).to.include('Event received');
      
      const eventId = result.eventId;
      expect(webhookSystem.eventLog[eventId]).to.exist;
      expect(webhookSystem.eventLog[eventId].source).to.equal('github');
      expect(webhookSystem.eventLog[eventId].event).to.equal('push');
      expect(webhookSystem.eventLog[eventId].status).to.equal('received');
      
      expect(webhookSystem.stats.github).to.exist;
      expect(webhookSystem.stats.github.received).to.equal(1);
      
      expect(mockStorage.saveEventLog.calledOnce).to.be.true;
    });
  });
  
  describe('registerEventHandler', () => {
    it('should register an event handler and return a handler ID', () => {
      const handler = async () => {};
      const handlerId = webhookSystem.registerEventHandler('github', 'push', handler);
      
      expect(handlerId).to.be.a('string');
      expect(webhookSystem.eventHandlers.github).to.exist;
      expect(webhookSystem.eventHandlers.github.push).to.be.an('array');
      expect(webhookSystem.eventHandlers.github.push).to.have.lengthOf(1);
      expect(webhookSystem.eventHandlers.github.push[0].id).to.equal(handlerId);
      expect(webhookSystem.eventHandlers.github.push[0].handler).to.equal(handler);
      expect(webhookSystem.eventHandlers.github.push[0].priority).to.equal(0);
    });
    
    it('should register a handler with custom priority', () => {
      const handler = async () => {};
      const handlerId = webhookSystem.registerEventHandler('github', 'push', handler, { priority: 10 });
      
      expect(webhookSystem.eventHandlers.github.push[0].priority).to.equal(10);
    });
    
    it('should register multiple handlers for the same event', () => {
      const handler1 = async () => {};
      const handler2 = async () => {};
      
      webhookSystem.registerEventHandler('github', 'push', handler1);
      webhookSystem.registerEventHandler('github', 'push', handler2);
      
      expect(webhookSystem.eventHandlers.github.push).to.have.lengthOf(2);
    });
  });
  
  describe('unregisterEventHandler', () => {
    let handlerId;
    
    beforeEach(() => {
      handlerId = webhookSystem.registerEventHandler('github', 'push', async () => {});
    });
    
    it('should unregister an existing event handler', () => {
      const result = webhookSystem.unregisterEventHandler('github', 'push', handlerId);
      
      expect(result).to.be.true;
      expect(webhookSystem.eventHandlers.github.push).to.be.undefined;
    });
    
    it('should return false for non-existent handler ID', () => {
      const result = webhookSystem.unregisterEventHandler('github', 'push', 'non-existent-id');
      
      expect(result).to.be.false;
      expect(webhookSystem.eventHandlers.github.push).to.have.lengthOf(1);
    });
    
    it('should return false for non-existent event', () => {
      const result = webhookSystem.unregisterEventHandler('github', 'non-existent', handlerId);
      
      expect(result).to.be.false;
    });
    
    it('should return false for non-existent source', () => {
      const result = webhookSystem.unregisterEventHandler('non-existent', 'push', handlerId);
      
      expect(result).to.be.false;
    });
  });
  
  describe('getWebhookStats', () => {
    beforeEach(async () => {
      await webhookSystem.processWebhook('github', 'push', { test: 'data' });
      await webhookSystem.processWebhook('github', 'pull_request', { test: 'data' });
      await webhookSystem.processWebhook('gitlab', 'push', { test: 'data' });
    });
    
    it('should return stats for all sources', () => {
      const stats = webhookSystem.getWebhookStats();
      
      expect(stats).to.be.an('object');
      expect(stats.github).to.exist;
      expect(stats.gitlab).to.exist;
      expect(stats.github.received).to.equal(2);
      expect(stats.gitlab.received).to.equal(1);
    });
    
    it('should return stats for a specific source', () => {
      const stats = webhookSystem.getWebhookStats('github');
      
      expect(stats).to.be.an('object');
      expect(stats.received).to.equal(2);
    });
    
    it('should return default stats for a non-existent source', () => {
      const stats = webhookSystem.getWebhookStats('non-existent');
      
      expect(stats).to.be.an('object');
      expect(stats.received).to.equal(0);
      expect(stats.processed).to.equal(0);
      expect(stats.failed).to.equal(0);
      expect(stats.retried).to.equal(0);
      expect(stats.lastEvent).to.be.null;
    });
  });
  
  describe('_processEvent', () => {
    let handler1;
    let handler2;
    let eventId;
    
    beforeEach(async () => {
      handler1 = sinon.stub().resolves();
      handler2 = sinon.stub().resolves();
      
      webhookSystem.registerEventHandler('github', 'push', handler1, { priority: 10 });
      webhookSystem.registerEventHandler('github', 'push', handler2, { priority: 5 });
      
      const result = await webhookSystem.processWebhook('github', 'push', { test: 'data' });
      eventId = result.eventId;
      
      // Reset the event status to test _processEvent directly
      webhookSystem.eventLog[eventId].status = 'received';
      webhookSystem.stats.github.processed = 0;
    });
    
    it('should process an event by calling registered handlers in priority order', async () => {
      await webhookSystem._processEvent(eventId, 'github', 'push', { test: 'data' });
      
      expect(handler1.calledOnce).to.be.true;
      expect(handler2.calledOnce).to.be.true;
      expect(handler1.calledBefore(handler2)).to.be.true; // Higher priority called first
      
      expect(webhookSystem.eventLog[eventId].status).to.equal('completed');
      expect(webhookSystem.stats.github.processed).to.equal(1);
    });
    
    it('should handle errors in event handlers', async () => {
      handler1.rejects(new Error('Test error'));
      
      await webhookSystem._processEvent(eventId, 'github', 'push', { test: 'data' });
      
      expect(handler1.calledOnce).to.be.true;
      expect(handler2.calledOnce).to.be.true; // Second handler still called
      
      expect(webhookSystem.eventLog[eventId].status).to.equal('completed');
      expect(webhookSystem.eventLog[eventId].handlerErrors).to.exist;
      expect(webhookSystem.stats.github.processed).to.equal(1);
    });
    
    it('should mark event as completed if no handlers are registered', async () => {
      // Unregister all handlers
      webhookSystem.eventHandlers = {};
      
      await webhookSystem._processEvent(eventId, 'github', 'push', { test: 'data' });
      
      expect(webhookSystem.eventLog[eventId].status).to.equal('completed');
      expect(webhookSystem.stats.github.processed).to.equal(1);
    });
  });
  
  describe('_getEventHandlers', () => {
    beforeEach(() => {
      // Register various handlers
      webhookSystem.registerEventHandler('github', 'push', async () => {}, { priority: 10 });
      webhookSystem.registerEventHandler('github', '*', async () => {}, { priority: 5 });
      webhookSystem.registerEventHandler('*', '*', async () => {}, { priority: 1 });
    });
    
    it('should get all handlers for a specific event including wildcards', () => {
      const handlers = webhookSystem._getEventHandlers('github', 'push');
      
      expect(handlers).to.have.lengthOf(3);
      expect(handlers[0].priority).to.equal(10); // Specific handler first (highest priority)
      expect(handlers[1].priority).to.equal(5);  // Source wildcard second
      expect(handlers[2].priority).to.equal(1);  // Global wildcard last
    });
    
    it('should get wildcard handlers for an event with no specific handlers', () => {
      const handlers = webhookSystem._getEventHandlers('github', 'pull_request');
      
      expect(handlers).to.have.lengthOf(2);
      expect(handlers[0].priority).to.equal(5);  // Source wildcard first
      expect(handlers[1].priority).to.equal(1);  // Global wildcard last
    });
    
    it('should get only global wildcard handlers for an unknown source', () => {
      const handlers = webhookSystem._getEventHandlers('gitlab', 'push');
      
      expect(handlers).to.have.lengthOf(1);
      expect(handlers[0].priority).to.equal(1);  // Only global wildcard
    });
  });
  
  describe('replayEvent', () => {
    let eventId;
    
    beforeEach(async () => {
      const result = await webhookSystem.processWebhook('github', 'push', { test: 'data' });
      eventId = result.eventId;
      mockStorage.saveEventLog.reset();
    });
    
    it('should replay an existing event', async () => {
      const result = await webhookSystem.replayEvent(eventId);
      
      expect(result.success).to.be.true;
      expect(result.eventId).to.be.a('string');
      expect(result.eventId).to.not.equal(eventId); // New event ID
      expect(result.message).to.include('replayed successfully');
      
      const replayId = result.eventId;
      expect(webhookSystem.eventLog[replayId]).to.exist;
      expect(webhookSystem.eventLog[replayId].source).to.equal('github');
      expect(webhookSystem.eventLog[replayId].event).to.equal('push');
      expect(webhookSystem.eventLog[replayId].status).to.equal('received');
      expect(webhookSystem.eventLog[replayId].replayOf).to.equal(eventId);
      
      expect(webhookSystem.stats.github.received).to.equal(2);
      expect(mockStorage.saveEventLog.calledOnce).to.be.true;
    });
    
    it('should return error for non-existent event ID', async () => {
      const result = await webhookSystem.replayEvent('non-existent-id');
      
      expect(result.success).to.be.false;
      expect(result.message).to.include('not found');
      expect(mockStorage.saveEventLog.called).to.be.false;
    });
  });
  
  describe('listEvents', () => {
    beforeEach(async () => {
      // Add some test events
      await webhookSystem.processWebhook('github', 'push', { test: 'data1' });
      await webhookSystem.processWebhook('github', 'pull_request', { test: 'data2' });
      await webhookSystem.processWebhook('gitlab', 'push', { test: 'data3' });
    });
    
    it('should list all events', () => {
      const events = webhookSystem.listEvents();
      
      expect(events).to.be.an('array');
      expect(events).to.have.lengthOf(3);
    });
    
    it('should filter events by source', () => {
      const events = webhookSystem.listEvents({ source: 'github' });
      
      expect(events).to.have.lengthOf(2);
      expect(events[0].source).to.equal('github');
      expect(events[1].source).to.equal('github');
    });
    
    it('should filter events by event type', () => {
      const events = webhookSystem.listEvents({ event: 'push' });
      
      expect(events).to.have.lengthOf(2);
      expect(events[0].event).to.equal('push');
      expect(events[1].event).to.equal('push');
    });
    
    it('should filter events by status', () => {
      const events = webhookSystem.listEvents({ status: 'received' });
      
      expect(events).to.have.lengthOf(3);
    });
    
    it('should apply pagination', () => {
      const events = webhookSystem.listEvents({ limit: 2, offset: 1 });
      
      expect(events).to.have.lengthOf(2);
    });
  });
  
  describe('getEventDetails', () => {
    let eventId;
    
    beforeEach(async () => {
      const result = await webhookSystem.processWebhook('github', 'push', { test: 'data' });
      eventId = result.eventId;
    });
    
    it('should get details for an existing event', () => {
      const event = webhookSystem.getEventDetails(eventId);
      
      expect(event).to.exist;
      expect(event.id).to.equal(eventId);
      expect(event.source).to.equal('github');
      expect(event.event).to.equal('push');
    });
    
    it('should return null for a non-existent event ID', () => {
      const event = webhookSystem.getEventDetails('non-existent-id');
      
      expect(event).to.be.null;
    });
  });
});
