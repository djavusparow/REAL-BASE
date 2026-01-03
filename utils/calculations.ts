
import { RankTier } from '../types';

/**
 * Points are obtained from:
 * 20% BaseApp account age
 * 30% Twitter account age
 * 50% Contributions (tweets with tags @base @baseapp @baseposting @jessepollak @brian_armstrong $LAMBOLESS)
 */
export const calculatePoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  mentionsCount: number
): number => {
  // Normalize age: assume 365 days is "max points" for age categories
  const baseAgeScore = Math.min((baseAppAgeDays / 365) * 20, 20);
  const twitterAgeScore = Math.min((twitterAgeDays / 730) * 30, 30); // Twitter accounts are usually older
  
  // Normalize mentions: assume 100 valid tweets is "max points"
  const mentionScore = Math.min((mentionsCount / 100) * 50, 50);
  
  return parseFloat((baseAgeScore + twitterAgeScore + mentionScore).toFixed(2));
};

export const getTierFromRank = (rank: number): RankTier => {
  if (rank <= 5) return RankTier.PLATINUM;
  if (rank <= 25) return RankTier.GOLD;
  if (rank <= 500) return RankTier.SILVER;
  if (rank <= 1000) return RankTier.BRONZE;
  return RankTier.NONE;
};
