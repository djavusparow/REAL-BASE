
import { SNAPSHOT_START, SNAPSHOT_END } from '../constants';

export interface Tweet {
  id: string;
  text: string;
  createdAt: Date;
}

export interface ScanResult {
  totalValidPosts: number;
  cappedPoints: number;
  dailyBreakdown: Record<string, number>;
  foundTweets: Tweet[];
  accountAgeDays: number; // Added to track account seniority
}

const REQUIRED_TAGS = [
  '@jessepollak',
  '@brian_armstrong',
  '@base',
  '@baseapp',
  '@baseposting',
  '$lamboless'
];

export class TwitterService {
  private accessToken: string | null = null;

  /**
   * Initiates the Twitter OAuth flow for access permission.
   * In a real environment, this would redirect to Twitter's auth portal.
   */
  async authorize(): Promise<boolean> {
    console.log("Initiating Twitter OAuth Permission Request...");
    // Simulate OAuth 2.0 PKCE flow
    await new Promise(resolve => setTimeout(resolve, 1500));
    this.accessToken = "simulated_secure_token_" + Math.random().toString(36).substring(7);
    return true;
  }

  /**
   * Scans a user's timeline for ecosystem contributions and fetches account metadata.
   * Logic: 
   * 1. Only posts between Nov 1, 2025 and Jan 15, 2026.
   * 2. Must contain at least one required tag.
   * 3. Max 5 points (1 per valid post) per day.
   * 4. Calculates account age from registration date.
   */
  async scanPosts(handle: string): Promise<ScanResult> {
    if (!this.accessToken) {
      throw new Error("Twitter access not authorized. Please link your account first.");
    }

    // In production, this would use the users/by/username endpoint to get created_at
    // fetch(`https://api.twitter.com/2/users/by/username/${handle}?user.fields=created_at`, ...)
    
    await new Promise(resolve => setTimeout(resolve, 3500)); // Simulate intensive historical scan

    // Simulate an account created between 1 and 8 years ago
    const yearsAgo = 1 + Math.random() * 7;
    const registrationDate = new Date();
    registrationDate.setFullYear(registrationDate.getFullYear() - yearsAgo);
    
    const accountAgeDays = Math.floor((Date.now() - registrationDate.getTime()) / (1000 * 60 * 60 * 24));

    const mockTweets: Tweet[] = this.generateHistoricalMockTweets(handle);
    
    const dailyCounts: Record<string, number> = {};
    const validTweets: Tweet[] = [];
    
    mockTweets.forEach(tweet => {
      // 1. Precise Date Filter
      if (tweet.createdAt < SNAPSHOT_START || tweet.createdAt > SNAPSHOT_END) return;
      
      // 2. Tag Detection (Case Insensitive)
      const lowercaseText = tweet.text.toLowerCase();
      const hasTag = REQUIRED_TAGS.some(tag => lowercaseText.includes(tag.toLowerCase()));
      
      if (hasTag) {
        validTweets.push(tweet);
        const dayKey = tweet.createdAt.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      }
    });

    // 3. Daily Cap Enforcement
    let cappedPoints = 0;
    Object.keys(dailyCounts).sort().forEach(day => {
      const count = dailyCounts[day];
      cappedPoints += Math.min(count, 5);
    });

    return {
      totalValidPosts: validTweets.length,
      cappedPoints,
      dailyBreakdown: dailyCounts,
      foundTweets: validTweets,
      accountAgeDays
    };
  }

  /**
   * Generates a realistic set of tweets for demonstration within the snapshot window.
   */
  private generateHistoricalMockTweets(handle: string): Tweet[] {
    const tweets: Tweet[] = [];
    const windowStart = SNAPSHOT_START.getTime();
    const windowEnd = SNAPSHOT_END.getTime();
    
    // Generate ~200 tweets to find valid ones
    for (let i = 0; i < 200; i++) {
      const randomTime = windowStart + Math.random() * (windowEnd - windowStart);
      const date = new Date(randomTime);
      
      const dice = Math.random();
      let text = "Building the future onchain. #Base";
      
      // Simulate varied user behavior with required tags
      if (dice > 0.85) {
        text = `Incredible work by @base and @jessepollak on the new protocol updates! $LAMBOLESS is the vibe.`;
      } else if (dice > 0.75) {
        text = `Checking out @baseapp. The UX is smooth! Shoutout to @brian_armstrong for the vision.`;
      } else if (dice > 0.65) {
        text = `@baseposting is the best community on Farcaster! @base is home.`;
      }
      
      tweets.push({
        id: "tw-" + Math.random().toString(36).substring(7),
        text,
        createdAt: date
      });
    }
    
    return tweets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const twitterService = new TwitterService();
