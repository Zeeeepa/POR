/**
 * GitHubService.test.js
 * Unit tests for the GitHubService module
 */

const { Octokit } = require('@octokit/rest');
const GitHubService = require('../../src/utils/GitHubService');
const NodeCache = require('node-cache');

// Mock dependencies
jest.mock('@octokit/rest');
jest.mock('node-cache');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/config', () => ({
  github: {
    token: 'mock-token',
    apiUrl: 'https://api.github.com',
    webhookSecret: 'mock-webhook-secret'
  }
}));
jest.mock('../../src/utils/GitHubEnhanced', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      authenticate: jest.fn().mockResolvedValue(true)
    };
  });
});

describe('GitHubService', () => {
  let service;
  let mockOctokit;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock Octokit instance
    mockOctokit = {
      users: {
        getAuthenticated: jest.fn().mockResolvedValue({
          data: { login: 'test-user' },
          headers: {
            'x-ratelimit-remaining': '4999',
            'x-ratelimit-reset': '1609459200'
          }
        })
      },
      repos: {
        listForAuthenticatedUser: jest.fn().mockResolvedValue({
          data: [{ name: 'test-repo' }],
          headers: {
            'x-ratelimit-remaining': '4998',
            'x-ratelimit-reset': '1609459200'
          }
        }),
        get: jest.fn().mockResolvedValue({
          data: { name: 'test-repo', owner: { login: 'test-owner' } },
          headers: {
            'x-ratelimit-remaining': '4997',
            'x-ratelimit-reset': '1609459200'
          }
        }),
        createInOrg: jest.fn().mockResolvedValue({
          data: { name: 'new-repo', owner: { login: 'test-org' } },
          headers: {
            'x-ratelimit-remaining': '4996',
            'x-ratelimit-reset': '1609459200'
          }
        }),
        createForAuthenticatedUser: jest.fn().mockResolvedValue({
          data: { name: 'new-repo', owner: { login: 'test-user' } },
          headers: {
            'x-ratelimit-remaining': '4995',
            'x-ratelimit-reset': '1609459200'
          }
        }),
        update: jest.fn().mockResolvedValue({
          data: { name: 'updated-repo', owner: { login: 'test-owner' } },
          headers: {
            'x-ratelimit-remaining': '4994',
            'x-ratelimit-reset': '1609459200'
          }
        }),
        delete: jest.fn().mockResolvedValue({
          data: {},
          headers: {
            'x-ratelimit-remaining': '4993',
            'x-ratelimit-reset': '1609459200'
          }
        }),
        listBranches: jest.fn().mockResolvedValue({
          data: [{ name: 'main', commit: { sha: 'abc123' } }],
          headers: {
            'x-ratelimit-remaining': '4992',
            'x-ratelimit-reset': '1609459200'
          }
        }),
        listCommits: jest.fn().mockResolvedValue({
          data: [{ sha: 'abc123', commit: { message: 'Test commit' } }],
          headers: {
            'x-ratelimit-remaining': '4991',
            'x-ratelimit-reset': '1609459200'
          }
        }),
        createWebhook: jest.fn().mockResolvedValue({
          data: { id: 123, config: { url: 'https://example.com/webhook' } },
          headers: {
            'x-ratelimit-remaining': '4990',
            'x-ratelimit-reset': '1609459200'
          }
        })
      },
      git: {
        createRef: jest.fn().mockResolvedValue({
          data: { ref: 'refs/heads/new-branch', object: { sha: 'abc123' } },
          headers: {
            'x-ratelimit-remaining': '4989',
            'x-ratelimit-reset': '1609459200'
          }
        })
      },
      rateLimit: {
        get: jest.fn().mockResolvedValue({
          data: {
            resources: {
              core: {
                limit: 5000,
                used: 10,
                remaining: 4990,
                reset: 1609459200
              }
            }
          },
          headers: {
            'x-ratelimit-remaining': '4988',
            'x-ratelimit-reset': '1609459200'
          }
        })
      }
    };
    
    // Mock Octokit constructor
    Octokit.mockImplementation(() => mockOctokit);
    
    // Mock NodeCache
    NodeCache.mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      keys: jest.fn().mockReturnValue([]),
      flushAll: jest.fn(),
      getStats: jest.fn().mockReturnValue({ hits: 10, misses: 5 })
    }));
    
    // Create service instance
    service = new GitHubService({
      token: 'test-token',
      cacheTTL: 60,
      maxRetries: 2
    });
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultService = new GitHubService();
      expect(defaultService.options.token).toBe('mock-token');
      expect(defaultService.options.baseUrl).toBe('https://api.github.com');
      expect(defaultService.options.cacheTTL).toBe(300);
      expect(defaultService.options.maxRetries).toBe(3);
      expect(defaultService.options.retryDelay).toBe(1000);
    });
    
    it('should initialize with custom options', () => {
      expect(service.options.token).toBe('test-token');
      expect(service.options.cacheTTL).toBe(60);
      expect(service.options.maxRetries).toBe(2);
    });
    
    it('should initialize cache', () => {
      expect(NodeCache).toHaveBeenCalledWith({
        stdTTL: 60,
        checkperiod: 6,
        useClones: false
      });
    });
  });
  
  describe('authenticate', () => {
    it('should authenticate with token', async () => {
      const result = await service.authenticate();
      
      expect(result).toBe(true);
      expect(service.authenticated).toBe(true);
      expect(service.authType).toBe('token');
      expect(Octokit).toHaveBeenCalledWith({
        auth: 'test-token',
        baseUrl: undefined
      });
      expect(mockOctokit.users.getAuthenticated).toHaveBeenCalled();
    });
    
    it('should throw AuthenticationError when no token is provided', async () => {
      service.options.token = null;
      
      await expect(service.authenticate()).rejects.toThrow('No GitHub token provided');
    });
  });
  
  describe('getRepositories', () => {
    it('should get repositories with default options', async () => {
      service.authenticated = true;
      
      const repos = await service.getRepositories();
      
      expect(repos).toEqual([{ name: 'test-repo' }]);
      expect(mockOctokit.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
        type: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        page: 1,
        visibility: undefined
      });
    });
    
    it('should get repositories with custom options', async () => {
      service.authenticated = true;
      
      await service.getRepositories({
        type: 'owner',
        sort: 'created',
        direction: 'asc',
        per_page: 50,
        page: 2,
        visibility: 'public'
      });
      
      expect(mockOctokit.repos.listForAuthenticatedUser).toHaveBeenCalledWith({
        type: 'owner',
        sort: 'created',
        direction: 'asc',
        per_page: 50,
        page: 2,
        visibility: 'public'
      });
    });
  });
  
  describe('getRepository', () => {
    it('should get a specific repository', async () => {
      service.authenticated = true;
      
      const repo = await service.getRepository('test-owner', 'test-repo');
      
      expect(repo).toEqual({ name: 'test-repo', owner: { login: 'test-owner' } });
      expect(mockOctokit.repos.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo'
      });
    });
  });
  
  describe('createRepository', () => {
    it('should create a repository for authenticated user', async () => {
      service.authenticated = true;
      
      const repo = await service.createRepository({
        name: 'new-repo',
        description: 'Test repository',
        private: true
      });
      
      expect(repo).toEqual({ name: 'new-repo', owner: { login: 'test-user' } });
      expect(mockOctokit.repos.createForAuthenticatedUser).toHaveBeenCalledWith({
        name: 'new-repo',
        description: 'Test repository',
        private: true,
        auto_init: false,
        gitignore_template: undefined,
        license_template: undefined
      });
    });
    
    it('should create a repository in an organization', async () => {
      service.authenticated = true;
      
      const repo = await service.createRepository({
        name: 'new-repo',
        description: 'Test repository',
        private: true,
        org: true,
        org_name: 'test-org'
      });
      
      expect(repo).toEqual({ name: 'new-repo', owner: { login: 'test-org' } });
      expect(mockOctokit.repos.createInOrg).toHaveBeenCalledWith({
        org: 'test-org',
        name: 'new-repo',
        description: 'Test repository',
        private: true,
        auto_init: false,
        gitignore_template: undefined,
        license_template: undefined
      });
    });
    
    it('should throw error when name is not provided', async () => {
      service.authenticated = true;
      
      await expect(service.createRepository({})).rejects.toThrow('Repository name is required');
    });
    
    it('should throw error when org is true but org_name is not provided', async () => {
      service.authenticated = true;
      
      await expect(service.createRepository({
        name: 'new-repo',
        org: true
      })).rejects.toThrow('Organization name is required for org repositories');
    });
  });
  
  describe('updateRepository', () => {
    it('should update repository settings', async () => {
      service.authenticated = true;
      service.cache.keys = jest.fn().mockReturnValue(['repo:test-owner/test-repo']);
      
      const repo = await service.updateRepository('test-owner', 'test-repo', {
        name: 'updated-repo',
        description: 'Updated description',
        private: false
      });
      
      expect(repo).toEqual({ name: 'updated-repo', owner: { login: 'test-owner' } });
      expect(mockOctokit.repos.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        name: 'updated-repo',
        description: 'Updated description',
        private: false
      });
      expect(service.cache.del).toHaveBeenCalledWith('repo:test-owner/test-repo');
    });
  });
  
  describe('deleteRepository', () => {
    it('should delete a repository', async () => {
      service.authenticated = true;
      service.cache.keys = jest.fn().mockReturnValue([
        'repo:test-owner/test-repo',
        'repos:{"type":"all"}',
        'branches:test-owner/test-repo:{"page":1}'
      ]);
      
      const result = await service.deleteRepository('test-owner', 'test-repo');
      
      expect(result).toBe(true);
      expect(mockOctokit.repos.delete).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo'
      });
      expect(service.cache.del).toHaveBeenCalledWith('repo:test-owner/test-repo');
      expect(service.cache.del).toHaveBeenCalledWith([
        'repos:{"type":"all"}',
        'branches:test-owner/test-repo:{"page":1}'
      ]);
    });
  });
  
  describe('getBranches', () => {
    it('should get branches with default options', async () => {
      service.authenticated = true;
      
      const branches = await service.getBranches('test-owner', 'test-repo');
      
      expect(branches).toEqual([{ name: 'main', commit: { sha: 'abc123' } }]);
      expect(mockOctokit.repos.listBranches).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        protected: undefined,
        per_page: 100,
        page: 1
      });
    });
    
    it('should get branches with custom options', async () => {
      service.authenticated = true;
      
      await service.getBranches('test-owner', 'test-repo', {
        protected: true,
        per_page: 50,
        page: 2
      });
      
      expect(mockOctokit.repos.listBranches).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        protected: true,
        per_page: 50,
        page: 2
      });
    });
  });
  
  describe('createBranch', () => {
    it('should create a new branch', async () => {
      service.authenticated = true;
      service.cache.keys = jest.fn().mockReturnValue(['branches:test-owner/test-repo:{}']);
      
      const branch = await service.createBranch('test-owner', 'test-repo', 'new-branch', 'abc123');
      
      expect(branch).toEqual({ ref: 'refs/heads/new-branch', object: { sha: 'abc123' } });
      expect(mockOctokit.git.createRef).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        ref: 'refs/heads/new-branch',
        sha: 'abc123'
      });
      expect(service.cache.del).toHaveBeenCalledWith('branches:test-owner/test-repo:{}');
    });
    
    it('should throw error when branch name is not provided', async () => {
      service.authenticated = true;
      
      await expect(service.createBranch('test-owner', 'test-repo', '', 'abc123')).rejects.toThrow('Branch name is required');
    });
    
    it('should throw error when SHA is not provided', async () => {
      service.authenticated = true;
      
      await expect(service.createBranch('test-owner', 'test-repo', 'new-branch', '')).rejects.toThrow('SHA is required');
    });
  });
  
  describe('getCommits', () => {
    it('should get commits with default options', async () => {
      service.authenticated = true;
      
      const commits = await service.getCommits('test-owner', 'test-repo');
      
      expect(commits).toEqual([{ sha: 'abc123', commit: { message: 'Test commit' } }]);
      expect(mockOctokit.repos.listCommits).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        sha: undefined,
        path: undefined,
        author: undefined,
        since: undefined,
        until: undefined,
        per_page: 100,
        page: 1
      });
    });
    
    it('should get commits with custom options', async () => {
      service.authenticated = true;
      
      await service.getCommits('test-owner', 'test-repo', {
        sha: 'main',
        path: 'src',
        author: 'test-user',
        since: '2023-01-01T00:00:00Z',
        until: '2023-12-31T23:59:59Z',
        per_page: 50,
        page: 2
      });
      
      expect(mockOctokit.repos.listCommits).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        sha: 'main',
        path: 'src',
        author: 'test-user',
        since: '2023-01-01T00:00:00Z',
        until: '2023-12-31T23:59:59Z',
        per_page: 50,
        page: 2
      });
    });
  });
  
  describe('createWebhook', () => {
    it('should create a webhook with default options', async () => {
      service.authenticated = true;
      
      const webhook = await service.createWebhook('test-owner', 'test-repo', {
        url: 'https://example.com/webhook'
      });
      
      expect(webhook).toEqual({ id: 123, config: { url: 'https://example.com/webhook' } });
      expect(mockOctokit.repos.createWebhook).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        config: {
          url: 'https://example.com/webhook',
          content_type: 'json',
          insecure_ssl: 0
        },
        events: ['push', 'pull_request'],
        active: true
      });
    });
    
    it('should create a webhook with custom options', async () => {
      service.authenticated = true;
      
      await service.createWebhook('test-owner', 'test-repo', {
        url: 'https://example.com/webhook',
        secret: 'webhook-secret',
        content_type: 'form',
        insecure_ssl: 1,
        events: ['push', 'pull_request', 'issues']
      });
      
      expect(mockOctokit.repos.createWebhook).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        config: {
          url: 'https://example.com/webhook',
          content_type: 'form',
          insecure_ssl: 1,
          secret: 'webhook-secret'
        },
        events: ['push', 'pull_request', 'issues'],
        active: true
      });
    });
    
    it('should throw error when URL is not provided', async () => {
      service.authenticated = true;
      
      await expect(service.createWebhook('test-owner', 'test-repo', {})).rejects.toThrow('Webhook URL is required');
    });
  });
  
  describe('validateWebhookSignature', () => {
    it('should validate webhook signature', () => {
      const webhookUtils = require('../../src/utils/github/webhookUtils');
      webhookUtils.verifySignature = jest.fn().mockReturnValue(true);
      
      const result = service.validateWebhookSignature(
        '{"event":"push"}',
        'sha256=hash',
        'webhook-secret'
      );
      
      expect(result).toBe(true);
      expect(webhookUtils.verifySignature).toHaveBeenCalledWith(
        'sha256=hash',
        '{"event":"push"}',
        'webhook-secret'
      );
    });
    
    it('should convert object payload to string', () => {
      const webhookUtils = require('../../src/utils/github/webhookUtils');
      webhookUtils.verifySignature = jest.fn().mockReturnValue(true);
      
      const result = service.validateWebhookSignature(
        { event: 'push' },
        'sha256=hash',
        'webhook-secret'
      );
      
      expect(result).toBe(true);
      expect(webhookUtils.verifySignature).toHaveBeenCalledWith(
        'sha256=hash',
        '{"event":"push"}',
        'webhook-secret'
      );
    });
    
    it('should return false when parameters are missing', () => {
      const result = service.validateWebhookSignature(null, 'sha256=hash', 'webhook-secret');
      expect(result).toBe(false);
    });
  });
  
  describe('clearCache', () => {
    it('should clear all cache entries', () => {
      service.cache.keys = jest.fn().mockReturnValue(['key1', 'key2', 'key3']);
      
      const count = service.clearCache();
      
      expect(count).toBe(3);
      expect(service.cache.flushAll).toHaveBeenCalled();
    });
    
    it('should clear cache entries matching pattern', () => {
      service.cache.keys = jest.fn().mockReturnValue(['repo:test1', 'repo:test2', 'branch:test']);
      
      const count = service.clearCache('repo:');
      
      expect(count).toBe(2);
      expect(service.cache.del).toHaveBeenCalledWith(['repo:test1', 'repo:test2']);
    });
  });
  
  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      service.cache.keys = jest.fn().mockReturnValue(['key1', 'key2']);
      
      const stats = service.getCacheStats();
      
      expect(stats).toEqual({
        keys: 2,
        hits: 10,
        misses: 5,
        ttl: 60
      });
    });
  });
  
  describe('getRateLimitInfo', () => {
    it('should return cached rate limit info', async () => {
      service.authenticated = true;
      service.rateLimitRemaining = 4990;
      service.rateLimitReset = 1609459200;
      
      const info = await service.getRateLimitInfo();
      
      expect(info).toEqual({
        core: {
          remaining: 4990,
          reset: 1609459200
        }
      });
      expect(mockOctokit.rateLimit.get).not.toHaveBeenCalled();
    });
    
    it('should fetch fresh rate limit info when refresh is true', async () => {
      service.authenticated = true;
      
      const info = await service.getRateLimitInfo(true);
      
      expect(info).toEqual({
        core: {
          limit: 5000,
          used: 10,
          remaining: 4990,
          reset: 1609459200
        }
      });
      expect(mockOctokit.rateLimit.get).toHaveBeenCalled();
    });
  });
});
