
import { RankTier } from '../types.ts';
import { MULTIPLIERS, HOURLY_WINDOW_START, HOURLY_WINDOW_END, TIERS } from '../constants.ts';

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
 * Calculates points based on Farcaster ID (FID) tiers.
 */
export const calculateFidPoints = (fid: number): number => {
  if (!fid || fid <= 0) return 0;
  if (fid <= 5000) return 225;
  if (fid <= 25000) return 150;
  if (fid <= 75000) return 125;
  if (fid <= 175000) return 100;
  if (fid <= 375000) return 75;
  if (fid <= 775000) return 50;
  if (fid <= 1500000) return 25;
  if (fid <= 5000000) return 15;
  return 10;
};

/**
 * Points Calculation Formula
 * Returns total points and a breakdown for display.
 */
export const calculateDetailedPoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  cappedContributionPoints: number, // Historical/General Twitter points
  farcasterId: number = 0,
  tokenUSDValues: { lambo: number; jesse: number; nick: number } = { lambo: 0, jesse: 0, nick: 0 },
  basepostingPoints: number = 0 // New direct point addition
): { total: number; breakdown: any } => {
  // 1. Social & Seniority Base Points
  const twitterBaseScore = (twitterAgeDays * 0.15) + (cappedContributionPoints * 0.30);
  const farcasterPoints = calculateFidPoints(farcasterId);
  const seniorityPoints = baseAppAgeDays * 0.10;
  
  // 2. Real-time Hourly Asset Points
  const now = new Date();
  const effectiveStart = new Date(HOURLY_WINDOW_START);
  const effectiveEnd = new Date(Math.min(HOURLY_WINDOW_END.getTime(), now.getTime()));
  
  let hoursElapsed = 0;
  if (effectiveEnd > effectiveStart) {
    hoursElapsed = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
  }

  const lamboPoints = tokenUSDValues.lambo * MULTIPLIERS.LAMBOLESS * hoursElapsed;
  const nickPoints = (tokenUSDValues.nick || 0) * MULTIPLIERS.NICK * hoursElapsed;
  const jessePoints = (tokenUSDValues.jesse || 0) * MULTIPLIERS.JESSE * hoursElapsed;
  
  // Rule #10: Each valid tweet = 1 point (basepostingPoints is already capped at 5/day in service)
  const total = twitterBaseScore + farcasterPoints + seniorityPoints + lamboPoints + nickPoints + jessePoints + basepostingPoints;
  
  return {
    total: parseFloat(total.toFixed(4)),
    breakdown: {
      social_twitter: parseFloat((twitterBaseScore + basepostingPoints).toFixed(4)),
      social_fc: parseFloat(farcasterPoints.toFixed(4)),
      seniority: parseFloat(seniorityPoints.toFixed(4)),
      social: parseFloat((twitterBaseScore + farcasterPoints + basepostingPoints).toFixed(4)), 
      lambo: parseFloat(lamboPoints.toFixed(4)),
      nick: parseFloat(nickPoints.toFixed(4)),
      jesse: parseFloat(jessePoints.toFixed(4)),
      baseposting: basepostingPoints
    }
  };
};

export const getTierFromPoints = (points: number): RankTier => {
  if (points >= TIERS[RankTier.PLATINUM].minPoints) return RankTier.PLATINUM;
  if (points >= TIERS[RankTier.GOLD].minPoints) return RankTier.GOLD;
  if (points >= TIERS[RankTier.SILVER].minPoints) return RankTier.SILVER;
  if (points >= TIERS[RankTier.BRONZE].minPoints) return RankTier.BRONZE;
  return RankTier.NONE;
};

export const estimateFarcasterAge = (fid: number): number => {
    return 0; // Deprecated as per user request
};
