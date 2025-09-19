/**
 * Simple .env file loader for Chrome extension development
 * Reads .env file from the project root and parses key-value pairs
 */

class EnvLoader {
  constructor() {
    this.envVars = {};
    this.loaded = false;
  }

  /**
   * Load environment variables from .env file
   */
  async loadEnv() {
    if (this.loaded) return this.envVars;

    try {
      // In development, read from the .env file in project root
      const response = await fetch(chrome.runtime.getURL('../../../.env'));
      const envContent = await response.text();

      this.envVars = this.parseEnvContent(envContent);
      this.loaded = true;
      console.log('✅ Environment variables loaded from .env file');

    } catch (error) {
      console.log('⚠️ Could not load .env file');
    }

    return this.envVars;
  }

  /**
   * Parse .env file content into key-value pairs
   */
  parseEnvContent(content) {
    const vars = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse KEY=value format
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        vars[key] = value;
      }
    }

    return vars;
  }

  /**
   * Get a specific environment variable
   */
  async get(key) {
    await this.loadEnv();
    return this.envVars[key];
  }

  /**
   * Get Gemini API key from .env file
   */
  async getGeminiApiKey() {
    await this.loadEnv();

    const apiKey = this.envVars.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.');
    }

    return apiKey;
  }
}

// Global instance
window.envLoader = new EnvLoader();
