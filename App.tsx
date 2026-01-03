
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
  PartyPopper
} from 'lucide-react';
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
      {/* Lamborghini Background Image */}
      <img 
        src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&q=80&w=400" 
        alt="Lambo" 
        className="absolute inset-0 w-full h-full object-cover brightness-50 group-hover:scale-110 transition-transform duration-700"
      />
      {/* Overlay for contrast */}
      <div className="absolute inset-0 bg-blue-900/40 mix-blend-multiply" />
      {/* Content */}
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
  
  // Minting states
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Simulation: Connect wallet/Twitter
  const handleConnect = async () => {
    setLoading(true);
    // Mimic API delay
    await new Promise(r => setTimeout(r, 1500));
    
    // Create random-ish user data for the demo
    const baseAge = 45;
    const twitterAge = 800;
    const tweets = 42;
    const points = calculatePoints(baseAge, twitterAge, tweets);
    const rank = 420; // Simulated rank

    setUser({
      address: "0x742d...444",
      twitterHandle: "@base_maxi",
      baseAppAgeDays: baseAge,
      twitterAgeDays: twitterAge,
      validTweetsCount: tweets,
      lambolessBalance: 3.50, // Above $2.5 req
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
    // Simulate transaction on Base network
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
    
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
      farcaster: `https://warpcast.com/~/compose?text=${encodedText}`
    };

    window.open(urls[platform], '_blank');
  };

  const isClaimable = useMemo(() => {
    if (!user) return false;
    const now = new Date();
    return (
      now >= CLAIM_START &&
      user.rank <= 1000 && 
      user.lambolessBalance >= MIN_TOKEN_VALUE_USD
    );
  }, [user]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-effect border-b border-white/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <BrandIcon size="sm" />
          <div>
            <h1 className="font-black text-lg tracking-tighter uppercase leading-none">Base Impression</h1>
            <span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase opacity-80">Season 1 Snapshot</span>
          </div>
        </div>
        
        {user ? (
          <div className="flex items-center gap-3 glass-effect px-4 py-2 rounded-full border border-blue-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-mono font-bold text-gray-300">{user.address}</span>
          </div>
        ) : (
          <button 
            onClick={handleConnect}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] active:scale-95"
          >
            {loading ? 'Connecting...' : 'Connect BaseApp'}
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 pb-32">
        
        {/* Timers Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Countdown targetDate={SNAPSHOT_END} label="Snapshot End" />
          <Countdown targetDate={CLAIM_START} label="Claim Opens" />
        </div>

        {!user ? (
          <div className="text-center py-20 space-y-8">
            <div className="relative inline-block">
                <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20" />
                <BrandIcon size="lg" />
            </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-black tracking-tight">Prove Your Impact.</h2>
              <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
                Connect your BaseApp account to calculate points from your Twitter contributions. 
                Top 1000 members earn exclusive on-chain badges.
              </p>
            </div>
            <button 
              onClick={handleConnect}
              className="px-8 py-4 bg-white text-black rounded-2xl font-black text-lg hover:bg-blue-50 transition-all flex items-center gap-3 mx-auto shadow-2xl"
            >
              Get Started <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Tabs */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                {(['dashboard', 'leaderboard', 'claim'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all ${
                            activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-3xl border border-blue-500/20">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Total Points</span>
                    <div className="text-4xl font-black text-white mt-1">{user.points}</div>
                    <div className="mt-2 text-[10px] text-green-400 font-bold bg-green-400/10 px-2 py-0.5 rounded-full inline-block">
                        ↑ LIVE UPDATING
                    </div>
                  </div>
                  <div className="glass-effect p-6 rounded-3xl border border-purple-500/20">
                    <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Current Rank</span>
                    <div className="text-4xl font-black text-white mt-1">#{user.rank}</div>
                    <div className="mt-2 text-[10px] text-purple-400 font-bold bg-purple-400/10 px-2 py-0.5 rounded-full inline-block">
                        {user.rank <= 1000 ? 'ELIGIBLE' : 'NOT ELIGIBLE'}
                    </div>
                  </div>
                </div>

                {/* Badge Visualizer */}
                <div className="glass-effect p-8 rounded-[2.5rem] border border-white/10 text-center space-y-8">
                   <BadgeDisplay 
                    tier={currentTier} 
                    imageUrl={badgeImage} 
                    loading={isGenerating} 
                   />

                   {analysis && (
                     <p className="text-sm italic text-gray-400 leading-relaxed px-4">
                        "{analysis}"
                     </p>                   )}

                   <div className="grid grid-cols-1 gap-3">
                     <button 
                        onClick={handleCheckpoint}
                        disabled={isGenerating}
                        className="w-full py-4 bg-white text-black rounded-2xl font-black hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                      >
                        <ShieldCheck className="w-5 h-5" />
                        {isGenerating ? 'Analyzing...' : 'Checkpoint (Update Rank)'}
                      </button>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleShare('twitter')}
                          className="flex-1 py-3 bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 text-[#1DA1F2] border border-[#1DA1F2]/30 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          <Twitter className="w-4 h-4" /> Share to X
                        </button>
                        <button 
                          onClick={() => handleShare('farcaster')}
                          className="flex-1 py-3 bg-[#8a63d2]/10 hover:bg-[#8a63d2]/20 text-[#8a63d2] border border-[#8a63d2]/30 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2"
                        >
                          <Share2 className="w-4 h-4" /> Farcaster
                        </button>
                      </div>
                      
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">
                        Last checked: {new Date().toLocaleTimeString()}
                      </p>
                   </div>
                </div>

                {/* Stats Detail */}
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">Contribution Metrics</h3>
                    <div className="space-y-2">
                        {[
                            { icon: <Target className="w-4 h-4" />, label: "BaseApp Account Age", val: `${user.baseAppAgeDays} Days`, weight: "20%" },
                            { icon: <Twitter className="w-4 h-4" />, label: "Twitter Connected Age", val: `${user.twitterAgeDays} Days`, weight: "30%" },
                            { icon: <Zap className="w-4 h-4" />, label: "Valid Tagged Tweets", val: user.validTweetsCount, weight: "50%" },
                        ].map((stat, i) => (
                            <div key={i} className="flex items-center justify-between p-4 glass-effect rounded-2xl border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="text-blue-500">{stat.icon}</div>
                                    <span className="text-sm font-bold text-gray-300">{stat.label}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black">{stat.val}</div>
                                    <div className="text-[10px] text-gray-500 font-bold">{stat.weight} weight</div>
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
                    <h2 className="text-xl font-black">Top Contributors</h2>
                    <span className="text-xs text-gray-500 font-bold">Snapshot Period: Nov 1 - Jan 15</span>
                </div>
                
                <div className="space-y-2">
                  {/* Your position row */}
                  <div className="p-4 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-xl font-black text-blue-400">#{user.rank}</span>
                        <div>
                            <div className="text-sm font-black text-white">YOU ({user.twitterHandle})</div>
                            <div className="text-[10px] font-bold text-blue-400 uppercase">{TIERS[currentTier].name} TIER</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-black text-white">{user.points}</div>
                    </div>
                  </div>

                  {/* Other players */}
                  {MOCKED_LEADERBOARD.map((player) => (
                    <div key={player.rank} className="p-4 glass-effect border border-white/5 rounded-2xl flex items-center justify-between opacity-80 hover:opacity-100 transition-all">
                        <div className="flex items-center gap-4">
                            <span className="text-lg font-black text-gray-500">#{player.rank}</span>
                            <div>
                                <div className="text-sm font-black text-gray-200">{player.handle}</div>
                                <div className={`text-[10px] font-bold uppercase bg-clip-text text-transparent bg-gradient-to-r ${TIERS[player.tier].color}`}>
                                    {TIERS[player.tier].name} TIER
                                </div>
                            </div>
                        </div>
                        <div className="text-right text-sm font-black text-white">{player.points}</div>
                    </div>
                  ))}
                </div>
                
                <div className="text-center py-4">
                    <p className="text-xs text-gray-500">Only the top 1000 contributors are eligible for badges.</p>
                </div>
              </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-8 animate-in zoom-in-95 duration-500">
                {!isMinted ? (
                  <>
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
                            <Wallet className="w-10 h-10 text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-black">Claim Your Badge</h2>
                        <p className="text-sm text-gray-400 max-w-sm mx-auto">
                            Snapshots lock on January 16, 2026 at 00:01 UTC.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            Requirements
                            <div className="h-px flex-1 bg-white/5" />
                        </h3>
                        
                        <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all ${user.rank <= 1000 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                            <div className="flex items-center gap-3">
                                {user.rank <= 1000 ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <AlertCircle className="w-6 h-6 text-red-500" />}
                                <div>
                                    <div className="text-sm font-black">Rank Requirement</div>
                                    <div className="text-xs text-gray-500">Rank #1-1000 (Current: #{user.rank})</div>
                                </div>
                            </div>
                            <span className={`text-xs font-black uppercase ${user.rank <= 1000 ? 'text-green-500' : 'text-red-500'}`}>
                                {user.rank <= 1000 ? 'Pass' : 'Fail'}
                            </span>
                        </div>

                        <div className={`p-5 rounded-3xl border flex items-center justify-between transition-all ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                            <div className="flex items-center gap-3">
                                {user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <AlertCircle className="w-6 h-6 text-red-500" />}
                                <div>
                                    <div className="text-sm font-black">$LAMBOLESS Balance</div>
                                    <div className="text-xs text-gray-500">Min. ${MIN_TOKEN_VALUE_USD.toFixed(2)} Value in Wallet</div>
                                </div>
                            </div>
                            <span className={`text-xs font-black uppercase ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'text-green-500' : 'text-red-500'}`}>
                                {user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'Pass' : 'Fail'}
                            </span>
                        </div>

                        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                                <Info className="w-3 h-3" />
                                <span>Fees Notice</span>
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Badge claims are free and only subject to standard <strong className="text-white">Base network transaction fees</strong> (gas).
                            </p>
                            <div className="pt-2 font-mono text-[9px] text-gray-600 truncate">
                                Contract: {TOKEN_CONTRACT}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button 
                            onClick={handleMint}
                            disabled={!isClaimable || isMinting}
                            className={`w-full py-5 rounded-[2rem] font-black text-xl transition-all shadow-2xl relative overflow-hidden group ${
                                isClaimable 
                                ? 'bg-blue-600 hover:bg-blue-500 active:scale-95 cursor-pointer' 
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            <div className="relative z-10 flex items-center justify-center gap-3">
                                {new Date() < CLAIM_START ? (
                                  'Claim Locked'
                                ) : isMinting ? (
                                  <>
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    Minting on Base...
                                  </>
                                ) : (
                                  'Mint NFT Badge'
                                )}
                            </div>
                            {isClaimable && !isMinting && (
                                 <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            )}
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                        Available on January 16, 2026 @ 02:00 UTC
                    </p>
                  </>
                ) : (
                  <div className="space-y-8 py-4 animate-in zoom-in-95 duration-700 text-center">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20" />
                        <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-green-500/50 relative">
                            <PartyPopper className="w-12 h-12 text-green-500" />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h2 className="text-3xl font-black text-white">Mint Successful!</h2>
                      <p className="text-gray-400 text-sm">Your {TIERS[currentTier].name} Badge is now live on the Base network.</p>
                    </div>

                    <div className="glass-effect p-6 rounded-3xl border border-green-500/20 space-y-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Transaction</span>
                          <a 
                            href={`https://basescan.org/tx/${txHash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 flex items-center gap-1 font-mono text-[10px] hover:underline"
                          >
                            {txHash?.slice(0, 10)}...{txHash?.slice(-8)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="h-px bg-white/5" />
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 font-bold uppercase tracking-wider text-[10px]">Asset</span>
                          <span className="text-white font-bold text-xs">Base Impression S1: {TIERS[currentTier].name}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                      <button 
                        onClick={() => handleShare('twitter')}
                        className="w-full py-4 bg-[#1DA1F2] text-white rounded-2xl font-black hover:bg-[#1a91da] transition-all flex items-center justify-center gap-2"
                      >
                        <Twitter className="w-5 h-5" /> Share Mint on X
                      </button>
                      <button 
                        onClick={() => handleShare('farcaster')}
                        className="w-full py-4 bg-[#8a63d2] text-white rounded-2xl font-black hover:bg-[#7a52c2] transition-all flex items-center justify-center gap-2"
                      >
                        <Share2 className="w-5 h-5" /> Cast to Farcaster
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Persistent Footer Stats (Mobile Style) */}
      {user && (
          <div className="fixed bottom-0 left-0 right-0 glass-effect border-t border-white/10 px-6 py-4 flex items-center justify-between md:hidden z-40">
              <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Rank</span>
                  <span className="text-xl font-black">#{user.rank}</span>
              </div>
              <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Points</span>
                  <span className="text-xl font-black text-blue-400">{user.points}</span>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
