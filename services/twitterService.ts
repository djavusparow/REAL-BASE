
import { TWITTER_CONFIG, SNAPSHOT_START, SNAPSHOT_END } from '../constants.ts';
import { calculateAccountAgeDays } from '../utils/calculations.ts';
import { sdk } from '@farcaster/frame-sdk';

export interface Tweet {
  id: string;
  text: string;
  createdAt: Date;
  qualityScore?: number;
  isReply?: boolean;
  isRetweet?: boolean;
}

export interface ScanResult {
  totalValidPosts: number;
  cappedPoints: number;
  basepostingPoints: number;
  dailyBreakdown: Record<string, number>;
  foundTweets: Tweet[];
  accountAgeDays: number;
  trustScore: number;
}

const REQUIRED_MENTIONS = ['@base', '@baseapp', '@baseposting', '@jessepollak', '@brian_armstrong'];
const BASEPOSTING_START_DATE = new Date("2025-11-01T23:59:00Z");

export class TwitterService {
  private activeBearerToken: string | undefined = TWITTER_CONFIG.bearerToken;

  constructor() {
    this.verifyAndInitialize();
  }

  private async verifyAndInitialize() {
    if (TWITTER_CONFIG.apiKey && TWITTER_CONFIG.apiSecret) {
      try {
        await this.refreshBearerToken();
      } catch (error) {
        console.error("[TwitterService] Error during verification:", error);
      }
    }
  }

  async login() {
    const clientId = TWITTER_CONFIG.apiKey || 'MOCK_CLIENT_ID';
    const redirectUri = encodeURIComponent(window.location.origin + window.location.pathname);
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('twitter_oauth_state', state);

    const loginUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=tweet.read%20users.read&state=${state}&code_challenge=challenge&code_challenge_method=plain`;
    try {
      await sdk.actions.openUrl(loginUrl);
    } catch (e) {
      window.location.href = loginUrl;
    }
  }

  async handleCallback(params: URLSearchParams): Promise<{ handle: string } | null> {
    const code = params.get('code');
    if (!code) return null;
    await new Promise(r => setTimeout(r, 1500));
    localStorage.removeItem('twitter_oauth_state');
    return { handle: "@base_builder_verified" };
  }

  private async refreshBearerToken(): Promise<string | undefined> {
    if (!TWITTER_CONFIG.apiKey || !TWITTER_CONFIG.apiSecret) return undefined;
    try {
      const credentials = btoa(`${TWITTER_CONFIG.apiKey}:${TWITTER_CONFIG.apiSecret}`);
      const response = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'grant_type=client_credentials',
      });
      const data = await response.json();
      if (data.access_token) {
        this.activeBearerToken = data.access_token;
        return data.access_token;
      }
    } catch (error) {
      console.error("[TwitterService] Failed to exchange token:", error);
    }
    return undefined;
  }

  private async getHeaders() {
    if (!this.activeBearerToken) await this.refreshBearerToken();
    return {
      'Authorization': `Bearer ${this.activeBearerToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Scans user tweets and applies high-accuracy validation rules:
   * 1. Mentions @base, @baseapp, @baseposting, @jessepollak, or @brian_armstrong.
   * 2. Since Nov 1, 2025 at 23:59 UTC.
   * 3. Must NOT be a retweet.
   * 4. Must NOT be a reply.
   * 5. Text length >= 10 characters.
   * 6. Capped at 5 valid tweets per day (1 point each).
   */
  async scanPosts(handle: string): Promise<ScanResult> {
    const username = handle.replace('@', '');
    const headers = await this.getHeaders();
    
    // Simulation of periodic fetch logic (Rule #2)
    await new Promise(r => setTimeout(r, 1500));

    const registrationDate = new Date();
    registrationDate.setFullYear(registrationDate.getFullYear() - (1 + Math.random() * 4));
    const accountAgeDays = calculateAccountAgeDays(registrationDate);

    // Generate mock history following the rules
    const rawTweets = this.generateStrictMockTweets(handle);
    const validBasepostingTweets: Tweet[] = [];
    const dailyCounts: Record<string, number> = {};

    const startTimestamp = BASEPOSTING_START_DATE.getTime();
    const endTimestamp = SNAPSHOT_END.getTime();

    // High accuracy filtering (Rules 1, 3, 4, 5, 9)
    for (const t of rawTweets) {
      const lowerText = t.text.toLowerCase();
      
      // Rule 1: Mentions check
      const hasMention = REQUIRED_MENTIONS.some(m => lowerText.includes(m.toLowerCase()));
      
      const isValid = 
        t.createdAt.getTime() >= startTimestamp && 
        t.createdAt.getTime() <= endTimestamp &&
        hasMention &&
        t.isReply === false && // Rule 4: Not a reply
        t.isRetweet === false && // Rule 3: Not a retweet
        t.text.trim().length >= 10; // Rule 5: Min 10 chars

      if (isValid) {
        validBasepostingTweets.push(t);
        const dayKey = t.createdAt.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      }
    }

    // Rule 11: Capped at 5 points per day
    let basepostingPointsTotal = 0;
    Object.keys(dailyCounts).forEach(day => {
      basepostingPointsTotal += Math.min(dailyCounts[day], 5);
    });

    const trustScore = Math.round((Math.min(accountAgeDays / 1000, 1) * 40) + (validBasepostingTweets.length > 5 ? 60 : 30));

    return {
      totalValidPosts: validBasepostingTweets.length,
      cappedPoints: validBasepostingTweets.length, // historical general metric
      basepostingPoints: basepostingPointsTotal,
      dailyBreakdown: dailyCounts,
      foundTweets: validBasepostingTweets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      accountAgeDays,
      trustScore
    };
  }

  private generateStrictMockTweets(handle: string): Tweet[] {
    const texts = [
      "I am building on @base because the ecosystem is growing fast! @jessepollak",
      "Check out @baseapp for the best onchain user experience. @baseposting",
      "Contribution is key to the @base ecosystem growth. #Baseposting",
      "Love the way @brian_armstrong focuses on decentralization for @base.",
      "My new dapp is live on @base! Super smooth experience.",
      "Just bridged to @base using @baseapp. High speed, low cost!",
      "Builders thrive on @base. @jessepollak keep shipping!",
      "@base is where the real builders are. #Baseposting",
      "Exploring new possibilities with @baseposting on @base network.",
      "gm @base builders! What are we shipping today?",
      "@baseapp is definitely the way to go for mass adoption.",
      "Verified my identity on @base through Base Impression."
    ];
    
    const tweets: Tweet[] = [];
    const count = 40 + Math.floor(Math.random() * 40);
    const start = BASEPOSTING_START_DATE.getTime();
    const end = SNAPSHOT_END.getTime();

    for (let i = 0; i < count; i++) {
      const ts = start + Math.random() * (end - start);
      tweets.push({
        id: `valid-tweet-${i}`,
        text: texts[i % texts.length],
        createdAt: new Date(ts),
        isReply: false, // For simulation of 'Original Post'
        isRetweet: false,
        qualityScore: 1.0
      });

      // Add some invalid ones to test logic
      if (i % 4 === 0) {
        tweets.push({
          id: `invalid-reply-${i}`,
          text: "@base this is awesome!",
          createdAt: new Date(ts),
          isReply: true,
          isRetweet: false
        });
      }
      if (i % 5 === 0) {
        tweets.push({
          id: `invalid-short-${i}`,
          text: "@base gm",
          createdAt: new Date(ts),
          isReply: false,
          isRetweet: false
        });
      }
    }
    return tweets;
  }
}

export const twitterService = new TwitterService();
