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
  async login() {
    return true;
  }

  async scanPosts(handle: string): Promise<ScanResult> {
    const username = handle.replace('@', '');
    
    // Simulate API latency for the "Auditing" feel
    await new Promise(r => setTimeout(r, 2000));

    const seed = username.length;
    const registrationDate = new Date();
    // Simulate account age: older handles get more days
    registrationDate.setFullYear(registrationDate.getFullYear() - (1 + (seed % 5)));
    const accountAgeDays = calculateAccountAgeDays(registrationDate);

    const rawTweets = this.generateRealisticMockTweets(handle);
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

    // Calculation: Original posts (2 pts) + Mentions (1 pt), capped at 10 pts per day
    let basepostingPointsTotal = 0;
    Object.keys(dailyCounts).forEach(day => {
      const dayTweets = validBasepostingTweets.filter(t => t.createdAt.toISOString().split('T')[0] === day);
      let dayPoints = 0;
      dayTweets.forEach(t => {
        dayPoints += t.isReply ? 1 : 2;
      });
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

  private generateRealisticMockTweets(handle: string): Tweet[] {
    const templates = [
      { text: "Building the future on @base is the best decision I've made. @jessepollak", isReply: false },
      { text: "gm @base community! Checking out the latest from @baseapp.", isReply: false },
      { text: "@baseapp great update today! Love the new UI.", isReply: true },
      { text: "Contribution matters. #Baseposting @base", isReply: false },
      { text: "@jessepollak keep building the @base vision! 🔵", isReply: true },
      { text: "Just minted my first NFT on @base network.", isReply: false },
      { text: "Bridge to @base is lightning fast today. @baseapp", isReply: false },
      { text: "@brian_armstrong decentralization is key for @base.", isReply: true }
    ];
    
    const tweets: Tweet[] = [];
    const count = 15 + Math.floor(Math.random() * 25);
    const start = BASEPOSTING_START_DATE.getTime();
    const end = Date.now();

    for (let i = 0; i < count; i++) {
      const ts = start + Math.random() * (end - start);
      const template = templates[i % templates.length];
      tweets.push({
        id: `tweet-${i}-${Math.random().toString(36).substr(2, 5)}`,
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