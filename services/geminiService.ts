import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Generates a ultra-high-quality premium badge visual using Gemini.
   * Optimized for Gemini 3 Pro / 2.5 Flash Image models.
   */
  async generateBadgePreview(tier: string, handle: string, retryAttempt: number = 0): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Priority: gemini-3-pro-image-preview for high resolution and artistic complexity
      const modelName = retryAttempt === 0 ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      let aestheticDesc = "";
      let coreColor = "";
      
      if (tier === 'PLATINUM') {
        aestheticDesc = "an ethereal floating diamond artifact with infinite internal reflections and iridescent holographic liquid. Translucent obsidian glass frame.";
        coreColor = "shimmering diamond, rainbow prism, white laser glow";
      } else if (tier === 'GOLD') {
        aestheticDesc = "a levitating core of molten sun-gold encased in a thick, perfectly polished crystal geometric sphere. Micro-circuits etched in gold.";
        coreColor = "warm amber radiance, 24k gold metallic, solar flare glow";
      } else if (tier === 'SILVER') {
        aestheticDesc = "a futuristic orb of liquid mercury and frosted sapphire glass. Sharp metallic edges with soft blue neon inner lighting.";
        coreColor = "cool azure, brushed chrome, arctic silver reflections";
      } else if (tier === 'BRONZE') {
        aestheticDesc = "a cybernetic relic made of deep amethyst resin and aged copper. Pulsing purple energy veins visible through semi-transparent layers.";
        coreColor = "neon violet, copper antique, dark purple obsidian";
      }

      // Mastery Level Prompt for Crypto-Aesthetic
      const prompt = `A ultra-premium 3D digital medallion NFT badge for elite crypto builders. 
           Design: ${aestheticDesc}. 
           Centerpiece: A glowing, minimalist "B" logo (representing Base) floating inside the core. 
           Materials: ${coreColor}, high-refractive index glass, liquid metal, and holographic energy.
           Visual Style: Octane Render, 8k, highly detailed textures, depth of field, studio lighting on black background, futuristic, luxury, masterpiece. 
           The design should look like a rare high-value digital asset.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K" // High quality for Pro model
          }
        }
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned from Gemini");
      }

      const candidate = response.candidates[0];
      
      // Handle safety or empty content
      if (candidate.finishReason === 'SAFETY' || !candidate.content?.parts) {
        console.warn("Safety filter triggered or no parts, retrying with fallback model...");
        if (retryAttempt === 0) return this.generateBadgePreview(tier, handle, 1);
        return null;
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      
      if (retryAttempt === 0) return this.generateBadgePreview(tier, handle, 1);
      return null;
    } catch (error) {
      console.error(`Gemini Image Generation Error:`, error);
      if (retryAttempt === 0) return this.generateBadgePreview(tier, handle, 1);
      return null;
    }
  }

  async getTokenPrice(tokenName: string, contract: string): Promise<number> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Price of ${tokenName} (${contract}) on Base in USD? Number only.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      const priceText = response.text?.replace(/[^0-9.]/g, '') || "0.0001"; 
      return parseFloat(priceText) || 0.0001;
    } catch (error) {
      return 0.0001; 
    }
  }

  async getImpressionAnalysis(points: number, tier: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Hype message for a builder with ${points} points (${tier} tier) on Base chain.`
      });
      return response.text || "Keep building!";
    } catch (error) {
      return "Build on Base!";
    }
  }
}

export const geminiService = new GeminiService();