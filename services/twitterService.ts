
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
  /**
   * Scans a set of tweets for the specific required tags.
   * Returns a summary including the capped points (max 5 per day).
   */
  async scanPosts(handle: string): Promise<ScanResult> {
    // In a real production app, this would be an API call to a backend 
    // that uses the Twitter API v2 'search' endpoint with the user's OAuth token.
    // For this demonstration, we simulate the scanning of historical posts.
    
    await new Promise(resolve => setTimeout(resolve, 3500)); // Simulate network latency

    // Mock tweets spanning the snapshot period
    const mockTweets: Tweet[] = this.generateMockTweets(handle);
    
    const dailyCounts: Record<string, number> = {};
    const validTweets: Tweet[] = [];
    
    mockTweets.forEach(tweet => {
      // Check if tweet is within range
      if (tweet.createdAt < SNAPSHOT_START || tweet.createdAt > SNAPSHOT_END) return;
      
      // Check for tags
      const lowercaseText = tweet.text.toLowerCase();
      const hasTag = REQUIRED_TAGS.some(tag => lowercaseText.includes(tag.toLowerCase()));
      
      if (hasTag) {
        validTweets.push(tweet);
        const dayKey = tweet.createdAt.toISOString().split('T')[0];
        dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      }
    });

    // Calculate capped points: max 5 per day
    let cappedPoints = 0;
    Object.values(dailyCounts).forEach(count => {
      cappedPoints += Math.min(count, 5);
    });

    return {
      totalValidPosts: validTweets.length,
      cappedPoints,
      dailyBreakdown: dailyCounts,
      foundTweets: validTweets
    };
  }

  private generateMockTweets(handle: string): Tweet[] {
    const tweets: Tweet[] = [];
    const startDate = new Date(SNAPSHOT_START);
    const endDate = new Date(); // Today
    
    // Generate a believable number of tweets for a builder
    for (let i = 0; i < 150; i++) {
      const randomTime = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
      const date = new Date(randomTime);
      
      // Some tweets have tags, some don't
      const dice = Math.random();
      let text = "Just building on Base! 🔵 #BuildOnBase";
      
      if (dice > 0.7) {
        text = `Excited for the future of @base with @jessepollak and @brian_armstrong! $LAMBOLESS to the moon.`;
      } else if (dice > 0.5) {
        text = `Testing out the new @baseapp features. Great work @baseposting!`;
      }
      
      tweets.push({
        id: Math.random().toString(36).substr(2, 9),
        text,
        createdAt: date
      });
    }
    
    return tweets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export const twitterService = new TwitterService();
