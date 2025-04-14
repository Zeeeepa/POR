/**
 * NgrokManager.js
 * Manages ngrok tunnels for exposing local servers to the internet.
 */

const ngrok = require('ngrok');
const logger = require('./logger');
const config = require('./config');

class NgrokManager {
  /**
   * Initialize the NgrokManager
   * @param {Object} options - Configuration options
   * @param {string} [options.authtoken] - Ngrok authtoken
   * @param {string} [options.region] - Ngrok region (us, eu, au, ap, sa, jp, in)
   */
  constructor(options = {}) {
    this.authtoken = options.authtoken || config.ngrok.authToken;
    this.region = options.region || config.ngrok.region || 'us';
    this.url = null;
    this.isRunning = false;
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
      if (!port || typeof port !== 'number') {
        throw new Error('Port must be a valid number');
      }

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
      logger.error(`Failed to start ngrok tunnel: ${error.message}`);
      throw error;
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
        await ngrok.disconnect();
        await ngrok.kill();
        
        this.url = null;
        this.isRunning = false;
        logger.info('Ngrok tunnel stopped');
      } else {
        logger.warn('No ngrok tunnel is running');
      }
    } catch (error) {
      logger.error(`Failed to stop ngrok tunnel: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the current public URL
   * @returns {Promise<string>} - The public ngrok URL
   * @throws {Error} - If no tunnel is running
   */
  async getPublicUrl() {
    if (!this.isRunning || !this.url) {
      throw new Error('No ngrok tunnel is running');
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
