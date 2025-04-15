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
      
      this.authtoken = options.authtoken || config.ngrok?.authToken;
      this.region = options.region || config.ngrok?.region || 'us';
      
      // Validate region if provided
      if (options.region) {
        validation.isOneOf(options.region, 'options.region', ['us', 'eu', 'au', 'ap', 'sa', 'jp', 'in']);
      }
      
      this.url = null;
      this.isRunning = false;
      
      logger.info('NgrokManager initialized');
    } catch (error) {
      logger.error('Failed to initialize NgrokManager', { error: error.stack });
      throw errorHandler.internalError('Failed to initialize NgrokManager', { originalError: error.message });
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
          logger.error('Error disconnecting ngrok tunnel', { error: disconnectError.stack });
        }
        
        try {
          await ngrok.kill();
        } catch (killError) {
          logger.error('Error killing ngrok process', { error: killError.stack });
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
  
  /**
   * Set the authtoken for ngrok
   * @param {string} authtoken - Ngrok authtoken
   * @throws {Error} If authtoken is invalid
   */
  setAuthToken(authtoken) {
    try {
      validation.isString(authtoken, 'authtoken');
      this.authtoken = authtoken;
      logger.info('Ngrok authtoken set');
    } catch (error) {
      throw errorHandler.validationError(error.message);
    }
  }
  
  /**
   * Set the region for ngrok
   * @param {string} region - Ngrok region (us, eu, au, ap, sa, jp, in)
   * @throws {Error} If region is invalid
   */
  setRegion(region) {
    try {
      validation.isOneOf(region, 'region', ['us', 'eu', 'au', 'ap', 'sa', 'jp', 'in']);
      this.region = region;
      logger.info(`Ngrok region set to ${region}`);
    } catch (error) {
      throw errorHandler.validationError(error.message);
    }
  }
}

module.exports = NgrokManager;
