import { RankTier } from '../types.ts';
import { MULTIPLIERS, TIERS } from '../constants.ts';

export const calculateAccountAgeDays = (registrationDate: Date): number => {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - registrationDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const calculateFidPoints = (fid: number): number => {
  if (!fid || fid <= 0) return 0;
  // Significant bonus for early Farcaster users
  if (fid <= 5000) return 3000;
  if (fid <= 20000) return 2000;
  if (fid <= 100000) return 1000;
  if (fid <= 500000) return 500;
  return 250;
};

export const calculateDetailedPoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  totalValidPosts: number,
  farcasterId: number = 0,
  tokenUSDValues: { lambo: number } = { lambo: 0 },
  basepostingCount: number = 0
): { total: number; breakdown: any } => {
  
  const twitterPoints = twitterAgeDays * MULTIPLIERS.TWITTER_AGE;
  const fidPoints = calculateFidPoints(farcasterId);
  const basepostingPoints = basepostingCount * MULTIPLIERS.BASEPOSTING;
  const assetPoints = tokenUSDValues.lambo * MULTIPLIERS.LAMBOLESS;
  
  const total = twitterPoints + fidPoints + basepostingPoints + assetPoints;
  
  return {
    total: Math.round(total),
    breakdown: {
      social_twitter: Math.round(twitterPoints),
      social_fc: Math.round(fidPoints),
      baseposting: Math.round(basepostingPoints),
      lambo: Math.round(assetPoints),
      seniority: 0, // Simplified
      social: Math.round(twitterPoints + fidPoints)
    }
  };
};

export const getTierFromPoints = (points: number): RankTier => {
  if (points >= TIERS[RankTier.PLATINUM].minPoints) return RankTier.PLATINUM;
  if (points >= TIERS[RankTier.GOLD].minPoints) return RankTier.GOLD;
  if (points >= TIERS[RankTier.SILVER].minPoints) return RankTier.SILVER;
  return RankTier.BRONZE;
};
