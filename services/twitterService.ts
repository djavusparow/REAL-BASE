
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

  async scanPosts(handle: string): Promise<ScanResult> {
    const username = handle.replace('@', '');
    const headers = await this.getHeaders();
    
    // In a production environment, this would call the Twitter API v2 /users/:id/tweets
    // For this simulation, we generate data following the user's specific rules:
    // 1. Mentions @base, @baseapp, etc.
    // 2. Since Nov 1, 2025.
    // 3. Not a retweet, not a reply.
    // 4. Length >= 10 chars.
    // 5. Cap 5 per day.

    await new Promise(r => setTimeout(r, 1500));

    const registrationDate = new Date();
    registrationDate.setFullYear(registrationDate.getFullYear() - (1 + Math.random() * 4));
    const accountAgeDays = calculateAccountAgeDays(registrationDate);

    // Filtered historical mock tweets
    const mockTweets = this.generateHistoricalMockTweets(handle);
    const validBasepostingTweets: Tweet[] = [];
    const dailyCounts: Record<string, number> = {};

    const startTimestamp = Math.max(SNAPSHOT_START.getTime(), BASEPOSTING_START_DATE.getTime());
    const endTimestamp = SNAPSHOT_END.getTime();

    for (const t of mockTweets) {
      const lowerText = t.text.toLowerCase();
      const hasMention = REQUIRED_MENTIONS.some(m => lowerText.includes(m.toLowerCase()));
      const isEligible = 
        t.createdAt.getTime() >= startTimestamp && 
        t.createdAt.getTime() <= endTimestamp &&
        hasMention &&
        !t.isReply &&
        !t.isRetweet &&
        t.text.length >= 10;

      if (isEligible) {
        validBasepostingTweets.push(t);
        const dayKey = t.createdAt.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      }
    }

    let basepostingPoints = 0;
    Object.keys(dailyCounts).forEach(day => { 
      // Rule 11: Max 5 points per day
      basepostingPoints += Math.min(dailyCounts[day], 5); 
    });

    const trustScore = Math.round((Math.min(accountAgeDays / 1000, 1) * 40) + (validBasepostingTweets.length > 5 ? 60 : 30));

    return {
      totalValidPosts: validBasepostingTweets.length,
      cappedPoints: basepostingPoints, // Current contributions are mapped to baseposting for this specific logic
      basepostingPoints,
      dailyBreakdown: dailyCounts,
      foundTweets: validBasepostingTweets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      accountAgeDays,
      trustScore
    };
  }

  private generateHistoricalMockTweets(handle: string): Tweet[] {
    const texts = [
      "Building the next big thing on @base! #OnchainSummer",
      "Just checked out @baseapp, the UX is incredible. @jessepollak",
      "Securing my footprint with $LAMBOLESS on @base.",
      "gm @base ecosystem! Who's building today? @baseposting",
      "Deployed my first contract on Base today. L2 scaling is real.",
      "Base mainnet is moving fast. Contribution count up!",
      "The $LAMBOLESS community is the strongest on @base right now.",
      "Calculating my @Base Impression profile. Verified and ready.",
      "Excited for what @brian_armstrong is doing for decentralized compute.",
      "@base is clearly the superior L2 for retail apps right now.",
      "gm builders! @jessepollak keep shipping that based infra.",
      "Just bridged some eth to @base, it took seconds. Incredible."
    ];
    
    const tweets: Tweet[] = [];
    const count = 30 + Math.floor(Math.random() * 50);
    const start = BASEPOSTING_START_DATE.getTime();
    const end = SNAPSHOT_END.getTime();

    for (let i = 0; i < count; i++) {
      const ts = start + Math.random() * (end - start);
      tweets.push({
        id: `scan-mock-${i}`,
        text: texts[i % texts.length],
        createdAt: new Date(ts),
        isReply: Math.random() < 0.2, // 20% replies
        isRetweet: Math.random() < 0.1, // 10% retweets
        qualityScore: 0.8 + Math.random() * 0.2
      });
    }
    return tweets;
  }
}

export const twitterService = new TwitterService();
