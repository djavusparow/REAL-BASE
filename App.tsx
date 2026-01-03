
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Target, 
  Twitter, 
  Wallet, 
  CheckCircle2, 
  AlertCircle,
  Zap, 
  ShieldCheck, 
  ChevronRight, 
  Info, 
  Share2, 
  ExternalLink, 
  Loader2, 
  PartyPopper,
  User as UserIcon,
  Link2
} from 'lucide-react';
import sdk from '@farcaster/frame-sdk';
import { UserStats, RankTier } from './types';
import { 
  TOKEN_CONTRACT, 
  SNAPSHOT_END, 
  CLAIM_START, 
  TIERS, 
  MOCKED_LEADERBOARD,
  FINAL_SNAPSHOT,
  MIN_TOKEN_VALUE_USD
} from './constants';
import { calculatePoints, getTierFromRank } from './utils/calculations';
import Countdown from './components/Countdown';
import BadgeDisplay from './components/BadgeDisplay';
import { geminiService } from './services/geminiService';

const BrandIcon: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => {
  const dimensions = size === 'lg' ? 'w-48 h-48' : 'w-12 h-12';
  const textSize = size === 'lg' ? 'text-xl' : 'text-[8px]';
  const padding = size === 'lg' ? 'p-4' : 'p-1';
  
  return (
    <div className={`${dimensions} relative rounded-2xl overflow-hidden shadow-2xl group border border-white/20`}>
      <img 
        src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&q=80&w=400" 
        alt="Lambo" 
        className="absolute inset-0 w-full h-full object-cover brightness-50 group-hover:scale-110 transition-transform duration-700"
      />
      <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply" />
      <div className={`absolute inset-0 flex items-center justify-center text-center ${padding}`}>
        <span className={`${textSize} font-black text-white uppercase tracking-tighter leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]`}>
          Base<br/>Impression
        </span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'claim'>('dashboard');
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<string>('');
  
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Connection Requirements
  const [fcUser, setFcUser] = useState<{ username: string; displayName?: string } | null>(null);
  const [twUser, setTwUser] = useState<{ handle: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const context = await sdk.context;
        if (context?.user) {
          setFcUser({ 
            username: context.user.username,
            displayName: context.user.displayName 
          });
        }
        sdk.actions.ready();
      } catch (e) {
        console.error("SDK initialization failed", e);
      }
    };
    init();
  }, []);

  const handleTwitterConnect = async () => {
    setLoading(true);
    // Simulate OAuth interaction
    await new Promise(r => setTimeout(r, 1200));
    setTwUser({ handle: "@base_builder" });
    setLoading(false);
  };

  const handleFinalizeConnection = async () => {
    if (!fcUser || !twUser) return;
    
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    
    const baseAge = 45;
    const twitterAge = 800;
    const tweets = 42;
    const points = calculatePoints(baseAge, twitterAge, tweets);
    const rank = 420;

    setUser({
      address: "0x742d...444",
      twitterHandle: twUser.handle,
      baseAppAgeDays: baseAge,
      twitterAgeDays: twitterAge,
      validTweetsCount: tweets,
      lambolessBalance: 3.50,
      points: points,
      rank: rank
    });
    setLoading(false);
  };

  const currentTier = useMemo(() => {
    if (!user) return RankTier.NONE;
    return getTierFromRank(user.rank);
  }, [user]);

  const handleCheckpoint = async () => {
    if (!user) return;
    setIsGenerating(true);
    const [img, msg] = await Promise.all([
      geminiService.generateBadgePreview(currentTier, user.twitterHandle),
      geminiService.getImpressionAnalysis(user.points, user.rank)
    ]);
    setBadgeImage(img);
    setAnalysis(msg);
    setIsGenerating(false);
    setActiveTab('dashboard');
  };

  const handleMint = async () => {
    if (!isClaimable || isMinting || isMinted) return;
    setIsMinting(true);
    await new Promise(r => setTimeout(r, 3000));
    const fakeHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join("");
    setTxHash(fakeHash);
    setIsMinted(true);
    setIsMinting(false);
  };

  const handleShare = (platform: 'twitter' | 'farcaster') => {
    if (!user) return;
    const shareText = isMinted 
      ? `I just minted my exclusive ${TIERS[currentTier].name} Badge for @base impression! 🛡️💎\n\nRank: #${user.rank}\n\nBuilt on @base via @baseapp! 🚀`
      : `I just checked my @base impression on @baseapp! 🛡️\n\nRank: #${user.rank}\nPoints: ${user.points}\n\nBuilding the future on @base! 🚀\n#BaseImpression #LamboLess #OnchainSummer`;
    const encodedText = encodeURIComponent(shareText);
    if (platform === 'farcaster') {
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodedText}`);
    } else {
      window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, '_blank');
    }
  };

  const isClaimable = useMemo(() => {
    if (!user) return false;
    return (
      currentTime >= CLAIM_START &&
      user.rank <= 1000 && 
      user.lambolessBalance >= MIN_TOKEN_VALUE_USD
    );
  }, [user, currentTime]);

  const claimTimeReached = currentTime >= CLAIM_START;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30 safe-top safe-bottom">
      <header className="sticky top-0 z-50 glass-effect border-b border-white/5 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BrandIcon size="sm" />
          <div className="flex flex-col">
            <h1 className="font-black text-base tracking-tighter uppercase leading-none">Base Impression</h1>
            <span className="text-[9px] text-blue-400 font-bold tracking-widest uppercase opacity-80">Season 1 Snapshot</span>
          </div>
        </div>
        
        {user && (
          <div className="flex items-center gap-2 glass-effect px-3 py-1.5 rounded-full border border-blue-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-gray-300">{user.address}</span>
          </div>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28">
        {!user ? (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="text-center space-y-4">
              <div className="relative inline-block mb-2">
                  <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20" />
                  <BrandIcon size="lg" />
              </div>
              <h2 className="text-3xl font-black tracking-tight leading-tight px-4">Prove Your<br/>Base Impact.</h2>
              <p className="text-gray-400 text-xs max-w-[300px] mx-auto leading-relaxed">
                To calculate your impression, we require a verified link to your Farcaster and Twitter accounts.
              </p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <div className="glass-effect p-5 rounded-3xl border border-white/10 space-y-4">
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Connection Requirements</h3>
                
                {/* Step 1: Farcaster */}
                <div className={`p-4 rounded-2xl flex items-center justify-between transition-all border ${fcUser ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${fcUser ? 'text-green-500' : 'text-blue-500'}`}>
                      <UserIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-black">Farcaster Account</div>
                      <div className="text-[10px] text-gray-500">
                        {fcUser ? `@${fcUser.username}` : 'Not detected'}
                      </div>
                    </div>
                  </div>
                  {fcUser ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  )}
                </div>

                {/* Step 2: Twitter */}
                <div className={`p-4 rounded-2xl flex items-center justify-between transition-all border ${twUser ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`${twUser ? 'text-green-500' : 'text-blue-400'}`}>
                      <Twitter className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-black">Twitter Account</div>
                      <div className="text-[10px] text-gray-500">
                        {twUser ? twUser.handle : 'Connection mandatory'}
                      </div>
                    </div>
                  </div>
                  {twUser ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <button 
                      onClick={handleTwitterConnect}
                      disabled={loading}
                      className="px-3 py-1 bg-blue-600 rounded-lg text-[10px] font-black hover:bg-blue-500 transition-all active:scale-95"
                    >
                      {loading ? 'Linking...' : 'Link X'}
                    </button>
                  )}
                </div>
              </div>

              <button 
                onClick={handleFinalizeConnection}
                disabled={!fcUser || !twUser || loading}
                className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 ${
                  fcUser && twUser 
                  ? 'bg-white text-black hover:bg-blue-50 cursor-pointer' 
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                }`}
              >
                {loading && !twUser ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Calculate My Impression'}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-4 opacity-40">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Secure</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-gray-500" />
              <div className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Read-Only</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 mb-2">
              <Countdown 
                targetDate={claimTimeReached ? SNAPSHOT_END : CLAIM_START} 
                label={claimTimeReached ? "Snapshot End" : "Mint Opens In"} 
              />
            </div>

            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 sticky top-[72px] z-30 backdrop-blur-md">
                {(['dashboard', 'leaderboard', 'claim'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${
                            activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-effect p-4 rounded-3xl border border-blue-500/20 text-center">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Points</span>
                    <div className="text-3xl font-black text-white mt-0.5">{user.points}</div>
                    <div className="mt-1 text-[8px] text-green-400 font-bold bg-green-400/10 px-1.5 py-0.5 rounded-full inline-block">
                        ↑ LIVE
                    </div>
                  </div>
                  <div className="glass-effect p-4 rounded-3xl border border-purple-500/20 text-center">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Rank</span>
                    <div className="text-3xl font-black text-white mt-0.5">#{user.rank}</div>
                    <div className="mt-1 text-[8px] text-purple-400 font-bold bg-purple-400/10 px-1.5 py-0.5 rounded-full inline-block">
                        {user.rank <= 1000 ? 'ELIGIBLE' : 'RANK UP'}
                    </div>
                  </div>
                </div>

                <div className="glass-effect p-6 rounded-[2rem] border border-white/10 text-center space-y-6">
                   <BadgeDisplay 
                    tier={currentTier} 
                    imageUrl={badgeImage} 
                    loading={isGenerating} 
                   />

                   {analysis && (
                     <p className="text-xs italic text-gray-400 leading-relaxed px-2 bg-white/5 py-3 rounded-xl border border-white/5">
                        "{analysis}"
                     </p>
                   )}

                   <div className="grid grid-cols-1 gap-3">
                     <button 
                        onClick={handleCheckpoint}
                        disabled={isGenerating}
                        className="w-full py-3.5 bg-white text-black rounded-2xl font-black text-sm hover:bg-gray-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        {isGenerating ? 'Analyzing...' : 'Checkpoint'}
                      </button>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleShare('farcaster')}
                          className="flex-1 py-3 bg-[#8a63d2]/10 hover:bg-[#8a63d2]/20 text-[#8a63d2] border border-[#8a63d2]/30 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <Share2 className="w-3.5 h-3.5" /> Farcaster
                        </button>
                        <button 
                          onClick={() => handleShare('twitter')}
                          className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <Twitter className="w-3.5 h-3.5" /> Share to X
                        </button>
                      </div>
                   </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Metrics Breakdown</h3>
                    <div className="space-y-2">
                        {[
                            { icon: <Target className="w-4 h-4" />, label: "Base Presence", val: `${user.baseAppAgeDays}D`, weight: "20%" },
                            { icon: <Twitter className="w-4 h-4" />, label: "Social Reach", val: `${user.twitterAgeDays}D`, weight: "30%" },
                            { icon: <Zap className="w-4 h-4" />, label: "Contribution", val: user.validTweetsCount, weight: "50%" },
                        ].map((stat, i) => (
                            <div key={i} className="flex items-center justify-between p-3.5 glass-effect rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="text-blue-500">{stat.icon}</div>
                                    <span className="text-xs font-bold text-gray-300">{stat.label}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black">{stat.val}</div>
                                    <div className="text-[9px] text-gray-500 font-bold">{stat.weight}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="flex items-center justify-between px-2">
                    <h2 className="text-lg font-black">Top Impact</h2>
                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Jan 16 Deadline</span>
                </div>
                
                <div className="space-y-2">
                  <div className="p-3.5 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-black text-blue-400">#{user.rank}</span>
                        <div>
                            <div className="text-xs font-black text-white">YOU</div>
                            <div className="text-[8px] font-bold text-blue-400 uppercase">{TIERS[currentTier].name}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-base font-black text-white">{user.points}</div>
                    </div>
                  </div>

                  {MOCKED_LEADERBOARD.map((player) => (
                    <div key={player.rank} className="p-3.5 glass-effect border border-white/5 rounded-2xl flex items-center justify-between opacity-80 hover:opacity-100 transition-all">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-gray-500">#{player.rank}</span>
                            <div>
                                <div className="text-xs font-black text-gray-200">{player.handle}</div>
                                <div className={`text-[8px] font-bold uppercase bg-clip-text text-transparent bg-gradient-to-r ${TIERS[player.tier as RankTier].color}`}>
                                    {TIERS[player.tier as RankTier].name}
                                </div>
                            </div>
                        </div>
                        <div className="text-right text-xs font-black text-white">{player.points}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-6 animate-in zoom-in-95 duration-500">
                {!isMinted ? (
                  <>
                    <div className="text-center space-y-3">
                        <div className="w-16 h-16 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
                            <Wallet className="w-8 h-8 text-blue-500" />
                        </div>
                        <h2 className="text-xl font-black">Claim Reward</h2>
                        <p className="text-xs text-gray-400 max-w-[240px] mx-auto">
                            Snapshots finalized. Check your status below. Minting opens Jan 16, 2:00 AM UTC.
                        </p>
                    </div>

                    <div className="space-y-2.5">
                        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${user.rank <= 1000 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                            <div className="flex items-center gap-3">
                                {user.rank <= 1000 ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                                <div>
                                    <div className="text-xs font-black">Rank Check</div>
                                    <div className="text-[10px] text-gray-500">#{user.rank} / 1000</div>
                                </div>
                            </div>
                        </div>

                        <div className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                            <div className="flex items-center gap-3">
                                {user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                                <div>
                                    <div className="text-xs font-black">Balance Check</div>
                                    <div className="text-[10px] text-gray-500">Min. $2.50 USD in Wallet</div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-1.5">
                            <div className="flex items-center gap-2 text-[8px] font-bold text-blue-400 uppercase tracking-wider">
                                <Info className="w-2.5 h-2.5" />
                                <span>Timeline Notice</span>
                            </div>
                            <p className="text-[10px] text-gray-400 leading-tight">
                                Claiming is locked until <strong className="text-white">January 16, 2026, 02:00 UTC</strong>. Please return then to mint your NFT.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleMint}
                            disabled={!isClaimable || isMinting}
                            className={`w-full py-4 rounded-2xl font-black text-lg transition-all shadow-xl relative overflow-hidden active:scale-95 ${
                                isClaimable 
                                ? 'bg-blue-600 hover:bg-blue-500 cursor-pointer' 
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            <div className="relative z-10 flex items-center justify-center gap-2">
                                {!claimTimeReached ? (
                                  'Mint Locked'
                                ) : isMinting ? (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Minting...
                                  </>
                                ) : (
                                  'Mint NFT'
                                )}
                            </div>
                        </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6 py-2 animate-in zoom-in-95 duration-700 text-center">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20" />
                        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-green-500/50 relative">
                            <PartyPopper className="w-10 h-10 text-green-500" />
                        </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <h2 className="text-2xl font-black text-white">Minted!</h2>
                      <p className="text-gray-400 text-xs px-6">Your exclusive {TIERS[currentTier].name} Badge is secured on-chain.</p>
                    </div>

                    <div className="glass-effect p-5 rounded-2xl border border-green-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-bold uppercase tracking-wider text-[8px]">TX ID</span>
                          <span className="text-blue-400 font-mono text-[9px]">
                            {txHash?.slice(0, 8)}...{txHash?.slice(-6)}
                          </span>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 font-bold uppercase tracking-wider text-[8px]">Reward</span>
                          <span className="text-white font-bold text-[10px] uppercase tracking-tighter">{TIERS[currentTier].name} Impression Badge</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                      <button 
                        onClick={() => handleShare('farcaster')}
                        className="w-full py-3.5 bg-[#8a63d2] text-white rounded-xl font-black text-sm hover:bg-[#7a52c2] transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <Share2 className="w-4 h-4" /> Share on Farcaster
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {user && (
          <div className="fixed bottom-0 left-0 right-0 glass-effect border-t border-white/10 px-6 py-4 flex items-center justify-between md:hidden z-40 bg-black/80 backdrop-blur-xl">
              <div className="flex flex-col">
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none">Global Rank</span>
                  <span className="text-xl font-black mt-1">#{user.rank}</span>
              </div>
              <div className="flex flex-col items-end">
                  <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none">Total Points</span>
                  <span className="text-xl font-black text-blue-400 mt-1">{user.points}</span>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
