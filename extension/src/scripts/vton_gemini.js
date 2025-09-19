/**
 * Simplified Virtual Try-On Gemini API Client for Browser Extension
 */

class VTONGemini {
  constructor(apiKey = null) {
    this.apiKey = apiKey;
    this.model = 'gemini-2.5-flash-image-preview';
    this.prompt = `You are an advanced virtual try-on assistant. Using the first image as the person (preserve their exact identity, facial features, hair, pose, lighting conditions, and background environment) and the second image as the garment, create a highly realistic, photorealistic image of the person wearing the garment.

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

Generate only the final composed image with professional photo quality.`;
  }

  /**
   * Initialize with API key from environment loader
   */
  async init() {
    if (!this.apiKey && window.envLoader) {
      try {
        this.apiKey = await window.envLoader.getGeminiApiKey();
        console.log('✅ Gemini API key loaded from environment');
      } catch (error) {
        console.error('❌ Failed to load Gemini API key:', error.message);
        throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY in your .env file.');
      }
    }

    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }
  }

  /**
   * Convert data URL to base64 (browser-specific)
   */
  dataUrlToBase64(dataUrl) {
    return dataUrl.split(',')[1];
  }

  /**
   * Get MIME type from data URL (browser-specific)
   */
  getMimeFromDataUrl(dataUrl) {
    return dataUrl.split(';')[0].split(':')[1];
  }

  /**
   * Convert blob to base64 (browser-specific)
   */
  async blobToBase64(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Simple try-on method for extension use
   * @param {string} personDataUrl - Person image as data URL
   * @param {string} garmentUrl - Garment image URL or data URL
   * @returns {Promise<Object>} Result with success, imageData, or error
   */
  async tryOn(personDataUrl, garmentUrl) {
    try {
      // Initialize API key if not already set
      await this.init();
      // Convert person image
      const personBase64 = this.dataUrlToBase64(personDataUrl);
      const personMime = this.getMimeFromDataUrl(personDataUrl);

      // Convert garment image
      let garmentBase64, garmentMime;
      if (garmentUrl.startsWith('data:')) {
        garmentBase64 = this.dataUrlToBase64(garmentUrl);
        garmentMime = this.getMimeFromDataUrl(garmentUrl);
      } else {
        // Fetch URL and convert to base64
        const response = await fetch(garmentUrl);
        const blob = await response.blob();
        garmentBase64 = await this.blobToBase64(blob);
        garmentMime = blob.type;
      }

      // Build request
      const requestBody = {
        contents: [{
          parts: [
            { text: this.prompt },
            { inline_data: { mime_type: personMime, data: personBase64 } },
            { inline_data: { mime_type: garmentMime, data: garmentBase64 } }
          ]
        }]
      };

      // Call API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.candidates?.[0]?.content) {
        throw new Error('No content returned from Gemini');
      }

      // Find image in response
      for (const part of data.candidates[0].content.parts) {
        if (part.text) {
          console.log('📝 Gemini:', part.text);
        } else if (part.inline_data?.data) {
          return {
            success: true,
            imageData: `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`
          };
        }
      }

      throw new Error('No image generated');
    } catch (error) {
      console.error('❌ Try-on failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Make available globally in browser
window.VTONGemini = VTONGemini;
