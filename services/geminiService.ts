import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  async generateBadgePreview(tier: string, username: string): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A centered, minimalist digital NFT Badge Shield for "${username}". 
        Tier: ${tier}. 
        Metallic finish (${tier.toLowerCase()}), sharp geometric hexagonal shape, luxury automotive aesthetic, clean dark background. 
        Highly detailed beveled edges, 8k resolution, cinematic lighting. 
        Focus on the medal structure, no complex characters.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', // Using flash for speed
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      if (!response.candidates || response.candidates.length === 0) return null;

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error) {
      console.error(`Gemini Generation Error:`, error);
      return null;
    }
  }

  async getTokenPrice(tokenName: string, contract: string): Promise<number> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Latest price of token ${contract} on Base network. Return ONLY a numeric string representing the USD price.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      return parseFloat(response.text?.replace(/[^0-9.]/g, '') || "0.0001");
    } catch (error) {
      return 0.0001; 
    }
  }
}

export const geminiService = new GeminiService();