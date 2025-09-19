# Virtual Try-On + Video Generation Platform

**AI-powered virtual try-on that works on any shopping site with personalized video generation**

## 🚀 What We Built

A **Chrome Extension** that transforms any product page into an interactive virtual try-on experience. Works universally across all e-commerce sites - no retailer integration needed.

![Extension Demo](./taylor_swift.webp)
*Chrome extension automatically detects products and adds "Try it On" functionality to any shopping site*

### Key Features
- **🌐 Universal Chrome Extension**: One-click installation, works on any e-commerce site
- **🎯 Photorealistic Try-On**: Advanced Gemini AI preserves body shape, pose, and background
- **🎬 Video Generation**: Create 3-6 second vertical clips with actions like "turn" and "wave"
- **🧠 Smart Memory**: Learns style preferences for personalized recommendations
- **⚡ Zero Setup**: Install extension and start trying on clothes immediately

## 🎯 The Experience

### 1. Original Person Image
![Person Image](./taylor_swift.webp)
*Upload your photo once - the extension remembers your profile for instant try-ons*

### 2. Product Detection
![Product Image](./sample_product.webp)
*Extension automatically detects clothing items on any e-commerce site*

### 3. AI-Generated Try-On Result
![Virtual Try-On Result](./vton_result_swift_banana.png)
*AI generates photorealistic try-on images in ~2 seconds, preserving your body shape and background*

**Complete Flow:**
1. **Browse any product page** → Extension detects clothing items
2. **Click "Try it On"** → AI generates realistic try-on preserving your appearance
3. **Make a Video** → Choose animations to showcase the fit
4. **Get Recommendations** → AI suggests similar items based on your history
5. **Share & Save** → Download or share your personalized content

## 🏗️ Architecture

**Chrome Extension + Distributed MCP Services:**
- **🔌 Chrome Extension (MV3)**: Universal product detection, UI injection, user management
- **🎨 MCP-A (Try-On)**: `mcp_vton/` - FastAPI + Redis + Gemini for virtual try-on generation
- **🎬 MCP-B (Video)**: `mcp_video/` - FastAPI + MiniMax for video generation and animation
- **⚡ Performance**: Sub-second responses with Redis caching, horizontal scaling

## 🎬 Demo Flow (3 Minutes)

1. Open any retailer → Extension detects product → Click "Try it On" → See result in ~2s
2. Click "Make a Video" → Choose "Turn" → Watch 4-6s animated clip
3. View recommendations → AI suggests similar items based on your style
4. **Impact**: "Two MCP services power try-on + video from any site with personalized memory"

## 🛠️ Quick Start

### For Users (Chrome Extension)
1. **Install Extension**: Load unpacked extension from `extension/` directory in Chrome
2. **Set Up Profile**: Add your photo and Gemini API key in extension settings
3. **Try It Out**: Visit any product page and click "Try it On"

### For Developers (Local Services)
```bash
# Start backend services
redis-server
cd mcp_vton && uvicorn app:app --port 8001
cd mcp_video && uvicorn app:app --port 8002
```

## 🎯 Market Impact

- **Universal Solution**: No retailer integration needed - works everywhere
- **Reduced Returns**: Customers see realistic fit before purchase
- **Increased Engagement**: Video content drives social sharing
- **Personalized Shopping**: AI learns individual style preferences
- **Scalable**: Distributed architecture serves millions of users

---

*Built with cutting-edge AI to make online shopping as engaging as in-store experiences.*