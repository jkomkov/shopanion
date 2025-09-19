# Virtual Try-On & Video Chrome Extension

A Chrome extension that enables virtual try-on and video creation from any retailer page, powered by MCP services.

## Features

- 🔍 **Auto-detect** product pages across any retailer
- 👕 **Virtual Try-On** using AI-powered image composition
- 🎬 **Video Creation** with animated actions (turn, wave, walk)
- 💾 **Smart Caching** for faster repeat try-ons
- 📚 **History Tracking** of all your try-ons and videos
- ✨ **Personalized Recommendations** based on your preferences
- 🎯 **One-Click Integration** with any product page

## Installation

### Development Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension/` directory
4. The extension icon should appear in your browser toolbar

### Prerequisites

Make sure the MCP services are running:
- **MCP-A (Try-On Service)**: `http://localhost:8001`
- **MCP-B (Video Service)**: `http://localhost:8002`

## Usage

### Basic Try-On Flow

1. **Navigate** to any product page (clothing retailer)
2. **Click** the "👕 Try it on" button that appears on the page
3. **Upload** your selfie or use the demo selfie
4. **Wait** for the AI to process your virtual try-on (~2-3 seconds)
5. **View** your try-on result and optionally create a video

### Video Creation

1. After completing a try-on, click "🎬 Make a Video"
2. Choose an action: Turn, Wave, or Walk
3. Wait for the video generation (~3-6 seconds)
4. Download or share your personalized video

### Extension Popup

Click the extension icon to access:
- **Quick Actions**: Try-on current page, view history, get recommendations
- **Recent Activity**: See your last 3 try-ons/videos
- **Settings**: Configure auto-detection and notifications
- **Service Status**: Check if MCP services are online

## Demo

### Test with Demo Page

1. Open `extension/assets/demo_product_page.html` in your browser
2. The extension should detect it as a product page
3. Click "Try it on" and use the demo selfie
4. Experience the full try-on and video creation flow

### Real Retailer Sites

The extension works on most major clothing retailers:
- Amazon Fashion
- Zara
- H&M
- Uniqlo
- ASOS
- And many more...

## API Integration

The extension communicates with two MCP services:

### MCP-A (Try-On Service) - Port 8001
- `POST /try_on` - Generate virtual try-on image
- `POST /remember_interaction` - Save user preferences
- `GET /recommend` - Get personalized recommendations

### MCP-B (Video Service) - Port 8002
- `POST /animate` - Create animated video from try-on image
- `POST /storyboard` - Generate action sequences
- `POST /compose` - Multi-action video composition

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Content Script │    │ Background SW   │    │  MCP Services   │
│                 │    │                 │    │                 │
│ • Page Detection│◄──►│ • API Calls     │◄──►│ • Try-On (8001) │
│ • UI Injection  │    │ • Caching       │    │ • Video (8002)  │
│ • User Events   │    │ • History       │    │ • Redis Cache   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## File Structure

```
extension/
├── manifest.json          # Extension configuration
├── content.js            # Injected page script
├── content.css           # Extension UI styles
├── background.js         # Service worker
├── popup.html           # Extension popup UI
├── popup.css            # Popup styles
├── popup.js             # Popup functionality
├── assets/
│   ├── demo_selfie.jpg   # Demo selfie for testing
│   ├── demo_product.webp # Demo product image
│   └── demo_product_page.html # Test product page
└── icons/
    ├── icon16.png        # Extension icons
    ├── icon48.png
    └── icon128.png
```

## Configuration

The extension automatically configures itself but you can customize:

### Settings (via popup)
- **Auto-detect product pages**: Automatically show try-on button
- **Show notifications**: Display badges and toasts
- **Cache results**: Store try-on results for faster loading

### Storage
- User preferences stored in Chrome local storage
- Try-on history (last 20 items)
- Service status and cache

## Troubleshooting

### Extension Not Working
1. Check that MCP services are running on ports 8001 and 8002
2. Verify the extension is loaded in `chrome://extensions/`
3. Check browser console for error messages
4. Ensure you're on a product page (contains product indicators)

### Try-On Button Not Appearing
1. Refresh the page after installing the extension
2. Check if the page is detected as a product page in the popup
3. Manually trigger try-on from the extension popup

### Service Connection Issues
1. Check service status indicators in the extension popup
2. Verify MCP services are accessible at localhost:8001 and localhost:8002
3. Check browser network tab for CORS or connection errors

## Development

### Testing
1. Load the extension in developer mode
2. Open the demo product page
3. Test the full try-on and video flow
4. Check browser console for any errors

### Debugging
- Use Chrome DevTools to inspect the content script
- Check the background service worker in `chrome://extensions/`
- Monitor network requests to MCP services
- View extension storage in DevTools Application tab

## Privacy & Security

- Only stores opaque user IDs and URLs
- No personal information beyond try-on preferences
- All processing happens via secure MCP service APIs
- Images are processed server-side and not stored locally

## Future Enhancements

- [ ] Support for more clothing categories (pants, shoes, accessories)
- [ ] Multiple selfie poses and angles
- [ ] Social sharing integration
- [ ] AR preview mode
- [ ] Batch try-on for multiple items
- [ ] Size recommendation based on fit analysis
