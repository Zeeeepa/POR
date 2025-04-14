require('dotenv').config();
const { Octokit } = require('@octokit/rest');
const WebhookServer = require('./webhookServer');
const { logger } = require('../utils/logger');
const path = require('path');
const setupDashboard = require('./dashboard');
const ejs = require('ejs');

// Load environment variables
const PORT = process.env.PORT || 3000;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const NGROK_AUTH_TOKEN = process.env.NGROK_AUTH_TOKEN;
const NGROK_REGION = process.env.NGROK_REGION || 'us';
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

// Initialize Octokit client for making GitHub API calls
const octokit = new Octokit({
  auth: GITHUB_TOKEN
});

// Helper function to get formatted time
function getFormattedTime() {
  return new Date().toISOString();
}

// Helper function to beautify JSON for display
function beautifyJson(json) {
  try {
    // If it's already a string, parse it first
    if (typeof json === 'string') {
      return JSON.stringify(JSON.parse(json), null, 2);
    }
    // Otherwise stringify the object
    return JSON.stringify(json, null, 2);
  } catch (e) {
    return json || '';
  }
}

// Initialize the webhook server
const webhookServer = new WebhookServer({
  port: PORT,
  webhookSecret: GITHUB_WEBHOOK_SECRET,
  githubToken: GITHUB_TOKEN,
  ngrokOptions: {
    authtoken: NGROK_AUTH_TOKEN,
    region: NGROK_REGION
  }
});

// Add the beautifyJson function to the response locals
webhookServer.app.use((req, res, next) => {
  res.locals.beautifyJson = beautifyJson;
  next();
});

// ============================================================
// Push Event Handler
// ============================================================
webhookServer.registerEventHandler('push', async (payload) => {
  const { repository, ref, commits, sender, after } = payload;
  const branch = ref.replace('refs/heads/', '');
  
  logger.info(`[${getFormattedTime()}] PUSH EVENT: ${repository.full_name} on branch ${branch} by ${sender.login}`);
  logger.info(`Commits: ${commits ? commits.length : 0}`);
  
  // Check if any package.json files were modified
  const packageJsonModified = commits?.some(commit => 
    commit.modified?.some(file => file === 'package.json' || file.endsWith('/package.json'))
  );
  
  if (packageJsonModified) {
    logger.info('package.json was modified, you might need to run npm install');
    
    // Example: Create an issue to remind about package.json changes
    try {
      if (GITHUB_TOKEN && repository.owner.login === GITHUB_OWNER) {
        await octokit.issues.create({
          owner: repository.owner.login,
          repo: repository.name,
          title: 'Dependency Changes Detected',
          body: `Package.json was modified in commit ${after}. Remember to run \`npm install\`.`,
          labels: ['dependencies']
        });
        logger.info('Created issue to remind about dependency changes');
      }
    } catch (error) {
      logger.error(`Failed to create issue: ${error.message}`);
    }
  }
  
  // Trigger actions based on branch
  if (branch === 'main' || branch === 'master') {
    logger.info('Push to main branch detected, triggering build process');
    // Here you would add code to trigger your CI/CD pipeline
  } else if (branch.startsWith('feature/')) {
    logger.info(`Feature branch update detected: ${branch}`);
    // Here you would add code for feature branch handling
  }
});

