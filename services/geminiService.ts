import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  /**
   * Generates a badge image using Gemini with an instant SVG fallback.
   */
  async generateBadgePreview(tier: string, username: string): Promise<string | null> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // User requested specific prompt: "Generate a simple, clean vector illustration of a Lamborghini car, minimalist style, premium badge background"
      const prompt = `Generate a simple, clean vector illustration of a Lamborghini car, minimalist style, premium ${tier.toLowerCase()} badge background for user ${username}. 4k, digital art.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
      });

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      
      return this.generateInstantBadge(tier, username);
    } catch (error) {
      console.error(`Gemini AI failed, using fallback:`, error);
      return this.generateInstantBadge(tier, username);
    }
  }

  private generateInstantBadge(tier: string, username: string): string {
    const colors: Record<string, { start: string, mid: string, end: string }> = {
      'PLATINUM': { start: '#E2E8F0', mid: '#94A3B8', end: '#1E293B' },
      'GOLD': { start: '#FDE047', mid: '#EAB308', end: '#713F12' },
      'SILVER': { start: '#F1F5F9', mid: '#94A3B8', end: '#334155' },
      'BRONZE': { start: '#FB923C', mid: '#C2410C', end: '#431407' },
      'NONE': { start: '#334155', mid: '#0F172A', end: '#000000' }
    };

    const c = colors[tier] || colors['NONE'];
    
    const svg = `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${c.start};stop-opacity:1" />
          <stop offset="50%" style="stop-color:${c.mid};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${c.end};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="#000000"/>
      <path d="M512 128 L832 256 L832 576 C832 768 512 896 512 896 C512 896 192 768 192 576 L192 256 L512 128Z" fill="url(#shieldGrad)" />
      <text x="512" y="520" font-family="Arial" font-weight="900" font-size="80" fill="white" text-anchor="middle">${tier}</text>
      <text x="512" y="800" font-family="Arial" font-weight="700" font-size="30" fill="white" text-anchor="middle">${username.toUpperCase()}</text>
    </svg>`;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  async getTokenPrice(tokenName: string, contract: string): Promise<number> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Latest price of token ${contract} on Base network. Return ONLY numeric USD price.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      return parseFloat(response.text?.replace(/[^0-9.]/g, '') || "0.0001");
    } catch (error) {
      return 0.0001; 
    }
  }
}

export const geminiService = new GeminiService();
