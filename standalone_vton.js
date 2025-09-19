#!/usr/bin/env node
/**
 * Standalone Virtual Try-On Script
 * Reads Gemini API key from .env and performs try-on with images in root folder
 * Saves results to data/tryon/ directory
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

class StandaloneVTON {
  constructor() {
    this.apiKey = null;
    this.baseDir = __dirname;
    this.tryonDir = path.join(this.baseDir, 'data', 'tryon');
    this.geminiModel = 'gemini-2.5-flash-image-preview';
    this.ai = null;
  }

  /**
   * Load environment variables from .env file
   */
  loadEnv() {
    const envPath = path.join(this.baseDir, '.env');

    if (!fs.existsSync(envPath)) {
      throw new Error('❌ .env file not found. Please create one with GEMINI_API_KEY=your_key_here');
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (key === 'GEMINI_API_KEY') {
          this.apiKey = value;
        }
      }
    }

    if (!this.apiKey) {
      throw new Error('❌ GEMINI_API_KEY not found in .env file');
    }

    // Initialize GoogleGenAI with API key
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    console.log('✅ API key loaded and GoogleGenAI initialized');
  }

  /**
   * Find image files in root directory
   */
  findImages() {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    const files = fs.readdirSync(this.baseDir);

    const images = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });

    console.log(`📁 Found ${images.length} images in root directory:`, images);
    return images;
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };
    return mimeTypes[ext] || 'image/png';
  }

  /**
   * Call Gemini API for virtual try-on using official SDK
   */
  async callGeminiAPI(personImagePath, garmentImagePath) {
    console.log(`🔄 Processing: ${path.basename(personImagePath)} + ${path.basename(garmentImagePath)}`);

    // Read images as base64
    const personImageData = fs.readFileSync(personImagePath);
    const garmentImageData = fs.readFileSync(garmentImagePath);

    const personBase64 = personImageData.toString('base64');
    const garmentBase64 = garmentImageData.toString('base64');

    const personMime = this.getMimeType(personImagePath);
    const garmentMime = this.getMimeType(garmentImagePath);

    // Create prompt with inline images
    const prompt = [
      {
        text: `You are an advanced virtual try-on assistant. Using the first image as the person (preserve their exact identity, facial features, hair, pose, lighting conditions, and background environment) and the second image as the garment, create a highly realistic, photorealistic image of the person wearing the garment.

Key requirements:
- Preserve the person's exact body shape, proportions, and posture
- Maintain original lighting conditions and shadows
- Keep the background completely unchanged
- Ensure the garment fits naturally with realistic fabric physics, wrinkles, and draping
- Respect garment texture, color, patterns, and material properties
- Adapt garment size and fit to the person's body naturally
- Maintain depth and perspective consistency
- Preserve any accessories or items the person is holding/wearing that don't conflict with the new garment
- Ensure seamless integration between person and garment with no visible artifacts or blending issues

Generate only the final composed image with professional photo quality.`
      },
      {
        inlineData: {
          mimeType: personMime,
          data: personBase64
        }
      },
      {
        inlineData: {
          mimeType: garmentMime,
          data: garmentBase64
        }
      }
    ];

    try {
      const response = await this.ai.models.generateContent({
        model: this.geminiModel,
        contents: prompt
      });

      // Process response parts
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          console.log('📝 Text response:', part.text);
        } else if (part.inlineData) {
          console.log('🖼️ Image generated successfully!');
          return {
            imageData: part.inlineData.data,
            mimeType: part.inlineData.mimeType
          };
        }
      }

      throw new Error('No image data found in response');
    } catch (error) {
      throw new Error(`Gemini API call failed: ${error.message}`);
    }
  }

  /**
   * Save generated image to tryon directory
   */
  saveImage(imageData, mimeType, personFile, garmentFile) {
    // Ensure tryon directory exists
    if (!fs.existsSync(this.tryonDir)) {
      fs.mkdirSync(this.tryonDir, { recursive: true });
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const personName = path.parse(personFile).name;
    const garmentName = path.parse(garmentFile).name;
    const extension = mimeType === 'image/png' ? '.png' : '.jpg';

    const filename = `result_${personName}_${garmentName}_${timestamp}${extension}`;
    const filepath = path.join(this.tryonDir, filename);

    // Convert base64 to buffer and save
    const imageBuffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(filepath, imageBuffer);

    console.log(`💾 Saved result: ${filename}`);
    return filepath;
  }

  /**
   * Perform virtual try-on with all combinations
   */
  async performTryOns() {
    console.log('🚀 Starting standalone virtual try-on process...');

    this.loadEnv();
    const images = this.findImages();

    if (images.length < 2) {
      throw new Error('❌ Need at least 2 images in root directory (person + garment)');
    }

    console.log('\n📝 Available combinations:');
    for (let i = 0; i < images.length; i++) {
      for (let j = 0; j < images.length; j++) {
        if (i !== j) {
          console.log(`  ${i + 1}. Person: ${images[i]} + Garment: ${images[j]}`);
        }
      }
    }

    // Check command line arguments
    const args = process.argv.slice(2);

    if (args.includes('--all')) {
      console.log('\n🔄 Processing all combinations...');
      let processed = 0;

      for (let i = 0; i < images.length; i++) {
        for (let j = 0; j < images.length; j++) {
          if (i !== j) {
            try {
              console.log(`\n⏳ Processing combination ${processed + 1}...`);

              const personPath = path.join(this.baseDir, images[i]);
              const garmentPath = path.join(this.baseDir, images[j]);

              const result = await this.callGeminiAPI(personPath, garmentPath);
              this.saveImage(result.imageData, result.mimeType, images[i], images[j]);

              processed++;
              console.log(`✅ Completed ${processed} try-ons`);

            } catch (error) {
              console.error(`❌ Failed: ${images[i]} + ${images[j]} - ${error.message}`);
            }
          }
        }
      }

      console.log(`\n🎉 Finished! Processed ${processed} try-on combinations`);

    } else {
      // Default: find Taylor Swift as person, use other image as garment
      let personPath, garmentPath, personFile, garmentFile;

      // Look for Taylor Swift image
      const taylorImage = images.find(img => img.toLowerCase().includes('taylor'));
      if (taylorImage) {
        personFile = taylorImage;
        garmentFile = images.find(img => img !== taylorImage);
        personPath = path.join(this.baseDir, personFile);
        garmentPath = path.join(this.baseDir, garmentFile);
      } else {
        // Fallback: use first as person, second as garment
        personFile = images[0];
        garmentFile = images[1];
        personPath = path.join(this.baseDir, personFile);
        garmentPath = path.join(this.baseDir, garmentFile);
      }

      console.log(`\n⏳ Processing: ${personFile} (person) + ${garmentFile} (garment)`);

      try {
        const result = await this.callGeminiAPI(personPath, garmentPath);
        const savedPath = this.saveImage(result.imageData, result.mimeType, personFile, garmentFile);

        console.log(`✅ Try-on completed successfully!`);
        console.log(`📁 Result saved to: ${savedPath}`);

      } catch (error) {
        console.error(`❌ Try-on failed: ${error.message}`);
        process.exit(1);
      }
    }
  }
}

// Run the script
if (require.main === module) {
  const vton = new StandaloneVTON();

  vton.performTryOns().catch(error => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = StandaloneVTON;