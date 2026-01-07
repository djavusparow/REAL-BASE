
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Twitter, 
  Wallet, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Info, 
  Share2, 
  Loader2, 
  X,
  ArrowRight,
  LogOut,
  Trophy,
  Award,
  Lock,
  RefreshCw,
  Cpu,
  Flame,
  Ban,
  Sparkles,
  Send,
  UserCheck,
  Search
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier } from './types.ts';
import { 
  TIERS, 
  LAMBOLESS_CONTRACT,
  NICK_CONTRACT,
  JESSE_CONTRACT,
  HOURLY_WINDOW_START,
  HOURLY_WINDOW_END
} from './constants.ts';
import { calculateDetailedPoints, getTierFromPoints } from './utils/calculations.ts';
import BadgeDisplay from './components/BadgeDisplay.tsx';
import { geminiService } from './services/geminiService.ts';
import { twitterService } from './services/twitterService.ts';
import { tokenService } from './services/tokenService.ts';

const STORAGE_KEY_USER = 'base_impression_v1_user';
const STORAGE_KEY_AUDIT_COUNT = 'base_impression_v1_count';

const BrandLogo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'sm' }) => {
  const dimensions = size === 'lg' ? 'w-40 h-40' : 'w-10 h-10';
  const radius = size === 'lg' ? 'rounded-[2.5rem]' : 'rounded-xl';
  
  return (
    <div className={`${dimensions} ${radius} relative overflow-hidden border border-white/20 blue-glow`}>
      <img 
        src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&q=80&w=400" 
        className="absolute inset-0 w-full h-full object-cover brightness-75"
        alt="Base"
      />
      <div className="absolute inset-0 bg-blue-600/30 mix-blend-overlay" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${size === 'lg' ? 'text-lg' : 'text-[7px]'} font-black text-white uppercase italic leading-none text-center`}>
          Base<br/>Impression
        </span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<UserStats | null>(null);
  const [farcasterContext, setFarcasterContext] = useState<any>(null);
  
  const [address, setAddress] = useState('');
  const [handle, setHandle] = useState('');
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);
  const [isTwitterVerified, setIsTwitterVerified] = useState(false);
  const [isSyncingFID, setIsSyncingFID] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

  const [communityAuditCount, setCommunityAuditCount] = useState(1);

  const getFarcasterAddress = useCallback((ctx: any) => {
    if (!ctx) return null;
    if (ctx.address) return ctx.address;
    if (ctx.user?.address) return ctx.user.address;
    if (ctx.user?.custodyAddress) return ctx.user.custodyAddress;
    if (ctx.user?.verifiedAddresses && ctx.user.verifiedAddresses.length > 0) {
      return ctx.user.verifiedAddresses[0];
    }
    return null;
  }, []);

  const loadUserDataFromStorage = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY_USER);
    if (saved) {
      try {
        const data = JSON.parse(saved) as UserStats;
        setUser(data);
        if (data.twitterHandle) { 
          setHandle(data.twitterHandle); 
          setIsTwitterVerified(true); 
        }
        if (data.address) { 
          setAddress(data.address); 
          setIsSignatureVerified(true); 
        }
      } catch (e) { 
        console.error("Failed to parse user data from storage", e); 
      }
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('code')) {
      const processCallback = async () => {
        setIsScanning(true);
        setScanLogs(["Authenticating with Twitter..."]);
        const result = await twitterService.handleCallback(params);
        if (result) {
          setHandle(result.handle);
          setIsTwitterVerified(true);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setIsScanning(false);
      };
      processCallback();
    }

    const savedCount = localStorage.getItem(STORAGE_KEY_AUDIT_COUNT);
    if (savedCount) {
      setCommunityAuditCount(parseInt(savedCount));
    }

    const init = async () => {
      const timeoutId = setTimeout(() => {
        setIsReady(true);
      }, 3000);

      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        if (context) {
          setFarcasterContext(context);
          if (!context.client.added) {
            sdk.actions.addFrame().catch(e => console.log("Add frame prompt dismissed", e));
          }
        }
        loadUserDataFromStorage();
      } catch (e) { 
        console.warn("Farcaster SDK init warning:", e); 
      } finally {
        clearTimeout(timeoutId);
        setIsReady(true);
      }
    };
    init();
  }, [getFarcasterAddress, loadUserDataFromStorage]);

  const handleFarcasterAutoLogin = async () => {
    if (isConnecting || isSigning) return;
    
    setIsConnecting(true);
    try {
      const context = await sdk.context;
      let fcAddr = getFarcasterAddress(context);
      const provider = sdk.wallet?.ethProvider;

      if (!fcAddr && provider) {
        try {
          const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
          if (accounts && accounts.length > 0) fcAddr = accounts[0];
        } catch (err) {
          console.warn("Provider fetch failed", err);
        }
      }
      
      if (!fcAddr) {
        alert("Farcaster identity not found. Verify your Warpcast wallet.");
        setIsConnecting(false);
        return;
      }

      if (provider) {
        setIsSigning(true);
        try {
          const web3 = new Web3(provider);
          const challengeMessage = `Base Impression Proof\nWallet: ${fcAddr}\nTime: ${Date.now()}\nVerify Farcaster identity for Base Impression.`;
          await web3.eth.personal.sign(challengeMessage, fcAddr, "");
        } catch (signError: any) {
          if (signError.code === 4001) throw signError; 
        } finally {
          setIsSigning(false);
        }
      }

      setAddress(fcAddr);
      setIsSignatureVerified(true);
      if (context.user?.username && !handle) {
        setHandle(`@${context.user.username}`);
        setIsTwitterVerified(true);
      }
      setShowWalletSelector(false);
    } catch (e: any) {
      console.error("Login Error:", e);
    } finally {
      setIsConnecting(false);
      setIsSigning(false);
    }
  };

  const scanFarcasterId = async () => {
    if (!user) return;
    setIsSyncingFID(true);
    try {
      const context = await sdk.context;
      if (context?.user?.fid) {
        const fid = context.user.fid;
        const username = context.user.username || '';
        
        // Recalculate points with new FID
        const { total, breakdown } = calculateDetailedPoints(
          user.baseAppAgeDays,
          user.twitterAgeDays,
          user.validTweetsCount,
          fid,
          { lambo: user.lambolessBalance || 0, jesse: user.jesseBalance || 0, nick: user.nickBalance || 0 },
          user.basepostingPoints
        );

        setUser({
          ...user,
          farcasterId: fid,
          farcasterUsername: username,
          points: total,
          pointsBreakdown: breakdown
        });
        
        console.log(`[App] FID Synced: ${fid}`);
      } else {
        alert("Could not detect Farcaster ID. Please ensure you're in Warpcast.");
      }
    } catch (e) {
      console.error("Failed to scan FID", e);
    } finally {
      setIsSyncingFID(false);
    }
  };

  const handleShareOnFarcaster = () => {
    if (!user) return;
    const tier = getTierFromPoints(user.points);
    const text = `Check and Tracking your BASE IMPRESSION @jesse.base.eth @base @baseapp \n\nI just earned the ${tier} Badge with ${user.points.toFixed(0)} points! 🔵⚡️`;
    sdk.actions.cast({ text }).catch(e => console.error("Cast failed", e));
  };

  const handleLogout = () => {
    setUser(null);
    setAddress('');
    setHandle('');
    setIsSignatureVerified(false);
    setIsTwitterVerified(false);
    setBadgeImage(null);
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const startAudit = async () => {
    if (!handle) return;
    setIsScanning(true);
    setScanProgress(10);
    setScanLogs(["Initializing scan engine...", "Target: " + handle]);
    
    try {
      const results = await twitterService.scanPosts(handle);
      setScanProgress(50);
      setScanLogs(prev => [...prev, "Found " + results.foundTweets.length + " candidate posts.", "Applying Baseposting rules..."]);
      
      await new Promise(r => setTimeout(r, 1000));
      setScanProgress(80);
      setScanLogs(prev => [...prev, "Validation complete. Total points: " + results.basepostingPoints]);
      
      const stats: UserStats = {
        address,
        twitterHandle: handle,
        baseAppAgeDays: 1,
        twitterAgeDays: results.accountAgeDays,
        validTweetsCount: results.totalValidPosts,
        basepostingPoints: results.basepostingPoints,
        lambolessBalance: 0,
        points: 0,
        rank: 0,
        trustScore: results.trustScore,
        recentContributions: results.foundTweets.slice(0, 3)
      };

      const { total, breakdown } = calculateDetailedPoints(
        stats.baseAppAgeDays,
        stats.twitterAgeDays,
        0,
        0,
        { lambo: 0, jesse: 0, nick: 0 },
        stats.basepostingPoints
      );

      stats.points = total;
      stats.pointsBreakdown = breakdown;
      
      setUser(stats);
      setScanProgress(100);
      setScanLogs(prev => [...prev, "Audit finished successfully!"]);
      
      setCommunityAuditCount(prev => {
        const next = prev + 1;
        localStorage.setItem(STORAGE_KEY_AUDIT_COUNT, next.toString());
        return next;
      });
    } catch (error) {
      console.error("Audit failed", error);
      setScanLogs(prev => [...prev, "Error: " + (error as Error).message]);
    } finally {
      setTimeout(() => setIsScanning(false), 1500);
    }
  };

  const refreshAssets = async () => {
    if (!user || !address) return;
    setIsRefreshingAssets(true);
    try {
      const [lamboBal, nickBal, jesseBal] = await Promise.all([
        tokenService.getBalance(address, LAMBOLESS_CONTRACT),
        tokenService.getBalance(address, NICK_CONTRACT),
        tokenService.getBalance(address, JESSE_CONTRACT)
      ]);

      const [lamboPrice, nickPrice, jessePrice] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT),
        tokenService.getTokenPrice(NICK_CONTRACT),
        tokenService.getTokenPrice(JESSE_CONTRACT)
      ]);

      const tokenUSDValues = {
        lambo: lamboBal * lamboPrice,
        nick: nickBal * nickPrice,
        jesse: jesseBal * jessePrice
      };

      const { total, breakdown } = calculateDetailedPoints(
        user.baseAppAgeDays,
        user.twitterAgeDays,
        user.validTweetsCount,
        user.farcasterId || 0,
        tokenUSDValues,
        user.basepostingPoints
      );

      setUser({
        ...user,
        lambolessBalance: tokenUSDValues.lambo,
        nickBalance: tokenUSDValues.nick,
        jesseBalance: tokenUSDValues.jesse,
        lambolessAmount: lamboBal,
        nickAmount: nickBal,
        jesseAmount: jesseBal,
        points: total,
        pointsBreakdown: breakdown
      });

    } catch (e) {
      console.error("Failed to refresh assets", e);
    } finally {
      setIsRefreshingAssets(false);
    }
  };

  const generateBadge = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const tier = getTierFromPoints(user.points);
      const img = await geminiService.generateBadgePreview(tier, user.twitterHandle);
      setBadgeImage(img);
    } catch (e) {
      console.error("Failed to generate badge", e);
    } finally {
      setIsGenerating(false);
    }
  };

  const claimEligibility = useMemo(() => {
    if (!user) return { eligible: false, message: "Run Audit First", status: 'NONE' };
    const currentTier = getTierFromPoints(user.points);
    if (currentTier === RankTier.NONE) return { eligible: false, message: "Rank Too Low", status: 'INELIGIBLE' };
    const requirement = TIERS[currentTier];
    if ((user.lambolessBalance || 0) < requirement.minLamboUsd) return { eligible: false, message: "No $LAMBOLESS", status: 'INELIGIBLE' };
    return { eligible: true, message: "Eligible", status: 'ELIGIBLE', tierName: requirement.name };
  }, [user]);

  if (!isReady) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
        <nav className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <div className="hidden sm:block">
                <h1 className="text-lg font-black tracking-tighter uppercase italic">Base Impression</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
               {address ? (
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-mono text-gray-300">{address.slice(0, 6)}...</span>
                    <button onClick={handleLogout} className="p-1 hover:text-red-400"><LogOut size={14} /></button>
                  </div>
               ) : (
                  <button onClick={() => setShowWalletSelector(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase px-6 py-2 rounded-full transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20">
                    <Sparkles size={14} /> Login
                  </button>
               )}
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!user ? (
            <div className="max-w-2xl mx-auto py-20 text-center space-y-12">
               <div className="space-y-4">
                  <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4">
                    <ShieldCheck size={40} />
                  </div>
                  <h2 className="text-5xl font-black tracking-tight leading-tight">ARE YOU <span className="text-blue-500">BUILDING</span> ON BASE?</h2>
                  <p className="text-gray-400 text-lg max-w-lg mx-auto leading-relaxed">Verify contributions, track $LAMBOLESS assets, and earn your reputation badge.</p>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  <div className={`p-6 rounded-2xl border ${isSignatureVerified ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${isSignatureVerified ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'}`}><Wallet size={20} /></div>
                      <span className="font-bold uppercase text-xs">Step 1: Wallet</span>
                    </div>
                    {isSignatureVerified ? <div className="text-green-400 text-sm font-bold flex items-center gap-2"><CheckCircle2 size={16} /> Verified</div> : <button onClick={() => setShowWalletSelector(true)} className="w-full py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl text-sm font-black uppercase">Sign Proof</button>}
                  </div>
                  <div className={`p-6 rounded-2xl border ${isTwitterVerified ? 'bg-green-500/5 border-green-500/30' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2 rounded-lg ${isTwitterVerified ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-400'}`}><Twitter size={20} /></div>
                      <span className="font-bold uppercase text-xs">Step 2: Socials</span>
                    </div>
                    {isTwitterVerified ? <div className="text-green-400 text-sm font-bold flex items-center gap-2"><CheckCircle2 size={16} /> Linked</div> : <button onClick={() => twitterService.login()} className="w-full py-2 bg-white/10 rounded-xl text-sm font-bold">Link Twitter</button>}
                  </div>
               </div>
               {isSignatureVerified && isTwitterVerified && (
                  <button onClick={startAudit} disabled={isScanning} className="w-full max-sm mx-auto py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-lg font-black uppercase flex items-center justify-center gap-3 disabled:opacity-50 transition-all shadow-xl shadow-blue-600/20">
                    {isScanning ? <Loader2 className="animate-spin" /> : <Zap />} Start Audit
                  </button>
               )}
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <div className="flex glass-effect p-1.5 rounded-2xl sticky top-20 z-30 backdrop-blur-xl border border-white/5 mb-8">
                  {(['dashboard', 'claim'] as const).map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 shadow-lg text-white' : 'text-gray-500'}`}>{t}</button>))}
               </div>
               {activeTab === 'dashboard' ? (
                 <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass-effect p-8 rounded-[3rem] border-blue-500/20 text-center relative flex flex-col items-center justify-center">
                          <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">MY BASE IMPRESSION</span>
                          <div className="text-6xl font-black italic mt-2 text-blue-500 drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]">{user.points.toFixed(2)}</div>
                          <div className="mt-6 w-48 mx-auto h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,1)]" style={{ width: `${Math.min((user.points / 1000) * 100, 100)}%` }} />
                          </div>
                      </div>
                      <div className="glass-effect p-8 rounded-[3rem] border-white/10 text-center flex flex-col items-center justify-center gap-6">
                         <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">ECOSYSTEM ACTIONS</span>
                         <div className="flex flex-col w-full gap-3">
                            <button 
                               onClick={scanFarcasterId}
                               disabled={isSyncingFID}
                               className="w-full py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase italic transition-all group"
                            >
                               {isSyncingFID ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                               {user.farcasterId ? `FID Synced: ${user.farcasterId}` : 'Sync Farcaster ID'}
                            </button>
                            <button 
                               onClick={handleShareOnFarcaster}
                               className="w-full py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase italic transition-all group"
                            >
                               <Share2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                               Share Your Impact
                            </button>
                         </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                       <div className="lg:col-span-1 space-y-6">
                         <BadgeDisplay tier={getTierFromPoints(user.points)} imageUrl={badgeImage} loading={isGenerating} />
                         <button onClick={generateBadge} disabled={isGenerating} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 italic tracking-widest">
                           {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                           Refresh NFT Visual
                         </button>
                       </div>
                       <div className="lg:col-span-2 glass-effect p-8 rounded-[3rem] border-white/10 space-y-6">
                          <div className="flex items-center justify-between">
                             <h4 className="font-black text-lg uppercase tracking-tighter italic">Contribution Breakdown</h4>
                             <button onClick={refreshAssets} disabled={isRefreshingAssets} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                               <RefreshCw className={`w-4 h-4 ${isRefreshingAssets ? 'animate-spin' : ''}`} />
                             </button>
                          </div>
                          <div className="space-y-5">
                             {[
                               { label: 'Social Impact', pts: user.pointsBreakdown?.social_twitter || 0, color: 'bg-blue-500' },
                               { label: 'Farcaster Synergy', pts: user.pointsBreakdown?.social_fc || 0, color: 'bg-purple-500' },
                               { label: '$LAMBOLESS Yield', pts: user.pointsBreakdown?.lambo || 0, color: 'bg-yellow-500' },
                               { label: 'Onchain Seniority', pts: user.pointsBreakdown?.seniority || 0, color: 'bg-indigo-500' }
                             ].map((item, i) => (
                               <div key={i} className="space-y-2">
                                 <div className="flex justify-between text-[10px] font-black uppercase italic tracking-widest">
                                   <span className="text-gray-500">{item.label}</span>
                                   <span className="text-blue-400">+{item.pts.toFixed(2)} PTS</span>
                                 </div>
                                 <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                   <div className={`h-full ${item.color} rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.2)]`} style={{ width: `${Math.min((item.pts / Math.max(user.points, 1)) * 100, 100)}%` }} />
                                 </div>
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>
               ) : (
                 <div className="space-y-10 text-center py-6 pb-12">
                    <Award className="w-16 h-16 text-blue-500 mx-auto" />
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter">Impact Rewards</h2>
                    <div className="max-w-md mx-auto space-y-8">
                       <BadgeDisplay tier={getTierFromPoints(user.points)} imageUrl={badgeImage} loading={isGenerating} />
                       <div className={`p-8 rounded-[3rem] text-center border bg-black/40 border-white/10`}>
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Tier Status</span>
                          <h3 className={`text-4xl font-black uppercase italic tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-r ${TIERS[getTierFromPoints(user.points)].color}`}>
                            {TIERS[getTierFromPoints(user.points)].name}
                          </h3>
                       </div>
                       <button disabled={!claimEligibility.eligible} className={`w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm flex items-center justify-center gap-3 transition-all border shadow-2xl ${claimEligibility.eligible ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30' : 'border-white/5 text-gray-600 bg-white/5'}`}>
                         {claimEligibility.eligible ? <Zap className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                         {claimEligibility.eligible ? 'Claim NFT Badge' : claimEligibility.message}
                       </button>
                    </div>
                 </div>
               )}
            </div>
          )}
        </main>

        {showWalletSelector && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <div className="w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-8 space-y-8 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic">Connect Wallet</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Verify Your Farcaster Identity</p>
                  </div>
                  <button onClick={() => setShowWalletSelector(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-500 transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Farcaster Account Only</span>
                    </div>
                    <button 
                      onClick={handleFarcasterAutoLogin}
                      disabled={isConnecting || isSigning}
                      className="w-full p-6 rounded-[1.5rem] bg-gradient-to-br from-purple-600/20 to-indigo-800/20 border border-purple-500/40 flex items-center gap-5 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 relative overflow-hidden group shadow-lg shadow-purple-500/10"
                    >
                      <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-inner">
                        {isConnecting || isSigning ? (
                          <Loader2 className="w-8 h-8 animate-spin text-white" />
                        ) : (
                          <div className="text-white font-black text-2xl italic">F</div>
                        )}
                      </div>
                      <div className="relative text-left flex-1">
                        <p className="font-black text-lg uppercase tracking-tight italic">Farcaster Identity</p>
                        <p className="text-[10px] text-purple-300/70 uppercase font-black tracking-widest">
                          {isSigning ? 'Requesting Sign...' : isConnecting ? 'Connecting...' : 'One-Tap Verification'}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
                <div className="pt-2 text-center">
                  <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
                    Access is limited to verified Farcaster accounts.
                  </p>
                </div>
             </div>
          </div>
        )}
        
        {isScanning && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-lg">
             <div className="w-full max-w-lg space-y-8 text-center">
                <div className="relative w-40 h-40 mx-auto">
                  <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full" />
                  <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-black italic">{scanProgress}%</span>
                  </div>
                </div>
                <h3 className="text-4xl font-black uppercase tracking-tighter italic">Auditing Impression</h3>
                <div className="bg-black/50 border border-white/10 rounded-3xl p-6 h-56 overflow-y-auto font-mono text-left text-[10px] space-y-1">
                  {scanLogs.map((log, i) => (
                    <div key={i} className="flex gap-2 border-l border-white/10 pl-3 py-0.5 text-gray-400">
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}
    </div>
  );
};

export default App;
