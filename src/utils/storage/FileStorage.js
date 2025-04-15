/**
 * FileStorage.js
 * File-based storage adapter for the WebhookSystem
 */

const fs = require('fs-extra');
const path = require('path');
const logger = require('../logger');

/**
 * FileStorage class for persisting webhook system data to the filesystem
 */
class FileStorage {
  /**
   * Initialize the file storage adapter
   * @param {Object} [options={}] - Storage options
   * @param {string} [options.directory='./data'] - Directory to store data files
   */
  constructor(options = {}) {
    this.directory = options.directory || './data';
    this.webhooksFile = path.join(this.directory, 'webhooks.json');
    this.eventLogFile = path.join(this.directory, 'event-log.json');
    this.statsFile = path.join(this.directory, 'stats.json');
    
    // Ensure the directory exists
    fs.ensureDirSync(this.directory);
  }
  
  /**
   * Get stored webhooks
   * @returns {Promise<Object>} Stored webhooks
   */
  async getWebhooks() {
    try {
      if (await fs.pathExists(this.webhooksFile)) {
        const data = await fs.readFile(this.webhooksFile, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      logger.error(`Error reading webhooks from ${this.webhooksFile}`, { error: error.stack });
      return {};
    }
  }
  
  /**
   * Save webhooks to storage
   * @param {Object} webhooks - Webhooks to save
   * @returns {Promise<void>}
   */
  async saveWebhooks(webhooks) {
    try {
      await fs.writeFile(this.webhooksFile, JSON.stringify(webhooks, null, 2), 'utf8');
    } catch (error) {
      logger.error(`Error saving webhooks to ${this.webhooksFile}`, { error: error.stack });
    }
  }
  
  /**
   * Get stored event log
   * @returns {Promise<Object>} Stored event log
   */
  async getEventLog() {
    try {
      if (await fs.pathExists(this.eventLogFile)) {
        const data = await fs.readFile(this.eventLogFile, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      logger.error(`Error reading event log from ${this.eventLogFile}`, { error: error.stack });
      return {};
    }
  }
  
  /**
   * Save event log to storage
   * @param {Object} eventLog - Event log to save
   * @returns {Promise<void>}
   */
  async saveEventLog(eventLog) {
    try {
      await fs.writeFile(this.eventLogFile, JSON.stringify(eventLog, null, 2), 'utf8');
    } catch (error) {
      logger.error(`Error saving event log to ${this.eventLogFile}`, { error: error.stack });
    }
  }
  
  /**
   * Get stored statistics
   * @returns {Promise<Object>} Stored statistics
   */
  async getStats() {
    try {
      if (await fs.pathExists(this.statsFile)) {
        const data = await fs.readFile(this.statsFile, 'utf8');
        return JSON.parse(data);
      }
      return {};
    } catch (error) {
      logger.error(`Error reading stats from ${this.statsFile}`, { error: error.stack });
      return {};
    }
  }
  
  /**
   * Save statistics to storage
   * @param {Object} stats - Statistics to save
   * @returns {Promise<void>}
   */
  async saveStats(stats) {
    try {
      await fs.writeFile(this.statsFile, JSON.stringify(stats, null, 2), 'utf8');
    } catch (error) {
      logger.error(`Error saving stats to ${this.statsFile}`, { error: error.stack });
    }
  }
  
  /**
   * Clear all stored data
   * @returns {Promise<void>}
   */
  async clearAll() {
    try {
      await Promise.all([
        fs.remove(this.webhooksFile),
        fs.remove(this.eventLogFile),
        fs.remove(this.statsFile)
      ]);
      logger.info('Cleared all webhook system data');
    } catch (error) {
      logger.error('Error clearing webhook system data', { error: error.stack });
    }
  }
}

module.exports = FileStorage;
