
import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateBadgePreview(tier: string, handle: string): Promise<string | null> {
    try {
      // Use the gemini-2.5-flash-image model for generating the NFT visual
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: `A cinematic, high-quality 3D NFT badge for a project called "BASE IMPRESSION". 
              The badge features a sleek purple Lamborghini and the Farcaster "Warplet" icon. 
              The tier is ${tier}. Theme color: ${tier === 'PLATINUM' ? 'rainbow sparkling' : tier.toLowerCase()}. 
              The handle "${handle}" is engraved in digital neon letters. Cyberpunk aesthetic, Base blue lighting.`
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
      console.error("Error generating badge preview:", error);
      return null;
    }
  }

  async getImpressionAnalysis(points: number, rank: number): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I have ${points} points and I am ranked #${rank} in the BASE IMPRESSION contribution event. 
        Write a short, hype-inducing motivational message about my contribution to the Base ecosystem. 
        Keep it under 3 sentences and mention "Onchain Summer" or "Building Base".`
      });
      return response.text || "You're a legend in the making. Keep building on Base!";
    } catch (error) {
      return "Your impact on Base is undeniable. Ready for the next leap?";
    }
  }
}

export const geminiService = new GeminiService();
