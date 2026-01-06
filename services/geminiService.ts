
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Generates a high-quality badge visual using Gemini 2.5 Flash Image.
   */
  async generateBadgePreview(tier: string, handle: string): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      let colorDesc = "";
      if (tier === 'PLATINUM') colorDesc = "shimmering holographic rainbow colors, iridescent metallic finish";
      else if (tier === 'GOLD') colorDesc = "polished reflective luxury gold metallic finish";
      else if (tier === 'SILVER') colorDesc = "sleek high-gloss metallic silver and chrome finish";
      else if (tier === 'BRONZE') colorDesc = "vibrant neon purple and deep bronze metallic fusion";

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `A premium 3D digital collectible NFT badge for "BASE IMPRESSION". 
              The main visual feature is a detailed, aggressive modern Lamborghini supercar. 
              The text "BASE IMPRESSION" must be clearly and boldly rendered as part of the badge design. 
              The entire badge and car are themed in ${colorDesc}. 
              The username "${handle}" is precisely laser-etched on a metallic plate at the bottom. 
              Style: Automotive photography aesthetic, cinematic studio lighting, high contrast, 8k resolution, futuristic tech vibe.`
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
