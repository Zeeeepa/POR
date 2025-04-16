/**
 * Token storage utility for persistent GitHub token
 */

const fs = require('fs-extra');
const path = require('path');

class TokenStorage {
  constructor() {
    this.tokenFile = path.join(process.cwd(), '.env');
    this.envExample = path.join(process.cwd(), '.env.example');
  }

  async getToken() {
    try {
      // First check environment variable
      if (process.env.GITHUB_TOKEN) {
        return process.env.GITHUB_TOKEN;
      }

      // Then check .env file
      if (await fs.pathExists(this.tokenFile)) {
        const envContent = await fs.readFile(this.tokenFile, 'utf8');
        const match = envContent.match(/GITHUB_TOKEN=(.+)/);
        if (match) {
          return match[1];
        }
      }

      return null;
    } catch (error) {
      console.error('Error reading GitHub token:', error);
      return null;
    }
  }

  async saveToken(token) {
    try {
      // Create .env from example if it doesn't exist
      if (!await fs.pathExists(this.tokenFile) && await fs.pathExists(this.envExample)) {
        await fs.copy(this.envExample, this.tokenFile);
      }

      // Read current .env content
      let envContent = '';
      if (await fs.pathExists(this.tokenFile)) {
        envContent = await fs.readFile(this.tokenFile, 'utf8');
      }

      // Update or add token
      if (envContent.includes('GITHUB_TOKEN=')) {
        envContent = envContent.replace(/GITHUB_TOKEN=.+/, `GITHUB_TOKEN=${token}`);
      } else {
        envContent += `\nGITHUB_TOKEN=${token}`;
      }

      // Save back to .env
      await fs.writeFile(this.tokenFile, envContent.trim());

      // Update process.env
      process.env.GITHUB_TOKEN = token;

      return true;
    } catch (error) {
      console.error('Error saving GitHub token:', error);
      return false;
    }
  }
}

module.exports = new TokenStorage();
