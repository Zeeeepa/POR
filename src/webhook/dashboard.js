/**
 * dashboard.js
 * Web UI for monitoring webhook activity with improved features and security
 */

const express = require('express');
const path = require('path');
const moment = require('moment');
const logger = require('../utils/logger');
const fs = require('fs');

/**
 * EventHistory class for storing and managing webhook events
 */
class EventHistory {
  constructor(options = {}) {
    this.events = [];
    this.maxEvents = options.maxEvents || 100;
    this.persistPath = options.persistPath;
    
    // Load persisted events if available
    if (this.persistPath && fs.existsSync(this.persistPath)) {
      try {
        const data = fs.readFileSync(this.persistPath, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.events = parsed;
          logger.info(`Loaded ${this.events.length} events from ${this.persistPath}`);
        }
      } catch (error) {
        logger.error(`Failed to load persisted events: ${error.message}`);
      }
    }
  }
  
  /**
   * Add a new event to the history
   * @param {Object} event - Event object to add
   * @returns {Object} The added event
   */
  addEvent(event) {
    // Ensure event has required fields
    const enhancedEvent = {
      ...event,
      id: event.id || Date.now().toString(),
      timestamp: event.timestamp || new Date()
    };
    
    this.events.unshift(enhancedEvent);
    
    // Keep only the latest events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
    
    // Persist events if path is configured
    this._persistEvents();
    
    return enhancedEvent;
  }
  
  /**
   * Get events with optional filtering
   * @param {Object} options - Filter options
   * @param {number} [options.limit=50] - Maximum number of events to return
   * @param {string} [options.type] - Filter by event type
   * @param {string} [options.repo] - Filter by repository name
   * @param {string} [options.action] - Filter by event action
   * @returns {Array} Filtered events
   */
  getEvents(options = {}) {
    const { limit = 50, type, repo, action } = options;
    let filteredEvents = [...this.events];
    
    // Apply filters
    if (type) {
      filteredEvents = filteredEvents.filter(e => e.type === type);
    }
    
    if (repo) {
      filteredEvents = filteredEvents.filter(e => 
        e.repository && e.repository.toLowerCase().includes(repo.toLowerCase())
      );
    }
    
    if (action) {
      filteredEvents = filteredEvents.filter(e => e.action === action);
    }
    
    // Apply limit
    return filteredEvents.slice(0, parseInt(limit, 10));
  }
  
  /**
   * Get event by ID
   * @param {string} id - Event ID
   * @returns {Object|null} Event object or null if not found
   */
  getEventById(id) {
    return this.events.find(e => e.id.toString() === id.toString()) || null;
  }
  
  /**
   * Get statistics about events
   * @returns {Object} Statistics object
   */
  getStats() {
    const stats = {
      total: this.events.length,
      byType: {},
      byRepo: {},
      byAction: {},
      recentActivity: {
        last24h: 0,
        last7d: 0,
        last30d: 0
      }
    };
    
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000);
    
    this.events.forEach(event => {
      // Count by event type
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      
      // Count by repository
      const repoName = event.repository || 'unknown';
      stats.byRepo[repoName] = (stats.byRepo[repoName] || 0) + 1;
      
      // Count by action
      if (event.action) {
        stats.byAction[event.action] = (stats.byAction[event.action] || 0) + 1;
      }
      
      // Count recent activity
      const eventDate = new Date(event.timestamp);
      if (eventDate >= last24h) stats.recentActivity.last24h++;
      if (eventDate >= last7d) stats.recentActivity.last7d++;
      if (eventDate >= last30d) stats.recentActivity.last30d++;
    });
    
    return stats;
  }
  
  /**
   * Clear all events
   */
  clearEvents() {
    this.events = [];
    this._persistEvents();
    logger.info('Event history cleared');
  }
  
  /**
   * Persist events to disk if persistPath is set
   * @private
   */
  _persistEvents() {
    if (!this.persistPath) return;
    
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(
        this.persistPath, 
        JSON.stringify(this.events, null, 2), 
        'utf8'
      );
    } catch (error) {
      logger.error(`Failed to persist events: ${error.message}`);
    }
  }
}

/**
 * Set up dashboard routes on an existing Express app
 * @param {Object} app - Express app
 * @param {Object} webhookServer - WebhookServer instance
 * @param {Object} options - Dashboard configuration options
 * @param {string} [options.basePath='/dashboard'] - Base path for dashboard routes
 * @param {number} [options.maxEvents=100] - Maximum number of events to store
 * @param {string} [options.persistPath] - Path to persist events to disk
 * @param {boolean} [options.requireAuth=false] - Whether to require authentication
 * @param {Object} [options.auth] - Authentication configuration
 * @param {string} [options.auth.username] - Username for basic auth
 * @param {string} [options.auth.password] - Password for basic auth
 */
