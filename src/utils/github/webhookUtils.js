/**
 * webhookUtils.js
 * Utility functions for GitHub webhook handling
 */

const crypto = require('crypto');
const logger = require('../logger');
const validation = require('../validation');
const errorHandler = require('../errorHandler');

/**
 * Verify a GitHub webhook signature
 * @param {string} signature - X-Hub-Signature-256 header
 * @param {string} body - Raw request body
 * @param {string} secret - Webhook secret
 * @returns {boolean} Whether the signature is valid
 */
function verifySignature(signature, body, secret) {
  try {
    // Validate parameters
    validation.isString(signature, 'signature');
    validation.isString(body, 'body');
    validation.isString(secret, 'secret');
    
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(body).digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(digest),
      Buffer.from(signature)
    );
  } catch (error) {
    logger.error(`Webhook signature validation failed: ${error.message}`, { error: error.stack });
    return false;
  }
}

/**
 * Generate a summary of a webhook event
 * @param {string} event - Event type
 * @param {Object} payload - Event payload
 * @returns {string} Event summary
 */
function generateEventSummary(event, payload) {
  try {
    switch (event) {
      case 'push':
        return `${payload.commits?.length || 0} commits to ${payload.ref}`;
      case 'pull_request':
        return `${payload.action} PR #${payload.number || payload.pull_request?.number}: ${payload.pull_request?.title}`;
      case 'issues':
        return `${payload.action} issue #${payload.issue?.number}: ${payload.issue?.title}`;
      case 'issue_comment':
        return `Comment on #${payload.issue?.number}`;
      case 'workflow_run':
        return `Workflow ${payload.workflow_run?.name} ${payload.workflow_run?.status}`;
      case 'repository':
        return `Repository ${payload.action}: ${payload.repository?.full_name}`;
      case 'ping':
        return `Ping from GitHub: ${payload.zen || 'Webhook configured'}`;
      case 'release':
        return `Release ${payload.action}: ${payload.release?.tag_name || 'unknown'}`;
      case 'check_run':
        return `Check run ${payload.action}: ${payload.check_run?.name || 'unknown'}`;
      case 'check_suite':
        return `Check suite ${payload.action}: ${payload.check_suite?.head_branch || 'unknown'}`;
      case 'create':
        return `Created ${payload.ref_type}: ${payload.ref}`;
      case 'delete':
        return `Deleted ${payload.ref_type}: ${payload.ref}`;
      default:
        return `${event} event received`;
    }
  } catch (error) {
    logger.error('Error generating event summary', { error: error.stack });
    return `${event} event received`;
  }
}

/**
 * Extract repository information from a webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object} Repository information
 */
function extractRepositoryInfo(payload) {
  try {
    const repository = payload.repository || {};
    
    return {
      name: repository.name || '',
      fullName: repository.full_name || '',
      owner: repository.owner?.login || '',
      private: repository.private || false,
      url: repository.html_url || '',
      defaultBranch: repository.default_branch || 'main',
      description: repository.description || '',
      language: repository.language || '',
      createdAt: repository.created_at || '',
      updatedAt: repository.updated_at || '',
      size: repository.size || 0,
      stars: repository.stargazers_count || 0,
      forks: repository.forks_count || 0,
      issues: repository.open_issues_count || 0
    };
  } catch (error) {
    logger.error('Error extracting repository info', { error: error.stack });
    return {
      name: '',
      fullName: '',
      owner: '',
      private: false,
      url: '',
      defaultBranch: 'main',
      description: '',
      language: '',
      createdAt: '',
      updatedAt: '',
      size: 0,
      stars: 0,
      forks: 0,
      issues: 0
    };
  }
}

/**
 * Extract sender information from a webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object} Sender information
 */
function extractSenderInfo(payload) {
  try {
    const sender = payload.sender || {};
    
    return {
      login: sender.login || '',
      id: sender.id || 0,
      type: sender.type || '',
      url: sender.html_url || '',
      avatarUrl: sender.avatar_url || '',
      siteAdmin: sender.site_admin || false
    };
  } catch (error) {
    logger.error('Error extracting sender info', { error: error.stack });
    return {
      login: '',
      id: 0,
      type: '',
      url: '',
      avatarUrl: '',
      siteAdmin: false
    };
  }
}

/**
 * Extract pull request information from a webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object|null} Pull request information or null if not a PR event
 */
function extractPullRequestInfo(payload) {
  try {
    const pr = payload.pull_request;
    if (!pr) return null;
    
    return {
      id: pr.id || 0,
      number: pr.number || 0,
      state: pr.state || '',
      title: pr.title || '',
      body: pr.body || '',
      url: pr.html_url || '',
      user: pr.user?.login || '',
      createdAt: pr.created_at || '',
      updatedAt: pr.updated_at || '',
      mergedAt: pr.merged_at || null,
      merged: pr.merged || false,
      mergeable: pr.mergeable || null,
      draft: pr.draft || false,
      head: {
        ref: pr.head?.ref || '',
        sha: pr.head?.sha || '',
        repo: pr.head?.repo?.full_name || ''
      },
      base: {
        ref: pr.base?.ref || '',
        sha: pr.base?.sha || '',
        repo: pr.base?.repo?.full_name || ''
      },
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changed_files || 0
    };
  } catch (error) {
    logger.error('Error extracting pull request info', { error: error.stack });
    return null;
  }
}