// ============================================================
// Pull Request Event Handler
// ============================================================
webhookServer.registerEventHandler('pull_request', async (payload) => {
  const { action, pull_request, repository, number } = payload;
  
  logger.info(`[${getFormattedTime()}] PR EVENT: ${action} #${number} in ${repository.full_name}`);
  logger.info(`Title: ${pull_request.title}`);
  logger.info(`User: ${pull_request.user.login}`);
  
  // Auto-label PRs based on files changed
  if ((action === 'opened' || action === 'synchronize') && GITHUB_TOKEN) {
    try {
      // Get files changed in this PR
      const { data: files } = await octokit.pulls.listFiles({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: number
      });
      
      const labels = [];
      
      // Determine labels based on file types
      const hasJsChanges = files.some(file => file.filename.endsWith('.js'));
      const hasCssChanges = files.some(file => file.filename.endsWith('.css') || file.filename.endsWith('.scss'));
      const hasDocsChanges = files.some(file => 
        file.filename.endsWith('.md') || 
        file.filename.includes('docs/') || 
        file.filename.includes('documentation/')
      );
      
      if (hasJsChanges) labels.push('javascript');
      if (hasCssChanges) labels.push('styling');
      if (hasDocsChanges) labels.push('documentation');
      
      // Add size label based on number of changes
      const totalChanges = files.reduce((sum, file) => sum + file.changes, 0);
      if (totalChanges > 500) {
        labels.push('large-change');
        
        // Comment on large PRs
        await octokit.issues.createComment({
          owner: repository.owner.login,
          repo: repository.name,
          issue_number: number,
          body: 'This is a large PR with over 500 changes. Please consider breaking it down into smaller PRs for easier review.'
        });
      } else if (totalChanges > 100) {
        labels.push('medium-change');
      } else {
        labels.push('small-change');
      }
      
      // Apply labels if we have any
      if (labels.length > 0) {
        await octokit.issues.addLabels({
          owner: repository.owner.login,
          repo: repository.name,
          issue_number: number,
          labels: labels
        });
        
        logger.info(`Added labels to PR #${number}: ${labels.join(', ')}`);
      }
    } catch (error) {
      logger.error(`Failed to process PR labels: ${error.message}`);
    }
  }
  
  // Handle PR closed event
  if (action === 'closed') {
    if (pull_request.merged) {
      logger.info(`PR #${number} was merged! 🎉`);
      // Add your post-merge logic here
    } else {
      logger.info(`PR #${number} was closed without merging`);
    }
  }
});

// ============================================================
// Issues Event Handler
// ============================================================
webhookServer.registerEventHandler('issues', async (payload) => {
  const { action, issue, repository } = payload;
  
  logger.info(`[${getFormattedTime()}] ISSUE EVENT: ${action} #${issue.number} in ${repository.full_name}`);
  logger.info(`Title: ${issue.title}`);
  
  // Auto-label new issues based on keywords in title
  if (action === 'opened' && GITHUB_TOKEN) {
    const title = issue.title.toLowerCase();
    const labels = [];
    
    // Check for common issue types in title
    if (title.includes('bug') || title.includes('fix') || title.includes('error')) {
      labels.push('bug');
    }
    
    if (title.includes('feature') || title.includes('enhancement') || title.includes('add')) {
      labels.push('enhancement');
    }
    
    if (title.includes('doc') || title.includes('documentation') || title.includes('readme')) {
      labels.push('documentation');
    }
    
    if (title.includes('question') || title.includes('help') || title.includes('support')) {
      labels.push('question');
    }
    
    // Apply labels if we found any matches
    if (labels.length > 0) {
      try {
        await octokit.issues.addLabels({
          owner: repository.owner.login,
          repo: repository.name,
          issue_number: issue.number,
          labels: labels
        });
        
        logger.info(`Auto-labeled issue #${issue.number} with: ${labels.join(', ')}`);
      } catch (error) {
        logger.error(`Failed to add labels to issue: ${error.message}`);
      }
    }
    
    // Welcome message for first-time contributors
    if (!issue.author_association || issue.author_association === 'FIRST_TIME_CONTRIBUTOR') {
      try {
        await octokit.issues.createComment({
          owner: repository.owner.login,
          repo: repository.name,
          issue_number: issue.number,
          body: `Thanks for opening your first issue, @${issue.user.login}! 👋 Our team will review it soon.`
        });
        
        logger.info(`Posted welcome message to new contributor on issue #${issue.number}`);
      } catch (error) {
        logger.error(`Failed to post welcome comment: ${error.message}`);
      }
    }
  }
  
  // Handle issue closed event
  if (action === 'closed') {
    logger.info(`Issue #${issue.number} was closed by ${payload.sender.login}`);
    // You could add logic to update tracking systems, etc.
  }
});

