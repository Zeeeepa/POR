/**
 * Enhanced GitHub client with token persistence
 */

const { Octokit } = require('@octokit/rest');
const tokenStorage = require('./tokenStorage');
const logger = require('./logger');

class GitHubEnhanced {
  constructor() {
    this.octokit = null;
    this.initializeClient();
  }

  async initializeClient() {
    try {
      const token = await tokenStorage.getToken();
      if (token) {
        this.octokit = new Octokit({ auth: token });
        logger.info('GitHub client initialized successfully');
      } else {
        logger.warn('GitHub token not found or invalid. Please provide a valid token.');
      }
    } catch (error) {
      logger.error('Failed to initialize GitHub client:', error);
      throw new Error('GitHub authentication failed: ' + error.message);
    }
  }

  async setToken(token) {
    try {
      // Validate token by making a test API call
      const testClient = new Octokit({ auth: token });
      await testClient.users.getAuthenticated();

      // If successful, save token and update client
      await tokenStorage.saveToken(token);
      this.octokit = testClient;
      logger.info('GitHub token updated successfully');
      return true;
    } catch (error) {
      logger.error('Invalid GitHub token:', error);
      return false;
    }
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

  // Add other GitHub-related methods here
}

module.exports = GitHubEnhanced;
