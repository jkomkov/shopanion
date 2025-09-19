// Content script for Virtual Try-On & Video extension
class VTONExtension {
  constructor() {
    this.mcpVtonUrl = 'http://localhost:8001';
    this.mcpVideoUrl = 'http://localhost:8002';
    this.userId = this.getUserId();
    this.currentProduct = null;
    this.currentTryOnImage = null;

    this.init();
  }

  getUserId() {
    let userId = localStorage.getItem('vton_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('vton_user_id', userId);
    }
    return userId;
  }

  init() {
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupExtension());
    } else {
      this.setupExtension();
    }
  }

  setupExtension() {
    // Detect if this is a product page
    if (this.isProductPage()) {
      this.extractProductInfo();
      this.injectTryOnButton();
    }
  }

  isProductPage() {
    // Simple heuristics to detect product pages
    const indicators = [
      'product',
      'item',
      'buy',
      'shop',
      'store',
      'clothing',
      'apparel'
    ];

    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();

    return indicators.some(indicator =>
      url.includes(indicator) || title.includes(indicator)
    ) || this.hasProductStructuredData();
  }

  hasProductStructuredData() {
    // Check for structured data indicating a product
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data['@type'] === 'Product' ||
            (Array.isArray(data) && data.some(item => item['@type'] === 'Product'))) {
          return true;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    return false;
  }

  extractProductInfo() {
    // Extract product information from the page
    const productInfo = {
      url: window.location.href,
      title: this.getProductTitle(),
      image: this.getProductImage(),
      price: this.getProductPrice(),
      description: this.getProductDescription()
    };

    this.currentProduct = productInfo;
    return productInfo;
  }

  getProductTitle() {
    // Try multiple selectors for product title
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
  }

  getProductImage() {
    // Try to find the main product image
    const selectors = [
      'img[data-testid*="product"]',
      '.product-image img',
      '.pdp-image img',
      '[data-testid="product-image"] img',
      '.main-image img',
      '.hero-image img'
    ];

    for (const selector of selectors) {
      const img = document.querySelector(selector);
      if (img && img.src) {
        return img.src;
      }
    }

    // Fallback to largest image on page
    const images = Array.from(document.querySelectorAll('img'));
    const largestImage = images.reduce((largest, img) => {
      if (!img.src || img.src.includes('icon') || img.src.includes('logo')) return largest;
      const area = img.naturalWidth * img.naturalHeight;
      const largestArea = largest ? largest.naturalWidth * largest.naturalHeight : 0;
      return area > largestArea ? img : largest;
    }, null);

    return largestImage ? largestImage.src : null;
  }

  getProductPrice() {
    const selectors = [
      '[data-testid*="price"]',
      '.price',
      '.product-price',
      '.pdp-price',
      '[class*="price"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.match(/[$£€¥]\d+/)) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  getProductDescription() {
    const selectors = [
      '[data-testid*="description"]',
      '.product-description',
      '.pdp-description',
      '.description'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim().substring(0, 500);
      }
    }

    return null;
  }

  injectTryOnButton() {
    // Find a good place to inject the try-on button
    const targetSelectors = [
      '.add-to-cart',
      '.buy-button',
      '.product-actions',
      '.pdp-actions',
      '[data-testid*="add-to-cart"]'
    ];

    let targetElement = null;
    for (const selector of targetSelectors) {
      targetElement = document.querySelector(selector);
      if (targetElement) break;
    }

    if (!targetElement) {
      // Fallback to body
      targetElement = document.body;
    }

    // Create the try-on button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'vton-extension-container';
    buttonContainer.innerHTML = `
      <button id="vton-try-on-btn" class="vton-btn vton-primary">
        Try it on
      </button>
      <div id="vton-modal" class="vton-modal" style="display: none;">
        <div class="vton-modal-content">
          <span class="vton-close">&times;</span>
          <div id="vton-modal-body">
            <h3>Virtual Try-On</h3>
            <div id="vton-step-1" class="vton-step">
              <p>Upload or use your selfie:</p>
              <input type="file" id="vton-selfie-upload" accept="image/*">
              <button id="vton-use-demo-selfie" class="vton-btn vton-secondary">Use Demo Selfie</button>
            </div>
            <div id="vton-step-2" class="vton-step" style="display: none;">
              <div id="vton-loading">Processing try-on...</div>
              <div id="vton-result" style="display: none;">
                <img id="vton-result-image" style="max-width: 100%; height: auto;">
                <div class="vton-actions">
                  <button id="vton-make-video-btn" class="vton-btn vton-primary">Make a Video</button>
                  <button id="vton-download-btn" class="vton-btn vton-secondary">Download</button>
                </div>
              </div>
            </div>
            <div id="vton-step-3" class="vton-step" style="display: none;">
              <div id="vton-video-controls">
                <p>Choose an action:</p>
                <button class="vton-action-btn" data-action="turn">Turn</button>
                <button class="vton-action-btn" data-action="wave">Wave</button>
                <button class="vton-action-btn" data-action="walk">Walk</button>
              </div>
              <div id="vton-video-loading" style="display: none;">Creating video...</div>
              <div id="vton-video-result" style="display: none;">
                <video id="vton-result-video" controls style="max-width: 100%; height: auto;"></video>
                <div class="vton-actions">
                  <button id="vton-download-video-btn" class="vton-btn vton-secondary">Download Video</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert the button near the target element
    if (targetElement === document.body) {
      targetElement.appendChild(buttonContainer);
    } else {
      targetElement.parentNode.insertBefore(buttonContainer, targetElement.nextSibling);
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'getProductInfo') {
        sendResponse({
          success: true,
          data: this.currentProduct
        });
      }
    });

    // Try-on button click
    document.getElementById('vton-try-on-btn').addEventListener('click', () => {
      document.getElementById('vton-modal').style.display = 'block';
    });

    // Close modal
    document.querySelector('.vton-close').addEventListener('click', () => {
      document.getElementById('vton-modal').style.display = 'none';
    });

    // Close modal when clicking outside
    document.getElementById('vton-modal').addEventListener('click', (e) => {
      if (e.target.id === 'vton-modal') {
        document.getElementById('vton-modal').style.display = 'none';
      }
    });

    // Selfie upload
    document.getElementById('vton-selfie-upload').addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this.handleSelfieUpload(e.target.files[0]);
      }
    });

    // Use demo selfie
    document.getElementById('vton-use-demo-selfie').addEventListener('click', () => {
      this.useDemoSelfie();
    });

    // Make video button
    document.getElementById('vton-make-video-btn').addEventListener('click', () => {
      this.showVideoStep();
    });

    // Action buttons
    document.querySelectorAll('.vton-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        this.createVideo(action);
      });
    });

    // Download buttons
    document.getElementById('vton-download-btn').addEventListener('click', () => {
      this.downloadImage();
    });

    document.getElementById('vton-download-video-btn').addEventListener('click', () => {
      this.downloadVideo();
    });
  }

  async handleSelfieUpload(file) {
    // Convert file to base64 or upload to a temporary service
    const reader = new FileReader();
    reader.onload = async (e) => {
      const selfieDataUrl = e.target.result;
      await this.processTryOn(selfieDataUrl);
    };
    reader.readAsDataURL(file);
  }

  async useDemoSelfie() {
    // Use the demo selfie from the vton directory
    const demoSelfieUrl = 'http://localhost:8001/assets/demo_selfie.jpg';
    await this.processTryOn(demoSelfieUrl);
  }

  async processTryOn(selfieUrl) {
    document.getElementById('vton-step-1').style.display = 'none';
    document.getElementById('vton-step-2').style.display = 'block';
    document.getElementById('vton-loading').style.display = 'block';

    try {
      const response = await this.callMCPService('vton', '/try_on', {
        user_id: this.userId,
        selfie_url: selfieUrl,
        product_url: this.currentProduct.url,
        product_image_url: this.currentProduct.image
      });

      if (response.image_url) {
        this.currentTryOnImage = response.image_url;
        document.getElementById('vton-loading').style.display = 'none';
        document.getElementById('vton-result').style.display = 'block';
        document.getElementById('vton-result-image').src = response.image_url;

        // Show cache hit indicator
        if (response.cache_hit) {
          this.showToast('Used cached result');
        }
      } else {
        throw new Error('No image returned from try-on service');
      }
    } catch (error) {
      console.error('Try-on failed:', error);
      document.getElementById('vton-loading').innerHTML = 'Try-on failed. Please try again.';
    }
  }

  showVideoStep() {
    document.getElementById('vton-step-2').style.display = 'none';
    document.getElementById('vton-step-3').style.display = 'block';
  }

  async createVideo(action) {
    document.getElementById('vton-video-controls').style.display = 'none';
    document.getElementById('vton-video-loading').style.display = 'block';

    try {
      const response = await this.callMCPService('video', '/animate', {
        user_id: this.userId,
        image_url: this.currentTryOnImage,
        action: action,
        duration_s: 4,
        aspect: '9:16'
      });

      if (response.video_url) {
        document.getElementById('vton-video-loading').style.display = 'none';
        document.getElementById('vton-video-result').style.display = 'block';
        document.getElementById('vton-result-video').src = response.video_url;
      } else {
        throw new Error('No video returned from animation service');
      }
    } catch (error) {
      console.error('Video creation failed:', error);
      document.getElementById('vton-video-loading').innerHTML = 'Video creation failed. Please try again.';
    }
  }

  async callMCPService(service, endpoint, data) {
    // Use background script for API calls to handle CORS and caching
    const action = service === 'vton' ? 'tryOn' : 'createVideo';

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: action,
        data: data
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      });
    });
  }

  downloadImage() {
    if (this.currentTryOnImage) {
      const link = document.createElement('a');
      link.href = this.currentTryOnImage;
      link.download = 'virtual-tryon.png';
      link.click();
    }
  }

  downloadVideo() {
    const video = document.getElementById('vton-result-video');
    if (video && video.src) {
      const link = document.createElement('a');
      link.href = video.src;
      link.download = 'virtual-tryon-video.mp4';
      link.click();
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'vton-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('vton-toast-show');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('vton-toast-show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
}

// Initialize the extension when the script loads
new VTONExtension();
