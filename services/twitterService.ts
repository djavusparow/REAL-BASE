import { SNAPSHOT_END } from '../constants.ts';
import { calculateAccountAgeDays } from '../utils/calculations.ts';

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
  /**
   * Menggunakan manual handle input untuk keandalan maksimum di lingkungan webview.
   */
  async login() {
    return true;
  }

  async scanPosts(handle: string): Promise<ScanResult> {
    const username = handle.replace('@', '');
    
    // Simulate API latency for the "Auditing" feel
    await new Promise(r => setTimeout(r, 2500));

    const seed = username.length;
    const registrationDate = new Date();
    registrationDate.setFullYear(registrationDate.getFullYear() - (2 + (seed % 3)));
    const accountAgeDays = calculateAccountAgeDays(registrationDate);

    const rawTweets = this.generateStrictMockTweets(handle);
    const validBasepostingTweets: Tweet[] = [];
    const dailyCounts: Record<string, number> = {};

    const startTimestamp = BASEPOSTING_START_DATE.getTime();
    const endTimestamp = SNAPSHOT_END.getTime();

    for (const t of rawTweets) {
      const lowerText = t.text.toLowerCase();
      const hasMention = REQUIRED_MENTIONS.some(m => lowerText.includes(m.toLowerCase()));
      
      const isValid = 
        t.createdAt.getTime() >= startTimestamp && 
        t.createdAt.getTime() <= endTimestamp &&
        hasMention &&
        t.isReply === false && 
        t.isRetweet === false && 
        t.text.trim().length >= 10;

      if (isValid) {
        validBasepostingTweets.push(t);
        const dayKey = t.createdAt.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      }
    }

    let basepostingPointsTotal = 0;
    Object.keys(dailyCounts).forEach(day => {
      basepostingPointsTotal += Math.min(dailyCounts[day], 5);
    });

    const trustScore = Math.min(100, Math.round((accountAgeDays / 10) + (validBasepostingTweets.length * 2)));

    return {
      totalValidPosts: validBasepostingTweets.length,
      cappedPoints: validBasepostingTweets.length,
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
    const count = 20 + Math.floor(Math.random() * 30);
    const start = BASEPOSTING_START_DATE.getTime();
    const end = Date.now();

    for (let i = 0; i < count; i++) {
      const ts = start + Math.random() * (end - start);
      tweets.push({
        id: `tweet-${i}`,
        text: texts[i % texts.length],
        createdAt: new Date(ts),
        isReply: false,
        isRetweet: false,
        qualityScore: 1.0
      });
    }
    return tweets;
  }
}

export const twitterService = new TwitterService();