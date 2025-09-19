# 🛍️ Shopanion - Local Demo Guide

## What You'll See & Do

### Step 1: Generate Icons (2 minutes)
1. Open `generate_icons.html` in Chrome
2. Icons will auto-generate
3. Right-click each canvas → "Save image as..."
4. Save as: `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder

### Step 2: Install Extension (1 minute)
1. Open Chrome
2. Go to `chrome://extensions/`
3. Toggle **"Developer mode"** ON (top-right)
4. Click **"Load unpacked"**
5. Select the `extension/` folder
6. ✅ You should see **"Shopanion"** in your extensions list!

### Step 3: What You'll See
- 🛍️ **Shopanion icon** appears in Chrome toolbar
- Click it → popup opens showing "Your AI shopping companion"
- Status shows: ❌ Services offline (red dots) - this is expected without MCP services

### Step 4: Test on Demo Page (2 minutes)
1. Open `assets/demo_product_page.html` in Chrome
2. **Expected behavior:**
   - Page loads showing a black hoodie product
   - 👕 **"Try it on" button appears** automatically on the page
   - Extension popup shows: ✅ "Product page detected"

### Step 5: Test Try-On Flow (Mock)
1. Click the **"Try it on"** button
2. Modal opens with upload options
3. Click **"Use Demo Selfie"**
4. **Expected:** Loading message appears (will show error without MCP services - this is normal!)

## 🎯 Success Criteria

You've successfully installed Shopanion if you see:

✅ **Extension Installed:**
- "Shopanion" appears in `chrome://extensions/`
- Icon visible in Chrome toolbar
- Popup opens with "Your AI shopping companion"

✅ **Page Detection Works:**
- Demo page shows "Try it on" button
- Extension popup detects product page
- Button styling matches the page design

✅ **UI Interaction:**
- Modal opens when clicking try-on button
- All buttons and interface elements work
- Responsive design on different screen sizes

## 🔧 Troubleshooting

### Extension Won't Load
- Check that you selected the `extension/` folder (not a subfolder)
- Ensure all icon files exist in `icons/` folder
- Look for errors in `chrome://extensions/`

### Try-On Button Doesn't Appear
- Refresh the demo page after installing extension
- Check browser console (F12) for JavaScript errors
- Verify you're on the demo product page, not just any HTML file

### Icons Missing
- Generate icons using `generate_icons.html`
- Save them as PNG files in the `icons/` folder
- Reload the extension in `chrome://extensions/`

## 📁 File Check

Make sure you have these files:
```
extension/
├── manifest.json ✅
├── content.js ✅
├── content.css ✅
├── background.js ✅
├── popup.html ✅
├── popup.css ✅
├── popup.js ✅
├── icons/
│   ├── icon16.png ← Generate this
│   ├── icon48.png ← Generate this
│   └── icon128.png ← Generate this
└── assets/
    └── demo_product_page.html ✅
```

## 🎬 Demo Script (30 seconds)

> "Here's Shopanion, our AI shopping companion. Watch as I visit any product page... *opens demo page* ...and instantly get a 'Try it on' button. The extension detects this is a clothing item and injects our virtual try-on interface. Click try-on, upload a selfie, and you'd get an AI-generated image showing how this hoodie looks on you. Then create an animated video showing different poses. All powered by our MCP services running in the background."

## 🚀 Next Steps

Once you see Shopanion working locally:
1. Test on real shopping sites (Amazon, Zara, etc.)
2. Start your MCP services to see full functionality
3. Customize the extension branding and features
4. Share with your team for feedback

**The extension is ready - you just need to generate the icons and load it!** 🎉
