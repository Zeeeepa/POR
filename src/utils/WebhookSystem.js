/**
 * WebhookSystem.js
 * Comprehensive webhook system for handling events from various sources.
 * Supports validation, routing, security, registration, and monitoring.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');
const config = require('./config');
const validation = require('./validation');
const errorHandler = require('./errorHandler');
const webhookUtils = require('./github/webhookUtils');
const GitHubWebhookManager = require('./WebhookManager');

/**
 * Event handler function type
 * @callback EventHandler
 * @param {string} source - Source of the webhook (e.g., 'github', 'gitlab')
 * @param {string} event - Event type
 * @param {Object} payload - Event payload
 * @returns {Promise<void>}
 */

/**
 * WebhookSystem class for managing webhooks from multiple sources
 */
class WebhookSystem {
  /**
   * Initialize the webhook system
   * @param {Object} [options={}] - Configuration options
   * @param {Object} [options.sources={}] - Source-specific configurations
   * @param {Object} [options.storage=null] - Storage adapter for persistence
   * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
   * @param {number} [options.retryDelay=5000] - Delay between retries in ms
   */
  constructor(options = {}) {
    this.options = {
      sources: options.sources || {},
      storage: options.storage || null,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000
    };

    // Initialize source-specific webhook managers
    this.webhookManagers = {};
    if (this.options.sources.github) {
      this.webhookManagers.github = new GitHubWebhookManager(
        this.options.sources.github.token,
        this.options.sources.github.webhookUrl
      );
    }

    // Initialize event handlers registry
    this.eventHandlers = {
      // Structure: { source: { event: [{ id, handler, priority }] } }
    };

    // Initialize webhooks registry
    this.webhooks = {
      // Structure: { id: { source, url, secret, events, createdAt, updatedAt } }
    };

    // Initialize event log
    this.eventLog = {
      // Structure: { id: { source, event, payload, timestamp, status, retries, error } }
    };

    // Initialize statistics
    this.stats = {
      // Structure: { source: { received, processed, failed, retried } }
    };

    // Load persisted data if storage is provided
    this._loadFromStorage();
  }

  /**
   * Load persisted data from storage
   * @private
   */
  async _loadFromStorage() {
    if (!this.options.storage) return;

    try {
      // Load webhooks
      const webhooks = await this.options.storage.getWebhooks();
      if (webhooks) this.webhooks = webhooks;

      // Load event log
      const eventLog = await this.options.storage.getEventLog();
      if (eventLog) this.eventLog = eventLog;

      // Load statistics
      const stats = await this.options.storage.getStats();
      if (stats) this.stats = stats;

      logger.info('Loaded webhook system data from storage');
    } catch (error) {
      logger.error('Failed to load webhook system data from storage', { error: error.stack });
    }
  }

  /**
   * Save data to storage
   * @private
   * @param {string} dataType - Type of data to save ('webhooks', 'eventLog', 'stats')
   */
  async _saveToStorage(dataType) {
    if (!this.options.storage) return;

    try {
      switch (dataType) {
        case 'webhooks':
          await this.options.storage.saveWebhooks(this.webhooks);
          break;
        case 'eventLog':
          await this.options.storage.saveEventLog(this.eventLog);
          break;
        case 'stats':
          await this.options.storage.saveStats(this.stats);
          break;
        case 'all':
          await Promise.all([
            this.options.storage.saveWebhooks(this.webhooks),
            this.options.storage.saveEventLog(this.eventLog),
            this.options.storage.saveStats(this.stats)
          ]);
          break;
        default:
          logger.warn(`Unknown data type for storage: ${dataType}`);
      }
    } catch (error) {
      logger.error(`Failed to save ${dataType} to storage`, { error: error.stack });
    }
  }

  /**
   * Initialize statistics for a source if not already present
   * @private
   * @param {string} source - Webhook source
   */
  _initializeStats(source) {
    if (!this.stats[source]) {
      this.stats[source] = {
        received: 0,
        processed: 0,
        failed: 0,
        retried: 0,
        lastEvent: null
      };
    }
  }

