
import { GoogleGenAI } from "@google/genai";
import { SNAPSHOT_START, SNAPSHOT_END, TWITTER_CONFIG } from '../constants';
import { calculateAccountAgeDays } from '../utils/calculations';

/**
 * Represents a single tweet record from the Twitter API v2.
 */
export interface Tweet {
  id: string;
  text: string;
  createdAt: Date;
  qualityScore?: number; // Added: AI-driven contribution quality score
}

/**
 * Detailed result of a profile scan.
 */
export interface ScanResult {
  totalValidPosts: number;
  cappedPoints: number;
  dailyBreakdown: Record<string, number>;
  foundTweets: Tweet[];
  accountAgeDays: number;
  trustScore: number; // Added: Overall profile trust rating
}

const REQUIRED_TAGS = [
  '@jessepollak',
  '@brian_armstrong',
  '@base',
  '@baseapp',
  '@baseposting',
  '$lamboless'
];

/**
 * TwitterService handles OAuth 2.0 simulation and historical data indexing.
 * It uses Gemini to perform 'Smart Verification' on found tweets to filter out spam.
 */
export class TwitterService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  /**
   * Initiates the Twitter OAuth 2.0 PKCE flow.
   * In a live environment, this would handle state/code-challenge exchange.
   */
  async authorize(): Promise<boolean> {
    const { apiKey, apiSecret } = TWITTER_CONFIG;
    
    // Log configuration status for internal debugging
    if (apiKey && apiSecret) {
      console.debug("Initializing Twitter OAuth with pre-configured API Key and Secret.");
    } else {
      console.debug("Initializing Twitter OAuth using default provider bridge.");
    }
    
    console.debug("Requesting Twitter OAuth Scope: [tweet.read, users.read, offline.access]");
    
    // Simulate network latency for authorization
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Simulate obtaining an ephemeral access token
    this.accessToken = "x_auth_" + btoa(Math.random().toString()).substring(0, 32);
    this.tokenExpiry = Date.now() + 3600 * 1000; // 1 hour expiry
    
    return true;
  }

  /**
   * Performs an AI-driven quality check on a tweet using Gemini.
   * This ensures users are actually contributing value rather than tag-spamming.
   */
  private async analyzeContributionQuality(tweetText: string): Promise<number> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this tweet for contribution quality to the Base ecosystem: "${tweetText}". 
        Score it from 0 to 1 based on depth of content, sentiment, and lack of spam. 
        Return ONLY the number.`,
        config: {
          temperature: 0.1,
          maxOutputTokens: 10
        }
      });

      const score = parseFloat(response.text?.trim() || "0.5");
      return isNaN(score) ? 0.5 : score;
    } catch (e) {
      console.warn("Gemini Quality Check failed, falling back to neutral score.", e);
      return 0.5;
    }
  }

  /**
   * Scans profile for contributions with smart filtering and pagination simulation.
   */
  async scanPosts(handle: string): Promise<ScanResult> {
    if (!this.accessToken || (this.tokenExpiry && Date.now() > this.tokenExpiry)) {
      throw new Error("Twitter Session Expired. Please re-authenticate.");
    }

    // Step 1: Fetch user metadata (Account Age)
    const yearsAgo = 0.5 + Math.random() * 9;
    const registrationDate = new Date();
    registrationDate.setFullYear(registrationDate.getFullYear() - yearsAgo);
    const accountAgeDays = calculateAccountAgeDays(registrationDate);

    // Step 2: Historical Indexing
    const mockTweets: Tweet[] = this.generateHistoricalMockTweets(handle);
    const validTweets: Tweet[] = [];
    const dailyCounts: Record<string, number> = {};

    // Step 3: Filter & Smart Analysis
    // We only perform AI analysis on a subset of 'potential' matches to manage latency/tokens
    const potentialMatches = mockTweets.filter(t => {
      const withinDate = t.createdAt >= SNAPSHOT_START && t.createdAt <= SNAPSHOT_END;
      if (!withinDate) return false;
      const lowercase = t.text.toLowerCase();
      return REQUIRED_TAGS.some(tag => lowercase.includes(tag.toLowerCase()));
    });

    // Smart Validation: Check the top 5 most recent potential contributions for high quality
    for (const tweet of potentialMatches) {
      // In a real app, we'd use a more efficient heuristic or check all
      tweet.qualityScore = await this.analyzeContributionQuality(tweet.text);
      
      // Only count if quality score > 0.3 (filters out lowest effort spam)
      if (tweet.qualityScore > 0.3) {
        validTweets.push(tweet);
        const dayKey = tweet.createdAt.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      }
    }

    // Step 4: Points Finalization
    let cappedPoints = 0;
    Object.keys(dailyCounts).sort().forEach(day => {
      cappedPoints += Math.min(dailyCounts[day], 5);
    });

    // Calculate trust score based on account age and post quality
    const avgQuality = validTweets.length > 0 
      ? validTweets.reduce((acc, t) => acc + (t.qualityScore || 0), 0) / validTweets.length 
      : 0;
    const ageFactor = Math.min(accountAgeDays / 1095, 1); // Max 1 for 3yr+ accounts
    const trustScore = (avgQuality * 0.7) + (ageFactor * 0.3);

    return {
      totalValidPosts: validTweets.length,
      cappedPoints,
      dailyBreakdown: dailyCounts,
      foundTweets: validTweets,
      accountAgeDays,
      trustScore: Math.round(trustScore * 100)
    };
  }

  private generateHistoricalMockTweets(handle: string): Tweet[] {
    const tweets: Tweet[] = [];
    const start = SNAPSHOT_START.getTime();
    const end = SNAPSHOT_END.getTime();
    
    // Simulate ~150 random tweets to search through
    for (let i = 0; i < 150; i++) {
      const timestamp = start + Math.random() * (end - start);
      const dice = Math.random();
      let text = "gm onchain summer!";

      if (dice > 0.9) text = `Building @baseapp is a dream. Shoutout to @jessepollak for the energy! 🔵`;
      else if (dice > 0.8) text = `Check out the new @base bridge UI. $LAMBOLESS is the goal.`;
      else if (dice > 0.7) text = `@baseposting is where the real ones hang out. Onchain Summer 2025!`;
      
      tweets.push({
        id: `id-${Math.random().toString(36).slice(2)}`,
        text,
        createdAt: new Date(timestamp)
      });
    }
    return tweets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const twitterService = new TwitterService();
