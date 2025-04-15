/**
 * GitHubEnhanced.js
 * Enhanced GitHub integration with PR analysis and automation
 */

const { Octokit } = require('@octokit/rest');
const EventEmitter = require('events');
const logger = require('./logger');
const config = require('./config');

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
    
    // Initialize if token is provided
    if (options.token || config.github.token) {
      this.authenticate();
    }
  }
  
  /**
   * Authenticate with GitHub API
   * @returns {Promise<boolean>} Authentication success
   * @throws {Error} If authentication fails
   */
  async authenticate() {
    try {
      const token = this.options.token || config.github.token || process.env.GITHUB_TOKEN;
      
      if (!token) {
        throw new Error('GitHub token not provided');
      }
      
      this.octokit = new Octokit({
        auth: token,
        baseUrl: this.options.baseUrl || config.github.apiUrl
      });
      
      // Verify authentication
      const { data } = await this.octokit.users.getAuthenticated();
      logger.info(`Authenticated with GitHub as ${data.login}`);
      
      this.authenticated = true;
      return true;
    } catch (error) {
      logger.logError('GitHub authentication failed', error);
      this.authenticated = false;
      throw error;
    }
  }
  
  /**
   * Get open pull requests for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of open PRs
   * @throws {Error} If not authenticated or request fails
   */
  async getOpenPRs(owner, repo) {
    try {
      if (!this.authenticated) {
        await this.authenticate();
      }
      
      logger.info(`Fetching open PRs for ${owner}/${repo}`);
      
      const { data: prs } = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'open',
        sort: 'created',
        direction: 'desc',
        per_page: 100
      });
      
      // Check for new PRs
      for (const pr of prs) {
        const prKey = `${owner}/${repo}#${pr.number}`;
        
        if (!this.knownPRs.has(prKey)) {
          // New PR found
          this.knownPRs.set(prKey, {
            number: pr.number,
            title: pr.title,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at
          });
          
          // Emit event for new PR
          this.emit('prCreated', {
            repoName: `${owner}/${repo}`,
            prNumber: pr.number,
            title: pr.title,
            url: pr.html_url
          });
          
          logger.info(`New PR detected: ${prKey} - ${pr.title}`);
        }
      }
      
      return prs;
    } catch (error) {
      logger.error(`Failed to get open PRs for ${owner}/${repo}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get branches for a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of branches
   * @throws {Error} If not authenticated or request fails
   */
  async getBranches(owner, repo) {
    try {
      if (!this.authenticated) {
        await this.authenticate();
      }
      
      logger.info(`Fetching branches for ${owner}/${repo}`);
      
      const { data: branches } = await this.octokit.repos.listBranches({
        owner,
        repo,
        per_page: 100
      });
      
      // Check for new branches
      for (const branch of branches) {
        const branchKey = `${owner}/${repo}:${branch.name}`;
        
        if (!this.knownBranches.has(branchKey)) {
          // New branch found
          this.knownBranches.set(branchKey, {
            name: branch.name,
            sha: branch.commit.sha,
            detectedAt: new Date().toISOString()
          });
          
          // Emit event for new branch
          this.emit('branchCreated', {
            repoName: `${owner}/${repo}`,
            branchName: branch.name,
            sha: branch.commit.sha
          });
          
          logger.info(`New branch detected: ${branchKey}`);
        }
      }
      
      return branches;
    } catch (error) {
      logger.error(`Failed to get branches for ${owner}/${repo}: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get details of a specific pull request
   * @param {string} repoFullName - Repository name in format "owner/repo"
   * @param {number} prNumber - Pull request number
   * @returns {Promise<Object>} Pull request details
   * @throws {Error} If not authenticated or request fails
   */
  async getPRDetails(repoFullName, prNumber) {
    try {
      if (!this.authenticated) {
        await this.authenticate();
      }
      
      const [owner, repo] = repoFullName.split('/');
      
      logger.info(`Fetching details for PR #${prNumber} in ${repoFullName}`);
      
      // Get PR details
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Get PR files
      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Combine data
      return {
        ...pr,
        files
      };
    } catch (error) {
      logger.error(`Failed to get PR details for #${prNumber} in ${repoFullName}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get content of a file from a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} path - File path
   * @param {string} [ref] - Git reference (branch, commit, tag)
   * @returns {Promise<string>} File content
   * @throws {Error} If not authenticated or request fails
   */
  async getFileContent(owner, repo, path, ref) {
    try {
      if (!this.authenticated) {
        await this.authenticate();
      }
      
      logger.info(`Fetching content for ${path} in ${owner}/${repo}${ref ? ` at ${ref}` : ''}`);
      
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref
      });
      
      // Decode content from base64
      if (data.encoding === 'base64' && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf8');
      }
      
      return null;
    } catch (error) {
      logger.error(`Failed to get file content for ${path} in ${owner}/${repo}: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Add a PR to the analysis queue
   * @param {Object} prData - Pull request data
   * @param {string} prData.owner - Repository owner
   * @param {string} prData.repo - Repository name
   * @param {number} prData.pull_number - Pull request number
   * @param {boolean} [prData.autoMerge=false] - Whether to auto-merge if analysis passes
   * @returns {boolean} Success status
   * @throws {Error} If required parameters are missing
   */
  addPrToAnalysisQueue(prData) {
    try {
      // Validate required fields
      if (!prData.owner || !prData.repo || !prData.pull_number) {
        throw new Error('Missing required PR data (owner, repo, pull_number)');
      }
      
      // Check if PR is already in queue
      const existingIndex = this.prAnalysisQueue.findIndex(item => 
        item.owner === prData.owner && 
        item.repo === prData.repo && 
        item.pull_number === prData.pull_number
      );
      
      if (existingIndex !== -1) {
        // Update existing entry
        this.prAnalysisQueue[existingIndex] = {
          ...this.prAnalysisQueue[existingIndex],
          ...prData,
          updatedAt: new Date().toISOString()
        };
        
        logger.info(`Updated PR in analysis queue: ${prData.owner}/${prData.repo}#${prData.pull_number}`);
      } else {
        // Add new entry
        this.prAnalysisQueue.push({
          ...prData,
          status: 'pending',
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        logger.info(`Added PR to analysis queue: ${prData.owner}/${prData.repo}#${prData.pull_number}`);
      }
      
      return true;
    } catch (error) {
      logger.logError('Failed to add PR to analysis queue', error);
      throw error;
    }
  }
  
  /**
   * Process the PR analysis queue
   * @returns {Promise<Object>} Processing results
   * @throws {Error} If not authenticated
   */
  async processAnalysisQueue() {
    if (!this.authenticated) {
      const error = new Error('Cannot process PR analysis queue: Not authenticated with GitHub');
      logger.warn(error.message);
      throw error;
    }
    
    if (this.prAnalysisQueue.length === 0) {
      return { success: true, processed: 0 };
    }
    
    logger.info(`Processing PR analysis queue (${this.prAnalysisQueue.length} items)`);
    
    const results = {
      success: true,
      processed: 0,
      failed: 0,
      details: []
    };
    
    // Process each PR in the queue
    for (let i = 0; i < this.prAnalysisQueue.length; i++) {
      const prData = this.prAnalysisQueue[i];
      
      if (prData.status === 'processing' || prData.status === 'completed') {
        continue;
      }
      
      try {
        // Mark as processing
        prData.status = 'processing';
        prData.processingStartedAt = new Date().toISOString();
        
        // Analyze PR
        const analysisResult = await this.analyzePR(prData);
        
        // Update status
        prData.status = 'completed';
        prData.completedAt = new Date().toISOString();
        prData.result = analysisResult;
        
        results.processed++;
        results.details.push({
          pr: `${prData.owner}/${prData.repo}#${prData.pull_number}`,
          success: true
        });
        
        logger.info(`Successfully analyzed PR: ${prData.owner}/${prData.repo}#${prData.pull_number}`);
      } catch (error) {
        // Update status
        prData.status = 'failed';
        prData.failedAt = new Date().toISOString();
        prData.error = error.message;
        
        results.failed++;
        results.details.push({
          pr: `${prData.owner}/${prData.repo}#${prData.pull_number}`,
          success: false,
          error: error.message
        });
        
        logger.logError(`Failed to analyze PR: ${prData.owner}/${prData.repo}#${prData.pull_number}`, error);
      }
    }
    
    // Clean up completed items (keep for reference)
    this.cleanupQueue();
    
    return results;
  }
  
  /**
   * Analyze a pull request
   * @param {Object} prData - Pull request data
   * @param {string} prData.owner - Repository owner
   * @param {string} prData.repo - Repository name
   * @param {number} prData.pull_number - Pull request number
   * @returns {Promise<Object>} Analysis result
   * @throws {Error} If analysis fails
   */
  async analyzePR(prData) {
    try {
      if (!this.authenticated) {
        throw new Error('Not authenticated with GitHub');
      }
      
      // Validate required fields
      if (!prData.owner || !prData.repo || !prData.pull_number) {
        throw new Error('Missing required PR data (owner, repo, pull_number)');
      }
      
      // Get PR details
      const { data: pr } = await this.octokit.pulls.get({
        owner: prData.owner,
        repo: prData.repo,
        pull_number: prData.pull_number
      });
      
      // Get PR files
      const { data: files } = await this.octokit.pulls.listFiles({
        owner: prData.owner,
        repo: prData.repo,
        pull_number: prData.pull_number
      });
      
      // Get PR comments
      const { data: comments } = await this.octokit.issues.listComments({
        owner: prData.owner,
        repo: prData.repo,
        issue_number: prData.pull_number
      });
      
      // Analyze PR (simplified for now)
      const analysis = {
        title: pr.title,
        state: pr.state,
        user: pr.user.login,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        mergeable: pr.mergeable,
        mergeable_state: pr.mergeable_state,
        files: {
          count: files.length,
          extensions: this.getFileExtensions(files),
          additions: files.reduce((sum, file) => sum + file.additions, 0),
          deletions: files.reduce((sum, file) => sum + file.deletions, 0),
          changes: files.reduce((sum, file) => sum + file.changes, 0)
        },
        comments: comments.length,
        auto_merge: this.shouldAutoMerge(pr, files, comments)
      };
      
      // Add to merge queue if auto-merge is enabled
      if (analysis.auto_merge && prData.autoMerge) {
        this.addToMergeQueue(prData);
      }
      
      return analysis;
    } catch (error) {
      logger.logError('Failed to analyze PR', error);
      throw error;
    }
  }
  
  /**
   * Get file extensions from PR files
   * @param {Array} files - PR files
   * @returns {Object} File extension counts
   */
  getFileExtensions(files) {
    const extensions = {};
    
    if (!Array.isArray(files)) {
      return extensions;
    }
    
    for (const file of files) {
      if (file.filename) {
        const ext = file.filename.split('.').pop().toLowerCase();
        extensions[ext] = (extensions[ext] || 0) + 1;
      }
    }
    
    return extensions;
  }
  
  /**
   * Determine if a PR should be auto-merged
   * @param {Object} pr - Pull request data
   * @param {Array} files - PR files
   * @param {Array} comments - PR comments
   * @returns {boolean} Whether PR should be auto-merged
   */
  shouldAutoMerge(pr, files, comments) {
    // This is a simplified implementation
    // In a real system, this would have more sophisticated logic
    
    // Don't auto-merge if PR is not mergeable
    if (!pr.mergeable) {
      return false;
    }
    
    // Don't auto-merge if PR has conflicts
    if (pr.mergeable_state === 'dirty') {
      return false;
    }
    
    // Don't auto-merge if PR has too many changes
    const totalChanges = files.reduce((sum, file) => sum + file.changes, 0);
    if (totalChanges > 100) {
      return false;
    }
    
    // Don't auto-merge if PR has unresolved comments
    // This is a simplified check - in reality would be more sophisticated
    if (comments.length > 0) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Add a PR to the merge queue
   * @param {Object} prData - Pull request data
   * @param {string} prData.owner - Repository owner
   * @param {string} prData.repo - Repository name
   * @param {number} prData.pull_number - Pull request number
   * @param {string} [prData.merge_method='merge'] - Merge method (merge, squash, rebase)
   * @returns {boolean} Success status
   * @throws {Error} If required parameters are missing
   */
  addToMergeQueue(prData) {
    try {
      // Validate required fields
      if (!prData.owner || !prData.repo || !prData.pull_number) {
        throw new Error('Missing required PR data (owner, repo, pull_number)');
      }
      
      // Check if PR is already in queue
      const existingIndex = this.mergeQueue.findIndex(item => 
        item.owner === prData.owner && 
        item.repo === prData.repo && 
        item.pull_number === prData.pull_number
      );
      
      if (existingIndex !== -1) {
        // Update existing entry
        this.mergeQueue[existingIndex] = {
          ...this.mergeQueue[existingIndex],
          ...prData,
          updatedAt: new Date().toISOString()
        };
        
        logger.info(`Updated PR in merge queue: ${prData.owner}/${prData.repo}#${prData.pull_number}`);
      } else {
        // Add new entry
        this.mergeQueue.push({
          ...prData,
          status: 'pending',
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        logger.info(`Added PR to merge queue: ${prData.owner}/${prData.repo}#${prData.pull_number}`);
      }
      
      return true;
    } catch (error) {
      logger.logError('Failed to add PR to merge queue', error);
      throw error;
    }
  }
  
  /**
   * Process the merge queue
   * @returns {Promise<Object>} Processing results
   * @throws {Error} If not authenticated
   */
  async processMergeQueue() {
    if (!this.authenticated) {
      const error = new Error('Cannot process merge queue: Not authenticated with GitHub');
      logger.warn(error.message);
      throw error;
    }
    
    if (this.mergeQueue.length === 0) {
      return { success: true, processed: 0 };
    }
    
    logger.info(`Processing merge queue (${this.mergeQueue.length} items)`);
    
    const results = {
      success: true,
      processed: 0,
      failed: 0,
      details: []
    };
    
    // Process each PR in the queue
    for (let i = 0; i < this.mergeQueue.length; i++) {
      const prData = this.mergeQueue[i];
      
      if (prData.status === 'processing' || prData.status === 'completed') {
        continue;
      }
      
      try {
        // Mark as processing
        prData.status = 'processing';
        prData.processingStartedAt = new Date().toISOString();
        
        // Merge PR
        await this.mergePR(prData);
        
        // Update status
        prData.status = 'completed';
        prData.completedAt = new Date().toISOString();
        
        results.processed++;
        results.details.push({
          pr: `${prData.owner}/${prData.repo}#${prData.pull_number}`,
          success: true
        });
        
        logger.info(`Successfully merged PR: ${prData.owner}/${prData.repo}#${prData.pull_number}`);
      } catch (error) {
        // Update status
        prData.status = 'failed';
        prData.failedAt = new Date().toISOString();
        prData.error = error.message;
        
        results.failed++;
        results.details.push({
          pr: `${prData.owner}/${prData.repo}#${prData.pull_number}`,
          success: false,
          error: error.message
        });
        
        logger.logError(`Failed to merge PR: ${prData.owner}/${prData.repo}#${prData.pull_number}`, error);
      }
    }
    
    // Clean up completed items
    this.cleanupQueue();
    
    return results;
  }
  
  /**
   * Merge a pull request
   * @param {Object} prData - Pull request data
   * @param {string} prData.owner - Repository owner
   * @param {string} prData.repo - Repository name
   * @param {number} prData.pull_number - Pull request number
   * @param {string} [prData.merge_method='merge'] - Merge method (merge, squash, rebase)
   * @param {string} [prData.commit_title] - Custom commit title
   * @param {string} [prData.commit_message] - Custom commit message
   * @returns {Promise<Object>} Merge result
   * @throws {Error} If merge fails
   */
  async mergePR(prData) {
    try {
      if (!this.authenticated) {
        throw new Error('Not authenticated with GitHub');
      }
      
      // Validate required fields
      if (!prData.owner || !prData.repo || !prData.pull_number) {
        throw new Error('Missing required PR data (owner, repo, pull_number)');
      }
      
      // Get latest PR data
      const { data: pr } = await this.octokit.pulls.get({
        owner: prData.owner,
        repo: prData.repo,
        pull_number: prData.pull_number
      });
      
      // Check if PR is mergeable
      if (!pr.mergeable) {
        throw new Error('PR is not mergeable');
      }
      
      // Merge the PR
      const { data: mergeResult } = await this.octokit.pulls.merge({
        owner: prData.owner,
        repo: prData.repo,
        pull_number: prData.pull_number,
        merge_method: prData.merge_method || 'merge',
        commit_title: prData.commit_title || `Merge pull request #${prData.pull_number}`,
        commit_message: prData.commit_message || ''
      });
      
      return mergeResult;
    } catch (error) {
      logger.logError('Failed to merge PR', error);
      throw error;
    }
  }
  
  /**
   * Clean up completed items from queues
   * @param {number} [hoursToKeep=24] - Hours to keep completed items
   */
  cleanupQueue(hoursToKeep = 24) {
    // Keep only recent completed items
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hoursToKeep);
    
    // Clean PR analysis queue
    this.prAnalysisQueue = this.prAnalysisQueue.filter(item => {
      if (item.status !== 'completed' && item.status !== 'failed') {
        return true;
      }
      
      const completedAt = new Date(item.completedAt || item.failedAt);
      return completedAt > cutoff;
    });
    
    // Clean merge queue
    this.mergeQueue = this.mergeQueue.filter(item => {
      if (item.status !== 'completed' && item.status !== 'failed') {
        return true;
      }
      
      const completedAt = new Date(item.completedAt || item.failedAt);
      return completedAt > cutoff;
    });
    
    logger.info(`Cleaned up queues. Analysis queue: ${this.prAnalysisQueue.length}, Merge queue: ${this.mergeQueue.length}`);
  }
}

module.exports = GitHubEnhanced;
