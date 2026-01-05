
import { RankTier } from '../types.ts';
import { MULTIPLIERS, SNAPSHOT_END } from '../constants.ts';

/**
 * Points Calculation Formula
 * Now includes cumulative holding points for $LAMBOLESS, $thenickshirley, and $jesse.
 * holdingPoints = (USD_Value) * (Multiplier) * (Days_Held_Until_Snapshot)
 */
export const calculatePoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  cappedContributionPoints: number,
  farcasterAgeDays: number = 0,
  tokenUSDValues: { lambo: number; nick: number; jesse: number } = { lambo: 0, nick: 0, jesse: 0 }
): number => {
  // 1. Social & Seniority Base Points
  const baseAgePoints = baseAppAgeDays * 0.10; // Reduced weight to shift to assets
  const twitterAgePoints = twitterAgeDays * 0.15;
  const contributionPoints = cappedContributionPoints * 0.30;
  const farcasterAgePoints = farcasterAgeDays * 0.20;
  
  // 2. Asset Holding Points (Cumulative)
  // Calculate how many days they have left until snapshot from their join date, or just use baseAppAgeDays as hold duration
  const now = new Date();
  const daysHeld = Math.min(baseAppAgeDays, Math.ceil((SNAPSHOT_END.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  // If we are past snapshot, use 0 for future projections but assume they held it for their baseAppAgeDays up to the snapshot.
  const effectiveHoldDays = baseAppAgeDays;

  const lamboPoints = tokenUSDValues.lambo * MULTIPLIERS.LAMBOLESS * effectiveHoldDays;
  const nickPoints = tokenUSDValues.nick * MULTIPLIERS.NICK * effectiveHoldDays;
  const jessePoints = tokenUSDValues.jesse * MULTIPLIERS.JESSE * effectiveHoldDays;
  
  const total = baseAgePoints + twitterAgePoints + contributionPoints + farcasterAgePoints + lamboPoints + nickPoints + jessePoints;
  
  // Normalize if values get too extreme for UI, but keep it realistic for the prompt
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
