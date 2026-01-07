import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  async generateBadgePreview(tier: string, handle: string, retryAttempt: number = 0): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Always prioritize gemini-3-pro-image-preview for high-end graphic design
      const modelName = retryAttempt === 0 ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      let aestheticParams = "";
      if (tier === 'PLATINUM') {
        aestheticParams = "liquid mercury and white diamond finish, rainbow prismatic glow, iridescent supercar, luxury white background elements";
      } else if (tier === 'GOLD') {
        aestheticParams = "polished 24k gold finish, warm solar flare lighting, gold lamborghini supercar, glitter gold particles";
      } else if (tier === 'SILVER') {
        aestheticParams = "brushed chrome and sapphire crystal finish, cool blue neon lighting, silver supercar, sleek metallic reflections";
      } else if (tier === 'BRONZE') {
        aestheticParams = "aged copper and purple amethyst finish, violet energy pulses, orange metallic supercar, dark royal atmosphere";
      }

      const prompt = `A highly professional digital NFT Badge centered in the frame.
        SHAPE: A vertical hexagonal metallic SHIELD with sharp beveled edges.
        ELEMENTS:
        1. Top: Engraved text "NFT BADGE".
        2. Middle: A photorealistic luxury SUPERCAR (Lamborghini style) facing right, positioned in front of a glowing circular rim.
        3. Bottom: Large bold engraved text "BASE" with "IMPRESSION" directly beneath it.
        4. Footer: A small elegant label showing the word "${tier}".
        STYLE: ${aestheticParams}. Octane Render, 8k resolution, cinematic studio lighting, depth of field, sharp textures, ray-traced reflections on a clean dark background. 
        The overall design should look like a physical collector's medallion.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      if (!response.candidates || response.candidates.length === 0) throw new Error("No candidates");

      const candidate = response.candidates[0];
      if (candidate.finishReason === 'SAFETY' || !candidate.content?.parts) {
        if (retryAttempt === 0) return this.generateBadgePreview(tier, handle, 1);
        return null;
      }

      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
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
      return parseFloat(response.text?.replace(/[^0-9.]/g, '') || "0.0001");
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