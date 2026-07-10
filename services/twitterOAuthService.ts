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

// Get Twitter credentials from Vite environment
const TWITTER_CLIENT_ID = import.meta.env.VITE_TWITTER_CONSUMER_KEY || '';
const TWITTER_CALLBACK_URL = import.meta.env.VITE_TWITTER_CALLBACK_URL || `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/twitter/callback`;

// Determine OAuth server URL based on environment
function getOAuthServerUrl(): string {
  // If we're in development mode and can access localhost
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  
  // For deployed/production, return empty since we won't use backend
  return '';
}

export class TwitterOAuthService {
  /**
   * Step 1: Get OAuth Authorization URL
   */
  async getAuthorizationUrl(): Promise<{ authUrl: string; state: string }> {
    try {
      const oauthUrl = getOAuthServerUrl();
      console.log('[OAuth] Getting auth URL from:', oauthUrl);
      const response = await axios.get(`${oauthUrl}/auth/twitter/request`);
      return {
        authUrl: response.data.authUrl,
        state: response.data.state
      };
    } catch (error: any) {
      console.error('[OAuth] Failed to get authorization URL:', error.response?.data || error.message);
      throw new Error('Failed to initiate Twitter OAuth: ' + (error.response?.data?.error || error.message));
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
      const oauthUrl = getOAuthServerUrl();
      const validationResponse = await axios.post(`${oauthUrl}/auth/twitter/validate`, {
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
      console.log('[OAuth] Starting authentication flow...');
      
      // Check if we can use backend
      const oauthServerUrl = getOAuthServerUrl();
      if (oauthServerUrl && window.location.hostname === 'localhost') {
        try {
          // Try to get auth URL from backend (if available in dev)
          const { authUrl } = await this.getAuthorizationUrl();
          console.log('[OAuth] Got auth URL from backend');
          window.location.href = authUrl;
          
          return {
            id: '',
            username: '',
            createdAt: new Date(),
            accountAgeDays: 0
          };
        } catch (backendError) {
          console.warn('[OAuth] Backend error:', backendError);
        }
      }

      // Use direct OAuth flow (works in both dev and production)
      console.log('[OAuth] Using direct Twitter OAuth flow');
      
      if (!TWITTER_CLIENT_ID) {
        throw new Error('Twitter API credentials not configured. Please set VITE_TWITTER_CONSUMER_KEY environment variable.');
      }
      
      const scope = 'tweet.read users.read';
      const state = this.generateRandomString(32);
      const codeVerifier = this.generateRandomString(128);
      
      // Store state and code verifier in sessionStorage for verification
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_code_verifier', codeVerifier);
      
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      
      const authUrl = `https://twitter.com/i/oauth2/authorize?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(TWITTER_CLIENT_ID)}&` +
        `redirect_uri=${encodeURIComponent(TWITTER_CALLBACK_URL)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${encodeURIComponent(state)}&` +
        `code_challenge=${encodeURIComponent(codeChallenge)}&` +
        `code_challenge_method=S256`;
      
      console.log('[OAuth] ========== DEBUG INFO ==========');
      console.log('[OAuth] Client ID:', TWITTER_CLIENT_ID ? '✓ SET' : '✗ MISSING');
      console.log('[OAuth] Callback URL:', TWITTER_CALLBACK_URL);
      console.log('[OAuth] Scope:', scope);
      console.log('[OAuth] App Origin:', window.location.origin);
      console.log('[OAuth] Redirecting to Twitter...');
      console.log('[OAuth] ===================================');
      window.location.href = authUrl;

      // Return dummy user (this won't be reached due to redirect)
      return {
        id: '',
        username: '',
        createdAt: new Date(),
        accountAgeDays: 0
      };
    } catch (error: any) {
      console.error('[OAuth] Failed to authenticate:', error.message);
      throw new Error('Failed to initiate Twitter login: ' + error.message);
    }
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateCodeChallenge(codeVerifier: string): string {
    if (typeof window === 'undefined') return '';
    // For browsers that support SubtleCrypto
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    // Using crypto API would require async, so we'll use a simple approach
    // In production, this should be done on the backend
    return this.base64UrlEncode(codeVerifier);
  }

  private base64UrlEncode(str: string): string {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
        const oauthUrl = getOAuthServerUrl();
        await axios.post(`${oauthUrl}/auth/twitter/revoke`, {
          accessToken
        });
        
        // Clear stored token
        sessionStorage.removeItem('twitter_access_token');
      }
    } catch (error: any) {
      console.error('[OAuth] Failed to logout:', error.message);
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
