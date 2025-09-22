// Content script for Virtual Try-On extension
class VTONExtension {
  constructor() {
    this.userId = this.getUserId();
    this.currentProduct = null;
    this.currentTryOnImage = null;

    // Bind debug handler
    this.handleDebugMessage = this.handleDebugMessage.bind(this);

    this.init();

    // Expose for debugging and add message bridge
    try {
      window.__gravity = this;
      window.addEventListener('message', this.handleDebugMessage, false);
      console.log('[Gravity] Debug ready. Force inject with: window.postMessage({source:"gravity-debug", action:"inject"})');
    } catch (_) {}
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
    // Replace the old injection method with the new one
    this.injectAtelierConsole();

    // Re-attach the widget if the DOM changes (e.g., in single-page apps)
    this.observeDOMChanges();

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  setupExtension() {
    // Detect if this is a product page
    const isPdp = this.isProductPage();
    console.log('[Gravity] setupExtension: isProductPage =', isPdp);

    // No longer inject the old inline button to simplify debugging.
    // if (isPdp) {
    //   this.extractProductInfo();
    //   this.injectTryOnButton();
    // }

    // Always inject the floating hover widget for quick access
    try {
      console.log('[Gravity] Attempting to inject hover widget...');
      this.injectHoverWidget();
    } catch (e) {
      console.error('[Gravity] Failed to inject hover widget:', e);
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
      // No suitable anchor found on the page (likely a listing page or non-PDP).
      // Skip injecting the inline button to avoid a non-floating footer button.
      console.log('VTON: Skipping inline try-on button (no PDP anchor found). Relying on floating widget.');
      return;
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

  // New "Smart Anchor" logic to find the best placement for the button
  findSmartAnchor() {
    // A list of selectors for potential containers, ordered by preference
    const selectors = [
      '#pdp-main-content',      // Saks
      '#main-content',          // Nordstrom
      '[data-pdp-main-content]',
      '#product-detail-page',
      '.product-detail',
      '.pdp-container',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`[Gravity] Smart Anchor found: ${selector}`);
        return element;
      }
    }

    console.log('[Gravity] No ideal anchor found, falling back to document.body');
    return document.body; // Fallback
  }

  // New function to calculate header height for the fixed fallback
  getHeaderHeight() {
    let headerHeight = 0;
    const headers = document.querySelectorAll('header, [data-sticky-header], #header-container'); // Added Saks header
    headers.forEach(header => {
      const style = getComputedStyle(header);
      if (style.position === 'fixed' || style.position === 'sticky') {
        headerHeight = Math.max(headerHeight, header.offsetHeight);
      }
    });
    return headerHeight + 16; // Add a 16px buffer for elegance
  }

  applyGenericPlacement(root) {
    const headerHeight = this.getHeaderHeight();
    Object.assign(root.style, {
      position: 'fixed',
      top: '0px', // Start at the top
      right: '24px',
      transform: `translateY(${headerHeight}px)`, // Push down below the header
      zIndex: '2147483647'
    });
    document.documentElement.appendChild(root);
  }

  // Floating hover widget (glassmorphic) similar to modern assistants
  injectHoverWidget() {
    if (document.getElementById('gravity-hover-root')) return;

    const root = document.createElement('div');
    root.id = 'gravity-hover-root';
    root.innerHTML = `
      <div class="gravity-fab" id="gravity-fab" title="Gravity – AI Try‑On">
        <img src="${chrome.runtime.getURL('assets/images/gravity-logo.png')}" class="gravity-fab-icon" alt="Gravity Logo"/>
      </div>
      <div class="gravity-panel" id="gravity-panel" aria-hidden="true">
        <div class="gravity-header">
          <button class="gravity-header-icon" id="gravity-passport-btn" aria-label="Open User Passport">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>
          <div class="gravity-co-branded-title">
            <!-- This will be dynamically populated -->
          </div>
          <button class="gravity-header-icon" id="gravity-compass-btn" aria-label="Discover Tools">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2l-1.45 4.14L6.21 8l4.14 1.45L12 13.59l1.64-4.14L18.79 8l-4.14-1.45L12 2z" />
            </svg>
          </button>
        </div>
        <div class="gravity-inspiration-zone">
          <!-- Product cards will go here -->
        </div>
        <div class="gravity-interaction-zone">
          <div class="gravity-celeste-intro">
            <p class="celeste-title">Welcome to the Atelier.</p>
            <p class="celeste-prompt">Tell me what's on your mind and I'll curate something extraordinary.</p>
          </div>
          <div class="gravity-smart-chips">
            <button class="chip">A single baroque-pearl earring</button>
            <button class="chip">A Napa vintner's lunch look</button>
            <button class="chip">Find me a dopamine-dressing look</button>
          </div>
          <div class="gravity-text-input-wrapper">
            <input type="text" class="gravity-text-input" placeholder="Ask Celeste anything..." />
            <button class="gravity-send-btn" aria-label="Send message">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // --- START SITE-SPECIFIC PLACEMENT LOGIC ---
    if (window.location.hostname.includes('saksfifthavenue')) {
      const detailsContainer = document.querySelector('.product-details');
      const wishlistButton = document.querySelector('.add-to-wishlist');

      if (detailsContainer && wishlistButton) {
        console.log('[Gravity] Saks-specific placement activated.');
        detailsContainer.style.position = 'relative'; // Ensure it can anchor the button

        // Calculate the perfect vertical position
        const topPosition = wishlistButton.offsetTop + (wishlistButton.offsetHeight / 2);

        Object.assign(root.style, {
          position: 'absolute',
          top: `${topPosition}px`,
          right: '24px', // Elegant offset from the edge
          transform: 'translateY(-50%)', // Vertically center the button
          zIndex: '100' // Sit cleanly within the content flow
        });
        detailsContainer.appendChild(root);
      } else {
        this.applyGenericPlacement(root);
      }
    } else {
      this.applyGenericPlacement(root);
    }
    // --- END SITE-SPECIFIC PLACEMENT LOGIC ---

    console.log('[Gravity] Hover widget injected');

    const fab = root.querySelector('#gravity-fab');
    const panel = root.querySelector('#gravity-panel');

    let open = false;

    const handleClickOutside = (event) => {
      // If the panel is open and the click is outside the widget, close it.
      if (open && root && !root.contains(event.target)) {
        closePanel();
      }
    };

    const openPanel = () => {
      if (open) return;
      open = true;
      panel.setAttribute('aria-hidden', 'false');
      root.classList.add('open');
      // Use a timeout to ensure the click that opened the panel isn't immediately caught.
      setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
      this.setBrandedTitle(); // Set the title when the panel opens
    };
    const closePanel = () => {
      if (!open) return;
      open = false;
      panel.setAttribute('aria-hidden', 'true');
      root.classList.remove('open');
      document.removeEventListener('click', handleClickOutside);
    };

    // Remove any lingering hover listeners to be certain.
    root.removeEventListener('mouseenter', openPanel);
    root.removeEventListener('mouseleave', closePanel);

    // Set up the click-to-toggle behavior.
    fab.addEventListener('click', (event) => {
      event.stopPropagation(); // Prevent the 'click outside' from firing immediately.
      if (open) {
        closePanel();
      } else {
        openPanel();
        // When opening the panel, fetch recommendations
        this.fetchAndDisplayRecommendations();
      }
    });

    // Wire actions
    root.querySelector('#gravity-tryon-btn').addEventListener('click', () => {
      closePanel();
      // If we're not on a detected product page, try to extract once
      if (!this.currentProduct) {
        this.extractProductInfo();
      }
      this.startTryOnProcess();
    });

    root.querySelector('#gravity-view-btn').addEventListener('click', () => {
      closePanel();
      try {
        if (this.currentProduct?.image) {
          window.open(this.currentProduct.image, '_blank');
        } else {
          this.showToast('No product image detected');
        }
      } catch (e) {
        this.showToast('Unable to open product image');
      }
    });

    root.querySelector('#gravity-history-btn').addEventListener('click', async () => {
      closePanel();
      try {
        // Navigate to extension history page in a new tab
        chrome.runtime.sendMessage({ action: 'openProfile' });
      } catch (e) {
        this.showToast('Unable to open profile');
      }
    });
  }

  setBrandedTitle() {
    const titleElement = document.querySelector('.gravity-co-branded-title');
    if (!titleElement) return;

    let siteName = "Saks Fifth Avenue"; // Default
    const hostname = window.location.hostname;

    if (hostname.includes('nordstrom')) {
      siteName = "Nordstrom";
    } else if (hostname.includes('macys')) {
      siteName = "Macy's";
    }
    // Add more site detections here

    // For now, we'll hardcode the beautiful Saks logo for the demo
    const saksLogoUrl = chrome.runtime.getURL('assets/images/saks-logo.png');

    titleElement.innerHTML = `
      <img src="${saksLogoUrl}" alt="Saks Fifth Avenue" class="site-logo" />
      <span class="connector-text">...with</span>
      <span class="gravity-brand-text">Gravity</span>
    `;
  }

  async fetchAndDisplayRecommendations() {
    const inspirationZone = document.querySelector('.gravity-inspiration-zone');
    if (!inspirationZone) return;

    // Show loading state
    inspirationZone.innerHTML = `<div class="gravity-loader"></div>`;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getRecommendations',
        data: {
          userId: this.userId,
          hint: this.currentProduct ? this.currentProduct.title : 'fashion'
        }
      });

      if (response && response.success && response.data.items && response.data.items.length > 0) {
        this.renderProductGrid(response.data.items);
      } else {
        // If the call succeeds but returns no items, or if the structure is invalid,
        // fall back to the beautiful placeholder grid.
        console.log('[Gravity] Backend returned no items, rendering placeholders.');
        this.renderProductGrid(this.getPlaceholderItems());
      }
    } catch (error) {
      console.error('[Gravity] Error fetching recommendations:', error);
      // Render placeholder cards on error for consistent design preview
      this.renderProductGrid(this.getPlaceholderItems());
    }
  }

  renderProductGrid(items) {
    const inspirationZone = document.querySelector('.gravity-inspiration-zone');
    if (!inspirationZone) return;

    if (!items || items.length === 0) {
      inspirationZone.innerHTML = `<p class="gravity-error-text">No recommendations found.</p>`;
      return;
    }

    inspirationZone.innerHTML = `
      <div class="product-grid">
        ${items.slice(0, 4).map((item, index) => `
          <div class="product-card" style="animation-delay: ${index * 100}ms">
            <div class="product-card-image-wrapper">
              <img src="${item.image_url}" class="product-card-image" alt="${item.title || ''}" />
              <button class="product-card-like-btn" aria-label="Like item">
                <svg viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </button>
            </div>
            <div class="product-card-info">
              <p class="product-card-price">${this.formatPrice(item)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Add event listeners to the new like buttons
    this.setupLikeButtonListeners();
  }

  setupLikeButtonListeners() {
    const likeButtons = document.querySelectorAll('.product-card-like-btn');
    likeButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        button.classList.toggle('liked');
        // Here you would also call a service to save the like state
      });
    });
  }

  formatPrice(item) {
    if (item.strikeThroughPrice && item.finalPrice && item.strikeThroughPrice > item.finalPrice) {
      return `
        <span class="sale">\$${Math.round(item.finalPrice)}</span>
        <span class="original">\$${Math.round(item.strikeThroughPrice)}</span>
      `;
    }
    const price = item.finalPrice || item.extractedPrice || 0;
    return `\$${Math.round(price)}`;
  }

  getPlaceholderItems() {
    // A curated list of beautiful, high-quality, and chic placeholder images.
    return [
      { image_url: 'https://images.unsplash.com/photo-1572804013427-4d7ca726b655?q=80&w=2400&auto=format&fit=crop', finalPrice: 1250 },
      { image_url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?q=80&w=2200&auto=format&fit=crop', finalPrice: 350, strikeThroughPrice: 495 },
      { image_url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=2400&auto=format&fit=crop', finalPrice: 720 },
      { image_url: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?q=80&w=2400&auto=format&fit=crop', finalPrice: 480 },
    ];
  }

  handleDebugMessage(event) {
    try {
      if (event.source !== window) return;
      const data = event.data || {};
      if (data.source !== 'gravity-debug') return;
      if (data.action === 'inject') {
        this.injectHoverWidget();
      }
      if (data.action === 'toggle') {
        const root = document.getElementById('gravity-hover-root');
        if (!root) { this.injectHoverWidget(); return; }
        const panel = root.querySelector('#gravity-panel');
        const isOpen = root.classList.contains('open');
        if (isOpen) {
          panel.setAttribute('aria-hidden', 'true');
          root.classList.remove('open');
        } else {
          panel.setAttribute('aria-hidden', 'false');
          root.classList.add('open');
        }
      }
    } catch (_) {}
  }

  // Detect common top-right fixed elements and return additional offsets in px
  detectTopRightObstruction() {
    const elements = Array.from(document.querySelectorAll('*'));
    let extraTop = 0;
    let extraRight = 0;
    for (const el of elements) {
      try {
        const style = getComputedStyle(el);
        if (style.position !== 'fixed' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 30) continue;
        const fromRight = window.innerWidth - rect.right;
        const fromTop = rect.top;
        // Within 140px of the top-right corner (headers, promo bars, toolbars)
        if (fromRight <= 140 && fromTop <= 140) {
          extraTop = Math.max(extraTop, Math.ceil(rect.height - fromTop + 12));
          extraRight = Math.max(extraRight, Math.ceil(rect.width + fromRight + 12));
        }
      } catch (_) {}
    }
    return { top: extraTop, right: extraRight };
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

  // Main injection function for the new Atelier Console
  injectAtelierConsole() {
    if (document.getElementById('gravity-console-root')) return;

    const root = document.createElement('div');
    root.id = 'gravity-console-root';
    
    // The Passport panel is added here, alongside the main console panel.
    root.innerHTML = `
      <div class="gravity-passport-panel" id="gravity-passport-panel"></div>
      <div class="gravity-console-panel" id="gravity-panel"></div>
      <div class="locket-wrapper" id="locket-wrapper">
        <button class="gravity-locket" id="gravity-locket-btn">
          <img src="${chrome.runtime.getURL('assets/images/gravity-logo.png')}" class="gravity-locket-icon" alt="Open Gravity Atelier"/>
          <span class="atelier-tab-text">Atelier</span>
        </button>
      </div>
    `;
    
    document.documentElement.appendChild(root);
    
    this.renderAtelierPanel();
    this.renderPassportPanel(); // New function to render the passport content
    this.setupConsoleEventListeners();
  }

  // Renders the content for the new Passport (user profile) panel
  renderPassportPanel() {
    const panel = document.getElementById('gravity-passport-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="passport-header">
        <h2 class="passport-title">GRAVITY</h2>
        <span class="passport-version">v0.9.1</span>
      </div>
      <div class="passport-nav">
        <a href="#" class="passport-item">
          <span class="passport-icon">
            <svg viewBox="0 0 24 24"><path d="M12 5.9a2.1 2.1 0 110 4.2 2.1 2.1 0 010-4.2m0 9c2.97 0 6.1 1.46 6.1 2.1v1.1H5.9V17c0-.64 3.13-2.1 6.1-2.1M12 4C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 9c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" fill="currentColor"></path></svg>
          </span>
          <span class="passport-text">My Profile</span>
        </a>
        <a href="#" class="passport-item">
          <span class="passport-icon">
            <svg viewBox="0 0 24 24"><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" fill="currentColor"></path></svg>
          </span>
          <span class="passport-text">Favorites</span>
        </a>
        <a href="#" class="passport-item">
          <span class="passport-icon">
            <svg viewBox="0 0 24 24"><path d="M19.5 3.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2v14H3v3c0 1.66 1.34 3 3 3h12c1.66 0 3-1.34 3-3V2l-1.5 1.5zM15 20H6c-.55 0-1-.45-1-1v-1h10v2zm0-4H5V8h10v8zm2-12h-1V4h1v2zm-3 0h-1V4h1v2zm-3 0h-1V4h1v2z" fill="currentColor"></path></svg>
          </span>
          <span class="passport-text">Orders</span>
        </a>
        <a href="#" class="passport-item">
          <span class="passport-icon">
            <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" fill="currentColor"></path></svg>
          </span>
          <span class="passport-text">Reserve</span>
        </a>
      </div>
      <div class="passport-divider"></div>
      <div class="passport-footer">
        <a href="#" class="passport-item utility">
          <span class="passport-icon">
            <svg viewBox="0 0 24 24"><path d="M12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" fill="currentColor"></path><path d="M3 6h18v3H3zM3 15h18v3H3z" fill="currentColor"></path></svg>
          </span>
          <span class="passport-text">Settings</span>
        </a>
        <a href="#" class="passport-item utility">
          <span class="passport-icon">
            <svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" fill="currentColor"></path></svg>
          </span>
          <span class="passport-text">Sign Out</span>
        </a>
      </div>
    `;
  }

  // Renders the inner content of the Atelier panel
  renderAtelierPanel() {
    const panel = document.getElementById('gravity-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="gravity-header">
        <button class="gravity-header-icon" id="gravity-passport-btn" aria-label="Open User Passport">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </button>
        <div class="gravity-co-branded-title" id="gravity-co-branded-title">
          <!-- Dynamically populated -->
        </div>
        <button class="gravity-header-icon" id="gravity-close-console-btn" aria-label="Close Atelier">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="gravity-console-feed" id="gravity-console-feed">
        <div class="feed-item gravity-celeste-intro">
          <p class="celeste-title">Welcome to the Atelier.</p>
          <p class="celeste-prompt">Tell me what's on your mind and I'll curate something extraordinary.</p>
        </div>
        
        <!-- Recommendations will be injected here as a carousel -->

        <div class="feed-item gravity-smart-chips" style="animation-delay: 0.4s;">
          <button class="chip">A single baroque-pearl earring</button>
          <button class="chip">A Napa vintner's lunch look</button>
          <button class="chip">Find me a dopamine-dressing look</button>
        </div>
      </div>
      <div class="gravity-text-input-wrapper" id="gravity-text-input-wrapper">
        <button class="gravity-attach-btn" aria-label="Attach file">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <input type="text" class="gravity-text-input" placeholder="Ask Celeste anything..." />
        <button class="gravity-send-btn" aria-label="Send message">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </div>
    `;
  }

  // Overwrite the old fetch/render function for the new carousel
  fetchAndDisplayRecommendations() {
    const feed = document.getElementById('gravity-console-feed');
    if (!feed) return;

    // Remove any existing carousel
    const existingCarousel = document.getElementById('inspiration-carousel');
    if (existingCarousel) existingCarousel.remove();

    // Create a container for the carousel
    const carouselItem = document.createElement('div');
    carouselItem.id = 'inspiration-carousel';
    carouselItem.className = 'feed-item inspiration-carousel';

    carouselItem.innerHTML = `<div class="inspiration-carousel-container" id="carousel-container"></div>`;
    
    // Insert the carousel after the intro message
    const intro = feed.querySelector('.gravity-celeste-intro');
    if (intro) {
      intro.insertAdjacentElement('afterend', carouselItem);
    } else {
      feed.prepend(carouselItem);
    }

    const carouselContainer = document.getElementById('carousel-container');
    
    // For now, using the same placeholder items
    const items = this.getPlaceholderItems();
    this.renderProductCarousel(items, carouselContainer);
  }

  renderProductCarousel(items, container) {
    if (!items || items.length === 0) {
      container.innerHTML = '<p class="gravity-error-text">No recommendations found.</p>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="carousel-product-card">
        <div class="product-card-image-wrapper">
          <img src="${item.image_url}" alt="${item.title || 'Product'}" class="product-card-image"/>
        </div>
      </div>
    `).join('');
  }

  // Sets up all event listeners for the console
  setupConsoleEventListeners() {
    const root = document.getElementById('gravity-console-root');
    const panel = document.getElementById('gravity-panel');
    const locket = document.getElementById('gravity-locket-btn');
    const closeBtn = document.getElementById('gravity-close-console-btn');
    const sendBtn = document.querySelector('.gravity-send-btn');
    const textInput = document.querySelector('.gravity-text-input');
    const feed = document.getElementById('gravity-console-feed');
    const passportBtn = document.getElementById('gravity-passport-btn');
    const passportPanel = document.getElementById('gravity-passport-panel');


    if (!root || !locket || !panel || !sendBtn || !textInput || !feed || !passportBtn || !passportPanel) return;

    const handleSendMessage = () => {
      const message = textInput.value.trim();
      if (message) {
        appendMessage(message, 'user');
        textInput.value = '';
        textInput.dispatchEvent(new Event('input')); // Trigger input event to reset button states
        
        // Disable input during agent response
        textInput.disabled = true;
        sendBtn.disabled = true;

        // Simulate agent response
        setTimeout(() => {
          appendMessage("That's a fascinating choice. Let me find some options for you.", 'agent');
          textInput.disabled = false;
          sendBtn.disabled = false;
          textInput.focus();
        }, 1500);
      }
    };

    const appendMessage = (text, sender) => {
      const messageEl = document.createElement('div');
      messageEl.className = `feed-item message-bubble ${sender}`;
      messageEl.textContent = text;
      feed.appendChild(messageEl);

      // Scroll to the bottom
      feed.scrollTop = feed.scrollHeight;
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeConsole();
        closePassport();
      }
    };

    const handleClickOutside = (e) => {
      // If clicking completely outside both the widget and passport panel, close everything
      if (root.classList.contains('expanded') && 
          !root.contains(e.target) && 
          !passportPanel.contains(e.target)) {
        closeConsole();
        return;
      }
      
      // If clicking inside the main panel but outside passport panel, close just the passport
      if (root.classList.contains('passport-open') && 
          root.contains(e.target) &&
          !passportPanel.contains(e.target) && 
          !passportBtn.contains(e.target)) {
        closePassport();
      }
      
      // If clicking outside both panels but passport is open, close just the passport
      if (root.classList.contains('passport-open') && 
          !root.contains(e.target) && 
          !passportPanel.contains(e.target)) {
        closePassport();
      }
    };

    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });

    const openConsole = () => {
      if (root.classList.contains('expanded')) return; // Don't re-open if already open
      root.classList.add('expanded');
      
      requestAnimationFrame(() => {
        root.classList.add('visible');
      });

      this.setBrandedTitle();
      this.fetchAndDisplayRecommendations();

      // Add listeners for closing the console
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
    };

    const closeConsole = () => {
      if (!root.classList.contains('expanded')) return; // Don't re-close if already closed
      root.classList.remove('visible');
      
      setTimeout(() => {
        root.classList.remove('expanded');
      }, 400); // Must match the CSS transition duration
      
      // Also close the passport panel if it's open
      closePassport();

      // Remove listeners
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };

    const openPassport = () => {
      if (root.classList.contains('passport-open')) return;
      root.classList.add('passport-open');
      passportPanel.classList.add('visible');
    };

    const closePassport = () => {
      if (!root.classList.contains('passport-open')) return;
      root.classList.remove('passport-open');
      passportPanel.classList.remove('visible');
    };


    // --- Event Listener Wiring ---

    passportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (root.classList.contains('passport-open')) {
        closePassport();
      } else {
        openPassport();
      }
    });

    // Open the console
    locket.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent the click from being caught by handleClickOutside
      if (root.classList.contains('visible')) {
        closeConsole();
      } else {
        openConsole();
      }
    });

    // Close the console with the dedicated button
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeConsole();
      });
    }

    // This replaces the old backdrop click listener
    // The new logic is handled by handleClickOutside on the document.

    // Scroll listener for the locket's fade effect remains the same
    const handleScroll = () => {
      const locketBtn = document.getElementById('gravity-locket-btn');
      if (!locketBtn) return;
      if (window.scrollY > 10) {
        locketBtn.classList.add('scrolled');
      } else {
        locketBtn.classList.remove('scrolled');
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Initial check
    handleScroll();
  }
}

function initializeGravity() {
  // Use requestAnimationFrame to wait for the next paint, ensuring the DOM is ready.
  requestAnimationFrame(() => {
    const extension = new VTONExtension();
    extension.init();
    console.log('[Gravity] VTONExtension initialized successfully.');
  });
}

// Initialize the extension when the script loads
console.log('[Gravity] Content script loading...');
try {
  initializeGravity();
} catch (error) {
  console.error('[Gravity] Failed to initialize VTON Content script:', error);
}
