/**
 * Enhanced GitHub client with token persistence
 */

const { Octokit } = require('@octokit/rest');
const tokenStorage = require('./tokenStorage');
const logger = require('./logger');

class GitHubEnhanced {
  constructor() {
    this.octokit = null;
    this.initialized = false;
  }

  async initializeClient() {
    try {
      const token = await tokenStorage.getToken();
      if (token) {
        // Validate token before using it
        if (await tokenStorage.validateToken(token)) {
          this.octokit = new Octokit({ auth: token });
          this.initialized = true;
          logger.info('Authenticated with GitHub as ' + (await this.getUserInfo()).login);
          return true;
        } else {
          logger.warn('GitHub token is invalid. Please provide a valid token.');
          return false;
        }
      } else {
        logger.warn('GitHub token not found. Please provide a valid token.');
        return false;
      }
    } catch (error) {
      logger.error('Failed to initialize GitHub client:', error);
      throw new Error('GitHub authentication failed: ' + error.message);
    }
  }

  async setToken(token) {
    try {
      // Validate token before saving
      if (await tokenStorage.validateToken(token)) {
        // Save token and update client
        await tokenStorage.saveToken(token);
        this.octokit = new Octokit({ auth: token });
        this.initialized = true;
        const user = await this.getUserInfo();
        logger.info('Authenticated with GitHub as ' + user.login);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to set GitHub token:', error);
      return false;
    }
  }

  async getUserInfo() {
    if (!this.octokit) {
      throw new Error('GitHub client not initialized. Please provide a valid token.');
    }
    const { data } = await this.octokit.users.getAuthenticated();
    return data;
  }

  async getUserRepositories(options = {}) {
    if (!this.octokit) {
      throw new Error('GitHub client not initialized. Please provide a valid token.');
    }

    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: options.per_page || 100,
        page: options.page || 1
      });

      return data;
    } catch (error) {
      logger.error('Failed to fetch repositories:', error);
      throw new Error('Failed to fetch repositories: ' + error.message);
    }
  }

  isInitialized() {
    return this.initialized && this.octokit !== null;
  }
}

module.exports = GitHubEnhanced;
