import { RankTier } from '../types.ts';
import { MULTIPLIERS, HOURLY_WINDOW_START, HOURLY_WINDOW_END } from '../constants.ts';

/**
 * Points Calculation Formula
 * Poin aset dihitung per jam berdasarkan durasi dalam jendela waktu 5 - 15 Jan 2026.
 */
export const calculatePoints = (
  baseAppAgeDays: number, 
  twitterAgeDays: number, 
  cappedContributionPoints: number,
  farcasterAgeDays: number = 0,
  tokenUSDValues: { lambo: number; nick: number; jesse: number } = { lambo: 0, nick: 0, jesse: 0 }
): number => {
  // 1. Social & Seniority Base Points (Statik)
  const baseAgePoints = baseAppAgeDays * 0.10;
  const twitterAgePoints = twitterAgeDays * 0.15;
  const contributionPoints = cappedContributionPoints * 0.30;
  const farcasterAgePoints = farcasterAgeDays * 0.20;
  
  // 2. Real-time Hourly Asset Points
  const now = new Date();
  
  // Menghitung berapa jam user berada dalam jendela akumulasi
  // Start: Max(Kapan jendela dimulai, Kapan user mulai berpartisipasi)
  // End: Min(Sekarang, Kapan jendela berakhir)
  
  const userStartDate = new Date(now.getTime() - (baseAppAgeDays * 24 * 60 * 60 * 1000));
  const effectiveStart = new Date(Math.max(HOURLY_WINDOW_START.getTime(), userStartDate.getTime()));
  const effectiveEnd = new Date(Math.min(HOURLY_WINDOW_END.getTime(), now.getTime()));
  
  let hoursElapsed = 0;
  if (effectiveEnd > effectiveStart) {
    hoursElapsed = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
  }

  // Akumulasi poin per jam
  const lamboPoints = tokenUSDValues.lambo * MULTIPLIERS.LAMBOLESS * hoursElapsed;
  const nickPoints = tokenUSDValues.nick * MULTIPLIERS.NICK * hoursElapsed;
  const jessePoints = tokenUSDValues.jesse * MULTIPLIERS.JESSE * hoursElapsed;
  
  const total = baseAgePoints + twitterAgePoints + contributionPoints + farcasterAgePoints + lamboPoints + nickPoints + jessePoints;
  
  return parseFloat(total.toFixed(3)); // Menggunakan 3 desimal untuk presisi akumulasi per jam
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