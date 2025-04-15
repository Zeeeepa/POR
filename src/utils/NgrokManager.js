/**
 * NgrokManager.js
 * Manages ngrok tunnels for exposing local servers to the internet.
 */

const ngrok = require('ngrok');
const logger = require('./logger');
const config = require('./config');
const validation = require('./validation');
const errorHandler = require('./errorHandler');

/**
 * NgrokManager class for managing ngrok tunnels
 */
class NgrokManager {
  /**
   * Initialize the NgrokManager
   * @param {Object} options - Configuration options
   * @param {string} [options.authtoken] - Ngrok authtoken
   * @param {string} [options.region] - Ngrok region (us, eu, au, ap, sa, jp, in)
   */
  constructor(options = {}) {
    try {
      validation.isObject(options, 'options');
      
      this.authtoken = options.authtoken || config.ngrok.authToken;
      this.region = options.region || config.ngrok.region || 'us';
      this.url = null;
      this.isRunning = false;
      
      logger.info('NgrokManager initialized');
    } catch (error) {
      const enhancedError = errorHandler.internalError(
        `Failed to initialize NgrokManager: ${error.message}`,
        { originalError: error.message }
      );
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }

  /**
   * Start a new ngrok tunnel
   * @param {number} port - The local port to expose
   * @param {Object} [options={}] - Additional ngrok options
   * @returns {Promise<string>} - The public ngrok URL
   * @throws {Error} If tunnel creation fails
   */
  async startTunnel(port, options = {}) {
    try {
      validation.isNumber(port, 'port', { min: 1, max: 65535 });
      validation.isObject(options, 'options');
      
      if (this.isRunning) {
        logger.warn('Ngrok tunnel is already running, stopping existing tunnel first');
        await this.stopTunnel();
      }

      logger.info(`Starting ngrok tunnel for port ${port}`);

      const ngrokOptions = {
        addr: port,
        region: this.region,
        ...options
      };

      // Add authtoken if provided
      if (this.authtoken) {
        ngrokOptions.authtoken = this.authtoken;
      }

      this.url = await ngrok.connect(ngrokOptions);
      this.isRunning = true;

      logger.info(`Ngrok tunnel established at ${this.url}`);
      return this.url;
    } catch (error) {
      if (error.name === errorHandler.ErrorTypes.VALIDATION) {
        throw error;
      }
      
      const enhancedError = errorHandler.externalServiceError(
        `Failed to start ngrok tunnel: ${error.message}`,
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }

  /**
   * Stop the current ngrok tunnel
   * @returns {Promise<void>}
   * @throws {Error} If stopping the tunnel fails
   */
  async stopTunnel() {
    try {
      if (this.isRunning) {
        logger.info('Stopping ngrok tunnel');
        
        try {
          await ngrok.disconnect();
        } catch (disconnectError) {
          logger.warn(`Error disconnecting ngrok: ${disconnectError.message}. Proceeding with kill.`);
        }
        
        try {
          await ngrok.kill();
        } catch (killError) {
          logger.warn(`Error killing ngrok process: ${killError.message}`);
          throw killError; // Re-throw to be caught by outer try/catch
        }
        
        this.url = null;
        this.isRunning = false;
        logger.info('Ngrok tunnel stopped');
      } else {
        logger.warn('No ngrok tunnel is running');
      }
    } catch (error) {
      const enhancedError = errorHandler.externalServiceError(
        `Failed to stop ngrok tunnel: ${error.message}`,
        { originalError: error.message }
      );
      
      logger.error(enhancedError.message, { error: error.stack });
      throw enhancedError;
    }
  }

  /**
   * Get the current public URL
   * @returns {string} - The public ngrok URL
   * @throws {Error} - If no tunnel is running
   */
  getPublicUrl() {
    if (!this.isRunning || !this.url) {
      throw errorHandler.notFoundError('No ngrok tunnel is running');
    }
    return this.url;
  }

  /**
   * Check if ngrok is running
   * @returns {boolean} - True if ngrok is running
   */
  isNgrokRunning() {
    return this.isRunning;
  }
}

module.exports = NgrokManager;
