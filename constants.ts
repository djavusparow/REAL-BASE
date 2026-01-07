import { RankTier, BadgeConfig, LeaderboardEntry } from './types.ts';

/**
 * CONFIGURATION SECTION
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
 * POINT MULTIPLIERS (Per $1 per 1 hour)
 */
export const MULTIPLIERS = {
  LAMBOLESS: 0.005,
  NICK: 0.0001,
  JESSE: 0.0001
};

/**
 * EVENT TIMELINE
 */
export const HOURLY_WINDOW_START = new Date("2025-11-01T07:00:00Z");
export const HOURLY_WINDOW_END = new Date("2026-12-31T23:59:00Z");

export const SNAPSHOT_START = new Date("2025-11-01T00:01:00Z");
export const SNAPSHOT_END = new Date("2026-12-31T23:59:00Z");

/**
 * TIER DEFINITIONS - Updated with specific Image Assets based on user request
 */
export const TIERS: Record<RankTier, BadgeConfig & { minPoints: number, maxPoints: number, supply: number, minLamboUsd: number, referenceImageUrl: string }> = {
  [RankTier.PLATINUM]: {
    name: "Platinum",
    color: "from-indigo-500 via-purple-500 to-pink-500",
    description: "Elite Impact - Platinum Shield",
    range: "751 - 2500 Pts",
    glowClass: "rainbow-border shadow-[0_0_25px_rgba(255,255,255,0.8)]",
    minPoints: 751,
    maxPoints: 2500,
    supply: 25,
    minLamboUsd: 2.5,
    referenceImageUrl: "https://i.ibb.co/C3Xg3mC/platinum.jpg" // Placeholder for the actual uploaded asset
  },
  [RankTier.GOLD]: {
    name: "Gold",
    color: "from-yellow-400 via-yellow-600 to-yellow-800",
    description: "High Impact - Gold Shield",
    range: "351 - 750 Pts",
    glowClass: "bg-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.6)]",
    minPoints: 351,
    maxPoints: 750,
    supply: 100,
    minLamboUsd: 2.5,
    referenceImageUrl: "https://i.ibb.co/mH1mY6n/gold.jpg"
  },
  [RankTier.SILVER]: {
    name: "Silver",
    color: "from-gray-300 via-gray-500 to-gray-700",
    description: "Solid Impact - Silver Shield",
    range: "151 - 350 Pts",
    glowClass: "bg-gray-400 shadow-[0_0_20px_rgba(156,163,175,0.6)]",
    minPoints: 151,
    maxPoints: 350,
    supply: 350,
    minLamboUsd: 2.5,
    referenceImageUrl: "https://i.ibb.co/vYmC7Wd/silver.jpg"
  },
  [RankTier.BRONZE]: {
    name: "Bronze",
    color: "from-purple-600 via-purple-800 to-purple-900",
    description: "Active Entry - Bronze Shield",
    range: "100 - 150 Pts",
    glowClass: "bg-purple-600 shadow-[0_0_20px_rgba(147,51,234,0.6)]",
    minPoints: 100,
    maxPoints: 150,
    supply: 1025,
    minLamboUsd: 2.5,
    referenceImageUrl: "https://i.ibb.co/L8yX7M0/bronze.jpg"
  },
  [RankTier.NONE]: {
    name: "Member",
    color: "from-gray-700 to-gray-900",
    description: "Build more to unlock rewards",
    range: "0 - 99 Pts",
    glowClass: "bg-gray-800",
    minPoints: 0,
    maxPoints: 99,
    supply: 0,
    minLamboUsd: 0,
    referenceImageUrl: ""
  }
};

export const MOCKED_LEADERBOARD: LeaderboardEntry[] = [];