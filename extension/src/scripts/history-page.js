// History page script for Shopanion extension

class HistoryPage {
  constructor() {
    this.userData = null;
    this.init();
  }

  async init() {
    await this.loadUserData();
    this.renderHistory();
  }

  async loadUserData() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getUserData'
      });

      if (response.success) {
        this.userData = response.data;
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  }

  renderHistory() {
    const historyGrid = document.getElementById('history-grid');

    if (!this.userData || !this.userData.history || this.userData.history.length === 0) {
      historyGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;">📭</div>
          <h3>No history yet</h3>
          <p>Start by trying on some items to see your history here!</p>
        </div>
      `;
      return;
    }

    const historyItems = this.userData.history.map(item => this.createHistoryCard(item)).join('');
    historyGrid.innerHTML = historyItems;

    // Add event listeners to action buttons
    this.setupCardEventListeners();
  }

  createHistoryCard(item) {
    const timestamp = this.formatTimestamp(item.timestamp);
    const type = item.type === 'tryon' ? 'Virtual Try-on' : `Video: ${item.action || 'Animation'}`;
    const imageUrl = item.imageUrl || item.videoUrl || '/assets/images/default_profile.webp';
    const domain = item.productUrl ? new URL(item.productUrl).hostname : 'Unknown';

    return `
      <div class="history-card">
        <img class="history-card-image" src="${imageUrl}" alt="History item" onerror="this.src='/assets/images/default_profile.webp'">
        <div class="history-card-content">
          <div class="history-card-title">${type}</div>
          <div class="history-card-meta">
            <div>${timestamp}</div>
            <div>${domain}</div>
          </div>
          <div class="history-card-actions">
            ${item.productUrl ? `<button class="card-action-btn" onclick="window.open('${item.productUrl}')">Visit Page</button>` : ''}
            <button class="card-action-btn" onclick="window.open('${imageUrl}')">View Full</button>
            ${item.type === 'tryon' ? '<button class="card-action-btn" onclick="this.tryAgain(\'' + item.productUrl + '\')">Try Again</button>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  setupCardEventListeners() {
    // Add any additional event listeners for cards if needed
    document.querySelectorAll('.history-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Handle card click if needed
        if (e.target.classList.contains('card-action-btn')) {
          return; // Don't handle card click if button was clicked
        }
      });
    });
  }

  formatTimestamp(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return new Date(timestamp).toLocaleDateString();
  }

  tryAgain(productUrl) {
    if (productUrl) {
      chrome.tabs.create({ url: productUrl });
    }
  }
}

// Initialize history page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HistoryPage();
});
