/**
 * dashboard.js
 * Web UI for monitoring webhook activity
 */

const express = require('express');
const path = require('path');
const moment = require('moment');
const validation = require('../utils/validation');
const errorHandler = require('../utils/errorHandler');
const logger = require('../utils/logger');
const webhookUtils = require('../utils/github/webhookUtils');

/**
 * Event history storage class
 */
class EventHistory {
  constructor(maxEvents = 100) {
    this.events = [];
    this.maxEvents = maxEvents;
  }
  
  /**
   * Add an event to the history
   * @param {Object} event - Event to add
   * @returns {Object} Added event
   */
  addEvent(event) {
    try {
      validation.isObject(event, 'event', { requiredProps: ['type'] });
      
      this.events.unshift(event);
      // Keep only the latest events
      if (this.events.length > this.maxEvents) {
        this.events = this.events.slice(0, this.maxEvents);
      }
      return event;
    } catch (error) {
      logger.error('Failed to add event to history', { error: error.stack });
      throw errorHandler.validationError('Failed to add event to history', { originalError: error.message });
    }
  }
  
  /**
   * Get events from the history
   * @param {number} limit - Maximum number of events to return
   * @returns {Array} Events
   */
  getEvents(limit = 50) {
    try {
      validation.isNumber(limit, 'limit', { min: 1, max: 1000 });
      return this.events.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get events', { error: error.stack });
      return [];
    }
  }
  
  /**
   * Get statistics about the events
   * @returns {Object} Event statistics
   */
  getStats() {
    const stats = {
      total: this.events.length,
      byType: {},
      byRepo: {}
    };
    
    this.events.forEach(event => {
      // Count by event type
      stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
      
      // Count by repository
      const repoName = event.repository || 'unknown';
      stats.byRepo[repoName] = (stats.byRepo[repoName] || 0) + 1;
    });
    
    return stats;
  }
}

/**
 * Set up dashboard routes on an existing Express app
 * @param {Object} app - Express app
 * @param {Object} webhookServer - WebhookServer instance
 * @param {string} basePath - Base path for dashboard routes
 * @returns {Object} Dashboard configuration
 */
function setupDashboard(app, webhookServer, basePath = '/dashboard') {
  try {
    validation.isObject(app, 'app');
    validation.isObject(webhookServer, 'webhookServer');
    validation.isString(basePath, 'basePath', true);
    
    // Create event history
    const eventHistory = new EventHistory(100);
    
    // Add template engine
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    
    // Serve static files
    app.use(`${basePath}/static`, express.static(path.join(__dirname, 'public')));
    
    // Create middleware to capture webhook events
    const captureEvents = () => {
      // Store original method reference
      const originalProcessEvent = webhookServer._processEvent.bind(webhookServer);
      
      // Override the _processEvent method to capture events
      webhookServer._processEvent = async (event, payload) => {
        try {
          // Extract repository and sender info
          const repository = webhookUtils.extractRepositoryInfo(payload);
          const sender = webhookUtils.extractSenderInfo(payload);
          
          // Capture event for dashboard
          eventHistory.addEvent({
            id: payload.id || payload.hook?.id || payload.hook_id || Date.now(),
            type: event,
            action: payload.action,
            timestamp: new Date(),
            repository: repository.fullName,
            sender: sender.login,
            summary: webhookUtils.generateEventSummary(event, payload),
            payload: JSON.stringify(payload, null, 2)
          });
          
          // Call original method
          return await originalProcessEvent(event, payload);
        } catch (error) {
          logger.error('Error in event capture middleware', { error: error.stack });
          // Still call original method even if capture fails
          return await originalProcessEvent(event, payload);
        }
      };
    };
    
    // Dashboard home page
    app.get(basePath, errorHandler.asyncHandler(async (req, res) => {
      const stats = eventHistory.getStats();
      const recentEvents = eventHistory.getEvents(10);
      
      const serverInfo = {
        port: webhookServer.port,
        webhookUrl: webhookServer.ngrokUrl ? 
          `${webhookServer.ngrokUrl}${webhookServer.path}` : 
          `http://localhost:${webhookServer.port}${webhookServer.path}`,
        isNgrokActive: !!webhookServer.ngrokUrl,
        uptime: process.uptime(),
        eventsReceived: eventHistory.events.length
      };
      
      res.render('dashboard', {
        title: 'Webhook Dashboard',
        serverInfo,
        stats,
        recentEvents,
        moment
      });
    }));
    
    // Events page with filtering
    app.get(`${basePath}/events`, errorHandler.asyncHandler(async (req, res) => {
      try {
        const { type, repo, limit = 50 } = req.query;
        let events = eventHistory.getEvents(100);
        
        // Apply filters
        if (type) {
          events = events.filter(e => e.type === type);
        }
        
        if (repo) {
          events = events.filter(e => e.repository && e.repository.includes(repo));
        }
        
        // Apply limit after filtering
        const parsedLimit = parseInt(limit, 10);
        events = events.slice(0, isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 100));
        
        res.render('events', {
          title: 'Webhook Events',
          events,
          filters: { type, repo, limit },
          moment
        });
      } catch (error) {
        throw errorHandler.internalError('Error filtering events', { originalError: error.message });
      }
    }));
    
    // Event detail page
    app.get(`${basePath}/events/:id`, errorHandler.asyncHandler(async (req, res) => {
      const eventId = req.params.id;
      const event = eventHistory.events.find(e => String(e.id) === String(eventId));
      
      if (!event) {
        throw errorHandler.notFoundError(`Event with ID ${eventId} was not found`);
      }
      
      res.render('event-detail', {
        title: `Event: ${event.type}`,
        event,
        moment
      });
    }));
    
    // API routes for event data
    app.get(`${basePath}/api/events`, errorHandler.asyncHandler(async (req, res) => {
      try {
        const { limit = 50 } = req.query;
        const parsedLimit = parseInt(limit, 10);
        const validLimit = isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 100);
        
        res.json(eventHistory.getEvents(validLimit));
      } catch (error) {
        throw errorHandler.internalError('Error retrieving events', { originalError: error.message });
      }
    }));
    
    app.get(`${basePath}/api/stats`, errorHandler.asyncHandler(async (req, res) => {
      try {
        res.json(eventHistory.getStats());
      } catch (error) {
        throw errorHandler.internalError('Error retrieving stats', { originalError: error.message });
      }
    }));
    
    app.get(`${basePath}/api/server-info`, errorHandler.asyncHandler(async (req, res) => {
      try {
        res.json({
          port: webhookServer.port,
          path: webhookServer.path,
          ngrokUrl: webhookServer.ngrokUrl,
          eventHandlers: Object.keys(webhookServer.eventHandlers),
          uptime: process.uptime()
        });
      } catch (error) {
        throw errorHandler.internalError('Error retrieving server info', { originalError: error.message });
      }
    }));
    
    // Add error handler middleware
    app.use(`${basePath}*`, errorHandler.expressErrorHandler.bind(errorHandler));
    
    // Start capturing events
    captureEvents();
    
    logger.info(`Dashboard set up at ${basePath}`);
    
    return {
      eventHistory,
      basePath
    };
  } catch (error) {
    logger.error('Failed to set up dashboard', { error: error.stack });
    throw errorHandler.internalError('Failed to set up dashboard', { originalError: error.message });
  }
}

module.exports = setupDashboard;
