
import { RankTier, BadgeConfig, LeaderboardEntry } from './types.ts';

/**
 * CONFIGURATION SECTION
 * These values are pulled from the environment. 
 * Ensure TWITTER_API_KEY, TWITTER_API_SECRET, and TWITTER_BEARER_TOKEN are set.
 */
export const TWITTER_CONFIG = {
  apiKey: process.env.TWITTER_API_KEY,
  apiSecret: process.env.TWITTER_API_SECRET,
  bearerToken: process.env.TWITTER_BEARER_TOKEN,
};

/**
 * ON-CHAIN CONFIGURATION
 */
export const LAMBOLESS_CONTRACT = "0xbe7c48aad42eea060150cb64f94b6448a89c1cef";
export const NICK_CONTRACT = "0x9F62B62CF8cC3aea56A3CE8808Cf13503D1131e7";
export const JESSE_CONTRACT = "0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59";

export const MIN_TOKEN_VALUE_USD = 2.5;

/**
 * POINT MULTIPLIERS (Per $1 per 24 hours)
 */
export const MULTIPLIERS = {
  LAMBOLESS: 2.5,
  NICK: 0.1,
  JESSE: 0.1
};

/**
 * EVENT TIMELINE
 */
export const SNAPSHOT_START = new Date("2025-11-01T00:01:00Z");
export const SNAPSHOT_END = new Date("2026-01-15T23:59:00Z");
export const FINAL_SNAPSHOT = new Date("2026-01-16T00:01:00Z");
export const CLAIM_START = new Date("2026-01-16T02:00:00Z");

/**
 * TIER DEFINITIONS
 */
export const TIERS: Record<RankTier, BadgeConfig> = {
  [RankTier.PLATINUM]: {
    name: "Platinum",
    color: "from-indigo-500 via-purple-500 to-pink-500",
    description: "Sparkling Rainbow - Top 5",
    range: "1 - 5",
    glowClass: "rainbow-border shadow-[0_0_20px_rgba(255,255,255,0.8)]"
  },
  [RankTier.GOLD]: {
    name: "Gold",
    color: "from-yellow-400 via-yellow-600 to-yellow-800",
    description: "Shiny Gold - Top 25",
    range: "6 - 25",
    glowClass: "bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]"
  },
  [RankTier.SILVER]: {
    name: "Silver",
    color: "from-gray-300 via-gray-500 to-gray-700",
    description: "Polished Silver - Top 500",
    range: "26 - 500",
    glowClass: "bg-gray-400 shadow-[0_0_20px_rgba(156,163,175,0.5)]"
  },
  [RankTier.BRONZE]: {
    name: "Bronze",
    color: "from-purple-600 via-purple-800 to-purple-900",
    description: "Mystic Purple - Top 1000",
    range: "501 - 1000",
    glowClass: "bg-purple-600 shadow-[0_0_20px_rgba(147,51,234,0.5)]"
  },
  [RankTier.NONE]: {
    name: "Member",
    color: "from-gray-700 to-gray-900",
    description: "Keep pushing!",
    range: "1000+",
    glowClass: "bg-gray-800"
  }
};

/**
 * GLOBAL LEADERBOARD (MOCK DATA)
 */
export const MOCKED_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, handle: "@jessepollak", points: 98.5, tier: RankTier.PLATINUM, accountAgeDays: 4500, baseAppAgeDays: 800 },
  { rank: 2, handle: "@brian_armstrong", points: 97.2, tier: RankTier.PLATINUM, accountAgeDays: 5200, baseAppAgeDays: 900 },
  { rank: 3, handle: "@basegod", points: 95.8, tier: RankTier.PLATINUM, accountAgeDays: 200, baseAppAgeDays: 150 },
  { rank: 4, handle: "@lambofarmer", points: 94.1, tier: RankTier.PLATINUM, accountAgeDays: 1200, baseAppAgeDays: 400 },
  { rank: 5, handle: "@warpcast_king", points: 93.0, tier: RankTier.PLATINUM, accountAgeDays: 800, baseAppAgeDays: 200 },
  { rank: 12, handle: "@baseapp_builder", points: 88.5, tier: RankTier.GOLD, accountAgeDays: 2100, baseAppAgeDays: 600 },
  { rank: 100, handle: "@farcaster_fan", points: 72.4, tier: RankTier.SILVER, accountAgeDays: 400, baseAppAgeDays: 100 },
  { rank: 750, handle: "@lambo_dreamer", points: 45.1, tier: RankTier.BRONZE, accountAgeDays: 150, baseAppAgeDays: 50 },
];
