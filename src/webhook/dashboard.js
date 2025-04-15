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

/**
 * Event history manager for storing and retrieving webhook events
 */
class EventHistory {
  constructor(maxEvents = 100) {
    this.events = [];
    this.maxEvents = maxEvents;
  }
  
  /**
   * Add a new event to the history
   * @param {Object} event - Event object to add
   * @returns {Object} The added event
   * @throws {Error} If event is invalid
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
      const enhancedError = errorHandler.validationError(
        `Failed to add event to history: ${error.message}`,
        { originalError: error.message }
      );
      logger.error('Failed to add event to history', { error: error.stack });
      throw enhancedError;
    }
  }
  
  /**
   * Get events from the history
   * @param {number} limit - Maximum number of events to return
   * @returns {Array} List of events
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
  
  /**
   * Find an event by ID
   * @param {string|number} id - Event ID to find
   * @returns {Object|null} Event object or null if not found
   */
  findEventById(id) {
    return this.events.find(e => String(e.id) === String(id)) || null;
  }
}

// Create a singleton instance
const eventHistory = new EventHistory(100);

/**
 * Generate a summary of an event based on its type and payload
 * @param {string} event - Event type
 * @param {Object} payload - Event payload
 * @returns {string} Event summary
 */
function getSummary(event, payload) {
  try {
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
  } catch (error) {
    logger.warn(`Error generating summary for ${event} event`, { error: error.stack });
    return `${event} event received`;
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
    
    // Add template engine
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    
    // Serve static files
    app.use(`${basePath}/static`, express.static(path.join(__dirname, 'public')));
    
    // Create middleware to capture webhook events
    const captureEvents = () => {
      // Override the _processEvent method to capture events
      const originalProcessEvent = webhookServer._processEvent.bind(webhookServer);
      webhookServer._processEvent = async (event, payload) => {
        try {
          // Capture event for dashboard
          eventHistory.addEvent({
            id: payload.id || payload.hook?.id || payload.hook_id || Date.now(),
            type: event,
            action: payload.action,
            timestamp: new Date(),
            repository: payload.repository?.full_name,
            sender: payload.sender?.login,
            summary: getSummary(event, payload),
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
        webhookUrl: webhookServer.ngrokUrl ? `${webhookServer.ngrokUrl}${webhookServer.path}` : `http://localhost:${webhookServer.port}${webhookServer.path}`,
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
    }));
    
    // Event detail page
    app.get(`${basePath}/events/:id`, errorHandler.asyncHandler(async (req, res) => {
      const eventId = req.params.id;
      const event = eventHistory.findEventById(eventId);
      
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
      const { limit = 50 } = req.query;
      const parsedLimit = parseInt(limit, 10);
      res.json(eventHistory.getEvents(isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 100)));
    }));
    
    app.get(`${basePath}/api/stats`, errorHandler.asyncHandler(async (req, res) => {
      res.json(eventHistory.getStats());
    }));
    
    app.get(`${basePath}/api/server-info`, errorHandler.asyncHandler(async (req, res) => {
      res.json({
        port: webhookServer.port,
        path: webhookServer.path,
        ngrokUrl: webhookServer.ngrokUrl,
        eventHandlers: Object.keys(webhookServer.eventHandlers),
        uptime: process.uptime()
      });
    }));
    
    // Add error handler middleware
    app.use(`${basePath}*`, errorHandler.expressErrorHandler.bind(errorHandler));
    
    // Start capturing events
    captureEvents();
    
    return {
      eventHistory,
      basePath
    };
  } catch (error) {
    const enhancedError = errorHandler.internalError(
      `Failed to set up dashboard: ${error.message}`,
      { originalError: error.message }
    );
    logger.error('Failed to set up dashboard', { error: error.stack });
    throw enhancedError;
  }
}

module.exports = setupDashboard;
