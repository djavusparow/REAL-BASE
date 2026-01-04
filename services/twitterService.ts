
import { SNAPSHOT_START, SNAPSHOT_END } from '../constants.ts';
import { calculateAccountAgeDays } from '../utils/calculations.ts';

export interface Tweet {
  id: string;
  text: string;
  createdAt: Date;
  qualityScore?: number;
}

export interface ScanResult {
  totalValidPosts: number;
  cappedPoints: number;
  dailyBreakdown: Record<string, number>;
  foundTweets: Tweet[];
  accountAgeDays: number;
  trustScore: number;
}

export class TwitterService {
  /**
   * Simulates a secure verification check by searching for the challenge code in recent activity.
   */
  async verifyOwnership(handle: string, challengeCode: string): Promise<boolean> {
    // In a real production app, this would call an API route that queries the Twitter Search API
    // for a tweet from @handle containing the challengeCode.
    await new Promise(r => setTimeout(r, 2000));
    return true; // Simulating success for the prototype
  }

  async scanPosts(handle: string): Promise<ScanResult> {
    await new Promise(r => setTimeout(r, 1500));

    const registrationDate = new Date();
    registrationDate.setFullYear(registrationDate.getFullYear() - (1 + Math.random() * 4));
    const accountAgeDays = calculateAccountAgeDays(registrationDate);

    const mockTweets = this.generateHistoricalMockTweets(handle);
    const validTweets: Tweet[] = [];
    const dailyCounts: Record<string, number> = {};

    const start = SNAPSHOT_START.getTime();
    const end = SNAPSHOT_END.getTime();

    for (const t of mockTweets) {
      if (t.createdAt.getTime() >= start && t.createdAt.getTime() <= end) {
        validTweets.push(t);
        const dayKey = t.createdAt.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      }
    }

    let cappedPoints = 0;
    Object.keys(dailyCounts).forEach(day => { 
      cappedPoints += Math.min(dailyCounts[day], 5); 
    });

    const trustScore = Math.round((Math.min(accountAgeDays / 1000, 1) * 40) + (validTweets.length > 5 ? 60 : 30));

    return {
      totalValidPosts: validTweets.length,
      cappedPoints,
      dailyBreakdown: dailyCounts,
      foundTweets: validTweets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
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
      "Deployed my first contract on Base today. L2 scaling is real."
    ];
    
    const tweets: Tweet[] = [];
    const count = 10 + Math.floor(Math.random() * 20);
    const start = SNAPSHOT_START.getTime();
    const end = SNAPSHOT_END.getTime();

    for (let i = 0; i < count; i++) {
      const ts = start + Math.random() * (end - start);
      tweets.push({
        id: `scan-${i}`,
        text: texts[i % texts.length],
        createdAt: new Date(ts),
        qualityScore: 0.5 + Math.random() * 0.5
      });
    }
    return tweets;
  }
}

export const twitterService = new TwitterService();
