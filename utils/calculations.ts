
import { RankTier, UserStats } from '../types.ts';
import { MULTIPLIERS, HOURLY_WINDOW_START, HOURLY_WINDOW_END } from '../constants.ts';

// Add the missing calculateAccountAgeDays utility function
/**
 * Calculates the number of days between the registration date and now.
 */
export const calculateAccountAgeDays = (registrationDate: Date): number => {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - registrationDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Points Calculation Formula
 * Returns total points and a breakdown for display.
 */
export const calculateDetailedPoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  cappedContributionPoints: number,
  farcasterAgeDays: number = 0,
  tokenUSDValues: { lambo: number; nick: number; jesse: number } = { lambo: 0, nick: 0, jesse: 0 }
): { total: number; breakdown: any } => {
  // 1. Social & Seniority Base Points
  const socialPoints = 
    (baseAppAgeDays * 0.10) + 
    (twitterAgeDays * 0.15) + 
    (cappedContributionPoints * 0.30) + 
    (farcasterAgeDays * 0.20);
  
  // 2. Real-time Hourly Asset Points
  const now = new Date();
  const effectiveStart = new Date(HOURLY_WINDOW_START);
  const effectiveEnd = new Date(Math.min(HOURLY_WINDOW_END.getTime(), now.getTime()));
  
  let hoursElapsed = 0;
  if (effectiveEnd > effectiveStart) {
    hoursElapsed = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
  }

  const lamboPoints = tokenUSDValues.lambo * MULTIPLIERS.LAMBOLESS * hoursElapsed;
  const nickPoints = tokenUSDValues.nick * MULTIPLIERS.NICK * hoursElapsed;
  const jessePoints = tokenUSDValues.jesse * MULTIPLIERS.JESSE * hoursElapsed;
  
  const total = socialPoints + lamboPoints + nickPoints + jessePoints;
  
  return {
    total: parseFloat(total.toFixed(4)),
    breakdown: {
      social: parseFloat(socialPoints.toFixed(4)),
      lambo: parseFloat(lamboPoints.toFixed(4)),
      nick: parseFloat(nickPoints.toFixed(4)),
      jesse: parseFloat(jessePoints.toFixed(4))
    }
  };
};

/**
 * Legacy compatibility wrapper
 */
export const calculatePoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  cappedContributionPoints: number,
  farcasterAgeDays: number = 0,
  tokenUSDValues: { lambo: number; nick: number; jesse: number } = { lambo: 0, nick: 0, jesse: 0 }
): number => {
  return calculateDetailedPoints(baseAppAgeDays, twitterAgeDays, cappedContributionPoints, farcasterAgeDays, tokenUSDValues).total;
};

export const getTierFromRank = (rank: number): RankTier => {
  if (rank <= 5) return RankTier.PLATINUM;
  if (rank <= 25) return RankTier.GOLD;
  if (rank <= 500) return RankTier.SILVER;
  if (rank <= 1000) return RankTier.BRONZE;
  return RankTier.NONE;
};
