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
  originalPostsCount: number;
  mentionsCount: number;
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
   * Secure identity scanning simulation.
   * Logic: Distinguish between original posts (2 pts) and mentions/replies (1 pt).
   */
  async scanPosts(handle: string): Promise<ScanResult> {
    const username = handle.replace('@', '').toLowerCase();
    
    // Authenticator simulation delay
    await new Promise(r => setTimeout(r, 2000));

    // Stable seed based on handle for consistent results per session
    const seed = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const registrationDate = new Date();
    // Simulate older accounts for longer handles or specific seeds
    const yearsBack = 1 + (seed % 6);
    registrationDate.setFullYear(registrationDate.getFullYear() - yearsBack);
    const accountAgeDays = calculateAccountAgeDays(registrationDate);

    const rawTweets = this.generateDeterministicMockTweets(seed);
    const validBasepostingTweets: Tweet[] = [];
    const dailyCounts: Record<string, number> = {};
    let originalPostsCount = 0;
    let mentionsCount = 0;

    const startTimestamp = BASEPOSTING_START_DATE.getTime();
    const endTimestamp = SNAPSHOT_END.getTime();

    for (const t of rawTweets) {
      const lowerText = t.text.toLowerCase();
      const mentions = REQUIRED_MENTIONS.filter(m => lowerText.includes(m.toLowerCase()));
      const hasRequiredMentions = mentions.length > 0;
      
      const isValid = 
        t.createdAt.getTime() >= startTimestamp && 
        t.createdAt.getTime() <= endTimestamp &&
        hasRequiredMentions &&
        t.isRetweet === false && 
        t.text.trim().length >= 10;

      if (isValid) {
        validBasepostingTweets.push(t);
        
        if (t.isReply) {
          mentionsCount++;
        } else {
          originalPostsCount++;
        }

        const dayKey = t.createdAt.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      }
    }

    // Calculation Engine
    let basepostingPointsTotal = 0;
    Object.keys(dailyCounts).forEach(day => {
      const dayTweets = validBasepostingTweets.filter(t => t.createdAt.toISOString().split('T')[0] === day);
      let dayPoints = 0;
      dayTweets.forEach(t => {
        // Original posts earn 2 points, replies earn 1 point
        dayPoints += t.isReply ? 1 : 2;
      });
      // Cap at 10 points per day to prevent spam
      basepostingPointsTotal += Math.min(dayPoints, 10);
    });

    const trustScore = Math.min(100, Math.round((accountAgeDays / 20) + (basepostingPointsTotal * 0.5)));

    return {
      totalValidPosts: validBasepostingTweets.length,
      originalPostsCount,
      mentionsCount,
      basepostingPoints: basepostingPointsTotal,
      dailyBreakdown: dailyCounts,
      foundTweets: validBasepostingTweets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      accountAgeDays,
      trustScore
    };
  }

  private generateDeterministicMockTweets(seed: number): Tweet[] {
    const templates = [
      { text: "Building the future on @base is the best decision I've made. @jessepollak", isReply: false },
      { text: "gm @base community! Checking out the latest from @baseapp.", isReply: false },
      { text: "@baseapp great update today! Love the new UI.", isReply: true },
      { text: "On-chain is the only way. #Baseposting @base", isReply: false },
      { text: "@jessepollak keep building the @base vision! 🔵", isReply: true },
      { text: "Just verified my impact on @base network with @baseapp.", isReply: false },
      { text: "Bridge to @base is lightning fast today. @baseapp", isReply: false },
      { text: "@brian_armstrong decentralization is key for @base.", isReply: true },
      { text: "The @base ecosystem is growing so fast. @baseposting", isReply: false },
      { text: "@baseapp is my favorite gateway to the Base ecosystem.", isReply: true }
    ];
    
    const tweets: Tweet[] = [];
    const count = 10 + (seed % 30);
    const start = BASEPOSTING_START_DATE.getTime();
    const end = Date.now();

    for (let i = 0; i < count; i++) {
      // Deterministic timestamp within range
      const offset = (seed * i * 1000000) % (end - start);
      const ts = start + offset;
      const template = templates[i % templates.length];
      tweets.push({
        id: `tweet-${seed}-${i}`,
        text: template.text,
        createdAt: new Date(ts),
        isReply: template.isReply,
        isRetweet: false,
        qualityScore: 1.0
      });
    }
    return tweets;
  }
}

export const twitterService = new TwitterService();