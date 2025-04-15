class GitHubIntegration {
  constructor(config) {
    this.config = config;
    this.authenticated = false;
    this.octokit = null;
    this.webhooks = [];
    this.prAnalysisQueue = [];
  }

  async authenticate() {
    try {
      const { Octokit } = require("@octokit/rest");
      
      const token = this.config.github?.token || process.env.GITHUB_TOKEN;
      
      if (!token) {
        throw new Error('GitHub token not configured. Please set up your token in settings.');
      }
      
      this.octokit = new Octokit({ 
        auth: token,
        userAgent: 'Depla-Project-Manager'
      });
      
      const { data: user } = await this.octokit.users.getAuthenticated();
      
      console.log(`Authenticated with GitHub as ${user.login}`);
      this.authenticated = true;
      
      if (!this.config.github.username) {
        this.config.github.username = user.login;
      }
      
      return user;
    } catch (error) {
      console.error('Failed to authenticate with GitHub:', error.message);
      this.authenticated = false;
      throw error;
    }
  }

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
      console.error('Failed to fetch repositories:', error.message);
      throw error;
    }
  }
  
  async createRepository(name, isPrivate = false, description = '') {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    try {
      const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: true
      });
      
      console.log(`Created repository: ${repo.full_name}`);
      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        description: repo.description,
        isPrivate: repo.private,
        defaultBranch: repo.default_branch
      };
    } catch (error) {
      console.error(`Failed to create repository "${name}":`, error.message);
      throw error;
    }
  }
  
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
          secret: this.config.github.webhookSecret || ''
        },
        events: ['push', 'pull_request', 'create', 'delete'],
        active: true
      });
      
      console.log(`Webhook created for ${repoFullName}`);
      this.webhooks.push(repo.id);
      return webhook;
    } catch (error) {
      console.error(`Failed to create webhook for ${repoFullName}:`, error.message);
      throw error;
    }
  }
  
  async getPullRequests(repoFullName, state = 'open') {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      const { data: pullRequests } = await this.octokit.pulls.list({
        owner,
        repo,
        state,
        sort: 'updated',
        direction: 'desc',
        per_page: 50
      });
      
      return pullRequests.map(pr => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        closedAt: pr.closed_at,
        mergedAt: pr.merged_at,
        authorLogin: pr.user?.login,
        authorAvatar: pr.user?.avatar_url,
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref
      }));
    } catch (error) {
      console.error(`Failed to fetch PRs for ${repoFullName}:`, error.message);
      throw error;
    }
  }
  
  async analyzePullRequest(repoFullName, prNumber, requirementsPath) {
    if (!this.authenticated) {
      await this.authenticate();
    }
    
    const [owner, repo] = repoFullName.split('/');
    
    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      
      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });
      
      const { data: commits } = await this.octokit.pulls.listCommits({
        owner,
        repo,
        pull_number: prNumber
      });
      
      let requirements = [];
      if (requirementsPath) {
        const fs = require('fs');
        if (fs.existsSync(requirementsPath)) {
          const content = fs.readFileSync(requirementsPath, 'utf8');
          requirements = this.parseRequirements(content);
        }
      }
      
      const analysis = {
        prNumber,
        title: pr.title,
        url: pr.html_url,
        author: pr.user.login,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        changedFiles: files.length,
        commits: commits.length,
        additions: pr.additions,
        deletions: pr.deletions,
        requirements: requirements,
        score: 0,
        feedback: [],
        status: 'pending'
      };
      
      if (requirements.length > 0) {
        let totalScore = 0;
        
        for (const req of requirements) {
          let isImplemented = pr.title.toLowerCase().includes(req.text.toLowerCase());
          
          for (const file of files) {
            if (file.filename.toLowerCase().includes(req.text.toLowerCase())) {
              isImplemented = true;
              break;
            }
          }
          
          if (isImplemented) {
            totalScore += 1;
            analysis.feedback.push(`✅ Requirement "${req.text}" appears to be implemented`);
          } else {
            analysis.feedback.push(`❌ Requirement "${req.text}" may not be implemented`);
          }
        }
        
        analysis.score = Math.round((totalScore / requirements.length) * 100);
        analysis.status = analysis.score >= 80 ? 'pass' : 'needs-review';
      } else {
        analysis.feedback.push('⚠️ No requirements found for comparison');
      }
      
      console.log(`PR #${prNumber} analysis complete with score: ${analysis.score}%`);
      return analysis;
    } catch (error) {
      console.error(`Failed to analyze PR #${prNumber}:`, error.message);
      throw error;
    }
  }
  
  parseRequirements(content) {
    const requirements = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.startsWith('-') || trimmed.startsWith('*')) && trimmed.length > 2) {
        const text = trimmed.substring(1).trim();
        requirements.push({ text, type: 'feature' });
      } else if (trimmed.startsWith('#') && trimmed.includes(':')) {
        const text = trimmed.substring(trimmed.indexOf(':') + 1).trim();
        requirements.push({ text, type: 'header' });
      }
    }
    
    return requirements;
  }
  
  async createComment(repoFullName, prNumber, body) {
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
      
      console.log(`Comment created on PR #${prNumber}`);
      return comment;
    } catch (error) {
      console.error(`Failed to create comment on PR #${prNumber}:`, error.message);
      throw error;
    }
  }
  
  async queuePRForAnalysis(project, prNumber) {
    this.prAnalysisQueue.push({
      project,
      prNumber,
      status: 'queued',
      timestamp: new Date().toISOString()
    });
    
    console.log(`PR #${prNumber} queued for analysis`);
    return this.prAnalysisQueue.length;
  }
  
  async processAnalysisQueue() {
    if (this.prAnalysisQueue.length === 0) {
      return [];
    }
    
    const results = [];
    
    for (const item of this.prAnalysisQueue) {
      if (item.status === 'queued') {
        try {
          item.status = 'processing';
          
          const repoFullName = item.project.config.repository.includes('/')
            ? item.project.config.repository
            : `${this.config.github.username}/${item.project.config.name}`;
            
          const requirementsPath = item.project.getRequirementsPath();
          
          const analysis = await this.analyzePullRequest(repoFullName, item.prNumber, requirementsPath);
          
          if (this.config.github.autoComment) {
            const comment = `## 🔍 Depla Analysis Results
              
**Score**: ${analysis.score}% (${analysis.status === 'pass' ? '✅ Pass' : '⚠️ Needs Review'})

**Feedback**:
${analysis.feedback.map(f => `- ${f}`).join('\n')}

---
*This analysis was automatically generated by Depla Project Manager.*`;
            
            await this.createComment(repoFullName, item.prNumber, comment);
          }
          
          item.status = 'completed';
          item.result = analysis;
          results.push(analysis);
          
          console.log(`PR #${item.prNumber} analysis completed`);
        } catch (error) {
          console.error(`Error analyzing PR #${item.prNumber}:`, error.message);
          item.status = 'error';
          item.error = error.message;
        }
      }
    }
    
    this.prAnalysisQueue = this.prAnalysisQueue.filter(
      item => item.status !== 'completed' && item.status !== 'error'
    );
    
    return results;
  }
}
