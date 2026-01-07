import React from 'react';
import { RankTier } from '../types.ts';
import { TIERS } from '../constants.ts';
import { Sparkles, Shield } from 'lucide-react';

interface BadgeDisplayProps {
  tier: RankTier;
  imageUrl?: string | null;
  loading?: boolean;
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ tier, imageUrl, loading }) => {
  const config = TIERS[tier];

  return (
    <div className="relative group w-full aspect-square max-w-[320px] mx-auto">
      {/* Dynamic Glow Layer */}
      <div className={`absolute inset-0 rounded-[3rem] blur-3xl opacity-30 transition-all duration-1000 ${config.glowClass}`} />
      
      <div className="relative h-full w-full rounded-[3rem] overflow-hidden border border-white/10 bg-[#0a0a0a] flex flex-col items-center justify-center shadow-2xl">
        {loading ? (
          <div className="flex flex-col items-center gap-6 p-8">
            <div className="relative">
                <div className="w-16 h-16 border-2 border-blue-500/20 rounded-full" />
                <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin" />
            </div>
            <div className="space-y-2 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 animate-pulse">Forging Artifact</p>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Applying ${tier} Finish...</p>
            </div>
          </div>
        ) : imageUrl ? (
          <div className="w-full h-full relative group">
            <img 
              src={imageUrl} 
              alt={`${tier} Badge`} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-8">
               <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/70">Verified Impression</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center p-12 text-center gap-6 animate-in fade-in zoom-in duration-500">
             <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden">
                <Shield className={`w-12 h-12 ${tier === 'NONE' ? 'text-gray-600' : 'text-white'}`} />
                <div className={`absolute inset-0 opacity-20 bg-gradient-to-br ${config.color}`} />
             </div>
             <div className="space-y-2">
                <h3 className={`text-2xl font-black italic uppercase tracking-tighter bg-clip-text text-transparent bg-gradient-to-r ${config.color}`}>
                  {config.name}
                </h3>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">{config.description}</p>
             </div>
          </div>
        )}
      </div>

      {/* Elegant Tier Floating Label */}
      {!loading && (
          <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-8 py-2 rounded-full border border-white/10 backdrop-blur-xl flex items-center gap-2 shadow-2xl transition-all duration-500 group-hover:-translate-y-1 ${tier === 'NONE' ? 'bg-gray-900 text-gray-500' : 'bg-black/80 text-white'}`}>
            <Sparkles size={12} className={tier !== 'NONE' ? 'text-blue-400' : 'hidden'} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] italic">
                {tier === 'NONE' ? 'Ineligible' : tier}
            </span>
          </div>
      )}
    </div>
  );
};

export default BadgeDisplay;