// Popup script for Virtual Try-On & Video extension

class VTONPopup {
  constructor() {
    this.userData = null;
    this.currentTab = null;
    this.currentProductInfo = null;

    this.init();
  }

  async init() {
    await this.loadUserData();
    await this.getCurrentTab();
    await this.loadProfileImage();
    this.setupEventListeners();
    this.updateUI();
    this.checkServiceStatus();
  }

  async loadUserData() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getUserData'
      });

      if (response.success) {
        this.userData = response.data;
        this.updateSettings();
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }

  async getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.currentTab = tab;
  }

  async loadProfileImage() {
    try {
      const data = await chrome.storage.local.get(['profileImage']);
      if (data.profileImage) {
        document.getElementById('profile-avatar').src = data.profileImage;
      }
    } catch (error) {
      console.error('Failed to load profile image:', error);
    }
  }

  setupEventListeners() {
    // Action buttons
    document.getElementById('try-on-current').addEventListener('click', () => {
      this.triggerTryOnCurrentPage();
    });

    document.getElementById('show-product-image').addEventListener('click', () => {
      this.showProductImageModal();
    });

    // Navigation buttons
    document.getElementById('open-history').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/history-page.html') });
    });

    document.getElementById('open-profile').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/profile-page.html') });
    });

    document.getElementById('get-recommendations').addEventListener('click', () => {
      this.showRecommendationsModal();
    });

    // Profile avatar click
    document.getElementById('profile-avatar').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/profile-page.html') });
    });

    // Refresh product info button
    document.getElementById('refresh-product-info').addEventListener('click', async () => {
      this.showToast('Refreshing product information...');
      this.currentProductInfo = null; // Clear cached info
      await this.loadProductInfo();
      this.updatePageStatus();
      if (this.currentProductInfo) {
        this.showToast('Product information updated');
      } else {
        this.showToast('No product detected on this page');
      }
    });

    // Product image modal actions
    document.getElementById('try-on-from-modal').addEventListener('click', () => {
      this.triggerTryOnCurrentPage();
      document.getElementById('product-image-modal').style.display = 'none';
    });

    document.getElementById('open-product-page').addEventListener('click', () => {
      if (this.currentProductInfo && this.currentProductInfo.url) {
        chrome.tabs.create({ url: this.currentProductInfo.url });
      }
    });

    // Modal close buttons (for product image modal)
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.target.dataset.modal;
        document.getElementById(modalId).style.display = 'none';
      });
    });

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }

  updateUI() {
    this.updatePageStatus();
    this.loadProductInfo();
  }

  updatePageStatus() {
    const statusText = document.getElementById('page-status-text');
    const tryOnBtn = document.getElementById('try-on-current');
    const showImageBtn = document.getElementById('show-product-image');

    if (this.isProductPage()) {
      statusText.textContent = '✅ Product page detected';
      statusText.style.color = '#28a745';
      tryOnBtn.disabled = false;
      showImageBtn.disabled = false;
    } else {
      statusText.textContent = '❌ Not a product page';
      statusText.style.color = '#dc3545';
      tryOnBtn.disabled = true;
      showImageBtn.disabled = true;
    }
  }

  isProductPage() {
    if (!this.currentTab || !this.currentTab.url) return false;

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

    const url = this.currentTab.url.toLowerCase();
    return productIndicators.some(indicator => url.includes(indicator));
  }


  async triggerTryOnCurrentPage() {
    if (!this.isProductPage()) {
      this.showToast('Please navigate to a product page first');
      return;
    }

    // Check if we have profile image
    const profileData = await chrome.storage.local.get(['profileImage']);
    if (!profileData.profileImage) {
      this.showToast('Please set up your profile image first');
      chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/profile-page.html') });
      return;
    }

    // Get product info
    if (!this.currentProductInfo) {
      this.showToast('Loading product information...');
      await this.loadProductInfo();
    }

    if (!this.currentProductInfo || !this.currentProductInfo.image) {
      this.showToast('Could not detect product image on this page');
      return;
    }

    this.showToast('Generating try-on image...');

    try {
      const result = await this.callGeminiTryOn(profileData.profileImage, this.currentProductInfo.image);

      if (result.success) {
        // Save the result and show it
        const timestamp = Date.now();
        const tryOnResult = {
          id: `tryon_${timestamp}`,
          personImage: profileData.profileImage,
          garmentImage: this.currentProductInfo.image,
          resultImage: result.imageData,
          productTitle: this.currentProductInfo.title,
          productUrl: this.currentProductInfo.url,
          timestamp: timestamp
        };

        // Save to history
        const history = await chrome.storage.local.get(['tryOnHistory']);
        const updatedHistory = [tryOnResult, ...(history.tryOnHistory || [])].slice(0, 50);
        await chrome.storage.local.set({ tryOnHistory: updatedHistory });

        // Show result in new tab
        const resultUrl = chrome.runtime.getURL('src/pages/history-page.html') + `?show=${tryOnResult.id}`;
        chrome.tabs.create({ url: resultUrl });

        this.showToast('✅ Try-on complete! Check the new tab.');
      } else {
        this.showToast('❌ Try-on failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Try-on failed:', error);
      this.showToast('❌ Try-on failed: ' + error.message);
    }
  }

  async callGeminiTryOn(personImageData, garmentImageUrl) {
    // Get API key from storage
    const settings = await chrome.storage.local.get(['geminiApiKey']);
    const GEMINI_API_KEY = settings.geminiApiKey;

    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured. Please set it in your profile settings.');
    }
    const GEMINI_MODEL = 'gemini-2.0-flash-exp';
    const PROMPT = `You are an advanced virtual try-on assistant. Using the first image as the person (preserve their exact identity, facial features, hair, pose, lighting conditions, and background environment) and the second image as the garment, compose a highly realistic, photorealistic image of the person wearing the garment.

Key requirements:
- Preserve the person's exact body shape, proportions, and posture
- Maintain original lighting conditions and shadows
- Keep the background completely unchanged
- Ensure the garment fits naturally with realistic fabric physics, wrinkles, and draping
- Respect garment texture, color, patterns, and material properties
- Adapt garment size and fit to the person's body naturally
- Maintain depth and perspective consistency
- Preserve any accessories or items the person is holding/wearing that don't conflict with the new garment
- Ensure seamless integration between person and garment with no visible artifacts or blending issues

Return only the final composed image with professional photo quality.`;

    try {
      // Convert person image data URL to base64
      const personBase64 = personImageData.split(',')[1];
      const personMimeType = personImageData.split(';')[0].split(':')[1];

      // Fetch and convert garment image to base64
      const garmentResponse = await fetch(garmentImageUrl);
      const garmentBlob = await garmentResponse.blob();
      const garmentBase64 = await this.blobToBase64(garmentBlob);
      const garmentMimeType = garmentBlob.type;

      const requestBody = {
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: personMimeType,
                  data: personBase64
                }
              },
              {
                inline_data: {
                  mime_type: garmentMimeType,
                  data: garmentBase64.split(',')[1]
                }
              },
              {
                text: PROMPT
              }
            ]
          }
        ]
      };

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('No content returned from Gemini');
      }

      const parts = data.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inline_data && part.inline_data.data) {
          const imageData = `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
          return { success: true, imageData };
        }
      }

      throw new Error('No image data found in response');
    } catch (error) {
      console.error('Gemini API call failed:', error);
      return { success: false, error: error.message };
    }
  }

  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }


  async showRecommendationsModal() {
    const modal = document.getElementById('recommendations-modal');
    const loadingState = document.getElementById('recommendations-loading');
    const recommendationsList = document.getElementById('recommendations-list');

    modal.style.display = 'block';
    loadingState.style.display = 'block';
    recommendationsList.style.display = 'none';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getRecommendations',
        data: {
          userId: this.userData.userId,
          hint: 'similar items'
        }
      });

      if (response.success && response.data.items) {
        loadingState.style.display = 'none';
        recommendationsList.style.display = 'grid';

        recommendationsList.innerHTML = response.data.items.map(item => `
          <div class="recommendation-item" onclick="chrome.tabs.create({url: '${item.product_url}'})">
            <img class="recommendation-image" src="${item.image_url}" alt="${item.title}">
            <div class="recommendation-info">
              <h4>${item.title}</h4>
              <p>${item.attrs ? Object.entries(item.attrs).map(([k,v]) => `${k}: ${v}`).join(', ') : ''}</p>
            </div>
          </div>
        `).join('');
      } else {
        throw new Error('No recommendations available');
      }
    } catch (error) {
      console.error('Failed to get recommendations:', error);
      loadingState.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">😔</div>
          <p>No recommendations available</p>
          <small>Try on more items to get personalized suggestions!</small>
        </div>
      `;
    }
  }

  async checkServiceStatus() {
    const vtonStatus = document.getElementById('vton-status');
    const videoStatus = document.getElementById('video-status');

    vtonStatus.className = 'status-dot checking';
    videoStatus.className = 'status-dot checking';

    // Check VTON service
    try {
      const vtonResponse = await fetch('http://localhost:8001/health', {
        method: 'GET',
        timeout: 3000
      });
      vtonStatus.className = vtonResponse.ok ? 'status-dot online' : 'status-dot';
    } catch (error) {
      vtonStatus.className = 'status-dot';
    }

    // Check Video service
    try {
      const videoResponse = await fetch('http://localhost:8002/health', {
        method: 'GET',
        timeout: 3000
      });
      videoStatus.className = videoResponse.ok ? 'status-dot online' : 'status-dot';
    } catch (error) {
      videoStatus.className = 'status-dot';
    }
  }

  formatTimestamp(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }

  async loadProductInfo() {
    if (!this.isProductPage()) return;

    try {
      // First try to get product info from content script
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getProductInfo'
      });

      if (response && response.success && response.data) {
        this.currentProductInfo = response.data;
        console.log('Got product info from content script:', this.currentProductInfo);
        return;
      }
    } catch (error) {
      console.log('Content script not available, extracting product info directly:', error);
    }

    // Fallback: extract product info directly from the current tab
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        func: this.extractProductInfoDirectly
      });

      if (results && results[0] && results[0].result) {
        this.currentProductInfo = results[0].result;
        console.log('Extracted product info directly:', this.currentProductInfo);
      }
    } catch (error) {
      console.error('Failed to extract product info:', error);
    }
  }

  // Function to inject and run in the page context
  extractProductInfoDirectly() {
    const getProductTitle = () => {
      const selectors = [
        'h1[data-testid*="product"]',
        'h1.product-title',
        'h1.pdp-product-name',
        '.product-name h1',
        'h1',
        '[data-testid="product-title"]',
        '.product-title'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      return document.title;
    };

    const getProductImage = () => {
      const selectors = [
        'img[data-testid*="product"]',
        '.product-image img',
        '.pdp-image img',
        '[data-testid="product-image"] img',
        '.main-image img',
        '.hero-image img',
        'img[alt*="product" i]',
        'img[class*="product" i]'
      ];

      for (const selector of selectors) {
        const img = document.querySelector(selector);
        if (img && img.src && !img.src.includes('icon') && !img.src.includes('logo')) {
          return img.src;
        }
      }

      // Fallback to largest image on page
      const images = Array.from(document.querySelectorAll('img'));
      const largestImage = images.reduce((largest, img) => {
        if (!img.src || img.src.includes('icon') || img.src.includes('logo') ||
            img.src.includes('sprite') || img.width < 100 || img.height < 100) {
          return largest;
        }
        const area = img.naturalWidth * img.naturalHeight;
        const largestArea = largest ? largest.naturalWidth * largest.naturalHeight : 0;
        return area > largestArea ? img : largest;
      }, null);

      return largestImage ? largestImage.src : null;
    };

    return {
      url: window.location.href,
      title: getProductTitle(),
      image: getProductImage(),
      timestamp: Date.now()
    };
  }


  async showProductImageModal() {
    // Try to load product info if we don't have it
    if (!this.currentProductInfo) {
      this.showToast('Loading product information...');
      await this.loadProductInfo();
    }

    if (!this.currentProductInfo) {
      this.showToast('Could not detect product information on this page');
      return;
    }

    if (!this.currentProductInfo.image) {
      this.showToast('No product image found on this page');
      return;
    }

    const modal = document.getElementById('product-image-modal');
    const image = document.getElementById('detected-product-image');
    const title = document.getElementById('product-title-display');
    const url = document.getElementById('product-url-display');

    // Set the product image
    image.src = this.currentProductInfo.image;
    image.onerror = () => {
      image.src = '/assets/images/demo_product.webp'; // Fallback image
      this.showToast('Product image failed to load, showing fallback');
    };

    title.textContent = this.currentProductInfo.title || 'Product';
    url.textContent = this.currentProductInfo.url || window.location.href;

    modal.style.display = 'block';
  }


  showToast(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new VTONPopup();
});
