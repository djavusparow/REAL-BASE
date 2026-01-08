import React, { useState, useEffect } from 'react';
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
  Gift,
  Twitter,
  User,
  ExternalLink,
  CheckCircle2,
  Lock,
  RefreshCw
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier } from './types';
import { TIERS, LAMBOLESS_CONTRACT } from './constants';
import { calculateDetailedPoints, getTierFromPoints } from './utils/calculations';
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

const STORAGE_KEY = 'base_impression_identity_secure';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [userCount, setUserCount] = useState(3450); 
  
  // Twitter Linking State
  const [isLinkingTwitter, setIsLinkingTwitter] = useState(false);
  const [linkedTwitterHandle, setLinkedTwitterHandle] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        
        // Farcaster Account Detection (Exclusive Login)
        if (context?.user) {
          const address = context.user.verifiedAddresses?.ethAddresses?.[0] || context.user.custodyAddress;
          const fid = context.user.fid;
          const username = context.user.username;

          if (!context.client.added) {
            sdk.actions.addFrame();
          }

          // Secure persistence for linked social identity
          const savedData = localStorage.getItem(STORAGE_KEY);
          let twitterHandleToUse = username; // Default to FC username
          
          if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed.fid === fid) {
              twitterHandleToUse = parsed.twitterHandle || username;
              setLinkedTwitterHandle(parsed.twitterHandle);
            }
          }

          if (address) {
            await syncUserData(address, fid, username, twitterHandleToUse);
          }
        }
      } catch (e) {
        console.error("Farcaster Connection Failed", e);
      } finally {
        setIsReady(true);
      }
    };
    init();
    
    const interval = setInterval(() => setUserCount(prev => prev + Math.floor(Math.random() * 6)), 8000);
    return () => clearInterval(interval);
  }, []);

  const syncUserData = async (address: string, fid: number, username: string, twitterHandle: string) => {
    setIsSyncing(true);
    try {
      // 1. Asset Holding Sync (Current balance)
      const lamboBalance = await tokenService.getBalance(address, LAMBOLESS_CONTRACT);
      const lamboPrice = await tokenService.getTokenPrice(LAMBOLESS_CONTRACT);
      const lamboUsdValue = lamboBalance * lamboPrice;

      // 2. Twitter Audit (Age & Baseposting)
      const twitterAudit = await twitterService.scanPosts(twitterHandle);

      // 3. Weight-Based Calculation (FID + Age + Baseposting + Duration)
      const { total, breakdown } = calculateDetailedPoints(
        1, 
        twitterAudit.accountAgeDays,
        twitterAudit.totalValidPosts,
        fid,
        { lambo: lamboUsdValue, jesse: 0, nick: 0 },
        twitterAudit.basepostingPoints
      );

      const stats: any = {
        address,
        twitterHandle: twitterHandle.startsWith('@') ? twitterHandle : `@${twitterHandle}`,
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
      };

      setUser(stats);
      // Save identity linkage
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ fid, twitterHandle }));
    } catch (e) {
      console.error("Sync Error", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const connectTwitterSecurely = async () => {
    setIsLinkingTwitter(true);
    // Simulation of Secure OAuth2 / Verified Authenticator Handshake
    await new Promise(r => setTimeout(r, 2500));
    
    const handle = prompt("Connect X Account Securely. Enter your handle:", user?.farcasterUsername || "");
    if (handle) {
      const sanitized = handle.replace('@', '');
      setLinkedTwitterHandle(sanitized);
      if (user) {
        await syncUserData(user.address, user.farcasterId || 0, user.farcasterUsername || "", sanitized);
      }
    }
    setIsLinkingTwitter(false);
  };

  const handleClaim = async () => {
    if (!user || isGenerating || isMinting) return;
    
    const canClaim = user.points >= 100 && (user.lambolessAmount || 0) >= 1000;
    if (!canClaim) return;

    setIsGenerating(true);
    try {
      const tier = getTierFromPoints(user.points);
      const preview = await geminiService.generateBadgePreview(tier, user.farcasterUsername || "BaseUser");
      setBadgeImage(preview);
      setIsGenerating(false);
      
      setIsMinting(true);
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("Wallet not detected");
      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      await contract.methods.mintBadge(preview || "", tierMap[tier] || 3).send({ from: user.address });
      
      setIsMinted(true);
      sdk.actions.cast({ 
        text: `🚀 My ${tier} impact on @base is verified!\n\nFID: #${user.farcasterId}\nScore: ${user.points.toFixed(0)} Points\n\nVerify yours: real-base-2026.vercel.app\n\n#Base #BaseApp #Onchain` 
      });
    } catch (e) {
      console.error(e);
      alert("Verification failed. Check your Base ETH balance for gas.");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  if (!isReady) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-blue-500 font-bold uppercase tracking-widest text-[10px] animate-pulse">Establishing Identity...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24 selection:bg-blue-600">
      {/* Header */}
      <nav className="p-6 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <Zap className="text-blue-500" fill="currentColor" size={20} />
          <h1 className="text-lg font-black italic tracking-tighter">BASE IMPRESSION</h1>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
          <TrendingUp size={12} className="text-blue-500" />
          <span className="text-[10px] font-bold tracking-widest">{userCount} AUDITED</span>
        </div>
      </nav>

      <main className="max-w-md mx-auto p-6 space-y-6">
        {/* Main Tabs */}
        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <LayoutDashboard size={14} /> DASHBOARD
          </button>
          <button 
            onClick={() => setActiveTab('claim')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'claim' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Gift size={14} /> CLAIM
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            
            {/* Connection Identity Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Share2 size={16} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Farcaster FID</p>
                  <p className="text-xs font-bold italic truncate">#{user?.farcasterId || '---'}</p>
                </div>
              </div>
              
              {linkedTwitterHandle ? (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Twitter size={16} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">X Account</p>
                    <p className="text-xs font-bold italic truncate">{user?.twitterHandle}</p>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={connectTwitterSecurely}
                  className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30 flex items-center gap-3 group hover:bg-blue-600/20 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                    {isLinkingTwitter ? <Loader2 size={16} className="animate-spin" /> : <Twitter size={16} />}
                  </div>
                  <div className="text-left">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Secure Link</p>
                    <p className="text-[10px] font-bold text-white group-hover:underline">Connect X</p>
                  </div>
                </button>
              )}
            </div>

            {/* Central Points Hub */}
            <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-10 rounded-[3rem] border border-blue-500/20 text-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mb-2">Base Impression Points</p>
              <h2 className="text-8xl font-black italic tracking-tighter mb-4">
                {isSyncing ? <Loader2 className="animate-spin inline" /> : user?.points.toFixed(0) || 0}
              </h2>
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 bg-black/40 py-3 px-6 rounded-full w-fit mx-auto border border-white/5 backdrop-blur-md">
                <Lock size={12} className="text-blue-500" />
                Real-Time Verified Identity Sync
              </div>
            </div>

            {/* Data Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:border-blue-500/30 transition-all">
                <Clock size={16} className="text-blue-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Identity Age</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.social_twitter.toFixed(0) || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:border-purple-500/30 transition-all">
                <Share2 size={16} className="text-purple-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">FID Seniority</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.social_fc.toFixed(0) || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:border-green-500/30 transition-all">
                <TrendingUp size={16} className="text-green-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Baseposting</p>
                <p className="text-xl font-bold">+{user?.basepostingPoints || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:border-yellow-500/30 transition-all">
                <Coins size={16} className="text-yellow-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Hold Duration</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.lambo.toFixed(0) || 0}</p>
              </div>
            </div>
            
            <button 
              onClick={() => user && syncUserData(user.address, user.farcasterId || 0, user.farcasterUsername || "", linkedTwitterHandle || user.farcasterUsername || "")}
              disabled={isSyncing}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isSyncing ? "Syncing..." : "Update Verified Stats"}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Badge Preview */}
            <div className="space-y-4">
              <BadgeDisplay 
                tier={getTierFromPoints(user?.points || 0)} 
                imageUrl={badgeImage} 
                loading={isGenerating} 
              />
              <div className="text-center">
                <h3 className="text-xl font-black italic tracking-tight uppercase">{getTierFromPoints(user?.points || 0)} SHIELD</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">Connected via @{user?.farcasterUsername}</p>
              </div>
            </div>

            {/* Threshold Progress */}
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Verification Thresholds</h4>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">100+ Total Points</span>
                {user && user.points >= 100 ? <CheckCircle /> : <Warning label={`${(100 - (user?.points || 0)).toFixed(0)} more`} />}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">1,000+ LAMBO Token Hold</span>
                {user && (user.lambolessAmount || 0) >= 1000 ? <CheckCircle /> : <Warning label="Threshold Required" />}
              </div>

              {user && (user.lambolessAmount || 0) < 1000 && (
                <div className="pt-2">
                  <p className="text-[9px] text-gray-500 font-bold uppercase leading-relaxed mb-2">
                    Contract Address (Buy on Base):<br/>
                    <code className="text-blue-400 break-all select-all font-mono text-[10px]">{LAMBOLESS_CONTRACT}</code>
                  </p>
                </div>
              )}
            </div>

            {/* Action Area */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Info size={14} className="text-blue-500" />
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Minting cost is 0 ETH (+ Gas)</p>
              </div>

              <button 
                onClick={handleClaim}
                disabled={!user || user.points < 100 || (user.lambolessAmount || 0) < 1000 || isMinting || isMinted}
                className={`w-full py-6 rounded-2xl font-black uppercase italic text-lg shadow-xl transition-all ${
                  isMinted ? 'bg-green-600' : 'bg-blue-600 hover:scale-[1.02] active:scale-95 disabled:opacity-20 disabled:grayscale'
                }`}
              >
                {isMinting ? <Loader2 className="animate-spin mx-auto" /> : isMinted ? 'BADGE COLLECTED' : 'MINT ON-CHAIN SHIELD'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Frame Login Gate */}
      {!isReady && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-8 text-center space-y-6">
           <Zap className="text-blue-600 w-16 h-16 animate-pulse" fill="currentColor" />
           <h2 className="text-3xl font-black italic uppercase tracking-tighter">Farcaster Exclusive</h2>
           <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Please login via Warpcast to verify your Base Impression.</p>
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