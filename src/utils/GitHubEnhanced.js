/**
 * GitHubEnhanced.js
 * Enhanced GitHub integration with PR analysis and automation
 */

const { Octokit } = require('@octokit/rest');
const EventEmitter = require('events');
const logger = require('./logger');
const config = require('./config');
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class GitHubEnhanced extends EventEmitter {
  /**
   * Initialize the GitHubEnhanced client
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.token] - GitHub token (overrides config)
   * @param {string} [options.baseUrl] - GitHub API base URL (overrides config)
   */
  constructor(options = {}) {
    super();
    this.options = options;
    this.octokit = null;
    this.authenticated = false;
    this.prAnalysisQueue = [];
    this.mergeQueue = [];
    this.knownPRs = new Map();
    this.knownBranches = new Map();
    this.authenticationFailed = false;
    
    // Initialize if token is provided
    if (options.token || config.github.token) {
      this.authenticate().catch(err => {
        this.authenticationFailed = true;
        logger.warn('GitHub authentication failed during initialization, will retry when needed');
      });
    }
  }
  
  /**
   * Prompt user for GitHub token in terminal
   * @returns {Promise<string>} GitHub token
   */
  async promptForGitHubToken() {
    logger.info('GitHub token not found or invalid. Please provide a valid token.');
    
    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Prompt for GitHub token
    const token = await new Promise((resolve) => {
      rl.question('Enter your GitHub token: ', (answer) => {
        resolve(answer.trim());
        rl.close();
      });
    });
    
    if (token) {
      try {
        // Ensure .env file exists
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';
        
        if (fs.existsSync(envPath)) {
          // Read existing .env file
          envContent = fs.readFileSync(envPath, 'utf8');
          
          // Check if GITHUB_TOKEN already exists in the file
          if (envContent.includes('GITHUB_TOKEN=')) {
            // Replace existing token
            envContent = envContent.replace(/GITHUB_TOKEN=.*(\\r?\\n|$)/, `GITHUB_TOKEN=${token}$1`);
          } else {
            // Add GITHUB_TOKEN to the file
            envContent += `\nGITHUB_TOKEN=${token}\n`;
          }
        } else {
          // Create new .env file with token
          envContent = `GITHUB_TOKEN=${token}\n`;
        }
        
        // Write to .env file
        fs.writeFileSync(envPath, envContent);
        
        logger.info('GitHub token saved to .env file');
        
        // Update environment variable
        process.env.GITHUB_TOKEN = token;
        config.github.token = token;
        
        return token;
      } catch (error) {
        logger.error(`Failed to save GitHub token to .env file: ${error.message}`);
        
        // Still update environment variables even if file save fails
        process.env.GITHUB_TOKEN = token;
        config.github.token = token;
        
        return token;
      }
    }
    
    return null;
  }
  
  /**
   * Authenticate with GitHub API
   * @param {boolean} [retry=true] - Whether to retry with user prompt if authentication fails
   * @returns {Promise<boolean>} Authentication success
   */
  async authenticate(retry = true) {
    try {
      const token = this.options.token || config.github.token || process.env.GITHUB_TOKEN;
      
      if (!token) {
        if (retry) {
          const newToken = await this.promptForGitHubToken();
          if (newToken) {
            return this.authenticate(false);
          }
        }
        
        this.authenticationFailed = true;
        logger.warn('GitHub authentication skipped: No token provided');
        return false;
      }
      
      this.octokit = new Octokit({
        auth: token,
        baseUrl: this.options.baseUrl || config.github.apiUrl
      });
      
      // Verify authentication
      const { data } = await this.octokit.users.getAuthenticated();
      logger.info(`Authenticated with GitHub as ${data.login}`);
      
      this.authenticated = true;
      this.authenticationFailed = false;
      return true;
    } catch (error) {
      if (error.status === 401 && retry) {
        logger.warn('GitHub authentication failed: Bad credentials');
        const newToken = await this.promptForGitHubToken();
        if (newToken) {
          return this.authenticate(false);
        }
      }
      
      this.authenticationFailed = true;
      this.authenticated = false;
      
      if (!retry) {
        logger.error('GitHub authentication failed', error);
        throw error;
      } else {
        logger.warn('GitHub authentication failed, continuing with limited functionality');
        return false;
      }
    }
  }
  
  // Rest of the class remains unchanged...
}

module.exports = GitHubEnhanced;
