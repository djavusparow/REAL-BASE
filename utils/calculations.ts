
import { RankTier } from '../types';

/**
 * Points Calculation Formula:
 * 1. BaseApp Age Points: (Days since activation) * 0.20
 * 2. Twitter Age Points: (Days since activation) * 0.30
 * 3. Contribution Points: 
 *    - Each post with tags (@jessepollak @brian_armstrong @base @baseapp @baseposting $LAMBOLESS) = 1 point
 *    - Maximum 5 points per day
 *    - Only within range: Nov 1, 2025, 00:01 UTC to Jan 15, 2026, 23:59 UTC
 *    - Total contribution points are then multiplied by 0.50 (50%)
 * 
 * Total Points = BaseAppAgePoints + TwitterAgePoints + ContributionPoints
 */
export const calculatePoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  cappedContributionPoints: number // This value should already respect the max 5/day and date range logic
): number => {
  const baseAgePoints = baseAppAgeDays * 0.20;
  const twitterAgePoints = twitterAgeDays * 0.30;
  
  // The contribution points result is the capped points multiplied by 50%
  const contributionPoints = cappedContributionPoints * 0.50;
  
  const total = baseAgePoints + twitterAgePoints + contributionPoints;
  
  return parseFloat(total.toFixed(2));
};

/**
 * Calculates the age of an account in days based on its registration/creation date.
 * @param createdAt The date the account was registered.
 * @returns Total number of full days since registration.
 */
export const calculateAccountAgeDays = (createdAt: Date): number => {
  const now = new Date();
  const diffInMs = now.getTime() - createdAt.getTime();
  // Using 86,400,000ms as a standard day length
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
