import { RankTier, BadgeConfig, LeaderboardEntry } from './types.ts';

/**
 * ON-CHAIN CONFIGURATION
 */
export const LAMBOLESS_CONTRACT = "0xbe7c48aad42eea060150cb64f94b6448a89c1cef";
export const NICK_CONTRACT = "0x9F62B62CF8cC3aea56A3CE8808Cf13503D1131e7";
export const JESSE_CONTRACT = "0x50f88fe97f72cd3e75b9eb4f747f59bceba80d59";

export const MIN_TOKEN_VALUE_USD = 2.5;

/**
 * CAMPAIGN CONFIGURATION
 */
// Fix: Added missing SNAPSHOT_END constant to resolve the import error in services/twitterService.ts
export const SNAPSHOT_END = new Date("2026-01-01T00:00:00Z");

/**
 * POINT MULTIPLIERS
 */
export const MULTIPLIERS = {
  LAMBOLESS: 10, // 10 points per $1 held
  BASEPOSTING: 10, // 10 points per mention
  TWITTER_AGE: 1, // 1 point per day
  FARCASTER_AGE: 1.5 // 1.5 points per day
};

/**
 * TIER DEFINITIONS
 */
export const TIERS: Record<RankTier, BadgeConfig & { minPoints: number, maxPoints: number }> = {
  [RankTier.PLATINUM]: {
    name: "Platinum",
    color: "from-blue-200 via-indigo-400 to-purple-600",
    description: "God-Tier Impression",
    range: "> 5000 Pts",
    glowClass: "shadow-[0_0_50px_rgba(147,197,253,0.5)]",
    minPoints: 5001,
    maxPoints: 999999
  },
  [RankTier.GOLD]: {
    name: "Gold",
    color: "from-yellow-200 via-yellow-500 to-yellow-700",
    description: "High Impact Pioneer",
    range: "3001 - 5000 Pts",
    glowClass: "shadow-[0_0_40px_rgba(234,179,8,0.4)]",
    minPoints: 3001,
    maxPoints: 5000
  },
  [RankTier.SILVER]: {
    name: "Silver",
    color: "from-gray-200 via-gray-400 to-gray-600",
    description: "Solid Impressionist",
    range: "1001 - 3000 Pts",
    glowClass: "shadow-[0_0_40px_rgba(209,213,219,0.3)]",
    minPoints: 1001,
    maxPoints: 3000
  },
  [RankTier.BRONZE]: {
    name: "Bronze",
    color: "from-orange-300 via-orange-600 to-orange-900",
    description: "Base Explorer",
    range: "0 - 1000 Pts",
    glowClass: "shadow-[0_0_40px_rgba(234,88,12,0.3)]",
    minPoints: 0,
    maxPoints: 1000
  },
  [RankTier.NONE]: {
    name: "Member",
    color: "from-gray-700 to-gray-900",
    description: "Unverified Impact",
    range: "0 Pts",
    glowClass: "bg-gray-800",
    minPoints: -1,
    maxPoints: -1
  }
};