/**
 * Extract issue information from a webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Object|null} Issue information or null if not an issue event
 */
function extractIssueInfo(payload) {
  try {
    const issue = payload.issue;
    if (!issue) return null;
    
    return {
      id: issue.id || 0,
      number: issue.number || 0,
      state: issue.state || '',
      title: issue.title || '',
      body: issue.body || '',
      url: issue.html_url || '',
      user: issue.user?.login || '',
      createdAt: issue.created_at || '',
      updatedAt: issue.updated_at || '',
      closedAt: issue.closed_at || null,
      labels: (issue.labels || []).map(label => ({
        name: label.name || '',
        color: label.color || '',
        description: label.description || ''
      })),
      assignees: (issue.assignees || []).map(assignee => assignee.login || '')
    };
  } catch (error) {
    logger.error('Error extracting issue info', { error: error.stack });
    return null;
  }
}

/**
 * Extract commit information from a webhook payload
 * @param {Object} payload - Webhook payload
 * @returns {Array} Array of commit information
 */
function extractCommitInfo(payload) {
  try {
    const commits = payload.commits || [];
    
    return commits.map(commit => ({
      id: commit.id || '',
      message: commit.message || '',
      url: commit.url || '',
      author: {
        name: commit.author?.name || '',
        email: commit.author?.email || '',
        username: commit.author?.username || ''
      },
      timestamp: commit.timestamp || '',
      added: commit.added || [],
      removed: commit.removed || [],
      modified: commit.modified || []
    }));
  } catch (error) {
    logger.error('Error extracting commit info', { error: error.stack });
    return [];
  }
}

/**
 * Determine if a webhook event should be processed based on filters
 * @param {string} event - Event type
 * @param {Object} payload - Event payload
 * @param {Object} filters - Filters to apply
 * @param {Array} [filters.events] - Event types to process
 * @param {Array} [filters.actions] - Actions to process
 * @param {Array} [filters.branches] - Branches to process
 * @param {Array} [filters.repositories] - Repositories to process
 * @param {Array} [filters.users] - Users to process
 * @returns {boolean} Whether the event should be processed
 */
function shouldProcessEvent(event, payload, filters = {}) {
  try {
    // Filter by event type
    if (filters.events && filters.events.length > 0) {
      if (!filters.events.includes(event)) {
        return false;
      }
    }
    
    // Filter by action
    if (filters.actions && filters.actions.length > 0 && payload.action) {
      if (!filters.actions.includes(payload.action)) {
        return false;
      }
    }
    
    // Filter by branch (for push events)
    if (filters.branches && filters.branches.length > 0) {
      if (event === 'push' && payload.ref) {
        const branch = payload.ref.replace('refs/heads/', '');
        if (!filters.branches.includes(branch)) {
          return false;
        }
      } else if (event === 'pull_request' && payload.pull_request?.base?.ref) {
        if (!filters.branches.includes(payload.pull_request.base.ref)) {
          return false;
        }
      }
    }
    
    // Filter by repository
    if (filters.repositories && filters.repositories.length > 0) {
      const repoName = payload.repository?.full_name;
      if (repoName && !filters.repositories.includes(repoName)) {
        return false;
      }
    }
    
    // Filter by user
    if (filters.users && filters.users.length > 0) {
      const username = payload.sender?.login;
      if (username && !filters.users.includes(username)) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error in shouldProcessEvent', { error: error.stack });
    return true; // Process by default in case of error
  }
}

/**
 * Sanitize webhook payload to remove sensitive information
 * @param {Object} payload - Webhook payload to sanitize
 * @returns {Object} Sanitized payload
 */
function sanitizePayload(payload) {
  try {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }
    
    const sensitiveKeys = ['token', 'password', 'secret', 'key', 'auth', 'credential', 'apiKey'];
    const sanitized = JSON.parse(JSON.stringify(payload)); // Deep clone
    
    // Recursively sanitize objects
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          obj[key] = sanitizeObject(obj[key]);
        } else if (typeof obj[key] === 'string' && 
                  sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        }
      }
      
      return obj;
    };
    
    return sanitizeObject(sanitized);
  } catch (error) {
    logger.error('Error sanitizing payload', { error: error.stack });
    return { sanitized: true, error: 'Failed to sanitize payload' };
  }
}

module.exports = {
  verifySignature,
  generateEventSummary,
  extractRepositoryInfo,
  extractSenderInfo,
  extractPullRequestInfo,
  extractIssueInfo,
  extractCommitInfo,
  shouldProcessEvent,
  sanitizePayload
};
