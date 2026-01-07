import { GoogleGenAI } from "@google/genai";
import { TIERS } from "../constants.ts";
import { RankTier } from "../types.ts";

export class GeminiService {
  /**
   * Generates the final NFT Badge by using the tier's specific reference image.
   * It uses Gemini to ensure the image is output as a high-fidelity, 
   * clean data-blob ready for on-chain minting.
   */
  async generateBadgePreview(tier: string, handle: string, retryAttempt: number = 0): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // We use gemini-3-pro-image-preview for the highest quality recreation
      const modelName = 'gemini-3-pro-image-preview';
      
      const config = TIERS[tier as RankTier];
      if (!config || !config.referenceImageUrl) return null;

      // The prompt is now a "strict reconstruction" instruction focusing on the provided assets
      const prompt = `Task: High-fidelity digital reconstruction of an NFT Badge based on this design: ${config.referenceImageUrl}. 
           
           STRICT DESIGN REQUIREMENTS:
           1. The badge MUST be the vertical hexagonal SHIELD from the source.
           2. The text MUST be exactly: "NFT BADGE" at the top, "BASE IMPRESSION" in the middle, and "${tier}" at the bottom.
           3. The central icon MUST be the specific luxury supercar from the reference.
           4. The material MUST match the ${tier} metal (Platinum/Gold/Silver/Bronze) with polished reflections.
           5. Final output: A clean, high-resolution (1K) professional render of this exact badge.
           
           Focus only on clarifying the existing text and sharpening the metallic details. Do not add any new characters or elements.`;

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

      if (response.candidates && response.candidates[0].content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }

      // If AI fails or produces safety errors, return the original high-quality reference directly
      console.warn("AI enhancement skipped, using original tier asset for stability.");
      return config.referenceImageUrl;
    } catch (error) {
      console.error(`Gemini Badge Generation Error:`, error);
      const config = TIERS[tier as RankTier];
      return config?.referenceImageUrl || null;
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
        contents: `Analyze builder impact for ${points} points (${tier} tier) on Base. Be hype and concise.`
      });
      return response.text || "Keep building on Base!";
    } catch (error) {
      return "Build on Base!";
    }
  }
}

export const geminiService = new GeminiService();