import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Generates a high-quality badge visual using Gemini.
   * Fallback to Flash model if Pro fails.
   */
  async generateBadgePreview(tier: string, handle: string, retryAttempt: number = 0): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Use Flash for faster/more reliable generation as primary or fallback
      const modelName = retryAttempt === 0 ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      let colorDesc = "";
      if (tier === 'PLATINUM') colorDesc = "holographic rainbow crystal, iridescent silver chrome";
      else if (tier === 'GOLD') colorDesc = "shiny 24k gold, polished yellow metallic";
      else if (tier === 'SILVER') colorDesc = "brushed silver, metallic chrome, sleek grey";
      else if (tier === 'BRONZE') colorDesc = "glowing neon purple, dark bronze metal";

      // Simplified prompt to avoid safety filters while maintaining aesthetic
      const prompt = `A 3D digital medallion icon for a crypto community. 
           Theme: ${colorDesc}. 
           Shape: Circular premium badge with a futuristic car symbol in the center.
           The text "BASE" is visible. 
           Lighting: Studio neon blue rim light, dark background, cinematic quality, high resolution.`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates");
      }

      const candidate = response.candidates[0];
      
      // Handle safety or empty content by retrying with simpler model
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
      console.error(`Gemini Error:`, error);
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