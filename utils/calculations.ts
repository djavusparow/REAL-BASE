
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
 * Updated tiers as per user request:
 * FID 1 - 5000: 225 pts
 * FID 5001 - 25000: 150 pts
 * FID 25001 - 75000: 125 pts
 * FID 75001 - 175000: 100 pts
 * FID 175001 - 375000: 75 pts
 * FID 375001 - 775000: 50 pts
 * FID 775001 - 1500000: 25 pts
 * FID 1500001 - 5000000: 15 pts
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
  return 10; // Default for very high FIDs
};

/**
 * Estimates Farcaster account age in days based on FID.
 * Farcaster growth has been non-linear, with significant acceleration post-Feb 2024.
 */
export const estimateFarcasterAge = (fid: number): number => {
  if (!fid) return 0;
  
  const now = new Date();
  const genesisDate = new Date("2020-07-25"); // Approximate Farcaster genesis
  const totalDaysSinceGenesis = (now.getTime() - genesisDate.getTime()) / (1000 * 60 * 60 * 24);

  // Heuristic based on FID milestones:
  // FID 1-10k: 2020 - Late 2022
  // FID 100k: Oct 2023
  // FID 250k: Feb 2024 (Frame Launch)
  // FID 500k: May 2024
  // FID 1M+: Feb 2025
  
  let estimatedDays = 0;
  if (fid <= 10000) {
    // Very early adopters (Senior builders)
    estimatedDays = totalDaysSinceGenesis - (fid / 10000) * 300;
  } else if (fid <= 100000) {
    // Early adopters
    const dayRef = totalDaysSinceGenesis - 400; // Late 2023 ref
    estimatedDays = dayRef * (1 - (fid - 10000) / 90000);
  } else if (fid <= 250000) {
    // Pre-frames boom
    estimatedDays = 400 * (1 - (fid - 100000) / 150000);
  } else {
    // Post-frames/Current growth phase
    // FID 1M is ~30 days old as of March 2025
    estimatedDays = Math.max(1, 380 * Math.pow(1 - Math.min(fid / 1200000, 1), 1.5));
  }

  return Math.floor(estimatedDays);
};

/**
 * Points Calculation Formula
 * Returns total points and a breakdown for display.
 * 
 * Note: farcasterId replaces the previous farcasterAgeDays for point calculation.
 */
export const calculateDetailedPoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  cappedContributionPoints: number,
  farcasterId: number = 0,
  tokenUSDValues: { lambo: number; jesse: number; nick: number } = { lambo: 0, jesse: 0, nick: 0 }
): { total: number; breakdown: any } => {
  // 1. Social & Seniority Base Points
  const twitterPoints = (twitterAgeDays * 0.15) + (cappedContributionPoints * 0.30);
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
  
  const total = twitterPoints + farcasterPoints + seniorityPoints + lamboPoints + nickPoints + jessePoints;
  
  return {
    total: parseFloat(total.toFixed(4)),
    breakdown: {
      social_twitter: parseFloat(twitterPoints.toFixed(4)),
      social_fc: parseFloat(farcasterPoints.toFixed(4)),
      seniority: parseFloat(seniorityPoints.toFixed(4)),
      social: parseFloat((twitterPoints + farcasterPoints).toFixed(4)), 
      lambo: parseFloat(lamboPoints.toFixed(4)),
      nick: parseFloat(nickPoints.toFixed(4)),
      jesse: parseFloat(jessePoints.toFixed(4))
    }
  };
};

/**
 * Returns the corresponding tier based on accumulated points.
 */
export const getTierFromPoints = (points: number): RankTier => {
  if (points >= TIERS[RankTier.PLATINUM].minPoints) return RankTier.PLATINUM;
  if (points >= TIERS[RankTier.GOLD].minPoints) return RankTier.GOLD;
  if (points >= TIERS[RankTier.SILVER].minPoints) return RankTier.SILVER;
  if (points >= TIERS[RankTier.BRONZE].minPoints) return RankTier.BRONZE;
  return RankTier.NONE;
};

/**
 * Deprecated: Use getTierFromPoints
 */
export const getTierFromRank = (rank: number): RankTier => {
  return RankTier.NONE;
};
