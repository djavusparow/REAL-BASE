import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Generates a high-fidelity NFT badge based on the specific shield design provided.
   */
  async generateBadgePreview(tier: string, handle: string, retryAttempt: number = 0): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Use Gemini 3 Pro for maximum aesthetic alignment
      const modelName = retryAttempt === 0 ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      let metalType = "";
      let carColor = "";
      let glowColor = "";

      if (tier === 'PLATINUM') {
        metalType = "pure polished Platinum and iridescent glass";
        carColor = "white iridescent supercar";
        glowColor = "bright rainbow holographic shimmer";
      } else if (tier === 'GOLD') {
        metalType = "24k polished gold with a sun-brushed texture";
        carColor = "vibrant gold supercar";
        glowColor = "warm golden aura and lens flare";
      } else if (tier === 'SILVER') {
        metalType = "brushed metallic silver and chrome";
        carColor = "sleek silver supercar";
        glowColor = "cool blue and white metallic reflections";
      } else if (tier === 'BRONZE') {
        metalType = "deep bronze and polished copper";
        carColor = "metallic bronze supercar";
        glowColor = "warm amber and purple neon undertones";
      }

      const prompt = `A ultra-high-quality professional NFT badge design. 
           The badge is a vertical hexagonal SHIELD shape made of ${metalType}.
           TOP SECTION: Bold text that says "NFT BADGE".
           CENTER SECTION: A highly detailed ${carColor} (Lamborghini style) parked in front of a circular metallic ring.
           BOTTOM SECTION: Large bold text that says "BASE" and "IMPRESSION" below it.
           FOOTER: A separate text label at the very bottom says "${tier}".
           AESTHETIC: High-end luxury photography style, soft bokeh background, studio lighting, ray-tracing, 8k resolution, crisp edges, cinematic atmosphere. 
           The final result must look exactly like a physical luxury badge. ${glowColor}.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates");
      }

      const candidate = response.candidates[0];
      if (candidate.finishReason === 'SAFETY' || !candidate.content?.parts) {
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
      console.error(`Gemini Generation Error:`, error);
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