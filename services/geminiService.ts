
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Generates a badge image using Gemini 2.5 Flash Image model.
   */
  async generateBadgePreview(tier: string, username: string): Promise<string | null> {
    try {
      // Create a new GoogleGenAI instance right before making an API call
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A centered, minimalist digital NFT Badge Shield for "${username}". 
        Tier: ${tier}. 
        Metallic finish (${tier.toLowerCase()}), sharp geometric hexagonal shape, luxury automotive aesthetic, clean dark background. 
        Highly detailed beveled edges, 8k resolution, cinematic lighting. 
        Focus on the medal structure, no complex characters.`;

      const response = await ai.models.generateContent({
        // Using gemini-2.5-flash-image for standard image generation tasks
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      if (!response.candidates || response.candidates.length === 0) return null;

      // Iterate through all parts to find the image part
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return `data:image/png;base64,${base64EncodeString}`;
        }
      }
      return null;
    } catch (error) {
      console.error(`Gemini Generation Error:`, error);
      return null;
    }
  }

  /**
   * Fetches token price using Gemini with Search Grounding.
   */
  async getTokenPrice(tokenName: string, contract: string): Promise<number> {
    try {
      // Create a new GoogleGenAI instance right before making an API call
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Latest price of token ${contract} on Base network. Return ONLY a numeric string representing the USD price.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      
      // Use .text property to get the generated text
      const text = response.text;
      return parseFloat(text?.replace(/[^0-9.]/g, '') || "0.0001");
    } catch (error) {
      return 0.0001; 
    }
  }
}

export const geminiService = new GeminiService();
