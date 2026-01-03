
import { RankTier, BadgeConfig } from './types';

export const TOKEN_CONTRACT = "0xbe7c48aad42eea060150cb64f94b6448a89c1cef";
export const MIN_TOKEN_VALUE_USD = 2.5;

export const SNAPSHOT_START = new Date("2025-11-01T00:01:00Z");
export const SNAPSHOT_END = new Date("2026-01-15T23:49:00Z");
export const FINAL_SNAPSHOT = new Date("2026-01-16T00:01:00Z");
export const CLAIM_START = new Date("2026-01-16T02:00:00Z");

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

export const MOCKED_LEADERBOARD: any[] = [
  { rank: 1, handle: "@jessepollak", points: 98.5, tier: RankTier.PLATINUM },
  { rank: 2, handle: "@brian_armstrong", points: 97.2, tier: RankTier.PLATINUM },
  { rank: 3, handle: "@basegod", points: 95.8, tier: RankTier.PLATINUM },
  { rank: 4, handle: "@lambofarmer", points: 94.1, tier: RankTier.PLATINUM },
  { rank: 5, handle: "@warpcast_king", points: 93.0, tier: RankTier.PLATINUM },
  { rank: 12, handle: "@baseapp_builder", points: 88.5, tier: RankTier.GOLD },
  { rank: 100, handle: "@farcaster_fan", points: 72.4, tier: RankTier.SILVER },
  { rank: 750, handle: "@lambo_dreamer", points: 45.1, tier: RankTier.BRONZE },
];