  /**
   * Register a new webhook endpoint
   * @param {string} source - Source of the webhook (e.g., 'github', 'gitlab')
   * @param {Object} options - Webhook options
   * @param {string} options.url - URL for the webhook
   * @param {string} [options.secret] - Secret for webhook signature validation
   * @param {Array<string>} [options.events] - Events to subscribe to
   * @returns {Promise<{id: string, success: boolean, message: string}>} Result with webhook ID
   * @throws {Error} If parameters are invalid
   */
  async registerWebhook(source, options) {
    try {
      // Validate parameters
      validation.isString(source, 'source');
      validation.isObject(options, 'options', {
        requiredProps: ['url'],
        propValidators: {
          url: (val, name) => validation.isUrl(val, name),
          secret: (val, name) => validation.isString(val, name),
          events: (val, name) => validation.isArray(val, name)
        }
      });

      // Check if source is supported
      if (!this.webhookManagers[source]) {
        throw errorHandler.validationError(`Unsupported webhook source: ${source}`);
      }

      // Generate webhook ID
      const webhookId = uuidv4();

      // Create webhook record
      this.webhooks[webhookId] = {
        id: webhookId,
        source,
        url: options.url,
        secret: options.secret || crypto.randomBytes(32).toString('hex'),
        events: options.events || ['*'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Source-specific registration
      let result = { success: true, message: `Webhook registered successfully` };
      
      if (source === 'github') {
        // Set webhook URL in the manager
        this.webhookManagers.github.setWebhookUrl(options.url);
        
        // If repository is specified, register webhook for that repository
        if (options.repository) {
          result = await this.webhookManagers.github.ensureWebhookExists(
            options.repository,
            {
              events: options.events,
              secret: options.secret
            }
          );
        }
      }

      // Save to storage
      await this._saveToStorage('webhooks');

      logger.info(`Registered webhook for ${source}`, { webhookId });
      return {
        id: webhookId,
        success: result.success,
        message: result.message
      };
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      const enhancedError = errorHandler.webhookError(
        `Error registering webhook for ${source}`,
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }

  /**
   * Unregister a webhook endpoint
   * @param {string} id - Webhook ID
   * @returns {Promise<{success: boolean, message: string}>} Result with success flag
   * @throws {Error} If webhook ID is invalid
   */
  async unregisterWebhook(id) {
    try {
      validation.isString(id, 'id');
      
      if (!this.webhooks[id]) {
        return {
          success: false,
          message: `Webhook with ID ${id} not found`
        };
      }
      
      const webhook = this.webhooks[id];
      delete this.webhooks[id];
      
      // Save to storage
      await this._saveToStorage('webhooks');
      
      logger.info(`Unregistered webhook ${id} for ${webhook.source}`);
      return {
        success: true,
        message: `Webhook ${id} unregistered successfully`
      };
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      const enhancedError = errorHandler.webhookError(
        `Error unregistering webhook ${id}`,
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * Validate webhook signature
   * @param {string} source - Source of the webhook (e.g., 'github', 'gitlab')
   * @param {Object|string} payload - Webhook payload (object or raw string)
   * @param {string} signature - Webhook signature from headers
   * @param {string} secret - Webhook secret
   * @returns {boolean} Whether the signature is valid
   * @throws {Error} If parameters are invalid
   */
  validateWebhook(source, payload, signature, secret) {
    try {
      // Validate parameters
      validation.isString(source, 'source');
      validation.exists(payload, 'payload');
      validation.isString(signature, 'signature');
      validation.isString(secret, 'secret');
      
      // Convert payload to string if it's an object
      const payloadString = typeof payload === 'string' 
        ? payload 
        : JSON.stringify(payload);
      
      // Source-specific validation
      switch (source) {
        case 'github':
          return webhookUtils.verifySignature(signature, payloadString, secret);
        
        case 'gitlab':
          // GitLab uses a different validation method
          const hmac = crypto.createHmac('sha256', secret);
          const digest = hmac.update(payloadString).digest('hex');
          return signature === digest;
        
        default:
          // Generic HMAC-SHA256 validation
          const hmacGen = crypto.createHmac('sha256', secret);
          const digestGen = hmacGen.update(payloadString).digest('hex');
          return signature === digestGen;
      }
    } catch (error) {
      logger.error(`Error validating webhook signature for ${source}`, { error: error.stack });
      return false;
    }
  }

  /**
   * Process a webhook event
   * @param {string} source - Source of the webhook (e.g., 'github', 'gitlab')
   * @param {string} event - Event type
   * @param {Object} payload - Event payload
   * @returns {Promise<{success: boolean, eventId: string, message: string}>} Processing result
   * @throws {Error} If parameters are invalid
   */
  async processWebhook(source, event, payload) {
    try {
      // Validate parameters
      validation.isString(source, 'source');
      validation.isString(event, 'event');
      validation.isObject(payload, 'payload');
      
      // Generate event ID
      const eventId = uuidv4();
      
      // Initialize stats for this source
      this._initializeStats(source);
      
      // Update received count
      this.stats[source].received += 1;
      this.stats[source].lastEvent = new Date().toISOString();
      
      // Log the event
      this.eventLog[eventId] = {
        id: eventId,
        source,
        event,
        payload: webhookUtils.sanitizePayload(payload),
        timestamp: new Date().toISOString(),
        status: 'received',
        retries: 0
      };
      
      // Save event log to storage
      await this._saveToStorage('eventLog');
      
      // Process the event asynchronously
      this._processEvent(eventId, source, event, payload)
        .then(() => this._saveToStorage('all'))
        .catch(error => {
          logger.error(`Error in async event processing for ${eventId}`, { error: error.stack });
          this._saveToStorage('all');
        });
      
      logger.info(`Received webhook event ${event} from ${source}`, { eventId });
      return {
        success: true,
        eventId,
        message: `Event received and queued for processing`
      };
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      const enhancedError = errorHandler.webhookError(
        `Error processing webhook from ${source}`,
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }

  /**
   * Process an event by calling registered handlers
   * @private
   * @param {string} eventId - Event ID
   * @param {string} source - Source of the webhook
   * @param {string} event - Event type
   * @param {Object} payload - Event payload
   * @returns {Promise<void>}
   */
  async _processEvent(eventId, source, event, payload) {
    try {
      // Update event status
      this.eventLog[eventId].status = 'processing';
      
      // Get handlers for this event
      const handlers = this._getEventHandlers(source, event);
      
      if (handlers.length === 0) {
        logger.info(`No handlers registered for ${source}:${event}`);
        this.eventLog[eventId].status = 'completed';
        this.stats[source].processed += 1;
        return;
      }
      
      // Execute handlers in order of priority
      for (const { handler, id } of handlers) {
        try {
          await handler(source, event, payload);
          logger.debug(`Handler ${id} executed successfully for ${source}:${event}`);
        } catch (error) {
          logger.error(`Handler ${id} failed for ${source}:${event}`, { error: error.stack });
          this.eventLog[eventId].handlerErrors = this.eventLog[eventId].handlerErrors || {};
          this.eventLog[eventId].handlerErrors[id] = error.message;
        }
      }
      
      // Update event status and stats
      this.eventLog[eventId].status = 'completed';
      this.eventLog[eventId].completedAt = new Date().toISOString();
      this.stats[source].processed += 1;
      
      logger.info(`Successfully processed event ${eventId} from ${source}:${event}`);
    } catch (error) {
      // Update event status and stats
      this.eventLog[eventId].status = 'failed';
      this.eventLog[eventId].error = error.message;
      this.stats[source].failed += 1;
      
      logger.error(`Failed to process event ${eventId} from ${source}:${event}`, { error: error.stack });
      
      // Attempt retry if within retry limit
      if (this.eventLog[eventId].retries < this.options.maxRetries) {
        this._scheduleRetry(eventId, source, event, payload);
      }
    }
  }

  /**
   * Schedule a retry for a failed event
   * @private
   * @param {string} eventId - Event ID
   * @param {string} source - Source of the webhook
   * @param {string} event - Event type
   * @param {Object} payload - Event payload
   */
  _scheduleRetry(eventId, source, event, payload) {
    const retryCount = this.eventLog[eventId].retries + 1;
    const delay = this.options.retryDelay * Math.pow(2, retryCount - 1); // Exponential backoff
    
    logger.info(`Scheduling retry ${retryCount} for event ${eventId} in ${delay}ms`);
    
    this.eventLog[eventId].status = 'retry-scheduled';
    this.eventLog[eventId].retries = retryCount;
    this.eventLog[eventId].nextRetry = new Date(Date.now() + delay).toISOString();
    
    setTimeout(async () => {
      try {
        this.stats[source].retried += 1;
        this.eventLog[eventId].status = 'retrying';
        await this._processEvent(eventId, source, event, payload);
      } catch (error) {
        logger.error(`Retry ${retryCount} failed for event ${eventId}`, { error: error.stack });
      }
    }, delay);
  }

  /**
   * Get all handlers for a specific event
   * @private
   * @param {string} source - Source of the webhook
   * @param {string} event - Event type
   * @returns {Array<{id: string, handler: Function, priority: number}>} Array of handlers
   */
  _getEventHandlers(source, event) {
    const handlers = [];
    
    // Add source-specific event handlers
    if (this.eventHandlers[source] && this.eventHandlers[source][event]) {
      handlers.push(...this.eventHandlers[source][event]);
    }
    
    // Add source-specific wildcard handlers
    if (this.eventHandlers[source] && this.eventHandlers[source]['*']) {
      handlers.push(...this.eventHandlers[source]['*']);
    }
    
    // Add global wildcard handlers
    if (this.eventHandlers['*'] && this.eventHandlers['*']['*']) {
      handlers.push(...this.eventHandlers['*']['*']);
    }
    
    // Sort by priority (higher numbers first)
    return handlers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Register an event handler
   * @param {string} source - Source of the webhook (e.g., 'github', 'gitlab')
   * @param {string} event - Event type
   * @param {Function} handler - Event handler function
   * @param {Object} [options={}] - Handler options
   * @param {number} [options.priority=0] - Handler priority (higher numbers execute first)
   * @returns {string} Handler ID
   * @throws {Error} If parameters are invalid
   */
  registerEventHandler(source, event, handler, options = {}) {
    try {
      // Validate parameters
      validation.isString(source, 'source');
      validation.isString(event, 'event');
      validation.isFunction(handler, 'handler');
      
      // Generate handler ID
      const handlerId = uuidv4();
      
      // Initialize source and event in registry if needed
      if (!this.eventHandlers[source]) {
        this.eventHandlers[source] = {};
      }
      
      if (!this.eventHandlers[source][event]) {
        this.eventHandlers[source][event] = [];
      }
      
      // Add handler to registry
      this.eventHandlers[source][event].push({
        id: handlerId,
        handler,
        priority: options.priority || 0
      });
      
      logger.info(`Registered handler ${handlerId} for ${source}:${event}`);
      return handlerId;
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      const enhancedError = errorHandler.webhookError(
        `Error registering event handler for ${source}:${event}`,
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }

  /**
   * Unregister an event handler
   * @param {string} source - Source of the webhook
   * @param {string} event - Event type
   * @param {string} handlerId - Handler ID to unregister
   * @returns {boolean} Whether the handler was found and removed
   * @throws {Error} If parameters are invalid
   */
  unregisterEventHandler(source, event, handlerId) {
    try {
      // Validate parameters
      validation.isString(source, 'source');
      validation.isString(event, 'event');
      validation.isString(handlerId, 'handlerId');
      
      // Check if handlers exist for this source and event
      if (!this.eventHandlers[source] || !this.eventHandlers[source][event]) {
        return false;
      }
      
      // Find handler index
      const handlerIndex = this.eventHandlers[source][event].findIndex(h => h.id === handlerId);
      
      if (handlerIndex === -1) {
        return false;
      }
      
      // Remove handler
      this.eventHandlers[source][event].splice(handlerIndex, 1);
      
      // Clean up empty arrays
      if (this.eventHandlers[source][event].length === 0) {
        delete this.eventHandlers[source][event];
        
        if (Object.keys(this.eventHandlers[source]).length === 0) {
          delete this.eventHandlers[source];
        }
      }
      
      logger.info(`Unregistered handler ${handlerId} for ${source}:${event}`);
      return true;
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      logger.error(`Error unregistering event handler for ${source}:${event}`, { error: error.stack });
      return false;
    }
  }

  /**
   * Get webhook statistics
   * @param {string} [source] - Source to get statistics for (all sources if not specified)
   * @returns {Object} Webhook statistics
   */
  getWebhookStats(source) {
    if (source) {
      return this.stats[source] || {
        received: 0,
        processed: 0,
        failed: 0,
        retried: 0,
        lastEvent: null
      };
    }
    
    return this.stats;
  }

  /**
   * Replay a previously received event
   * @param {string} eventId - Event ID to replay
   * @returns {Promise<{success: boolean, message: string}>} Result with success flag
   * @throws {Error} If event ID is invalid
   */
  async replayEvent(eventId) {
    try {
      validation.isString(eventId, 'eventId');
      
      if (!this.eventLog[eventId]) {
        return {
          success: false,
          message: `Event with ID ${eventId} not found`
        };
      }
      
      const event = this.eventLog[eventId];
      
      // Create a new event ID for the replay
      const replayId = uuidv4();
      
      // Copy the event with a new ID and reset status
      this.eventLog[replayId] = {
        id: replayId,
        source: event.source,
        event: event.event,
        payload: event.payload,
        timestamp: new Date().toISOString(),
        status: 'received',
        retries: 0,
        replayOf: eventId
      };
      
      // Initialize stats for this source
      this._initializeStats(event.source);
      
      // Update received count
      this.stats[event.source].received += 1;
      this.stats[event.source].lastEvent = new Date().toISOString();
      
      // Save event log to storage
      await this._saveToStorage('eventLog');
      
      // Process the event asynchronously
      this._processEvent(replayId, event.source, event.event, event.payload)
        .then(() => this._saveToStorage('all'))
        .catch(error => {
          logger.error(`Error in async event processing for ${replayId}`, { error: error.stack });
          this._saveToStorage('all');
        });
      
      logger.info(`Replaying webhook event ${event.event} from ${event.source}`, { 
        originalEventId: eventId, 
        replayId 
      });
      
      return {
        success: true,
        eventId: replayId,
        message: `Event ${eventId} replayed successfully with new ID ${replayId}`
      };
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      const enhancedError = errorHandler.webhookError(
        `Error replaying event ${eventId}`,
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }

  /**
   * List received events with filtering options
   * @param {Object} [options={}] - Filtering options
   * @param {string} [options.source] - Filter by source
   * @param {string} [options.event] - Filter by event type
   * @param {string} [options.status] - Filter by status
   * @param {string} [options.from] - Filter by timestamp (from)
   * @param {string} [options.to] - Filter by timestamp (to)
   * @param {number} [options.limit=100] - Maximum number of events to return
   * @param {number} [options.offset=0] - Offset for pagination
   * @returns {Array<Object>} Array of events
   */
  listEvents(options = {}) {
    try {
      const {
        source,
        event,
        status,
        from,
        to,
        limit = 100,
        offset = 0
      } = options;
      
      // Convert timestamps to Date objects if provided
      const fromDate = from ? new Date(from) : null;
      const toDate = to ? new Date(to) : null;
      
      // Filter events
      const filteredEvents = Object.values(this.eventLog)
        .filter(e => {
          if (source && e.source !== source) return false;
          if (event && e.event !== event) return false;
          if (status && e.status !== status) return false;
          
          if (fromDate) {
            const eventDate = new Date(e.timestamp);
            if (eventDate < fromDate) return false;
          }
          
          if (toDate) {
            const eventDate = new Date(e.timestamp);
            if (eventDate > toDate) return false;
          }
          
          return true;
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by timestamp (newest first)
      
      // Apply pagination
      return filteredEvents.slice(offset, offset + limit);
    } catch (error) {
      logger.error('Error listing events', { error: error.stack });
      return [];
    }
  }

  /**
   * Get detailed information about an event
   * @param {string} eventId - Event ID
   * @returns {Object|null} Event details or null if not found
   * @throws {Error} If event ID is invalid
   */
  getEventDetails(eventId) {
    try {
      validation.isString(eventId, 'eventId');
      
      if (!this.eventLog[eventId]) {
        return null;
      }
      
      return this.eventLog[eventId];
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      logger.error(`Error getting event details for ${eventId}`, { error: error.stack });
      return null;
    }
  }
}

module.exports = WebhookSystem;
