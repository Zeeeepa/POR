const express = require('express');
const router = express.Router();
const { Octokit } = require('@octokit/rest');

// Initialize Octokit with GitHub token
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

/**
 * Get list of repositories for the authenticated user
 */
router.get('/repositories', async (req, res) => {
  try {
    // Get user's repositories
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      direction: 'desc',
      per_page: 100
    });

    // Format repository data
    const formattedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      language: repo.language,
      private: repo.private,
      updated_at: repo.updated_at
    }));

    res.json(formattedRepos);
  } catch (error) {
    console.error('Failed to fetch repositories:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

module.exports = router;
