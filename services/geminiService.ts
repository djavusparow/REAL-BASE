
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Generates a high-quality badge visual using Gemini 2.5 Flash Image.
   */
  async generateBadgePreview(tier: string, handle: string): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let colorDesc = "";
      if (tier === 'PLATINUM') colorDesc = "shimmering holographic rainbow colors with high-gloss reflection";
      else if (tier === 'GOLD') colorDesc = "luxury polished 24k gold metallic finish";
      else if (tier === 'SILVER') colorDesc = "sleek brushed silver and chrome metallic finish";
      else if (tier === 'BRONZE') colorDesc = "deep mystic purple neon and bronze fusion";

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `A professional 3D NFT badge for the "BASE IMPRESSION" project. 
              The centerpiece is a futuristic Lamborghini supercar silhouette. 
              The text "BASE IMPRESSION" is clearly visible and integrated into the design. 
              The badge color theme is ${colorDesc}. 
              The username "${handle}" is elegantly etched at the bottom. 
              Style: Clean, premium, tech-focused, cinematic lighting, Unreal Engine 5 render.`
            }
          ]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error) {
      console.error("Gemini Image Generation Error:", error);
      return null;
    }
  }

  /**
   * Fetches the real-time price of a token on Base using Google Search grounding.
   */
  async getTokenPrice(tokenName: string, contract: string): Promise<number> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `What is the current market price of the ${tokenName} token on Base network (contract ${contract}) in USD? Return ONLY the numerical price value. If unknown, return 0.0001.`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      
      const priceText = response.text?.replace(/[^0-9.]/g, '') || "0.0001"; 
      return parseFloat(priceText) || 0.0001;
    } catch (error) {
      console.error(`Gemini Price Fetch Error for ${tokenName}:`, error);
      return 0.0001; 
    }
  }

  /**
   * Generates motivational copy using Gemini 3 Flash Preview.
   */
  async getImpressionAnalysis(points: number, tier: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze my stats for the BASE IMPRESSION event: Points ${points}, Tier reached: ${tier}. 
        Write a hyper-energetic, punchy motivational message (max 2 sentences). 
        Mention 'Base ecosystem' and my growth as a builder.`
      });
      return response.text || "You're carving a path on Base. The snapshot is watching!";
    } catch (error) {
      console.error("Gemini Text Generation Error:", error);
      return "Your footprint on Base is growing. Keep building the future!";
    }
  }
}

export const geminiService = new GeminiService();
