const { Octokit } = require('@octokit/rest');
const { createOAuthAppAuth } = require('@octokit/auth-oauth-app');

class GitHubService {
    constructor(config) {
        if (!config.clientId || !config.clientSecret) {
            throw new Error('GitHub client ID and client secret are required');
        }

        this.config = config;
        this.octokit = new Octokit({
            authStrategy: createOAuthAppAuth,
            auth: {
                clientId: config.clientId,
                clientSecret: config.clientSecret
            }
        });
    }

    /**
     * Authenticate a user with GitHub OAuth
     * @param {string} code - OAuth code from GitHub
     * @returns {Promise<Object>} Authentication result
     */
    async authenticate(code) {
        try {
            const auth = await this.octokit.auth({
                type: 'oauth-user',
                code: code
            });

            return {
                token: auth.token,
                type: auth.tokenType
            };
        } catch (error) {
            throw new Error(`GitHub authentication failed: ${error.message}`);
        }
    }

    /**
     * Get user information
     * @param {string} token - User's access token
     * @returns {Promise<Object>} User information
     */
    async getUserInfo(token) {
        try {
            const octokit = new Octokit({ auth: token });
            const { data } = await octokit.users.getAuthenticated();
            return data;
        } catch (error) {
            throw new Error(`Failed to get user info: ${error.message}`);
        }
    }

    /**
     * List user repositories
     * @param {string} token - User's access token
     * @param {Object} options - List options (page, per_page, etc.)
     * @returns {Promise<Array>} List of repositories
     */
    async listRepositories(token, options = {}) {
        try {
            const octokit = new Octokit({ auth: token });
            const { data } = await octokit.repos.listForAuthenticatedUser({
                sort: 'updated',
                direction: 'desc',
                ...options
            });
            return data;
        } catch (error) {
            throw new Error(`Failed to list repositories: ${error.message}`);
        }
    }

    /**
     * Create a repository
     * @param {string} token - User's access token
     * @param {Object} repoData - Repository data
     * @returns {Promise<Object>} Created repository
     */
    async createRepository(token, repoData) {
        try {
            const octokit = new Octokit({ auth: token });
            const { data } = await octokit.repos.createForAuthenticatedUser(repoData);
            return data;
        } catch (error) {
            throw new Error(`Failed to create repository: ${error.message}`);
        }
    }

    /**
     * Create a pull request
     * @param {string} token - User's access token
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {Object} prData - Pull request data
     * @returns {Promise<Object>} Created pull request
     */
    async createPullRequest(token, owner, repo, prData) {
        try {
            const octokit = new Octokit({ auth: token });
            const { data } = await octokit.pulls.create({
                owner,
                repo,
                ...prData
            });
            return data;
        } catch (error) {
            throw new Error(`Failed to create pull request: ${error.message}`);
        }
    }

    /**
     * Get repository content
     * @param {string} token - User's access token
     * @param {string} owner - Repository owner
     * @param {string} repo - Repository name
     * @param {string} path - File path
     * @returns {Promise<Object>} File content
     */
    async getContent(token, owner, repo, path) {
        try {
            const octokit = new Octokit({ auth: token });
            const { data } = await octokit.repos.getContent({
                owner,
                repo,
                path
            });
            return data;
        } catch (error) {
            throw new Error(`Failed to get content: ${error.message}`);
        }
    }
}

module.exports = GitHubService;
