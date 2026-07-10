import axios from 'axios';
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
  accessToken?: string;
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
const OAUTH_SERVER_URL = 'http://localhost:3001';

export class TwitterOAuthService {
  /**
   * Step 1: Get OAuth Authorization URL
   */
  async getAuthorizationUrl(): Promise<{ authUrl: string; state: string }> {
    try {
      const response = await axios.get(`${OAUTH_SERVER_URL}/auth/twitter/request`);
      return {
        authUrl: response.data.authUrl,
        state: response.data.state
      };
    } catch (error: any) {
      console.error('Failed to get authorization URL:', error.response?.data || error.message);
      throw new Error('Failed to initiate Twitter OAuth');
    }
  }

  /**
   * Step 2: Handle OAuth Callback (called after user authorizes)
   * In a real-world scenario, the backend handles this and redirects
   */
  async handleCallbackResponse(params: URLSearchParams): Promise<TwitterUser> {
    try {
      const token = params.get('token');
      const userId = params.get('userId');
      const username = params.get('username');
      const accessToken = params.get('accessToken');

      if (!token || !userId || !username) {
        throw new Error('Missing OAuth callback parameters');
      }

      // Validate token with backend
      const validationResponse = await axios.post(`${OAUTH_SERVER_URL}/auth/twitter/validate`, {
        token,
        userId
      });

      if (!validationResponse.data.valid) {
        throw new Error('Invalid OAuth token');
      }

      // Store access token securely (in sessionStorage for this demo)
      if (accessToken) {
        sessionStorage.setItem('twitter_access_token', accessToken);
      }

      // Create Twitter user object
      const twitterUser: TwitterUser = {
        id: userId,
        username,
        createdAt: new Date(), // Backend should provide this
        accountAgeDays: 0, // Backend should calculate this
        accessToken
      };

      return twitterUser;
    } catch (error: any) {
      console.error('OAuth callback handling error:', error.message);
      throw error;
    }
  }

  /**
   * Initiate OAuth flow by redirecting to authorization URL
   */
  async authenticate(): Promise<TwitterUser> {
    try {
      // Get auth URL
      const { authUrl } = await this.getAuthorizationUrl();
      
      // Redirect to Twitter
      window.location.href = authUrl;

      // Return dummy user (this won't be reached due to redirect)
      return {
        id: '',
        username: '',
        createdAt: new Date(),
        accountAgeDays: 0
      };
    } catch (error: any) {
      console.error('Failed to authenticate:', error.message);
      throw new Error('Failed to initiate Twitter login');
    }
  }

  /**
   * Scan Twitter posts (mock implementation)
   * In production, this would use Twitter API with the access token
   */
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

  /**
   * Revoke Twitter access token (logout)
   */
  async logout(): Promise<void> {
    try {
      const accessToken = sessionStorage.getItem('twitter_access_token');
      
      if (accessToken) {
        await axios.post(`${OAUTH_SERVER_URL}/auth/twitter/revoke`, {
          accessToken
        });
        
        // Clear stored token
        sessionStorage.removeItem('twitter_access_token');
      }
    } catch (error: any) {
      console.error('Failed to logout:', error.message);
      // Clear token anyway
      sessionStorage.removeItem('twitter_access_token');
    }
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

export const twitterOAuthService = new TwitterOAuthService();
