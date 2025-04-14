/**
 * GitHubEnhanced.js
 * Enhanced GitHub integration with improved PR analysis and auto-merging capabilities
 */

const { Octokit } = require('@octokit/rest');
const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

class GitHubEnhanced {
  constructor(config = {}) {
    this.config = config;
    this.authenticated = false;
    this.octokit = null;
    this.webhooks = [];
    this.prAnalysisQueue = [];
    this.mergeQueue = [];
  }
  
  /**
   * Authenticate with GitHub API
   * @returns {Promise<boolean>} Success status
   */
  async authenticate() {
    try {
      // Check if we have GitHub credentials
      if (!this.config.github || !this.config.github.token) {
        throw new Error('GitHub credentials not configured');
      }
      
      // Create Octokit instance
      this.octokit = new Octokit({
        auth: this.config.github.token,
        userAgent: 'depla-project-manager'
      });
      
      // Verify authentication by getting user data
      const { data: user } = await this.octokit.users.getAuthenticated();
      
      logger.info(`Authenticated with GitHub as ${user.login}`);
      this.authenticated = true;
      
      return true;
    } catch (error) {
      logger.error(`GitHub authentication failed: ${error.message}`);
      this.authenticated = false;
      throw error;
    }
  }
  
  /**
   * Get repositories for the authenticated user
   * @returns {Promise<Array>} List of repositories
   */
  async getRepositories() {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    try {
      const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });
      