function setupDashboard(app, webhookServer, options = {}) {
  const {
    basePath = '/dashboard',
    maxEvents = 100,
    persistPath,
    requireAuth = false,
    auth = {}
  } = options;
  
  // Create event history store
  const eventHistory = new EventHistory({
    maxEvents,
    persistPath: persistPath || path.join(process.cwd(), 'data', 'events.json')
  });
  
  // Add template engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  
  // Serve static files
  app.use(`${basePath}/static`, express.static(path.join(__dirname, 'public')));
  
  // Add basic authentication if required
  if (requireAuth) {
    if (!auth.username || !auth.password) {
      logger.warn('Authentication required but credentials not provided. Dashboard will be accessible without authentication.');
    } else {
      app.use(basePath, (req, res, next) => {
        // Parse authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return unauthorized();
        }
        
        const [type, credentials] = authHeader.split(' ');
        if (type !== 'Basic') {
          return unauthorized();
        }
        
        const [username, password] = Buffer.from(credentials, 'base64')
          .toString()
          .split(':');
        
        if (username === auth.username && password === auth.password) {
          return next();
        }
        
        return unauthorized();
        
        function unauthorized() {
          res.set('WWW-Authenticate', 'Basic realm="Webhook Dashboard"');
          return res.status(401).send('Authentication required');
        }
      });
      
      logger.info('Dashboard authentication enabled');
    }
  }
  
  // Create middleware to capture webhook events
  const captureEvents = () => {
    // Override the _processEvent method to capture events
    const originalProcessEvent = webhookServer._processEvent.bind(webhookServer);
    webhookServer._processEvent = async (event, payload, deliveryId) => {
      // Capture event for dashboard
      eventHistory.addEvent({
        id: deliveryId || payload.id || payload.hook?.id || payload.hook_id || Date.now(),
        type: event,
        action: payload.action,
        timestamp: new Date(),
        repository: payload.repository?.full_name,
        sender: payload.sender?.login,
        summary: getSummary(event, payload),
        payload: JSON.stringify(payload, null, 2)
      });
      
      // Call original method
      return await originalProcessEvent(event, payload, deliveryId);
    };
  };
  
  // Helper to generate summary of events
  function getSummary(event, payload) {
    switch (event) {
      case 'push':
        return `${payload.commits?.length || 0} commits to ${payload.ref}`;
      case 'pull_request':
        return `${payload.action} PR #${payload.number || payload.pull_request?.number}: ${payload.pull_request?.title}`;
      case 'issues':
        return `${payload.action} issue #${payload.issue?.number}: ${payload.issue?.title}`;
      case 'issue_comment':
        return `Comment on #${payload.issue?.number}`;
      case 'workflow_run':
        return `Workflow ${payload.workflow_run?.name} ${payload.workflow_run?.status}`;
      default:
        return `${event} event received`;
    }
  }
  
  // Helper to beautify JSON for display
  function beautifyJson(json) {
    try {
      // If it's already a string, parse it first
      if (typeof json === 'string') {
        return JSON.stringify(JSON.parse(json), null, 2);
      }
      // Otherwise stringify the object
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return json || '';
    }
  }
  
  // Add the beautifyJson function to the response locals
  app.use((req, res, next) => {
    res.locals.beautifyJson = beautifyJson;
    res.locals.moment = moment;
    next();
  });
  
  // Dashboard home page
  app.get(basePath, (req, res) => {
    const stats = eventHistory.getStats();
    const recentEvents = eventHistory.getEvents({ limit: 10 });
    
    const serverInfo = {
      port: webhookServer.port,
      webhookUrl: webhookServer.ngrokUrl 
        ? `${webhookServer.ngrokUrl}${webhookServer.path}` 
        : `http://localhost:${webhookServer.port}${webhookServer.path}`,
      isNgrokActive: !!webhookServer.ngrokUrl,
      uptime: process.uptime(),
      eventsReceived: eventHistory.events.length,
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      registeredHandlers: Object.keys(webhookServer.eventHandlers)
    };
    
    res.render('dashboard', {
      title: 'Webhook Dashboard',
      serverInfo,
      stats,
      recentEvents,
      moment
    });
  });
  
  // Events page with filtering
  app.get(`${basePath}/events`, (req, res) => {
    const { type, repo, action, limit = 50 } = req.query;
    
    const events = eventHistory.getEvents({
      type,
      repo,
      action,
      limit: parseInt(limit, 10)
    });
    
    // Get unique values for filter dropdowns
    const filterOptions = {
      types: [...new Set(eventHistory.events.map(e => e.type))].filter(Boolean),
      repos: [...new Set(eventHistory.events.map(e => e.repository))].filter(Boolean),
      actions: [...new Set(eventHistory.events.map(e => e.action))].filter(Boolean)
    };
    
    res.render('events', {
      title: 'Webhook Events',
      events,
      filters: { type, repo, action, limit },
      filterOptions,
      moment
    });
  });
  
  // Event detail page
  app.get(`${basePath}/events/:id`, (req, res) => {
    const eventId = req.params.id;
    const event = eventHistory.getEventById(eventId);
    
    if (!event) {
      return res.status(404).render('error', {
        title: 'Event Not Found',
        message: `Event with ID ${eventId} was not found`
      });
    }
    
    res.render('event-detail', {
      title: `Event: ${event.type}`,
      event,
      moment
    });
  });
  
  // Clear events
  app.post(`${basePath}/events/clear`, (req, res) => {
    eventHistory.clearEvents();
    res.redirect(`${basePath}/events`);
  });
  
  // API routes for event data
  app.get(`${basePath}/api/events`, (req, res) => {
    const { type, repo, action, limit = 50 } = req.query;
    res.json(eventHistory.getEvents({ type, repo, action, limit: parseInt(limit, 10) }));
  });
  
  app.get(`${basePath}/api/events/:id`, (req, res) => {
    const event = eventHistory.getEventById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  });
  
  app.get(`${basePath}/api/stats`, (req, res) => {
    res.json(eventHistory.getStats());
  });
  
  app.get(`${basePath}/api/server-info`, (req, res) => {
    res.json({
      port: webhookServer.port,
      path: webhookServer.path,
      ngrokUrl: webhookServer.ngrokUrl,
      eventHandlers: Object.keys(webhookServer.eventHandlers),
      uptime: process.uptime(),
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
    });
  });
  
  // Start capturing events
  captureEvents();
  
  logger.info(`Dashboard set up at ${basePath}`);
  
  return {
    eventHistory,
    basePath
  };
}

module.exports = setupDashboard;
