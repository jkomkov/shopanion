// Content script for Virtual Try-On extension
class VTONExtension {
  constructor() {
    this.userId = this.getUserId();
    this.currentProduct = null;
    this.currentTryOnImage = null;

    this.init();
  }

  getUserId() {
    let userId = localStorage.getItem('vton_user_id');
    if (!userId) {
      userId = 'user_' + Date.now();
      localStorage.setItem('vton_user_id', userId);
      console.log('Generated new user ID:', userId);
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

      <!-- Try-On Result Modal (similar to product image modal) -->
      <div id="vton-result-modal" class="vton-modal" style="display: none;">
        <div class="vton-modal-content">
          <div class="vton-modal-header">
            <h2>Virtual Try-On Result</h2>
            <span class="vton-close" data-modal="vton-result-modal">&times;</span>
          </div>
          <div class="vton-modal-body">
            <div id="vton-loading-state" class="vton-loading-state">
              <div class="vton-spinner"></div>
              <p>Generating your virtual try-on...</p>
            </div>
            <div id="vton-result-display" class="vton-result-display" style="display: none;">
              <div class="vton-result-preview">
                <img id="vton-result-image" class="vton-result-image" src="" alt="Virtual Try-On Result">
                <div class="vton-result-info">
                  <h4 id="vton-product-title">Product Try-On</h4>
                  <p id="vton-product-url">Product URL</p>
                  <div class="vton-result-actions">
                    <button id="vton-download-btn" class="action-btn primary">Download Image</button>
                    <button id="vton-try-again-btn" class="action-btn secondary">Try Again</button>
                  </div>
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
      console.log('📨 Content script received message:', request);

      try {
        if (request.action === 'ping') {
          console.log('🏓 Ping received from popup');
          sendResponse({ success: true, message: 'Content script is alive', timestamp: Date.now() });
          return true;
        } else if (request.action === 'getProductInfo') {
          console.log('📋 Sending product info:', this.currentProduct);
          sendResponse({
            success: true,
            data: this.currentProduct
          });
          return true; // Keep message channel open
        } else if (request.action === 'triggerTryOn') {
          // Trigger try-on from popup
          console.log('🚀 Starting try-on process from popup trigger');
          this.startTryOnProcess();
          sendResponse({ success: true, message: 'Try-on process started' });
          return true; // Keep message channel open
        } else {
          console.log('❓ Unknown action:', request.action);
          sendResponse({ success: false, error: 'Unknown action: ' + request.action });
          return true;
        }
      } catch (error) {
        console.error('❌ Error handling message in content script:', error);
        sendResponse({ success: false, error: error.message });
        return true;
      }
    });

    // Try-on button click - directly start try-on process
    document.getElementById('vton-try-on-btn').addEventListener('click', () => {
      this.startTryOnProcess();
    });

    // Close modal
    document.querySelector('.vton-close').addEventListener('click', () => {
      document.getElementById('vton-result-modal').style.display = 'none';
    });

    // Close modal when clicking outside
    document.getElementById('vton-result-modal').addEventListener('click', (e) => {
      if (e.target.id === 'vton-result-modal') {
        document.getElementById('vton-result-modal').style.display = 'none';
      }
    });

    // Download button
    document.getElementById('vton-download-btn').addEventListener('click', () => {
      this.downloadImage();
    });

