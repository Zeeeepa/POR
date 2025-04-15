/**
 * GitHubService.js
 * A robust GitHub integration module for API authentication and repository management
 * 
 * This service provides a comprehensive interface for interacting with GitHub,
 * including authentication, repository management, branch operations, commit handling,
 * and webhook management. It implements caching, rate limiting, and error handling.
 */

const { Octokit } = require('@octokit/rest');
const { createOAuthAppAuth } = require('@octokit/auth-oauth-app');
const { createOAuthUserAuth } = require('@octokit/auth-oauth-user');
const EventEmitter = require('events');
const NodeCache = require('node-cache');
const crypto = require('crypto');
const logger = require('./logger');
const config = require('./config');
const GitHubEnhanced = require('./GitHubEnhanced');
const webhookUtils = require('./github/webhookUtils');
const errorHandler = require('./errorHandler');

// Custom error types for GitHub service
class GitHubServiceError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.name = 'GitHubServiceError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

class RateLimitError extends GitHubServiceError {
  constructor(message, details = {}) {
    super(message, 429, details);
    this.name = 'RateLimitError';
    this.retryAfter = details.retryAfter || 60;
  }
}

class AuthenticationError extends GitHubServiceError {
  constructor(message, details = {}) {
    super(message, 401, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * GitHubService class for GitHub API integration
 * Extends the functionality of GitHubEnhanced with additional features
 */
class GitHubService extends EventEmitter {
  /**
   * Initialize the GitHub service
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.token] - GitHub token (overrides config)
   * @param {string} [options.baseUrl] - GitHub API base URL (overrides config)
   * @param {Object} [options.oauth] - OAuth configuration
   * @param {string} [options.oauth.clientId] - OAuth client ID
   * @param {string} [options.oauth.clientSecret] - OAuth client secret
   * @param {string} [options.oauth.redirectUrl] - OAuth redirect URL
   * @param {number} [options.cacheTTL=300] - Cache TTL in seconds (default: 5 minutes)
   * @param {number} [options.maxRetries=3] - Maximum number of retries for failed requests
   * @param {number} [options.retryDelay=1000] - Delay between retries in milliseconds
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      token: options.token || config.github?.token,
      baseUrl: options.baseUrl || config.github?.apiUrl,
      oauth: options.oauth || config.github?.oauth || {},
      cacheTTL: options.cacheTTL || 300, // 5 minutes default
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000
    };
    
    this.octokit = null;
    this.authenticated = false;
    this.authType = null;
    this.rateLimitRemaining = null;
    this.rateLimitReset = null;
    
    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: this.options.cacheTTL,
      checkperiod: Math.floor(this.options.cacheTTL / 10),
      useClones: false
    });
    
    // Initialize enhanced GitHub client for backward compatibility
    this.enhanced = new GitHubEnhanced(options);
    
    // Bind event handlers from enhanced client
    this._bindEnhancedEvents();
    
    // Initialize if token is provided
    if (this.options.token) {
      this.authenticate({ type: 'token', token: this.options.token })
        .catch(err => {
          logger.warn('GitHub authentication failed during initialization, will retry when needed', { error: err.message });
        });
    }
  }
  
  /**
   * Bind events from enhanced GitHub client
   * @private
   */
  _bindEnhancedEvents() {
    this.enhanced.on('prCreated', (data) => this.emit('prCreated', data));
    this.enhanced.on('branchCreated', (data) => this.emit('branchCreated', data));
    this.enhanced.on('prAnalyzed', (data) => this.emit('prAnalyzed', data));
    this.enhanced.on('prMerged', (data) => this.emit('prMerged', data));
  }
  
  /**
   * Update rate limit information from response
   * @private
   * @param {Object} response - Octokit response
   */
  _updateRateLimitInfo(response) {
    if (response && response.headers) {
      this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'], 10) || null;
      this.rateLimitReset = parseInt(response.headers['x-ratelimit-reset'], 10) || null;
      
      // Emit rate limit event if we're getting low
      if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 100) {
        this.emit('rateLimitLow', {
          remaining: this.rateLimitRemaining,
          resetAt: this.rateLimitReset ? new Date(this.rateLimitReset * 1000) : null
        });
      }
    }
  }
  
  /**
   * Execute a GitHub API request with retry logic and caching
   * @private
   * @param {Function} apiCall - Function that returns a promise for the API call
   * @param {Object} [options={}] - Options for the request
   * @param {string} [options.cacheKey] - Key to use for caching
   * @param {boolean} [options.useCache=true] - Whether to use cache
   * @param {boolean} [options.updateCache=true] - Whether to update cache with results
   * @param {number} [options.retries] - Number of retries (overrides default)
   * @returns {Promise<any>} API response data
   * @throws {GitHubServiceError} On API error
   */
  async _executeRequest(apiCall, options = {}) {
    const {
      cacheKey,
      useCache = true,
      updateCache = true,
      retries = this.options.maxRetries
    } = options;
    
    // Check cache if enabled and key provided
    if (useCache && cacheKey) {
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }
    
    let lastError = null;
    let attempt = 0;
    
    while (attempt <= retries) {
      try {
        // Ensure we're authenticated
        if (!this.authenticated) {
          await this.authenticate();
        }
        
        // Execute the API call
        const response = await apiCall();
        
        // Update rate limit info
        this._updateRateLimitInfo(response);
        
        // Cache the result if enabled
        if (updateCache && cacheKey && response.data) {
          this.cache.set(cacheKey, response.data);
        }
        
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Handle rate limiting
        if (error.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
          const resetTime = error.response?.headers?.['x-ratelimit-reset'];
          const retryAfter = resetTime ? Math.ceil((parseInt(resetTime, 10) * 1000 - Date.now()) / 1000) : 60;
          
          throw new RateLimitError('GitHub API rate limit exceeded', {
            retryAfter,
            resetAt: resetTime ? new Date(parseInt(resetTime, 10) * 1000) : null
          });
        }
        
        // Handle authentication errors
        if (error.status === 401) {
          this.authenticated = false;
          throw new AuthenticationError('GitHub authentication failed', {
            message: error.message
          });
        }
        
        // For other errors, retry if we have attempts left
        if (attempt < retries) {
          const delay = this.options.retryDelay * Math.pow(2, attempt);
          logger.warn(`GitHub API request failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries: retries,
            error: error.message
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
        } else {
          // No more retries, throw the error
          throw new GitHubServiceError(
            `GitHub API request failed after ${retries} retries: ${error.message}`,
            error.status || 500,
            { originalError: error.message }
          );
        }
      }
    }
    
    // This should never be reached due to the throw in the else block above
    throw lastError;
  }
  
  /**
   * Authenticate with GitHub API
   * @param {Object} [options={}] - Authentication options
   * @param {string} [options.type='token'] - Authentication type: 'token', 'oauth-app', or 'oauth-user'
   * @param {string} [options.token] - GitHub token for token authentication
   * @param {Object} [options.oauth] - OAuth configuration for OAuth authentication
   * @param {string} [options.oauth.clientId] - OAuth client ID
   * @param {string} [options.oauth.clientSecret] - OAuth client secret
   * @param {string} [options.oauth.code] - OAuth code (for oauth-user)
   * @param {string} [options.oauth.redirectUrl] - OAuth redirect URL (for oauth-user)
   * @returns {Promise<boolean>} Authentication success
   * @throws {AuthenticationError} On authentication failure
   */
  async authenticate(options = {}) {
    try {
      const authType = options.type || 'token';
      let auth;
      
      switch (authType) {
        case 'token':
          const token = options.token || this.options.token || process.env.GITHUB_TOKEN;
          
          if (!token) {
            throw new AuthenticationError('No GitHub token provided');
          }
          
          auth = {
            auth: token
          };
          break;
          
        case 'oauth-app':
          const appOauth = options.oauth || this.options.oauth;
          
          if (!appOauth.clientId || !appOauth.clientSecret) {
            throw new AuthenticationError('Missing OAuth app credentials');
          }
          
          auth = {
            authStrategy: createOAuthAppAuth,
            auth: {
              clientId: appOauth.clientId,
              clientSecret: appOauth.clientSecret
            }
          };
          break;
          
        case 'oauth-user':
          const userOauth = options.oauth || this.options.oauth;
          
          if (!userOauth.clientId || !userOauth.clientSecret || !userOauth.code) {
            throw new AuthenticationError('Missing OAuth user credentials or code');
          }
          
          auth = {
            authStrategy: createOAuthUserAuth,
            auth: {
              clientId: userOauth.clientId,
              clientSecret: userOauth.clientSecret,
              code: userOauth.code,
              redirectUrl: userOauth.redirectUrl
            }
          };
          break;
          
        default:
          throw new AuthenticationError(`Unsupported authentication type: ${authType}`);
      }
      
      // Create Octokit instance with auth
      this.octokit = new Octokit({
        ...auth,
        baseUrl: this.options.baseUrl
      });
      
      // Verify authentication
      const { data } = await this.octokit.users.getAuthenticated();
      
      this.authenticated = true;
      this.authType = authType;
      
      logger.info(`Authenticated with GitHub as ${data.login} using ${authType}`);
      
      // Emit authentication event
      this.emit('authenticated', {
        username: data.login,
        authType: authType
      });
      
      return true;
    } catch (error) {
      this.authenticated = false;
      
      logger.error('GitHub authentication failed', {
        error: error.message,
        stack: error.stack
      });
      
      if (error instanceof AuthenticationError) {
        throw error;
      } else {
        throw new AuthenticationError(`Authentication failed: ${error.message}`, {
          originalError: error.message
        });
      }
    }
  }
  
  /**
   * Get repositories with filtering options
   * @param {Object} [options={}] - Options for fetching repositories
   * @param {string} [options.type='all'] - Type of repositories: 'all', 'owner', 'public', 'private', 'member'
   * @param {string} [options.sort='updated'] - Sort field: 'created', 'updated', 'pushed', 'full_name'
   * @param {string} [options.direction='desc'] - Sort direction: 'asc', 'desc'
   * @param {number} [options.per_page=100] - Results per page
   * @param {number} [options.page=1] - Page number
   * @param {string} [options.visibility] - Visibility: 'all', 'public', 'private'
   * @param {boolean} [options.useCache=true] - Whether to use cache
   * @returns {Promise<Array>} List of repositories
   */
  async getRepositories(options = {}) {
    const cacheKey = `repos:${JSON.stringify(options)}`;
    
    return this._executeRequest(
      () => this.octokit.repos.listForAuthenticatedUser({
        type: options.type || 'all',
        sort: options.sort || 'updated',
        direction: options.direction || 'desc',
        per_page: options.per_page || 100,
        page: options.page || 1,
        visibility: options.visibility
      }),
      {
        cacheKey,
        useCache: options.useCache !== false
      }
    );
  }
  
  /**
   * Get a specific repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {boolean} [useCache=true] - Whether to use cache
   * @returns {Promise<Object>} Repository information
   */
  async getRepository(owner, repo, useCache = true) {
    const cacheKey = `repo:${owner}/${repo}`;
    
    return this._executeRequest(
      () => this.octokit.repos.get({ owner, repo }),
      {
        cacheKey,
        useCache
      }
    );
  }
  
  /**
   * Create a new repository
   * @param {Object} options - Repository creation options
   * @param {string} options.name - Repository name
   * @param {string} [options.description] - Repository description
   * @param {boolean} [options.private=false] - Whether the repository is private
   * @param {boolean} [options.auto_init=false] - Whether to initialize with README
   * @param {string} [options.gitignore_template] - Gitignore template to use
   * @param {string} [options.license_template] - License template to use
   * @param {boolean} [options.org] - Whether to create in an organization
   * @param {string} [options.org_name] - Organization name (required if org=true)
   * @returns {Promise<Object>} Created repository
   */
  async createRepository(options) {
    if (!options.name) {
      throw new GitHubServiceError('Repository name is required');
    }
    
    if (options.org && !options.org_name) {
      throw new GitHubServiceError('Organization name is required for org repositories');
    }
    
    const repoOptions = {
      name: options.name,
      description: options.description,
      private: options.private !== undefined ? options.private : false,
      auto_init: options.auto_init !== undefined ? options.auto_init : false,
      gitignore_template: options.gitignore_template,
      license_template: options.license_template
    };
    
    if (options.org) {
      return this._executeRequest(
        () => this.octokit.repos.createInOrg({
          org: options.org_name,
          ...repoOptions
        }),
        { updateCache: false }
      );
    } else {
      return this._executeRequest(
        () => this.octokit.repos.createForAuthenticatedUser(repoOptions),
        { updateCache: false }
      );
    }
  }
  
  /**
   * Update repository settings
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Repository update options
   * @param {string} [options.name] - New repository name
   * @param {string} [options.description] - New description
   * @param {boolean} [options.private] - New private status
   * @param {boolean} [options.has_issues] - Whether to enable issues
   * @param {boolean} [options.has_projects] - Whether to enable projects
   * @param {boolean} [options.has_wiki] - Whether to enable wiki
   * @param {string} [options.default_branch] - Default branch
   * @returns {Promise<Object>} Updated repository
   */
  async updateRepository(owner, repo, options) {
    const cacheKey = `repo:${owner}/${repo}`;
    
    const result = await this._executeRequest(
      () => this.octokit.repos.update({
        owner,
        repo,
        ...options
      }),
      {
        updateCache: false
      }
    );
    
    // Invalidate cache for this repository
    this.cache.del(cacheKey);
    
    return result;
  }
  
  /**
   * Delete a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<boolean>} Success status
   */
  async deleteRepository(owner, repo) {
    const cacheKey = `repo:${owner}/${repo}`;
    
    await this._executeRequest(
      () => this.octokit.repos.delete({
        owner,
        repo
      }),
      {
        useCache: false,
        updateCache: false
      }
    );
    
    // Invalidate cache for this repository
    this.cache.del(cacheKey);
    
    // Invalidate any cache entries that might contain this repo
    const keysToDelete = [];
    this.cache.keys().forEach(key => {
      if (key.startsWith('repos:') || key.startsWith(`${owner}/${repo}`)) {
        keysToDelete.push(key);
      }
    });
    
    if (keysToDelete.length > 0) {
      this.cache.del(keysToDelete);
    }
    
    return true;
  }
  
  /**
   * Get branches for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} [options={}] - Options for fetching branches
   * @param {boolean} [options.protected] - Filter by protected status
   * @param {number} [options.per_page=100] - Results per page
   * @param {number} [options.page=1] - Page number
   * @param {boolean} [options.useCache=true] - Whether to use cache
   * @returns {Promise<Array>} List of branches
   */
  async getBranches(owner, repo, options = {}) {
    const cacheKey = `branches:${owner}/${repo}:${JSON.stringify(options)}`;
    
    return this._executeRequest(
      () => this.octokit.repos.listBranches({
        owner,
        repo,
        protected: options.protected,
        per_page: options.per_page || 100,
        page: options.page || 1
      }),
      {
        cacheKey,
        useCache: options.useCache !== false
      }
    );
  }
  
  /**
   * Create a new branch
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - New branch name
   * @param {string} sha - SHA of the commit to branch from
   * @returns {Promise<Object>} Created reference
   */
  async createBranch(owner, repo, branch, sha) {
    if (!branch) {
      throw new GitHubServiceError('Branch name is required');
    }
    
    if (!sha) {
      throw new GitHubServiceError('SHA is required');
    }
    
    // Ensure branch name has refs/heads/ prefix
    const ref = branch.startsWith('refs/heads/') ? branch : `refs/heads/${branch}`;
    
    const result = await this._executeRequest(
      () => this.octokit.git.createRef({
        owner,
        repo,
        ref,
        sha
      }),
      {
        useCache: false,
        updateCache: false
      }
    );
    
    // Invalidate branches cache
    this.cache.keys().forEach(key => {
      if (key.startsWith(`branches:${owner}/${repo}`)) {
        this.cache.del(key);
      }
    });
    
    // Emit branch created event
    this.emit('branchCreated', {
      repoName: `${owner}/${repo}`,
      branchName: branch.replace('refs/heads/', ''),
      sha
    });
    
    return result;
  }
  
  /**
   * Get commits for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} [options={}] - Options for fetching commits
   * @param {string} [options.sha] - SHA or branch name
   * @param {string} [options.path] - Only commits containing this file path
   * @param {string} [options.author] - GitHub username, name, or email
   * @param {string} [options.since] - ISO 8601 date - only commits after this date
   * @param {string} [options.until] - ISO 8601 date - only commits before this date
   * @param {number} [options.per_page=100] - Results per page
   * @param {number} [options.page=1] - Page number
   * @param {boolean} [options.useCache=true] - Whether to use cache
   * @returns {Promise<Array>} List of commits
   */
  async getCommits(owner, repo, options = {}) {
    const cacheKey = `commits:${owner}/${repo}:${JSON.stringify(options)}`;
    
    return this._executeRequest(
      () => this.octokit.repos.listCommits({
        owner,
        repo,
        sha: options.sha,
        path: options.path,
        author: options.author,
        since: options.since,
        until: options.until,
        per_page: options.per_page || 100,
        page: options.page || 1
      }),
      {
        cacheKey,
        useCache: options.useCache !== false
      }
    );
  }
  
  /**
   * Create a webhook for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} options - Webhook creation options
   * @param {string} options.url - Webhook URL
   * @param {string} [options.secret] - Webhook secret
   * @param {string} [options.content_type='json'] - Content type: 'json' or 'form'
   * @param {boolean} [options.insecure_ssl=0] - Whether to allow insecure SSL
   * @param {Array<string>} [options.events=['push', 'pull_request']] - Events to trigger webhook
   * @returns {Promise<Object>} Created webhook
   */
  async createWebhook(owner, repo, options) {
    if (!options.url) {
      throw new GitHubServiceError('Webhook URL is required');
    }
    
    const webhookConfig = {
      url: options.url,
      content_type: options.content_type || 'json',
      insecure_ssl: options.insecure_ssl || 0
    };
    
    if (options.secret) {
      webhookConfig.secret = options.secret;
    }
    
    return this._executeRequest(
      () => this.octokit.repos.createWebhook({
        owner,
        repo,
        config: webhookConfig,
        events: options.events || ['push', 'pull_request'],
        active: true
      }),
      {
        useCache: false,
        updateCache: false
      }
    );
  }
  
  /**
   * Validate webhook signature
   * @param {string|Object} payload - Webhook payload (string or parsed object)
   * @param {string} signature - X-Hub-Signature-256 header
   * @param {string} secret - Webhook secret
   * @returns {boolean} Whether the signature is valid
   */
  validateWebhookSignature(payload, signature, secret) {
    try {
      if (!payload || !signature || !secret) {
        return false;
      }
      
      // Convert payload to string if it's an object
      const payloadStr = typeof payload === 'string' 
        ? payload 
        : JSON.stringify(payload);
      
      return webhookUtils.verifySignature(signature, payloadStr, secret);
    } catch (error) {
      logger.error('Webhook signature validation failed', {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }
  
  /**
   * Clear cache entries
   * @param {string} [pattern] - Pattern to match cache keys
   * @returns {number} Number of cleared cache entries
   */
  clearCache(pattern) {
    if (!pattern) {
      const count = this.cache.keys().length;
      this.cache.flushAll();
      return count;
    }
    
    const keysToDelete = this.cache.keys().filter(key => key.includes(pattern));
    if (keysToDelete.length > 0) {
      this.cache.del(keysToDelete);
    }
    
    return keysToDelete.length;
  }
  
  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      ttl: this.options.cacheTTL
    };
  }
  
  /**
   * Get rate limit information
   * @param {boolean} [refresh=false] - Whether to refresh rate limit info
   * @returns {Promise<Object>} Rate limit information
   */
  async getRateLimitInfo(refresh = false) {
    if (refresh || this.rateLimitRemaining === null) {
      const data = await this._executeRequest(
        () => this.octokit.rateLimit.get(),
        {
          useCache: false
        }
      );
      
      return data.resources;
    }
    
    return {
      core: {
        remaining: this.rateLimitRemaining,
        reset: this.rateLimitReset
      }
    };
  }
}

module.exports = GitHubService;
