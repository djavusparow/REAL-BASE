import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Generates a ultra-high-quality premium badge visual using Gemini.
   */
  async generateBadgePreview(tier: string, handle: string, retryAttempt: number = 0): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Priority: gemini-3-pro-image-preview for artistic quality
      const modelName = retryAttempt === 0 ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      let aestheticDesc = "";
      if (tier === 'PLATINUM') {
        aestheticDesc = "made of pure iridescent diamond and transparent obsidian glass. Rainbow refraction, glowing white core, holographic fragments floating inside.";
      } else if (tier === 'GOLD') {
        aestheticDesc = "made of molten liquid gold encased in a polished crystal sphere. Warm amber glow, premium gold metallic textures, rays of light.";
      } else if (tier === 'SILVER') {
        aestheticDesc = "made of brushed titanium and frosted glass. Cold blue neon rim lighting, sleek futuristic metallic finish, elegant chrome reflections.";
      } else if (tier === 'BRONZE') {
        aestheticDesc = "made of deep purple translucent resin and copper circuits. Cyberpunk aesthetic, neon violet glow, industrial futuristic textures.";
      }

      // High-end artistic prompt
      const prompt = `A premium 3D digital crypto trophy badge, floating in mid-air. 
           The badge is a masterpiece of digital art: ${aestheticDesc}. 
           In the center, a minimalist and elegant futuristic "B" logo for BASE is etched inside the glass with glowing light. 
           The handle "${handle}" is not visible but the design represents elite status.
           Lighting: Cinematic ray-tracing, soft bokeh background, dark atmospheric studio lighting, 8k resolution, Unreal Engine 5 render style, masterpiece.`;

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
      
      // Handle safety or empty content
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
      console.error(`Gemini High-Quality Visual Error:`, error);
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