      return repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        description: repo.description,
        isPrivate: repo.private,
        hasWebhook: this.webhooks.includes(repo.id),
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at
      }));
    } catch (error) {
      logger.error(`Failed to fetch repositories: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Setup webhook for a repository
   * @param {string} repoFullName - Full name of the repository (owner/repo)
   * @param {string} webhookUrl - URL for the webhook
   * @returns {Promise<Object>} Webhook data
   */
  async setupWebhook(repoFullName, webhookUrl) {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      const { data: webhook } = await this.octokit.repos.createWebhook({
        owner,
        repo,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: this.config.github?.webhookSecret || ''
        },
        events: ['push', 'pull_request', 'create', 'delete'],
        active: true
      });
      
      logger.info(`Webhook created for ${repoFullName}`);
      this.webhooks.push(repo.id);
      return webhook;
    } catch (error) {
      logger.error(`Failed to create webhook: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get pull requests for a repository
   * @param {string} repoFullName - Full name of the repository (owner/repo)
   * @param {string} state - State of PRs to fetch ('open', 'closed', 'all')
   * @returns {Promise<Array>} List of pull requests
   */
  async getPullRequests(repoFullName, state = 'open') {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      const { data: prs } = await this.octokit.pulls.list({
        owner,
        repo,
        state,
        sort: 'created',
        direction: 'desc',
        per_page: 100
      });
      
      return prs.map(pr => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        user: {
          id: pr.user.id,
          login: pr.user.login,
          url: pr.user.html_url
        },
        base: {
          ref: pr.base.ref,
          sha: pr.base.sha
        },
        head: {
          ref: pr.head.ref,
          sha: pr.head.sha
        }
      }));
    } catch (error) {
      logger.error(`Failed to fetch pull requests: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Analyze a pull request to determine if it meets requirements
   * @param {string} repoFullName - Full name of the repository (owner/repo)
   * @param {number} prNumber - PR number
   * @param {string} requirementsPath - Path to requirements file
   * @returns {Promise<Object>} Analysis result
   */
  async analyzePullRequest(repoFullName, prNumber, requirementsPath = null) {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
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
      
      // Calculate file statistics
      const stats = {
        filesChanged: files.length,
        additions: files.reduce((total, file) => total + file.additions, 0),
        deletions: files.reduce((total, file) => total + file.deletions, 0),
        fileTypes: {}
      };
      
      // Count file types
      files.forEach(file => {
        const ext = path.extname(file.filename).toLowerCase();
        if (!stats.fileTypes[ext]) {
          stats.fileTypes[ext] = 0;
        }
        stats.fileTypes[ext]++;
      });
      
      // Determine phase and feature if this is a step-by-step implementation
      const branchNameMatch = pr.head.ref.match(/phase-(\d+)\/(.+)/);
      const phase = branchNameMatch ? branchNameMatch[1] : null;
      const feature = branchNameMatch ? branchNameMatch[2] : null;
      
      // Check if PR meets auto-merge criteria
      let canAutoMerge = false;
      let autoMergeReason = 'Does not meet criteria';
      
      // Auto-merge criteria:
      // 1. Structure Analysis PRs (usually text-only files)
      // 2. Feature Suggestion PRs (usually text-only files)
      // 3. Step Generation PRs (usually text-only files)
      // 4. Small PRs with few deletions (low risk)
      
      if (
        // PR title indicates it's a structure analysis
        pr.title.toLowerCase().includes('structure analysis') ||
        // PR title indicates it's a feature suggestion
        pr.title.toLowerCase().includes('feature suggestion') ||
        // PR title indicates it's a step generation
        pr.title.toLowerCase().includes('step') && pr.title.toLowerCase().includes('generation')
      ) {
        canAutoMerge = true;
        autoMergeReason = 'Documentation or analysis PR';
      } else if (
        // Small PR with minimal deletions
        stats.additions > 0 && 
        stats.deletions < 50 && 
        stats.additions / Math.max(stats.deletions, 1) > 5
      ) {
        canAutoMerge = true;
        autoMergeReason = 'Low-risk implementation PR';
      }
      
      // Create analysis result
      const analysisResult = {
        pr: {
          number: pr.number,
          title: pr.title,
          state: pr.state,
          url: pr.html_url,
          createdAt: pr.created_at
        },
        stats,
        phase,
        feature,
        canAutoMerge,
        autoMergeReason,
        analysisDate: new Date().toISOString()
      };
      
      logger.info(`Analyzed PR #${prNumber} for ${repoFullName}: ${canAutoMerge ? 'Can auto-merge' : 'Manual review needed'}`);
      return analysisResult;
    } catch (error) {
      logger.error(`Failed to analyze PR: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Merge a pull request
   * @param {string} repoFullName - Full name of the repository (owner/repo)
   * @param {number} prNumber - PR number
   * @param {string} mergeMethod - Merge method (merge, squash, rebase)
   * @returns {Promise<Object>} Merge result
   */
  async mergePullRequest(repoFullName, prNumber, mergeMethod = 'squash') {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      // Get PR details first
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      
      // Make sure PR is open
      if (pr.state !== 'open') {
        throw new Error(`PR #${prNumber} is not open (current state: ${pr.state})`);
      }
      
      // Check if PR is mergeable
      if (pr.mergeable === false) {
        throw new Error(`PR #${prNumber} has conflicts and cannot be merged automatically`);
      }
      
      // Try to merge
      const { data: mergeResult } = await this.octokit.pulls.merge({
        owner,
        repo,
        pull_number: prNumber,
        merge_method: mergeMethod,
        commit_title: `${pr.title} (#${prNumber})`,
        commit_message: `Automated merge of PR #${prNumber}`
      });
      
      logger.info(`Merged PR #${prNumber} for ${repoFullName} using ${mergeMethod} method`);
      
      return {
        success: true,
        merged: mergeResult.merged,
        message: mergeResult.message,
        sha: mergeResult.sha,
        pr: {
          number: pr.number,
          title: pr.title
        }
      };
    } catch (error) {
      logger.error(`Failed to merge PR #${prNumber}: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        pr: {
          number: prNumber
        }
      };
    }
  }
  
  /**
   * Queue a PR for analysis
   * @param {Object} project - Project object
   * @param {number} prNumber - PR number
   */
  async queuePRForAnalysis(project, prNumber) {
    try {
      // Check if PR is already in queue
      const existingIndex = this.prAnalysisQueue.findIndex(
        item => item.project.config.name === project.config.name && item.prNumber === prNumber
      );
      
      if (existingIndex !== -1) {
        // Update existing entry
        this.prAnalysisQueue[existingIndex].queuedAt = new Date().toISOString();
        logger.info(`Updated PR #${prNumber} in analysis queue for ${project.config.name}`);
        return;
      }
      
      // Add to queue
      this.prAnalysisQueue.push({
        project: project,
        prNumber: prNumber,
        queuedAt: new Date().toISOString(),
        attempts: 0
      });
      
      logger.info(`Queued PR #${prNumber} for analysis for ${project.config.name}`);
    } catch (error) {
      logger.error(`Failed to queue PR for analysis: ${error.message}`);
    }
  }
  
  /**
   * Process the PR analysis queue
   */
  async processAnalysisQueue() {
    if (this.prAnalysisQueue.length === 0) {
      logger.debug('No PRs in analysis queue');
      return;
    }
    
    logger.info(`Processing ${this.prAnalysisQueue.length} PRs in analysis queue`);
    
    // Sort by queue time (oldest first)
    this.prAnalysisQueue.sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt));
    
    // Process the first PR in the queue
    const queueItem = this.prAnalysisQueue.shift();
    
    try {
      // Increment attempt counter
      queueItem.attempts += 1;
      
      // Get repository full name
      const repoName = queueItem.project.config.repository;
      const repoFullName = repoName.includes('/') 
        ? repoName 
        : `${this.config.github.username}/${repoName}`;
      
      // Analyze the PR
      const analysisResult = await this.analyzePullRequest(
        repoFullName, 
        queueItem.prNumber
      );
      
      // Check if PR can be auto-merged
      if (analysisResult.canAutoMerge && this.config.github?.autoMerge) {
        logger.info(`Auto-merging PR #${queueItem.prNumber} for ${repoFullName}`);
        
        // Queue for merge
        this.queuePRForMerge(repoFullName, queueItem.prNumber);
      } else {
        logger.info(`PR #${queueItem.prNumber} requires manual review: ${analysisResult.autoMergeReason}`);
        
        // Add comment to PR
        await this.addCommentToPR(
          repoFullName,
          queueItem.prNumber,
          `## Automated Analysis Results\n\n` +
          `This PR ${analysisResult.canAutoMerge ? 'meets' : 'does not meet'} auto-merge criteria.\n\n` +
          `- **Reason**: ${analysisResult.autoMergeReason}\n` +
          `- **Files changed**: ${analysisResult.stats.filesChanged}\n` +
          `- **Additions**: ${analysisResult.stats.additions}\n` +
          `- **Deletions**: ${analysisResult.stats.deletions}\n\n` +
          `Please review and merge manually if appropriate.`
        );
      }
    } catch (error) {
      logger.error(`Error processing PR #${queueItem.prNumber}: ${error.message}`);
      
      // If fewer than 3 attempts, re-queue
      if (queueItem.attempts < 3) {
        queueItem.queuedAt = new Date().toISOString();
        this.prAnalysisQueue.push(queueItem);
        logger.info(`Re-queued PR #${queueItem.prNumber} for analysis (attempt ${queueItem.attempts})`);
      } else {
        logger.error(`Giving up on PR #${queueItem.prNumber} after ${queueItem.attempts} attempts`);
      }
    }
    
    // Continue processing queue if items remain
    if (this.prAnalysisQueue.length > 0) {
      // Add small delay to avoid API rate limits
      setTimeout(() => this.processAnalysisQueue(), 1000);
    }
  }
  
  /**
   * Add a comment to a PR
   * @param {string} repoFullName - Full name of the repository (owner/repo)
   * @param {number} prNumber - PR number
   * @param {string} body - Comment body
   * @returns {Promise<Object>} Comment data
   */
  async addCommentToPR(repoFullName, prNumber, body) {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      const { data: comment } = await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body
      });
      
      logger.info(`Added comment to PR #${prNumber}`);
      return comment;
    } catch (error) {
      logger.error(`Failed to add comment to PR #${prNumber}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Queue a PR for merging
   * @param {string} repoFullName - Full name of the repository (owner/repo)
   * @param {number} prNumber - PR number
   */
  queuePRForMerge(repoFullName, prNumber) {
    try {
      // Check if PR is already in queue
      const existingIndex = this.mergeQueue.findIndex(
        item => item.repoFullName === repoFullName && item.prNumber === prNumber
      );
      
      if (existingIndex !== -1) {
        // Update existing entry
        this.mergeQueue[existingIndex].queuedAt = new Date().toISOString();
        logger.info(`Updated PR #${prNumber} in merge queue for ${repoFullName}`);
        return;
      }
      
      // Add to queue
      this.mergeQueue.push({
        repoFullName,
        prNumber,
        queuedAt: new Date().toISOString(),
        attempts: 0
      });
      
      logger.info(`Queued PR #${prNumber} for merge for ${repoFullName}`);
      
      // Start processing if not already running
      if (this.mergeQueue.length === 1) {
        this.processMergeQueue();
      }
    } catch (error) {
      logger.error(`Failed to queue PR for merge: ${error.message}`);
    }
  }
  
  /**
   * Process the PR merge queue
   */
  async processMergeQueue() {
    if (this.mergeQueue.length === 0) {
      logger.debug('No PRs in merge queue');
      return;
    }
    
    logger.info(`Processing ${this.mergeQueue.length} PRs in merge queue`);
    
    // Sort by queue time (oldest first)
    this.mergeQueue.sort((a, b) => new Date(a.queuedAt) - new Date(b.queuedAt));
    
    // Process the first PR in the queue
    const queueItem = this.mergeQueue.shift();
    
    try {
      // Increment attempt counter
      queueItem.attempts += 1;
      
      // Add a comment before merging
      await this.addCommentToPR(
        queueItem.repoFullName,
        queueItem.prNumber,
        `## Auto-Merge Notification\n\n` +
        `This PR meets auto-merge criteria and will be merged automatically.\n\n` +
        `If this is unexpected or incorrect, please contact the repository administrators.`
      );
      
      // Small delay to ensure comment is posted
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Merge the PR
      const mergeResult = await this.mergePullRequest(
        queueItem.repoFullName,
        queueItem.prNumber
      );
      
      if (mergeResult.success) {
        logger.info(`Successfully merged PR #${queueItem.prNumber} for ${queueItem.repoFullName}`);
      } else {
        logger.error(`Failed to merge PR #${queueItem.prNumber}: ${mergeResult.error}`);
        
        // If fewer than 3 attempts, re-queue
        if (queueItem.attempts < 3) {
          queueItem.queuedAt = new Date().toISOString();
          this.mergeQueue.push(queueItem);
          logger.info(`Re-queued PR #${queueItem.prNumber} for merge (attempt ${queueItem.attempts})`);
        } else {
          logger.error(`Giving up on PR #${queueItem.prNumber} after ${queueItem.attempts} attempts`);
          
          // Add comment about failure
          await this.addCommentToPR(
            queueItem.repoFullName,
            queueItem.prNumber,
            `## Auto-Merge Failed\n\n` +
            `The system was unable to merge this PR automatically after ${queueItem.attempts} attempts.\n\n` +
            `**Error**: ${mergeResult.error}\n\n` +
            `Please merge manually or resolve any conflicts.`
          );
        }
      }
    } catch (error) {
      logger.error(`Error processing PR #${queueItem.prNumber} for merge: ${error.message}`);
      
      // If fewer than 3 attempts, re-queue
      if (queueItem.attempts < 3) {
        queueItem.queuedAt = new Date().toISOString();
        this.mergeQueue.push(queueItem);
        logger.info(`Re-queued PR #${queueItem.prNumber} for merge (attempt ${queueItem.attempts})`);
      } else {
        logger.error(`Giving up on PR #${queueItem.prNumber} after ${queueItem.attempts} attempts`);
      }
    }
    
    // Continue processing queue if items remain
    if (this.mergeQueue.length > 0) {
      // Add small delay to avoid API rate limits
      setTimeout(() => this.processMergeQueue(), 2000);
    }
  }
  
  /**
   * Detect the type of PR based on branch name, title and files
   * @param {string} repoFullName - Full name of the repository (owner/repo)
   * @param {number} prNumber - PR number
   * @returns {Promise<Object>} PR type information
   */
  async detectPRType(repoFullName, prNumber) {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
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
      
      // Check for structure analysis PR
      const isStructureAnalysis = 
        pr.title.toLowerCase().includes('structure analysis') ||
        files.some(file => file.filename.includes('STRUCTURE.md'));
      
      // Check for feature suggestion PR
      const isFeatureSuggestion =
        pr.title.toLowerCase().includes('feature suggestion') ||
        files.some(file => file.filename.includes('SUGGESTED') && file.filename.includes('STRUCTURE.md'));
      
      // Check for step generation PR
      const isStepGeneration =
        pr.title.toLowerCase().includes('step generation') ||
        files.some(file => file.filename.includes('STEP') && file.filename.includes('.md'));
      
      // Check for feature implementation PR
      const branchNameMatch = pr.head.ref.match(/phase-(\d+)\/(.+)/);
      const isFeatureImplementation = !!branchNameMatch;
      
      // Determine PR type
      let prType = 'unknown';
      let phaseNumber = null;
      let featureName = null;
      
      if (isStructureAnalysis) {
        prType = 'structure_analysis';
      } else if (isFeatureSuggestion) {
        prType = 'feature_suggestion';
      } else if (isStepGeneration) {
        prType = 'step_generation';
      } else if (isFeatureImplementation) {
        prType = 'feature_implementation';
        phaseNumber = branchNameMatch[1];
        featureName = branchNameMatch[2];
      }
      
      return {
        prNumber,
        prType,
        phaseNumber,
        featureName,
        title: pr.title,
        branchName: pr.head.ref,
        filesChanged: files.length,
        isTextOnly: files.every(file => {
          const ext = path.extname(file.filename).toLowerCase();
          return ext === '.md' || ext === '.txt' || file.filename.includes('prompt');
        })
      };
    } catch (error) {
      logger.error(`Failed to detect PR type: ${error.message}`);
      throw error;
    }
  }
}

module.exports = GitHubEnhanced; 