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

export interface TwitterUser {
  id: string;
  username: string;
  createdAt: Date;
  accountAgeDays: number;
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
  user?: TwitterUser;
}

const REQUIRED_MENTIONS = ['@base', '@baseapp', '@baseposting', '@jessepollak', '@brian_armstrong'];
const BASEPOSTING_START_DATE = new Date("2024-01-01T00:00:00Z");

export class TwitterService {
  /**
   * Simulasi OAuth 2.0 Twitter Auth
   */
  async authenticate(): Promise<TwitterUser> {
    await new Promise(r => setTimeout(r, 1500)); // Simulasi network delay
    
    // Data simulasi (dalam real-world ini datang dari OAuth token)
    const mockId = Math.floor(Math.random() * 1000000000).toString();
    const mockCreatedAt = new Date();
    mockCreatedAt.setFullYear(mockCreatedAt.getFullYear() - (Math.floor(Math.random() * 5) + 1));
    
    return {
      id: mockId,
      username: "User" + mockId.slice(0, 4),
      createdAt: mockCreatedAt,
      accountAgeDays: calculateAccountAgeDays(mockCreatedAt)
    };
  }

  async scanPosts(handle: string): Promise<ScanResult> {
    const username = handle.replace('@', '').toLowerCase();
    const seed = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Simulasi data user
    const registrationDate = new Date();
    const yearsBack = 1 + (seed % 6);
    registrationDate.setFullYear(registrationDate.getFullYear() - yearsBack);
    const accountAgeDays = calculateAccountAgeDays(registrationDate);

    const rawTweets = this.generateDeterministicMockTweets(seed);
    const validBasepostingTweets: Tweet[] = [];
    const dailyCounts: Record<string, number> = {};
    let originalPostsCount = 0;
    let mentionsCount = 0;

    for (const t of rawTweets) {
      const lowerText = t.text.toLowerCase();
      const mentions = REQUIRED_MENTIONS.filter(m => lowerText.includes(m.toLowerCase()));
      const hasRequiredMentions = mentions.length > 0;
      
      const isValid = hasRequiredMentions && !t.isRetweet && t.text.trim().length >= 10;

      if (isValid) {
        validBasepostingTweets.push(t);
        if (t.isReply) mentionsCount++; else originalPostsCount++;
        const dayKey = t.createdAt.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      }
    }

    let basepostingPointsTotal = 0;
    Object.keys(dailyCounts).forEach(day => {
      const dayTweets = validBasepostingTweets.filter(t => t.createdAt.toISOString().split('T')[0] === day);
      let dayPoints = 0;
      dayTweets.forEach(t => { dayPoints += t.isReply ? 1 : 2; });
      basepostingPointsTotal += Math.min(dayPoints, 10);
    });

    return {
      totalValidPosts: validBasepostingTweets.length,
      originalPostsCount,
      mentionsCount,
      basepostingPoints: basepostingPointsTotal,
      dailyBreakdown: dailyCounts,
      foundTweets: validBasepostingTweets,
      accountAgeDays,
      trustScore: Math.min(100, accountAgeDays / 10)
    };
  }

  private generateDeterministicMockTweets(seed: number): Tweet[] {
    const templates = [
      { text: "Building the future on @base is amazing! @jessepollak", isReply: false },
      { text: "Love the new @baseapp updates. #Baseposting", isReply: false },
      { text: "@baseapp this is awesome!", isReply: true },
      { text: "On-chain revolution starts with @base", isReply: false }
    ];
    const tweets: Tweet[] = [];
    const count = 5 + (seed % 15);
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      tweets.push({
        id: `tw-${seed}-${i}`,
        text: template.text,
        createdAt: new Date(),
        isReply: template.isReply,
        isRetweet: false
      });
    }
    return tweets;
  }
}

export const twitterService = new TwitterService();