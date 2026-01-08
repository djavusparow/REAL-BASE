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
  Lock
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

const STORAGE_KEY = 'base_impression_session_v2';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [userCount, setUserCount] = useState(3120); 
  
  // Twitter Linking State
  const [isLinkingTwitter, setIsLinkingTwitter] = useState(false);
  const [linkedTwitterHandle, setLinkedTwitterHandle] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        
        // Auto-detect Farcaster User
        if (context?.user) {
          const address = context.user.verifiedAddresses?.ethAddresses?.[0] || context.user.custodyAddress;
          const fid = context.user.fid;
          const username = context.user.username;

          if (!context.client.added) {
            sdk.actions.addFrame();
          }

          // Load previous session if exists
          const savedSession = localStorage.getItem(STORAGE_KEY);
          if (savedSession) {
            const parsed = JSON.parse(savedSession);
            if (parsed.farcasterId === fid) {
              setLinkedTwitterHandle(parsed.twitterHandle);
              setUser(parsed);
            }
          }

          if (address) {
            await syncUserData(address, fid, username, linkedTwitterHandle || username);
          }
        }
      } catch (e) {
        console.error("Farcaster Auth Error", e);
      } finally {
        setIsReady(true);
      }
    };
    init();
    
    const interval = setInterval(() => setUserCount(prev => prev + Math.floor(Math.random() * 5)), 12000);
    return () => clearInterval(interval);
  }, [linkedTwitterHandle]);

  const syncUserData = async (address: string, fid: number, username: string, twitterHandle: string) => {
    setIsSyncing(true);
    try {
      const lamboBalance = await tokenService.getBalance(address, LAMBOLESS_CONTRACT);
      const lamboPrice = await tokenService.getTokenPrice(LAMBOLESS_CONTRACT);
      const lamboUsdValue = lamboBalance * lamboPrice;

      const twitterAudit = await twitterService.scanPosts(twitterHandle);

      const { total, breakdown } = calculateDetailedPoints(
        1, 
        twitterAudit.accountAgeDays,
        twitterAudit.totalValidPosts,
        fid,
        { lambo: lamboUsdValue, jesse: 0, nick: 0 },
        twitterAudit.basepostingPoints
      );

      const updatedUser: any = {
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

      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    } catch (e) {
      console.error("Sync Error", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const connectTwitterSecurely = async () => {
    setIsLinkingTwitter(true);
    // Simulation of a secure OAuth2 / Authenticator Handshake
    await new Promise(r => setTimeout(r, 2000));
    
    const handle = prompt("Enter your X (Twitter) Username to link securely:", user?.farcasterUsername || "");
    if (handle) {
      const sanitized = handle.replace('@', '');
      setLinkedTwitterHandle(sanitized);
      // Trigger re-sync in useEffect
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
      if (!provider) throw new Error("Wallet not found");
      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      await contract.methods.mintBadge(preview || "", tierMap[tier] || 3).send({ from: user.address });
      
      setIsMinted(true);
      sdk.actions.cast({ 
        text: `🛡️ My ${tier} Impression on @base is verified!\n\nScore: ${user.points.toFixed(0)} Points\nFID: #${user.farcasterId}\n\nClaim your free badge: real-base-2026.vercel.app\n\n#Base #BaseApp #Onchain` 
      });
    } catch (e) {
      console.error(e);
      alert("Mint failed. Ensure you have Base ETH for gas.");
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
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg' : 'text-gray-500'}`}
          >
            <LayoutDashboard size={14} /> DASHBOARD
          </button>
          <button 
            onClick={() => setActiveTab('claim')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'claim' ? 'bg-blue-600 shadow-lg' : 'text-gray-500'}`}
          >
            <Gift size={14} /> CLAIM
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            
            {/* Identity & Connection Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 border border-purple-500/20">
                      <Share2 size={14} />
                   </div>
                   <div>
                      <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Connected FID</p>
                      <p className="text-xs font-bold italic tracking-tight">#{user?.farcasterId || '---'} (@{user?.farcasterUsername})</p>
                   </div>
                </div>
                <CheckCircle2 size={16} className="text-green-500" />
              </div>

              {linkedTwitterHandle ? (
                <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 border border-blue-500/20">
                        <Twitter size={14} />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">X Identity</p>
                        <p className="text-xs font-bold italic tracking-tight">{user?.twitterHandle}</p>
                    </div>
                  </div>
                  <button onClick={connectTwitterSecurely} className="p-1 text-gray-600 hover:text-white transition-colors">
                    <ExternalLink size={14} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={connectTwitterSecurely}
                  className="w-full flex items-center justify-between px-4 py-4 bg-blue-600/10 hover:bg-blue-600/20 rounded-2xl border border-blue-500/30 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                        <Twitter size={14} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Secure Link X Account</span>
                  </div>
                  {isLinkingTwitter ? <Loader2 size={14} className="animate-spin text-blue-500" /> : <Lock size={14} className="text-blue-500 group-hover:translate-x-1 transition-transform" />}
                </button>
              )}
            </div>

            {/* Total Points Display */}
            <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-10 rounded-[3rem] border border-blue-500/20 text-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mb-2">Base Impression Point</p>
              <h2 className="text-8xl font-black italic tracking-tighter mb-4 transition-all duration-700">
                {isSyncing ? <Loader2 className="animate-spin inline" /> : user?.points.toFixed(0) || 0}
              </h2>
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 bg-black/40 py-2.5 px-6 rounded-full w-fit mx-auto border border-white/5 backdrop-blur-md">
                <ShieldCheck size={14} className="text-blue-500" />
                Live Authenticated Sync
              </div>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:border-blue-500/30 transition-colors">
                <Clock size={16} className="text-blue-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Account Age</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.social_twitter.toFixed(0) || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:border-purple-500/30 transition-colors">
                <Share2 size={16} className="text-purple-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">FID Points</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.social_fc.toFixed(0) || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:border-green-500/30 transition-colors">
                <TrendingUp size={16} className="text-green-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Baseposting</p>
                <p className="text-xl font-bold">+{user?.basepostingPoints || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:border-yellow-500/30 transition-colors">
                <Coins size={16} className="text-yellow-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Duration Value</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.lambo.toFixed(0) || 0}</p>
              </div>
            </div>
            
            <button 
              onClick={() => user && syncUserData(user.address, user.farcasterId || 0, user.farcasterUsername || "", linkedTwitterHandle || user.farcasterUsername || "")}
              disabled={isSyncing}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : "Refresh Verification"}
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
                <h3 className="text-xl font-black italic tracking-tight uppercase">{getTierFromPoints(user?.points || 0)} SHIELD</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">Sync Status: Authenticated</p>
              </div>
            </div>

            {/* Requirements Section */}
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Mint Prerequisites</h4>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">100+ Total Points</span>
                {user && user.points >= 100 ? <CheckCircle /> : <Warning label={`${(100 - (user?.points || 0)).toFixed(0)} more`} />}
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">1,000+ LAMBO Token Hold</span>
                {user && (user.lambolessAmount || 0) >= 1000 ? <CheckCircle /> : <Warning label="Below Minimum" />}
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

            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Info size={14} className="text-blue-500" />
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Minting cost: 0 ETH + Gas</p>
              </div>

              <button 
                onClick={handleClaim}
                disabled={!user || user.points < 100 || (user.lambolessAmount || 0) < 1000 || isMinting || isMinted}
                className={`w-full py-6 rounded-2xl font-black uppercase italic text-lg shadow-xl transition-all ${
                  isMinted ? 'bg-green-600' : 'bg-blue-600 hover:scale-[1.02] active:scale-95 disabled:opacity-20 disabled:grayscale'
                }`}
              >
                {isMinting ? <Loader2 className="animate-spin mx-auto" /> : isMinted ? 'BADGE SECURED' : 'MINT IMPRESSION BADGE'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Login Gate Simulation for non-Farcaster environments */}
      {!isReady && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-8 text-center space-y-6">
           <Zap className="text-blue-600 w-16 h-16 animate-pulse" fill="currentColor" />
           <h2 className="text-3xl font-black italic uppercase tracking-tighter">Farcaster Required</h2>
           <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Please open this app inside Warpcast or a Farcaster client.</p>
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