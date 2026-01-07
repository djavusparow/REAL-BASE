
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
  Search,
  AlertCircle,
  TrendingUp,
  Coins,
  ExternalLink,
  Copy,
  Layers,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  History,
  Calendar
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
  const [showScanDetails, setShowScanDetails] = useState(false);
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
        return data;
      } catch (e) { 
        console.error("Failed to parse user data from storage", e); 
      }
    }
    return null;
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
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
      const watchdog = setTimeout(() => {
        setIsReady(true);
      }, 4000);

      try {
        await sdk.actions.ready().catch(e => console.warn("SDK actions ready failed", e));
        const context = await sdk.context.catch(e => {
            console.warn("SDK context fetch failed", e);
            return null;
        });

        if (context) {
          setFarcasterContext(context);
        }

        const storedUser = loadUserDataFromStorage();
        if (context && storedUser) {
           const fcAddr = getFarcasterAddress(context);
           if (fcAddr && fcAddr.toLowerCase() === storedUser.address.toLowerCase()) {
             setAddress(fcAddr);
             setIsSignatureVerified(true);
           }
        }
      } catch (e) { 
        console.error("Initialization error:", e); 
      } finally {
        clearTimeout(watchdog);
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
      if (context?.user?.username && !handle) {
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
      } else {
        alert("Could not detect Farcaster ID.");
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
        recentContributions: results.foundTweets,
        twitterDailyBreakdown: results.dailyBreakdown
      } as any;

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

  const handleBuyToken = (contract: string) => {
    const url = `https://app.uniswap.org/swap?outputCurrency=${contract}&chain=base`;
    sdk.actions.openUrl(url).catch(() => {
        window.open(url, '_blank');
    });
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Contract Address copied!");
  };

  const claimEligibility = useMemo(() => {
    if (!user) return { eligible: false, message: "Run Audit First", status: 'NONE', pointsNeeded: 0, lamboUsdNeeded: 0 };
    
    const currentTier = getTierFromPoints(user.points);
    const bronzeMinPoints = TIERS[RankTier.BRONZE].minPoints;
    const pointsNeeded = Math.max(0, bronzeMinPoints - user.points);
    
    const minLamboUsd = 2.5;
    const lamboUsdNeeded = Math.max(0, minLamboUsd - (user.lambolessBalance || 0));

    if (currentTier === RankTier.NONE) {
      return { 
        eligible: false, 
        message: `Rank Too Low.`, 
        status: 'INELIGIBLE',
        pointsNeeded,
        lamboUsdNeeded
      };
    }

    if (lamboUsdNeeded > 0) {
      return { 
        eligible: false, 
        message: `Need $${lamboUsdNeeded.toFixed(2)} more.`, 
        status: 'INELIGIBLE',
        pointsNeeded,
        lamboUsdNeeded
      };
    }

    return { 
      eligible: true, 
      message: "Eligible for Badge Mint!", 
      status: 'ELIGIBLE', 
      tierName: TIERS[currentTier].name,
      pointsNeeded: 0,
      lamboUsdNeeded: 0
    };
  }, [user]);

  if (!isReady) return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-blue-500 font-black uppercase italic tracking-widest text-sm">Base Impression</h2>
        <p className="text-gray-500 text-[10px] uppercase font-bold tracking-[0.3em]">Initializing Ecosystem...</p>
      </div>
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
                      <div className="glass-effect p-8 rounded-[3rem] border-blue-500/20 text-center relative flex flex-col items-center justify-center overflow-hidden">
                          <div className="absolute inset-0 bg-blue-600/5 pointer-events-none" />
                          <span className="text-[10px] font-black uppercase text-yellow-400 tracking-widest">MY BASE IMPRESSION</span>
                          <div className="text-6xl font-black italic mt-2 text-blue-500 drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]">{user.points.toFixed(2)}</div>
                          <div className="mt-6 w-48 mx-auto h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,1)]" style={{ width: `${Math.min((user.points / 1000) * 100, 100)}%` }} />
                          </div>
                          
                          <button 
                            onClick={() => setShowScanDetails(!showScanDetails)}
                            className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-blue-400 transition-colors"
                          >
                            {showScanDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {showScanDetails ? 'Hide Scan Details' : 'View Scan Details'}
                          </button>
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

                    {showScanDetails && (
                      <div className="glass-effect p-8 rounded-[3rem] border-blue-500/10 space-y-8 animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-4">
                           <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                              <History size={24} />
                           </div>
                           <div>
                              <h3 className="text-xl font-black uppercase italic tracking-tighter">Detailed Scan Results</h3>
                              <p className="text-[10px] text-gray-500 uppercase font-bold">Campaign Window: Nov 1, 2025 - Jan 15, 2026</p>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                           <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                 <Calendar className="text-blue-500" size={16} />
                                 <h4 className="text-xs font-black uppercase tracking-widest italic">Daily Valid Posts</h4>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                 {Object.entries((user as any).twitterDailyBreakdown || {}).map(([day, count], i) => (
                                    <div key={i} className="bg-white/5 border border-white/5 p-3 rounded-xl flex justify-between items-center">
                                       <span className="text-[10px] font-mono text-gray-400">{day.split('-').slice(1).join('/')}</span>
                                       <span className="text-xs font-black text-blue-400">+{count}</span>
                                    </div>
                                 ))}
                              </div>
                           </div>

                           <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                 <Twitter className="text-blue-500" size={16} />
                                 <h4 className="text-xs font-black uppercase tracking-widest italic">Verified Contributions</h4>
                              </div>
                              <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                                 {user.recentContributions?.map((tweet, i) => (
                                    <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2 hover:border-blue-500/20 transition-colors group">
                                       <div className="flex justify-between items-start">
                                          <div className="flex items-center gap-2">
                                             <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(37,99,235,1)]" />
                                             <span className="text-[9px] font-mono text-gray-500">
                                                {new Date(tweet.createdAt).toLocaleDateString()}
                                             </span>
                                          </div>
                                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 rounded text-[8px] font-black text-green-400 group-hover:bg-green-500/20 transition-all">
                                             <CheckCircle2 size={8} /> VERIFIED
                                          </div>
                                       </div>
                                       <p className="text-[11px] text-gray-300 leading-relaxed italic">{tweet.text}</p>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <Layers className="text-blue-500" size={20} />
                            <h3 className="text-xl font-black uppercase italic tracking-tighter">Holding Rewards</h3>
                         </div>
                         <button 
                            onClick={refreshAssets} 
                            disabled={isRefreshingAssets}
                            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-all"
                         >
                            <RefreshCw size={12} className={isRefreshingAssets ? 'animate-spin' : ''} />
                            Sync Balances
                         </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[
                          { 
                            name: '$LAMBOLESS', 
                            amount: user.lambolessAmount || 0, 
                            usd: user.lambolessBalance || 0, 
                            pts: user.pointsBreakdown?.lambo || 0, 
                            contract: LAMBOLESS_CONTRACT,
                            accent: 'text-yellow-500',
                            bg: 'border-yellow-500/20 bg-yellow-500/5'
                          },
                          { 
                            name: '$JESSE', 
                            amount: user.jesseAmount || 0, 
                            usd: user.jesseBalance || 0, 
                            pts: user.pointsBreakdown?.jesse || 0, 
                            contract: JESSE_CONTRACT,
                            accent: 'text-blue-500',
                            bg: 'border-blue-500/20 bg-blue-500/5'
                          },
                          { 
                            name: '$NICK', 
                            amount: user.nickAmount || 0, 
                            usd: user.nickBalance || 0, 
                            pts: user.pointsBreakdown?.nick || 0, 
                            contract: NICK_CONTRACT,
                            accent: 'text-gray-400',
                            bg: 'border-white/10 bg-white/5'
                          }
                        ].map((token, idx) => (
                          <div key={idx} className={`p-6 rounded-[2rem] border ${token.bg} space-y-4 relative overflow-hidden group`}>
                             <div className="flex justify-between items-start">
                                <div>
                                   <p className={`text-sm font-black italic ${token.accent}`}>{token.name}</p>
                                   <p className="text-2xl font-black tracking-tight">{token.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                   <p className="text-[10px] text-gray-500 font-bold">≈ ${token.usd.toFixed(2)} USD</p>
                                </div>
                                <div className="text-right">
                                   <p className={`text-sm font-black italic ${token.accent}`}>+{token.pts.toFixed(2)} PTS</p>
                                </div>
                             </div>
                             
                             <div className="pt-2 flex flex-col gap-2 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                    <button 
                                      onClick={() => copyToClipboard(token.contract)}
                                      className="flex items-center gap-2 text-[9px] font-mono text-gray-600 hover:text-gray-400 transition-colors uppercase"
                                    >
                                      <Copy size={10} /> {token.contract.slice(0, 6)}...{token.contract.slice(-4)}
                                    </button>
                                    <a 
                                      href={`https://basescan.org/address/${token.contract}`} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="p-1.5 bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"
                                    >
                                      <ExternalLink size={12} />
                                    </a>
                                </div>
                                
                                <button 
                                   onClick={() => handleBuyToken(token.contract)}
                                   className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase italic transition-all active:scale-95"
                                >
                                   <ShoppingCart size={12} className={token.accent} />
                                   Buy {token.name}
                                </button>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">
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
                 <div className="space-y-10 py-6 pb-12 max-w-4xl mx-auto">
                    <div className="text-center space-y-4">
                      <Award className="w-16 h-16 text-blue-500 mx-auto" />
                      <h2 className="text-4xl font-black uppercase italic tracking-tighter">Impact Rewards</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
                       <div className="space-y-8">
                         <BadgeDisplay tier={getTierFromPoints(user.points)} imageUrl={badgeImage} loading={isGenerating} />
                         <div className={`p-8 rounded-[3rem] text-center border bg-black/40 border-white/10`}>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Current Rank</span>
                            <h3 className={`text-4xl font-black uppercase italic tracking-tight mt-1 bg-clip-text text-transparent bg-gradient-to-r ${TIERS[getTierFromPoints(user.points)].color}`}>
                              {TIERS[getTierFromPoints(user.points)].name}
                            </h3>
                         </div>
                       </div>

                       <div className="space-y-6">
                          <div className="glass-effect p-8 rounded-[2.5rem] border-white/10 space-y-8">
                             <div className="flex items-center justify-between">
                               <h4 className="font-black text-lg uppercase italic">Claim Checklist</h4>
                               {claimEligibility.eligible ? (
                                 <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-400 text-[10px] font-black italic">
                                   <CheckCircle2 size={12} /> READY
                                 </div>
                               ) : (
                                 <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full text-red-400 text-[10px] font-black italic">
                                   <AlertCircle size={12} /> INCOMPLETE
                                 </div>
                               )}
                             </div>

                             <div className="space-y-8">
                                <div className="space-y-3">
                                   <div className="flex justify-between items-end">
                                      <div className="flex items-center gap-2">
                                         <TrendingUp size={16} className={user.points >= TIERS[RankTier.BRONZE].minPoints ? "text-green-500" : "text-gray-500"} />
                                         <span className="text-xs font-black uppercase tracking-widest">Base Points</span>
                                      </div>
                                      <span className="text-[10px] font-mono text-gray-400">{user.points.toFixed(0)} / {TIERS[RankTier.BRONZE].minPoints}</span>
                                   </div>
                                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                      <div className={`h-full transition-all duration-700 ${user.points >= TIERS[RankTier.BRONZE].minPoints ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} style={{ width: `${Math.min((user.points / TIERS[RankTier.BRONZE].minPoints) * 100, 100)}%` }} />
                                   </div>
                                </div>

                                <div className="space-y-3">
                                   <div className="flex justify-between items-end">
                                      <div className="flex items-center gap-2">
                                         <Coins size={16} className={(user.lambolessBalance || 0) >= 2.5 ? "text-green-500" : "text-gray-500"} />
                                         <span className="text-xs font-black uppercase tracking-widest">$LAMBOLESS Value</span>
                                      </div>
                                      <span className="text-[10px] font-mono text-gray-400">${(user.lambolessBalance || 0).toFixed(2)} / $2.50</span>
                                   </div>
                                   <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                      <div className={`h-full transition-all duration-700 ${(user.lambolessBalance || 0) >= 2.5 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} style={{ width: `${Math.min(((user.lambolessBalance || 0) / 2.5) * 100, 100)}%` }} />
                                   </div>
                                </div>

                                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                                   <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg ${isSignatureVerified && isTwitterVerified ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                         <UserCheck size={16} />
                                      </div>
                                      <span className="text-xs font-black uppercase tracking-widest">Identity Sync</span>
                                   </div>
                                   <CheckCircle2 size={16} className={isSignatureVerified && isTwitterVerified ? "text-green-500" : "text-gray-800"} />
                                </div>
                             </div>

                             <button disabled={!claimEligibility.eligible} className={`w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm flex items-center justify-center gap-3 transition-all border shadow-2xl ${claimEligibility.eligible ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30' : 'border-white/5 text-gray-600 bg-white/5 opacity-50'}`}>
                               {claimEligibility.eligible ? <Zap className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                               {claimEligibility.eligible ? `Mint ${TIERS[getTierFromPoints(user.points)].name} Badge` : 'Claim Locked'}
                             </button>
                          </div>
                       </div>
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
                  </div>
                  <button onClick={() => setShowWalletSelector(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-500 transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <button 
                      onClick={handleFarcasterAutoLogin}
                      disabled={isConnecting || isSigning}
                      className="w-full p-6 rounded-[1.5rem] bg-gradient-to-br from-purple-600/20 to-indigo-800/20 border border-purple-500/40 flex items-center gap-5 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 relative overflow-hidden group shadow-lg shadow-purple-500/10"
                    >
                      <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-inner">
                        {isConnecting || isSigning ? <Loader2 className="w-8 h-8 animate-spin text-white" /> : <div className="text-white font-black text-2xl italic">F</div>}
                      </div>
                      <div className="relative text-left flex-1">
                        <p className="font-black text-lg uppercase tracking-tight italic">Farcaster Identity</p>
                      </div>
                    </button>
                  </div>
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
             </div>
          </div>
        )}
    </div>
  );
};

export default App;
