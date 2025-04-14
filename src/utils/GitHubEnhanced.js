/**
 * GitHubEnhanced.js
 * Enhanced GitHub integration with PR analysis and automation
 */

const { Octokit } = require('@octokit/rest');
const logger = require('./logger');

class GitHubEnhanced {
  constructor(config = {}) {
    this.config = config;
    this.octokit = null;
    this.authenticated = false;
    this.prAnalysisQueue = [];
    this.mergeQueue = [];
    
    // Initialize if token is provided
    if (config.github && config.github.token) {
      this.authenticate();
    }
  }
  
  /**
   * Authenticate with GitHub API
   * @returns {Promise<boolean>} Authentication success
   */
  async authenticate() {
    try {
      const token = this.config.github?.token || process.env.GITHUB_TOKEN;
      
      if (!token) {
        throw new Error('GitHub token not provided');
      }
      
      this.octokit = new Octokit({
        auth: token
      });
      
      // Verify authentication
      const { data } = await this.octokit.users.getAuthenticated();
      logger.info(`Authenticated with GitHub as ${data.login}`);
      
      this.authenticated = true;
      return true;
    } catch (error) {
      logger.error(`GitHub authentication failed: ${error.message}`);
      this.authenticated = false;
      return false;
    }
  }
  
  /**
   * Add a PR to the analysis queue
   * @param {Object} prData - Pull request data
   * @returns {boolean} Success status
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
      logger.error(`Failed to add PR to analysis queue: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Process the PR analysis queue
   * @returns {Promise<Object>} Processing results
   */
  async processAnalysisQueue() {
    if (!this.authenticated) {
      logger.warn('Cannot process PR analysis queue: Not authenticated with GitHub');
      return { success: false, error: 'Not authenticated with GitHub' };
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
        
        logger.error(`Failed to analyze PR: ${prData.owner}/${prData.repo}#${prData.pull_number} - ${error.message}`);
      }
    }
    
    // Clean up completed items (keep for reference)
    this.cleanupQueue();
    
    return results;
  }
  
  /**
   * Analyze a pull request
   * @param {Object} prData - Pull request data
   * @returns {Promise<Object>} Analysis result
   */
  async analyzePR(prData) {
    try {
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
      logger.error(`Failed to analyze PR: ${error.message}`);
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
    
    for (const file of files) {
      const ext = file.filename.split('.').pop().toLowerCase();
      extensions[ext] = (extensions[ext] || 0) + 1;
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
   * @returns {boolean} Success status
   */
  addToMergeQueue(prData) {
    try {
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
      logger.error(`Failed to add PR to merge queue: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Process the merge queue
   * @returns {Promise<Object>} Processing results
   */
  async processMergeQueue() {
    if (!this.authenticated) {
      logger.warn('Cannot process merge queue: Not authenticated with GitHub');
      return { success: false, error: 'Not authenticated with GitHub' };
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
        
        logger.error(`Failed to merge PR: ${prData.owner}/${prData.repo}#${prData.pull_number} - ${error.message}`);
      }
    }
    
    // Clean up completed items
    this.cleanupQueue();
    
    return results;
  }
  
  /**
   * Merge a pull request
   * @param {Object} prData - Pull request data
   * @returns {Promise<Object>} Merge result
   */
  async mergePR(prData) {
    try {
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
      logger.error(`Failed to merge PR: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Clean up completed items from queues
   */
  cleanupQueue() {
    // Keep only recent completed items (last 24 hours)
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    
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
  }
}

module.exports = GitHubEnhanced;
