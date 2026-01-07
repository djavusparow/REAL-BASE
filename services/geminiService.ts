import { GoogleGenAI } from "@google/genai";
import { TIERS } from "../constants.ts";
import { RankTier } from "../types.ts";

export class GeminiService {
  /**
   * Refines the specific tier badge image to high-fidelity NFT quality.
   * Strictly maintains the source image structure while enhancing clarity.
   */
  async generateBadgePreview(tier: string, handle: string, retryAttempt: number = 0): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const modelName = retryAttempt === 0 ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      const config = TIERS[tier as RankTier];
      if (!config || !config.referenceImageUrl) return null;

      const prompt = `Perform a high-fidelity 8k reconstruction of this specific NFT badge: ${config.referenceImageUrl}. 
           STRICT RULES:
           1. Maintain the vertical hexagonal SHIELD shape.
           2. Ensure the text "NFT BADGE" is at the top, "BASE IMPRESSION" in the middle, and "${tier}" at the bottom.
           3. Keep the supercar (Lamborghini style) centered in the circular frame.
           4. Enhance the ${tier} metallic material (Platinum/Gold/Silver/Bronze) with realistic ray-traced reflections and studio lighting.
           5. Do NOT add any new elements or change the layout. The goal is upscaling and sharpening the existing design to look premium.`;

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
        // Fallback to direct reference image if AI safety triggers or fails, 
        // ensuring user still gets their correct tier badge.
        return config.referenceImageUrl;
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      
      return config.referenceImageUrl;
    } catch (error) {
      console.error(`Gemini Enhancement Error:`, error);
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
        contents: `Hype message for a builder with ${points} points (${tier} tier) on Base chain.`
      });
      return response.text || "Keep building!";
    } catch (error) {
      return "Build on Base!";
    }
  }
}

export const geminiService = new GeminiService();