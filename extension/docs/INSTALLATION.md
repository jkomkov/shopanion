# Chrome Extension Installation & Testing Guide

## Quick Start

### 1. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The Virtual Try-On extension should now appear in your extensions list

### 2. Verify Installation

- Look for the extension icon (👕) in your Chrome toolbar
- Click the icon to open the popup and check service status
- The status dots should show red (offline) until MCP services are running

### 3. Start MCP Services

Make sure both MCP services are running:

```bash
# Terminal 1: Start MCP-A (Try-On Service)
cd mcp_vton/
uvicorn app:app --reload --port 8001

# Terminal 2: Start MCP-B (Video Service)
cd mcp_video/
uvicorn app:app --reload --port 8002
```

### 4. Test with Demo Page

1. Open `extension/assets/demo_product_page.html` in Chrome
2. You should see a "👕 Try it on" button appear on the page
3. Click the button to test the full try-on flow
4. Use the demo selfie option for quick testing

## Testing Checklist

### ✅ Basic Functionality
- [ ] Extension loads without errors
- [ ] Icon appears in Chrome toolbar
- [ ] Popup opens and shows correct status
- [ ] Demo page is detected as product page
- [ ] Try-on button appears on demo page

### ✅ Try-On Flow
- [ ] Modal opens when clicking "Try it on"
- [ ] Demo selfie option works
- [ ] File upload option works
- [ ] Try-on image generates successfully
- [ ] Result displays in modal

### ✅ Video Creation
- [ ] "Make a Video" button appears after try-on
- [ ] Action selection works (Turn, Wave, Walk)
- [ ] Video generates successfully
- [ ] Video plays in modal

### ✅ Extension Features
- [ ] History tracking works
- [ ] Recommendations load
- [ ] Settings persist
- [ ] Service status indicators work
- [ ] Download buttons function

## Real Website Testing

Test on actual retailer websites:

### Supported Sites
- **Amazon Fashion**: Search for "hoodie" or "t-shirt"
- **Zara**: Navigate to any clothing item
- **H&M**: Browse men's or women's clothing
- **Uniqlo**: Any apparel product page
- **ASOS**: Clothing product pages

### Testing Steps
1. Navigate to a product page
2. Check if extension detects it (popup should show "✅ Product page detected")
3. Look for the injected "👕 Try it on" button
4. Test the complete try-on and video flow

## Troubleshooting

### Extension Not Loading
```bash
# Check for JavaScript errors in Chrome DevTools
# Go to chrome://extensions/ and click "Errors" if any appear
```

### Try-On Button Not Appearing
1. Refresh the page after installing extension
2. Check popup to verify page detection
3. Look for console errors in DevTools
4. Ensure you're on a product page (not category/search page)

### API Calls Failing
1. Verify MCP services are running on correct ports
2. Check service status in extension popup
3. Look for CORS errors in Network tab
4. Ensure localhost:8001 and localhost:8002 are accessible

### Content Script Issues
```javascript
// Debug in browser console
console.log('VTON Extension loaded:', !!window.VTONExtension);
```

## Development Tips

### Debugging Content Script
1. Open DevTools on any page
2. Go to Console tab
3. Check for extension-related logs
4. Use `chrome.runtime.sendMessage` to test background communication

### Debugging Background Script
1. Go to `chrome://extensions/`
2. Click "service worker" link under your extension
3. This opens DevTools for the background script
4. Check console for API call logs

### Debugging Popup
1. Right-click the extension icon
2. Select "Inspect popup"
3. This opens DevTools for the popup
4. Debug popup JavaScript and styling

### Reloading Changes
- Click the refresh icon on your extension in `chrome://extensions/`
- Or use Ctrl+R in the extension popup/background DevTools
- Content scripts require page refresh to update

## File Structure Reference

```
extension/
├── manifest.json              # Extension configuration
├── content.js                # Injected into web pages
├── content.css               # Styles for injected UI
├── background.js             # Service worker (API calls, caching)
├── popup.html               # Extension popup interface
├── popup.css                # Popup styles
├── popup.js                 # Popup functionality
├── assets/
│   ├── demo_selfie.jpg       # Test selfie image
│   ├── demo_product.webp     # Test product image
│   └── demo_product_page.html # Test product page
├── icons/                   # Extension icons (generate with create_icons.html)
├── README.md               # Full documentation
├── INSTALLATION.md         # This file
└── create_icons.html       # Icon generator utility
```

## Next Steps

1. **Generate Icons**: Open `create_icons.html` and download the generated PNG files to the `icons/` folder
2. **Test Thoroughly**: Use both demo page and real retailer sites
3. **Check Logs**: Monitor browser console and background script for any errors
4. **Customize**: Modify styles, add features, or adjust detection logic as needed

## Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Verify MCP services are running and accessible
3. Test with the demo page first before real sites
4. Check extension permissions in Chrome settings
