
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
  lambolessBalance: number;
  points: number;
  rank: number;
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  points: number;
  tier: RankTier;
}

export interface BadgeConfig {
  name: string;
  color: string;
  description: string;
  range: string;
  glowClass: string;
}
