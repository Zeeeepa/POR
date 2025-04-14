/**
 * dashboard.js
 * Web UI for monitoring webhook activity
 */

const express = require('express');
const path = require('path');
const moment = require('moment');

// For storing webhook events in memory
const eventHistory = {
  events: [],
  maxEvents: 100,
  addEvent(event) {
    this.events.unshift(event);
    // Keep only the latest events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }
    return event;
  },
  getEvents(limit = 50) {
    return this.events.slice(0, limit);
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
 */
function setupDashboard(app, webhookServer, basePath = '/dashboard') {
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
  app.get(basePath, (req, res) => {
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
  });
  
  // Events page with filtering
  app.get(`${basePath}/events`, (req, res) => {
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
    events = events.slice(0, parseInt(limit, 10));
    
    res.render('events', {
      title: 'Webhook Events',
      events,
      filters: { type, repo, limit },
      moment
    });
  });
  
  // Event detail page
  app.get(`${basePath}/events/:id`, (req, res) => {
    const eventId = req.params.id;
    const event = eventHistory.events.find(e => e.id == eventId);
    
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
  
  // API routes for event data
  app.get(`${basePath}/api/events`, (req, res) => {
    const { limit = 50 } = req.query;
    res.json(eventHistory.getEvents(parseInt(limit, 10)));
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
      uptime: process.uptime()
    });
  });
  
  // Start capturing events
  captureEvents();
  
  return {
    eventHistory,
    basePath
  };
}

module.exports = setupDashboard; 