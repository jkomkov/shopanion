// Background service worker for Virtual Try-On & Video extension

class VTONBackground {
  constructor() {
    this.mcpVtonUrl = 'http://localhost:8001';
    this.mcpVideoUrl = 'http://localhost:8002';

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        console.log('Virtual Try-On & Video extension installed');
        this.initializeExtension();
      }
    });

    // Handle messages from content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });

    // Handle tab updates to detect navigation to product pages
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.checkProductPage(tab);
      }
    });
  }

  async initializeExtension() {
    // Set default settings
    await chrome.storage.local.set({
      userId: this.generateUserId(),
      settings: {
        autoDetect: true,
        showNotifications: true,
        cacheResults: true
      }
    });
  }

  generateUserId() {
    const userId = 'user_' + Date.now();
    console.log('Generated background user ID:', userId);
    return userId;
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'tryOn':
          const tryOnResult = await this.handleTryOn(request.data);
          sendResponse({ success: true, data: tryOnResult });
          break;

        case 'createVideo':
          const videoResult = await this.handleCreateVideo(request.data);
          sendResponse({ success: true, data: videoResult });
          break;

        case 'getRecommendations':
          const recommendations = await this.getRecommendations(request.data);
          sendResponse({ success: true, data: recommendations });
          break;

        case 'rememberInteraction':
          await this.rememberInteraction(request.data);
          sendResponse({ success: true });
          break;

        case 'getUserData':
          const userData = await this.getUserData();
          sendResponse({ success: true, data: userData });
          break;

        case 'openProfile':
          chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/profile-page.html') });
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleTryOn(data) {
    const { userId, selfieUrl, productUrl, productImageUrl } = data;

    // Check cache first
    const cacheKey = `tryon_${userId}_${this.hashUrl(productUrl)}`;
    const cached = await this.getFromCache(cacheKey);

    if (cached) {
      return { ...cached, cache_hit: true };
    }

    // Make API call to MCP-A
    const response = await fetch(`${this.mcpVtonUrl}/try_on`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        selfie_url: selfieUrl,
        product_url: productUrl,
        product_image_url: productImageUrl
      })
    });

    if (!response.ok) {
      throw new Error(`Try-on service error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Cache the result
    await this.saveToCache(cacheKey, result, 24 * 60 * 60 * 1000); // 24 hours

    // Update user history
    await this.updateUserHistory(userId, {
      type: 'tryon',
      productUrl,
      imageUrl: result.image_url,
      timestamp: Date.now()
    });

    return { ...result, cache_hit: false };
  }

  async handleCreateVideo(data) {
    const { userId, imageUrl, action, duration = 4, aspect = '9:16' } = data;

    // Make API call to MCP-B
    const response = await fetch(`${this.mcpVideoUrl}/animate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        image_url: imageUrl,
        action,
        duration_s: duration,
        aspect
      })
    });

    if (!response.ok) {
      throw new Error(`Video service error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    // Update user history
    await this.updateUserHistory(userId, {
      type: 'video',
      action,
      videoUrl: result.video_url,
      timestamp: Date.now()
    });

    return result;
  }

  async getRecommendations(data) {
    const { userId, hint } = data;

    const response = await fetch(`${this.mcpVtonUrl}/recommend?user_id=${userId}&hint=${encodeURIComponent(hint || '')}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Recommendations service error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async rememberInteraction(data) {
    const { userId, productAttrs, verdict } = data;

    const response = await fetch(`${this.mcpVtonUrl}/remember_interaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        product_attrs: productAttrs,
        verdict
      })
    });

    if (!response.ok) {
      throw new Error(`Remember interaction error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async getUserData() {
    const data = await chrome.storage.local.get(['userId', 'settings', 'history']);
    return {
      userId: data.userId,
      settings: data.settings || {},
      history: data.history || []
    };
  }

  async updateUserHistory(userId, entry) {
    const data = await chrome.storage.local.get(['history']);
    const history = data.history || [];

    history.unshift(entry);

    // Keep only last 20 entries
    if (history.length > 20) {
      history.splice(20);
    }

    await chrome.storage.local.set({ history });
  }

  async getFromCache(key) {
    const data = await chrome.storage.local.get([key]);
    const cached = data[key];

    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    return null;
  }

  async saveToCache(key, data, ttlMs) {
    const cacheEntry = {
      data,
      expiry: Date.now() + ttlMs
    };

    await chrome.storage.local.set({ [key]: cacheEntry });
  }

  hashUrl(url) {
    // Simple hash function for URL
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  async checkProductPage(tab) {
    // Check if the current tab is a product page and show notification
    const settings = await chrome.storage.local.get(['settings']);

    if (settings.settings?.autoDetect && this.isLikelyProductPage(tab.url)) {
      // Show notification that try-on is available
      if (settings.settings?.showNotifications) {
        chrome.action.setBadgeText({
          text: '👕',
          tabId: tab.id
        });

        chrome.action.setBadgeBackgroundColor({
          color: '#667eea',
          tabId: tab.id
        });
      }
    } else {
      chrome.action.setBadgeText({
        text: '',
        tabId: tab.id
      });
    }
  }

  isLikelyProductPage(url) {
    const productIndicators = [
      'product',
      'item',
      'buy',
      'shop',
      'store',
      'clothing',
      'apparel',
      '/p/',
      '/products/',
      '/items/'
    ];

    const lowerUrl = url.toLowerCase();
    return productIndicators.some(indicator => lowerUrl.includes(indicator));
  }
}

// Initialize the background service
new VTONBackground();
