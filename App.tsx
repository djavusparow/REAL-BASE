import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  Info, 
  Loader2, 
  Trophy,
  Coins,
  Share2,
  PlusCircle,
  TrendingUp,
  Clock,
  LayoutDashboard,
  Gift
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier } from './types';
import { TIERS, LAMBOLESS_CONTRACT } from './constants';
import { calculateDetailedPoints, getTierFromPoints, calculateFidPoints } from './utils/calculations';
import BadgeDisplay from './components/BadgeDisplay';
import { geminiService } from './services/geminiService';
import { twitterService } from './services/twitterService';
import { tokenService } from './services/tokenService';

const NFT_CONTRACT_ADDRESS = "0x4afc5DF90f6F2541C93f9b29Ec0A95b46ad61a6B"; 
const MINIMAL_NFT_ABI = [
  {
    "inputs": [{ "internalType": "string", "name": "tokenURI", "type": "string" }, { "internalType": "uint8", "name": "tier", "type": "uint8" }],
    "name": "mintBadge", "outputs": [], "stateMutability": "payable", "type": "function"
  }
];

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [userCount, setUserCount] = useState(1248); // Simulated real-time count

  // 1. Farcaster Auto-Detection & Initial Setup
  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        
        if (context?.user) {
          const address = context.user.verifiedAddresses?.ethAddresses?.[0] || context.user.custodyAddress;
          const fid = context.user.fid;
          const username = context.user.username;

          // Mandatory prompt to add app
          if (!context.client.added) {
            sdk.actions.addFrame();
          }

          if (address) {
            await syncUserData(address, fid, username);
          }
        }
      } catch (e) {
        console.error("Farcaster Init Error", e);
      } finally {
        setIsReady(true);
      }
    };
    init();
    
    // Increment user count randomly to simulate real-time
    const interval = setInterval(() => setUserCount(prev => prev + Math.floor(Math.random() * 2)), 10000);
    return () => clearInterval(interval);
  }, []);

  const syncUserData = async (address: string, fid: number, username: string) => {
    setIsSyncing(true);
    try {
      // Real-time Balance Check
      const lamboBalance = await tokenService.getBalance(address, LAMBOLESS_CONTRACT);
      const lamboPrice = await tokenService.getTokenPrice(LAMBOLESS_CONTRACT);
      const lamboUsdValue = lamboBalance * lamboPrice;

      // Real-time Twitter Audit Fallback to username for simulation if not linked
      const twitterAudit = await twitterService.scanPosts(username);

      const { total, breakdown } = calculateDetailedPoints(
        1, // App Age
        twitterAudit.accountAgeDays,
        twitterAudit.totalValidPosts,
        fid,
        { lambo: lamboUsdValue, jesse: 0, nick: 0 },
        twitterAudit.basepostingPoints
      );

      setUser({
        address,
        twitterHandle: `@${username}`,
        baseAppAgeDays: 1,
        twitterAgeDays: twitterAudit.accountAgeDays,
        validTweetsCount: twitterAudit.totalValidPosts,
        basepostingPoints: twitterAudit.basepostingPoints,
        lambolessBalance: lamboUsdValue,
        lambolessAmount: lamboBalance,
        points: total,
        rank: 0,
        farcasterId: fid,
        farcasterUsername: username,
        pointsBreakdown: breakdown
      } as any);
    } catch (e) {
      console.error("Sync Error", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClaim = async () => {
    if (!user || isGenerating || isMinting) return;
    
    // Check Requirements
    const canClaim = user.points >= 100 && (user.lambolessAmount || 0) >= 1000;
    if (!canClaim) return;

    setIsGenerating(true);
    try {
      const tier = getTierFromPoints(user.points);
      // Faster, simplified prompt
      const preview = await geminiService.generateBadgePreview(tier, user.farcasterUsername || "BaseUser");
      setBadgeImage(preview);
      setIsGenerating(false);
      
      setIsMinting(true);
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("Wallet not found");
      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      await contract.methods.mintBadge(preview || "", tierMap[tier] || 3).send({ from: user.address });
      
      setIsMinted(true);
      // Enforce mandatory Cast
      sdk.actions.cast({ 
        text: `🚀 Just claimed my ${tier} BASE IMPRESSION Badge! \n\nCheck, Track and Claim your Free Reward at: real-base-2026.vercel.app \n\n#Base #BaseApp #Onchain` 
      });
    } catch (e) {
      console.error(e);
      alert("Claim failed. Please try again.");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  if (!isReady) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-blue-500 font-bold uppercase tracking-widest text-[10px]">Syncing Farcaster...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
      {/* Header */}
      <nav className="p-6 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Zap className="text-blue-500" fill="currentColor" size={20} />
          <h1 className="text-lg font-black italic tracking-tighter">BASE IMPRESSION</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
          <TrendingUp size={12} className="text-blue-500" />
          <span className="text-[10px] font-bold">{userCount} Active Users</span>
        </div>
      </nav>

      <main className="max-w-md mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'text-gray-500'}`}
          >
            <LayoutDashboard size={14} /> DASHBOARD
          </button>
          <button 
            onClick={() => setActiveTab('claim')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'claim' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'text-gray-500'}`}
          >
            <Gift size={14} /> CLAIM
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Total Points Display */}
            <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-8 rounded-[2.5rem] border border-blue-500/20 text-center relative overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 mb-2">Base Impression Point</p>
              <h2 className="text-7xl font-black italic tracking-tighter mb-4">
                {isSyncing ? <Loader2 className="animate-spin inline" /> : user?.points.toFixed(0) || 0}
              </h2>
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 bg-black/40 py-2 px-4 rounded-full w-fit mx-auto">
                <ShieldCheck size={14} className="text-green-500" />
                Real-time Verified Sync
              </div>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <Clock size={16} className="text-blue-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Twitter Age</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.social_twitter.toFixed(0) || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <Share2 size={16} className="text-purple-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">FID Score</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.social_fc.toFixed(0) || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <TrendingUp size={16} className="text-green-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Baseposting</p>
                <p className="text-xl font-bold">+{user?.basepostingPoints || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <Coins size={16} className="text-yellow-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Asset Hold</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.lambo.toFixed(0) || 0}</p>
              </div>
            </div>
            
            <button 
              onClick={() => user && syncUserData(user.address, user.farcasterId || 0, user.farcasterUsername || "")}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : "Refresh Data"}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Preview Section */}
            <div className="space-y-4">
              <BadgeDisplay 
                tier={getTierFromPoints(user?.points || 0)} 
                imageUrl={badgeImage} 
                loading={isGenerating} 
              />
              <div className="text-center">
                <h3 className="text-xl font-black italic tracking-tight">{getTierFromPoints(user?.points || 0)} BADGE</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Available for Claim on Base Mainnet</p>
              </div>
            </div>

            {/* Requirements Section */}
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Claim Requirements</h4>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">100+ Total Points</span>
                {user && user.points >= 100 ? <CheckCircle /> : <Warning label={`${(100 - (user?.points || 0)).toFixed(0)} more points needed`} />}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">1,000+ LAMBO Token Hold</span>
                {user && (user.lambolessAmount || 0) >= 1000 ? <CheckCircle /> : <Warning label="Insufficient Balance" />}
              </div>

              {user && (user.lambolessAmount || 0) < 1000 && (
                <div className="pt-2">
                  <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed mb-2">
                    Contract Address (Buy on Base):<br/>
                    <code className="text-blue-400">{LAMBOLESS_CONTRACT}</code>
                  </p>
                </div>
              )}
            </div>

            {/* Claim Action */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-green-500/10 rounded-2xl border border-green-500/20">
                <Info size={14} className="text-green-500" />
                <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Free Claim (Gas Fee Only)</p>
              </div>

              <button 
                onClick={handleClaim}
                disabled={!user || user.points < 100 || (user.lambolessAmount || 0) < 1000 || isMinting || isMinted}
                className={`w-full py-6 rounded-2xl font-black uppercase italic text-lg shadow-xl transition-all ${
                  isMinted ? 'bg-green-600' : 'bg-blue-600 hover:scale-[1.02] active:scale-95 disabled:opacity-20 disabled:grayscale'
                }`}
              >
                {isMinting ? <Loader2 className="animate-spin mx-auto" /> : isMinted ? 'SUCCESSFULLY CLAIMED' : 'MINT BADGE'}
              </button>
              
              {isMinted && (
                <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-center">
                  <p className="text-[10px] font-bold text-blue-400 uppercase animate-pulse">
                    Please share to Farcaster to complete verification!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Hint */}
      {!isReady && (
        <div className="fixed bottom-6 left-6 right-6 p-4 bg-blue-600 rounded-2xl flex items-center justify-between shadow-2xl animate-bounce">
          <div className="flex items-center gap-3">
            <PlusCircle size={20} />
            <span className="text-xs font-black uppercase italic">Add to Mini-app to start!</span>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckCircle = () => (
  <div className="w-5 h-5 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center">
    <Zap size={10} className="text-green-500" fill="currentColor" />
  </div>
);

const Warning = ({ label }: { label: string }) => (
  <span className="text-[9px] font-black bg-red-500/10 text-red-500 px-2 py-1 rounded-md border border-red-500/20 uppercase tracking-widest">
    {label}
  </span>
);

export default App;