// ============================================================
// Issue Comment Event Handler
// ============================================================
webhookServer.registerEventHandler('issue_comment', async (payload) => {
  const { action, comment, issue, repository } = payload;
  
  if (action !== 'created') return;
  
  logger.info(`[${getFormattedTime()}] COMMENT EVENT: New comment on #${issue.number} in ${repository.full_name}`);
  logger.info(`Comment by: ${comment.user.login}`);
  
  // Process comment commands (like /assign, /label, etc)
  const commentBody = comment.body.trim();
  
  // Handle /assign command
  if (commentBody.startsWith('/assign')) {
    const assignees = commentBody
      .substring('/assign'.length)
      .trim()
      .split(/\s+/)
      .map(name => name.startsWith('@') ? name.substring(1) : name)
      .filter(name => name.length > 0);
    
    if (assignees.length === 0) {
      assignees.push(comment.user.login); // Self-assign
    }
    
    try {
      await octokit.issues.addAssignees({
        owner: repository.owner.login,
        repo: repository.name,
        issue_number: issue.number,
        assignees: assignees
      });
      
      logger.info(`Assigned issue #${issue.number} to: ${assignees.join(', ')}`);
    } catch (error) {
      logger.error(`Failed to assign issue: ${error.message}`);
    }
  }
  
  // Handle /label command
  if (commentBody.startsWith('/label')) {
    const labels = commentBody
      .substring('/label'.length)
      .trim()
      .split(/\s+/)
      .filter(label => label.length > 0);
    
    if (labels.length > 0) {
      try {
        await octokit.issues.addLabels({
          owner: repository.owner.login,
          repo: repository.name,
          issue_number: issue.number,
          labels: labels
        });
        
        logger.info(`Added labels to issue #${issue.number}: ${labels.join(', ')}`);
      } catch (error) {
        logger.error(`Failed to add labels: ${error.message}`);
      }
    }
  }
});

// ============================================================
// Workflow Run Event Handler
// ============================================================
webhookServer.registerEventHandler('workflow_run', (payload) => {
  const { action, workflow_run } = payload;
  
  logger.info(`[${getFormattedTime()}] WORKFLOW EVENT: ${action} - ${workflow_run.name}`);
  logger.info(`Status: ${workflow_run.status}, Conclusion: ${workflow_run.conclusion}`);
  logger.info(`Repository: ${workflow_run.repository.full_name}`);
  
  // Handle workflow completions
  if (action === 'completed') {
    if (workflow_run.conclusion === 'success') {
      logger.info(`Workflow ${workflow_run.name} completed successfully`);
      
      // If this is a deployment workflow, you could trigger post-deployment actions
      if (workflow_run.name.includes('deploy') || workflow_run.name.includes('release')) {
        logger.info('Deployment workflow completed, triggering post-deployment hooks');
        // Add your post-deployment logic here
      }
    } else if (workflow_run.conclusion === 'failure') {
      logger.error(`Workflow ${workflow_run.name} failed!`);
      
      // You could send notifications for failed workflows
      // For example, send a message to a Slack webhook or email the team
    }
  }
});

// Start server and set up webhook
async function main() {
  try {
    // Set up the dashboard on the webhook server
    setupDashboard(webhookServer.app, webhookServer);
    
    // Start the server with ngrok tunneling
    const serverInfo = await webhookServer.start(true);
    logger.info(`Webhook server started on port ${PORT}`);
    logger.info(`Public URL: ${serverInfo.url}`);
    logger.info(`Dashboard available at: ${serverInfo.url}/dashboard`);
    
    // Set up webhook for repository if configured
    if (GITHUB_OWNER && GITHUB_REPO && GITHUB_TOKEN) {
      try {
        const webhook = await webhookServer.setupWebhook({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          events: [
            'push', 
            'pull_request', 
            'issues', 
            'issue_comment', 
            'workflow_run'
          ]
        });
        
        logger.info(`Webhook created successfully for ${GITHUB_OWNER}/${GITHUB_REPO}`);
        logger.info(`Webhook ID: ${webhook.id}`);
      } catch (error) {
        logger.error(`Failed to set up webhook: ${error.message}`);
        logger.info('You may need to set up the webhook manually, or ensure your token has admin:repo_hook scope');
      }
    } else {
      logger.info('GITHUB_OWNER, GITHUB_REPO, or GITHUB_TOKEN not configured. Skipping webhook setup.');
      logger.info(`Use this URL for your webhook: ${serverInfo.url}/webhook`);
      logger.info('Configure your webhook to send the following events:');
      logger.info('- push, pull_request, issues, issue_comment, workflow_run');
    }
    
    return serverInfo;
  } catch (error) {
    logger.error(`Failed to start webhook server: ${error.message}`);
    throw error;
  }
}

// Handle graceful shutdown
function shutdown() {
  logger.info('Shutting down webhook server...');
  webhookServer.stop()
    .then(() => {
      logger.info('Server stopped successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error(`Error during shutdown: ${error.message}`);
      process.exit(1);
    });
}

// Register shutdown handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error(`Server failed to start: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  webhookServer,
  start: main
}; 