# Virtual Try-On + Video Generation Platform

**AI-powered virtual try-on that works on any shopping site with personalized video generation**

## 🚀 What It Is

A **Universal Chrome Extension** that adds AI-powered virtual try-on to any shopping site. Instantly see how clothes fit, create short videos, and get personalized style recommendations—no retailer integration needed.

### Core Features
- **🌐 Universal Try-On**: Works on any e-commerce site out of the box.
- **🎯 Photorealistic Results**: AI preserves your body shape, pose, and background.
- **⚡ Instant Popup Results**: See try-on results immediately in a clean popup interface.
- **🧠 Smart Recommendations**: Learns your style and suggests new items you'll love.

## 🎯 How It Works

| 1. Upload Your Photo | 2. Browse Any Store | 3. Get Your AI Try-On |
| :---: |:---:|:---:|
| ![Person Image](./taylor_swift.webp) | ![Product Image](./sample_product.webp) | ![Virtual Try-On Result](./vton_result_swift_banana.png) |
| Your personal model for instant try-ons. | Our extension finds the product automatically. | See a photorealistic result in seconds. |

## 🏗️ Architecture

**Chrome Extension + Distributed MCP Services:**
- **🔌 Chrome Extension (MV3)**: Universal product detection, UI injection, user management
- **🎨 MCP-A (Try-On)**: `mcp_vton/` - FastAPI + Redis + Gemini for virtual try-on generation
- **🎬 MCP-B (Video)**: `mcp_video/` - FastAPI + MiniMax for video generation and animation
- **⚡ Performance**: Sub-second responses with Redis caching, horizontal scaling

## 🎬 Demo Flow (1 Minute)

1. Open any retailer → Extension detects product → Click "Try it On" → See result popup in ~2s
2. Download your try-on image or try again with different settings
3. View recommendations → AI suggests similar items based on your style
4. **Impact**: "Instant virtual try-on with popup results - no complex workflows needed"

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