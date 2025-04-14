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

// For storing webhook events in memory
const eventHistory = {
  events: [],
  maxEvents: 100,
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
      throw error;
    }
  },
  getEvents(limit = 50) {
    try {
      validation.isNumber(limit, 'limit', { min: 1, max: 1000 });
      return this.events.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get events', { error: error.stack });
      return [];
    }
  },
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
};

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
      events = events.slice(0, isNaN(parsedLimit) ? 50 : parsedLimit);
      
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
      const event = eventHistory.events.find(e => e.id == eventId);
      
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
      res.json(eventHistory.getEvents(isNaN(parsedLimit) ? 50 : parsedLimit));
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
    logger.error('Failed to set up dashboard', { error: error.stack });
    throw error;
  }
}

module.exports = setupDashboard;
