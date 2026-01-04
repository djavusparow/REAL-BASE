
import { RankTier } from '../types.ts';

/**
 * Points Calculation Formula
 * Now includes Farcaster seniority weight
 */
export const calculatePoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  cappedContributionPoints: number,
  farcasterAgeDays: number = 0
): number => {
  const baseAgePoints = baseAppAgeDays * 0.20;
  const twitterAgePoints = twitterAgeDays * 0.30;
  const contributionPoints = cappedContributionPoints * 0.50;
  const farcasterAgePoints = farcasterAgeDays * 0.40; // Higher weight for native Farcaster identity
  
  const total = baseAgePoints + twitterAgePoints + contributionPoints + farcasterAgePoints;
  return parseFloat(total.toFixed(2));
};

export const calculateAccountAgeDays = (createdAt: Date): number => {
  const now = new Date();
  const diffInMs = now.getTime() - createdAt.getTime();
  const days = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
};

export const getTierFromRank = (rank: number): RankTier => {
  if (rank <= 5) return RankTier.PLATINUM;
  if (rank <= 25) return RankTier.GOLD;
  if (rank <= 500) return RankTier.SILVER;
  if (rank <= 1000) return RankTier.BRONZE;
  return RankTier.NONE;
};
