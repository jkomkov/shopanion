// Profile page script for Shopanion extension

class ProfilePage {
  constructor() {
    this.userData = null;
    this.init();
  }

  async init() {
    await this.loadUserData();
    await this.loadProfileImage();
    await this.loadApiKey();
    this.setupEventListeners();
    this.updateProfileStats();
    this.updateSettings();
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

  async loadProfileImage() {
    try {
      const data = await chrome.storage.local.get(['profileImage']);
      if (data.profileImage) {
        document.getElementById('profile-image-large').src = data.profileImage;
      }
    } catch (error) {
      console.error('Failed to load profile image:', error);
    }
  }

  setupEventListeners() {
    // Profile image change
    document.getElementById('change-profile-image').addEventListener('click', () => {
      document.getElementById('profile-image-upload').click();
    });

    document.getElementById('profile-image-upload').addEventListener('change', (e) => {
      this.handleProfileImageChange(e);
    });

    // API key save
    document.getElementById('save-api-key').addEventListener('click', () => {
      this.saveApiKey();
    });

    // Settings
    document.getElementById('auto-detect').addEventListener('change', (e) => {
      this.updateSetting('autoDetect', e.target.checked);
    });

    document.getElementById('show-notifications').addEventListener('change', (e) => {
      this.updateSetting('showNotifications', e.target.checked);
    });

    document.getElementById('cache-results').addEventListener('change', (e) => {
      this.updateSetting('cacheResults', e.target.checked);
    });
  }

  async handleProfileImageChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target.result;

      // Update profile image
      document.getElementById('profile-image-large').src = imageUrl;

      // Save to storage
      chrome.storage.local.set({ profileImage: imageUrl });

      this.showToast('Profile photo updated successfully');
    };
    reader.readAsDataURL(file);
  }

  updateProfileStats() {
    if (!this.userData || !this.userData.history) return;

    const history = this.userData.history;
    const tryons = history.filter(item => item.type === 'tryon').length;
    const videos = history.filter(item => item.type === 'video').length;

    document.getElementById('total-tryons').textContent = tryons;
    document.getElementById('total-videos').textContent = videos;
    document.getElementById('favorite-items').textContent = '0'; // Placeholder for future feature
  }

  updateSettings() {
    if (!this.userData || !this.userData.settings) return;

    const settings = this.userData.settings;
    document.getElementById('auto-detect').checked = settings.autoDetect !== false;
    document.getElementById('show-notifications').checked = settings.showNotifications !== false;
    document.getElementById('cache-results').checked = settings.cacheResults !== false;
  }

  async loadApiKey() {
    try {
      const data = await chrome.storage.local.get(['geminiApiKey']);
      if (data.geminiApiKey) {
        document.getElementById('gemini-api-key').value = data.geminiApiKey;
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  }

  async saveApiKey() {
    const apiKey = document.getElementById('gemini-api-key').value.trim();

    if (!apiKey) {
      this.showToast('Please enter an API key');
      return;
    }

    try {
      await chrome.storage.local.set({ geminiApiKey: apiKey });
      this.showToast('✅ API key saved successfully');
    } catch (error) {
      console.error('Failed to save API key:', error);
      this.showToast('❌ Failed to save API key');
    }
  }

  async updateSetting(key, value) {
    try {
      const settings = { ...this.userData.settings, [key]: value };
      await chrome.storage.local.set({ settings });
      this.userData.settings = settings;
      this.showToast(`Setting updated: ${key}`);
    } catch (error) {
      console.error('Failed to update setting:', error);
      this.showToast('Failed to update setting');
    }
  }

  showToast(message) {
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

// Initialize profile page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ProfilePage();
});
