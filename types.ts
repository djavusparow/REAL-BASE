
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
  validTweetsCount: number;
  lambolessBalance: number; // USD Value
  nickBalance?: number;     // USD Value
  jesseBalance?: number;    // USD Value
  points: number;
  rank: number;
  trustScore?: number;
  recentContributions?: any[];
  // Farcaster specific fields
  farcasterId?: number;
  farcasterUsername?: string;
  farcasterAgeDays?: number;
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  points: number;
  tier: RankTier;
  accountAgeDays: number; // Twitter age
  baseAppAgeDays: number; // Baseapp age
}

export interface BadgeConfig {
  name: string;
  color: string;
  description: string;
  range: string;
  glowClass: string;
}
