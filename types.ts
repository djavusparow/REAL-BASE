
export enum RankTier {
  PLATINUM = 'PLATINUM',
  GOLD = 'GOLD',
  SILVER = 'SILVER',
  BRONZE = 'BRONZE',
  NONE = 'NONE'
}

export interface UserStats {
  address: string;
  twitterHandle: string;
  baseAppAgeDays: number;
  twitterAgeDays: number;
  twitterCreatedAt?: string;
  validTweetsCount: number;
  basepostingPoints: number; // New field for tracked mentions
  
  // USD Values for logic
  lambolessBalance: number; 
  nickBalance?: number;     
  jesseBalance?: number;    

  // Actual Token Quantities for UI
  lambolessAmount?: number;
  nickAmount?: number;
  jesseAmount?: number;

  points: number;
  rank: number;
  trustScore?: number;
  recentContributions?: any[];
  
  // Farcaster specific fields
  farcasterId?: number;
  farcasterUsername?: string;
  farcasterDisplayName?: string;
  farcasterPfp?: string;
  farcasterAgeDays?: number;
  farcasterCreatedAt?: string;

  // Breakdown for Dashboard UI
  pointsBreakdown?: {
    social_twitter: number;
    social_fc: number;
    seniority: number;
    social: number;
    lambo: number;
    nick: number;
    jesse: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  points: number;
  tier: RankTier;
  accountAgeDays: number;
  baseAppAgeDays: number;
  auditedAt?: string; // New field for real-time tracking
}

export interface BadgeConfig {
  name: string;
  color: string;
  description: string;
  range: string;
  glowClass: string;
}