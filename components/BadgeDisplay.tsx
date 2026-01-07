
import React from 'react';
import { RankTier } from '../types.ts';
import { TIERS } from '../constants.ts';

interface BadgeDisplayProps {
  tier: RankTier;
  imageUrl?: string | null;
  loading?: boolean;
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ tier, imageUrl, loading }) => {
  const config = TIERS[tier];

  return (
    <div className="relative group w-full aspect-square max-w-[300px] mx-auto">
      {/* Glow effect */}
      <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${config.glowClass}`} />
      
      <div className={`relative h-full w-full rounded-3xl overflow-hidden border-2 border-white/10 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm`}>
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400 animate-pulse">Generating Badge Visual...</span>
          </div>
        ) : imageUrl ? (
          <img src={imageUrl} alt="Badge" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center p-8 text-center gap-4">
             <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center">
                <span className="text-4xl">💎</span>
             </div>
             <div className="space-y-1">
                <h3 className={`text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${config.color}`}>
                  {config.name} Tier
                </h3>
                <p className="text-xs text-gray-400">{config.description}</p>
             </div>
          </div>
        )}
      </div>

      {/* Tier Label */}
      <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-6 py-1 rounded-full text-xs font-black uppercase tracking-widest text-white shadow-xl ${config.glowClass}`}>
        {config.name}
      </div>
    </div>
  );
};

export default BadgeDisplay;
