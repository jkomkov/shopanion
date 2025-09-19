# 🛍️ Shopanion Chrome Extension

Professional AI-powered virtual try-on companion for any shopping site.

## 📁 **Organized Project Structure**

```
extension/
├── 📄 manifest.json                    # Extension configuration
├── 📄 README.md                        # This file
│
├── 📂 src/                             # Source code
│   ├── 📂 pages/                       # HTML pages
│   │   ├── extension-popup.html        # Main extension popup (320x400px)
│   │   ├── profile-page.html          # Full-screen profile management
│   │   └── history-page.html          # Try-on history grid view
│   │
│   ├── 📂 scripts/                     # JavaScript files
│   │   ├── extension-popup.js         # Popup functionality & navigation
│   │   ├── profile-page.js            # Profile management & settings
│   │   ├── history-page.js            # History display & interactions
│   │   ├── background-service.js      # Service worker (API calls, caching)
│   │   └── content-injector.js        # Page injection & try-on UI
│   │
│   └── 📂 styles/                      # CSS stylesheets
│       ├── extension-styles.css       # Main styles for all pages
│       └── content-injector.css       # Styles for injected content
│
├── 📂 assets/                          # Static assets
│   ├── 📂 images/                      # Image files
│   │   ├── default_profile.webp       # Taylor Swift default profile
│   │   ├── demo_product.webp          # Demo product image
│   │   ├── demo_selfie.jpg            # Demo selfie for testing
│   │   ├── icon16.png                 # Extension icon (16x16)
│   │   ├── icon48.png                 # Extension icon (48x48)
│   │   └── icon128.png                # Extension icon (128x128)
│   │
│   └── 📂 data/                        # Data files
│       └── demo_product_page.html     # Test product page
│
└── 📂 docs/                            # Documentation
    ├── README.md                       # Main documentation
    ├── INSTALLATION.md                 # Installation guide
    ├── LOCAL_DEMO.md                   # Local demo instructions
    ├── NEW_FEATURES.md                 # Feature documentation
    └── PROFESSIONAL_UPDATE.md          # Professional redesign notes
```

## 🎯 **File Naming Convention**

### **Descriptive Names**
- ❌ `popup.html` → ✅ `extension-popup.html`
- ❌ `popup.js` → ✅ `extension-popup.js`
- ❌ `background.js` → ✅ `background-service.js`
- ❌ `content.js` → ✅ `content-injector.js`

### **Purpose-Based Organization**
- **Pages**: User interface HTML files
- **Scripts**: JavaScript functionality
- **Styles**: CSS stylesheets
- **Images**: Visual assets (icons, photos, demos)
- **Data**: Static data files and test content
- **Docs**: Documentation and guides

## 🚀 **Quick Start**

### **Installation**
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder
5. ✅ Shopanion appears in your extensions

### **Development**
```bash
# Navigate to extension directory
cd /Users/jinwu/Desktop/vton/extension

# File structure
tree -I 'node_modules|.git|.DS_Store'

# Reload extension after changes
# Go to chrome://extensions/ and click reload
```

## 🎨 **Architecture Overview**

### **Extension Popup** (`extension-popup.html`)
- **Size**: 320x400px compact interface
- **Purpose**: Essential controls and navigation
- **Features**: Page status, try-on actions, navigation grid

### **Profile Page** (`profile-page.html`)
- **Size**: Full browser window
- **Purpose**: Profile management and settings
- **Features**: Photo upload, activity stats, preferences

### **History Page** (`history-page.html`)
- **Size**: Full browser window
- **Purpose**: Try-on history and management
- **Features**: Grid layout, detailed cards, actions

### **Content Injection** (`content-injector.js`)
- **Purpose**: Inject try-on UI into shopping sites
- **Features**: Product detection, try-on modal, video creation

### **Background Service** (`background-service.js`)
- **Purpose**: API communication and data management
- **Features**: MCP service calls, caching, history tracking

## 🔧 **Configuration**

### **Manifest Highlights**
```json
{
  "name": "Shopanion",
  "action": {
    "default_popup": "src/pages/extension-popup.html"
  },
  "background": {
    "service_worker": "src/scripts/background-service.js"
  },
  "content_scripts": [{
    "js": ["src/scripts/content-injector.js"],
    "css": ["src/styles/content-injector.css"]
  }]
}
```

### **Web Accessible Resources**
- Profile and history pages accessible via `chrome.tabs.create()`
- Assets available for content script injection
- Proper CORS handling for MCP service communication

## 🎯 **Benefits of New Structure**

### **Professional Organization**
- ✅ **Clear separation** of concerns
- ✅ **Descriptive naming** for easy navigation
- ✅ **Logical grouping** by file type and purpose
- ✅ **Scalable structure** for future features

### **Developer Experience**
- ✅ **Easy to find** specific functionality
- ✅ **Clear dependencies** between files
- ✅ **Organized assets** for quick access
- ✅ **Comprehensive documentation**

### **Maintainability**
- ✅ **Modular architecture** for independent updates
- ✅ **Consistent naming** across all files
- ✅ **Proper asset organization** for performance
- ✅ **Version control friendly** structure

## 📚 **Documentation**

- **Installation**: See `docs/INSTALLATION.md`
- **Local Demo**: See `docs/LOCAL_DEMO.md`
- **Features**: See `docs/NEW_FEATURES.md`
- **Updates**: See `docs/PROFESSIONAL_UPDATE.md`

## 🎉 **Ready for Production**

The extension now follows professional development standards with:
- Organized folder structure
- Descriptive file names
- Clear separation of concerns
- Comprehensive documentation
- Scalable architecture

Perfect for team collaboration and future enhancements! 🎯