    // Try again button
    document.getElementById('vton-try-again-btn').addEventListener('click', () => {
      this.startTryOnProcess();
    });
  }

  async startTryOnProcess() {
    console.log('🎯 Starting try-on process...');
    console.log('Current product:', this.currentProduct);
    console.log('User ID:', this.userId);

    // Show the modal with loading state
    document.getElementById('vton-result-modal').style.display = 'block';
    document.getElementById('vton-loading-state').style.display = 'block';
    document.getElementById('vton-result-display').style.display = 'none';

    try {
      // Check if user has a profile image, otherwise use demo selfie
      const profileData = await chrome.storage.local.get(['profileImage']);
      let selfieUrl;

      if (profileData.profileImage) {
        selfieUrl = profileData.profileImage;
        console.log('📸 Using profile image, length:', selfieUrl.length);
      } else {
        // Use demo selfie as fallback
        selfieUrl = chrome.runtime.getURL('assets/images/demo_selfie.jpg');
        console.log('📸 Using demo selfie:', selfieUrl);
      }

      console.log('🔄 Processing try-on with:', {
        userId: this.userId,
        selfieUrl: selfieUrl.substring(0, 100) + '...',
        productImage: this.currentProduct?.image?.substring(0, 100) + '...',
        productUrl: this.currentProduct?.url
      });

      await this.processTryOn(selfieUrl);
    } catch (error) {
      console.error('❌ Try-on process failed:', error);
      this.showTryOnError(error.message);
    }
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
    // Use the demo selfie from the extension assets
    const demoSelfieUrl = chrome.runtime.getURL('assets/images/demo_selfie.jpg');
    await this.processTryOn(demoSelfieUrl);
  }

  async processTryOn(selfieUrl) {
    try {
      const result = await this.callGeminiTryOn(selfieUrl, this.currentProduct.image);

      if (result.success) {
        this.currentTryOnImage = result.imageData;

        // Hide loading and show result
        document.getElementById('vton-loading-state').style.display = 'none';
        document.getElementById('vton-result-display').style.display = 'block';

        // Set the result image and product info
        document.getElementById('vton-result-image').src = result.imageData;
        document.getElementById('vton-result-image').onerror = () => {
          document.getElementById('vton-result-image').src = chrome.runtime.getURL('assets/images/demo_product.webp');
          this.showToast('Try-on image failed to load, showing fallback');
        };

        document.getElementById('vton-product-title').textContent = this.currentProduct.title || 'Virtual Try-On Result';
        document.getElementById('vton-product-url').textContent = this.currentProduct.url || window.location.href;

        this.showToast('✅ Try-on complete!');
      } else {
        throw new Error(result.error || 'Try-on generation failed');
      }
    } catch (error) {
      console.error('Try-on failed:', error);
      this.showTryOnError(error.message);
    }
  }

  showTryOnError(errorMessage) {
    document.getElementById('vton-loading-state').style.display = 'none';

    let errorContent = `
      <div class="vton-error-state">
        <p>❌ Try-on failed: ${errorMessage}</p>
        <button id="vton-retry-btn" class="action-btn primary">Try Again</button>
      </div>
    `;

    // Add specific help for API key issues
    if (errorMessage.includes('API key not configured')) {
      errorContent = `
        <div class="vton-error-state">
          <p>❌ ${errorMessage}</p>
          <p>Make sure your .env file contains GEMINI_API_KEY=your_key_here</p>
          <button id="vton-retry-btn" class="action-btn primary">Try Again</button>
        </div>
      `;
    }

    document.getElementById('vton-result-display').innerHTML = errorContent;
    document.getElementById('vton-result-display').style.display = 'block';

    // Add retry functionality
    const retryBtn = document.getElementById('vton-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.startTryOnProcess();
      });
    }

  }


  async callGeminiTryOn(personImageData, garmentImageUrl) {
    console.log('🚀 Starting Gemini try-on process');
    console.log('Person image data length:', personImageData.length);
    console.log('Garment image URL:', garmentImageUrl);

    try {
      // Create client (API key will be loaded automatically)
      const gemini = new VTONGemini();

      // Call simplified try-on method
      const result = await gemini.tryOn(personImageData, garmentImageUrl);

      if (result.success) {
        console.log('✅ Image generated successfully');
        return { success: true, imageData: result.imageData };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Try-on failed:', error);
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

  downloadImage() {
    if (this.currentTryOnImage) {
      const link = document.createElement('a');
      link.href = this.currentTryOnImage;
      link.download = `virtual-tryon-${Date.now()}.png`;
      link.click();
      this.showToast('📥 Download started!');
    } else {
      this.showToast('❌ No image to download');
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
console.log('VTON Content script loading...');
try {
  new VTONExtension();
  console.log('VTON Content script initialized successfully');
} catch (error) {
  console.error('Failed to initialize VTON Content script:', error);
}
