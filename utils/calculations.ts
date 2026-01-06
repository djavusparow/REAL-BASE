
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
 */
export const calculateDetailedPoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  cappedContributionPoints: number,
  farcasterAgeDays: number = 0,
  tokenUSDValues: { lambo: number; nick: number; jesse: number } = { lambo: 0, nick: 0, jesse: 0 }
): { total: number; breakdown: any } => {
  // 1. Social & Seniority Base Points
  const twitterPoints = (twitterAgeDays * 0.15) + (cappedContributionPoints * 0.30);
  const farcasterPoints = farcasterAgeDays * 0.20;
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
  const nickPoints = tokenUSDValues.nick * MULTIPLIERS.NICK * hoursElapsed;
  const jessePoints = tokenUSDValues.jesse * MULTIPLIERS.JESSE * hoursElapsed;
  
  const total = twitterPoints + farcasterPoints + seniorityPoints + lamboPoints + nickPoints + jessePoints;
  
  return {
    total: parseFloat(total.toFixed(4)),
    breakdown: {
      social_twitter: parseFloat(twitterPoints.toFixed(4)),
      social_fc: parseFloat(farcasterPoints.toFixed(4)),
      seniority: parseFloat(seniorityPoints.toFixed(4)),
      social: parseFloat((twitterPoints + farcasterPoints).toFixed(4)), // legacy support
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
