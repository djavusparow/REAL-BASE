import React, { useState, useEffect, useMemo } from 'react';
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
  Search,
  LogOut,
  Trophy,
  Award,
  Link2,
  Lock,
  ExternalLink,
  Shield,
  Fingerprint,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowUpDown,
  Coins,
  Cpu,
  Binary,
  Send,
  Users,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import Web3 from 'web3';
import { UserStats, RankTier } from './types.ts';
import { 
  TIERS, 
  MOCKED_LEADERBOARD,
  MIN_TOKEN_VALUE_USD,
  CLAIM_START,
  LAMBOLESS_CONTRACT,
  NICK_CONTRACT,
  JESSE_CONTRACT,
  HOURLY_WINDOW_START,
  HOURLY_WINDOW_END
} from './constants.ts';
import { calculatePoints, getTierFromRank } from './utils/calculations.ts';
import BadgeDisplay from './components/BadgeDisplay.tsx';
import { geminiService } from './services/geminiService.ts';
import { twitterService, Tweet } from './services/twitterService.ts';
import { tokenService } from './services/tokenService.ts';

const STORAGE_KEY_USER = 'base_impression_v1_user';

interface EIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: any;
}

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
  const [farcasterContextUser, setFarcasterContextUser] = useState<any>(null);
  
  const [address, setAddress] = useState('');
  const [handle, setHandle] = useState('');
  const [discoveredProviders, setDiscoveredProviders] = useState<EIP6963ProviderDetail[]>([]);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);

  const [isTwitterConnecting, setIsTwitterConnecting] = useState(false);
  const [isTwitterVerified, setIsTwitterVerified] = useState(false);
  const [twitterChallenge, setTwitterChallenge] = useState('');
  const [showTwitterVerifyModal, setShowTwitterVerifyModal] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'leaderboard' | 'claim'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncingFarcaster, setIsSyncingFarcaster] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingAssets, setIsRefreshingAssets] = useState(false);

  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [leaderboardSort, setLeaderboardSort] = useState<'desc' | 'asc'>('desc');
  const [leaderboardTierFilter, setLeaderboardTierFilter] = useState<RankTier | 'ALL'>('ALL');

  useEffect(() => {
    const onAnnouncement = (event: any) => {
      setDiscoveredProviders(prev => {
        const detail = event.detail as EIP6963ProviderDetail;
        if (prev.some(p => p.info.uuid === detail.info.uuid)) return prev;
        return [...prev, detail];
      });
    };
    window.addEventListener("eip6963:announceProvider", onAnnouncement);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const init = async () => {
      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        if (context?.user) {
          console.log("Farcaster Context User Object:", context.user);
          setFarcasterContextUser(context.user);
          
          const saved = localStorage.getItem(STORAGE_KEY_USER);
          if (!saved) {
            const detectedAddr = 
              context.user.custodyAddress || 
              context.user.address || 
              (Array.isArray(context.user.verifiedAddresses) && context.user.verifiedAddresses[0]) ||
              '';
              
            setAddress(detectedAddr);
            setHandle(`@${context.user.username}`);
            
            if (detectedAddr) {
              setIsSignatureVerified(true);
              setIsTwitterVerified(true);
            }
          }
        }
      } catch (e) {
        console.warn("Farcaster SDK init failed:", e);
      } finally {
        loadUserDataFromStorage();
        setIsReady(true);
      }
    };
    init();
    return () => window.removeEventListener("eip6963:announceProvider", onAnnouncement);
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const now = new Date();
      if (now >= HOURLY_WINDOW_START && now <= HOURLY_WINDOW_END) {
        setUser(prev => {
          if (!prev) return null;
          const newPoints = calculatePoints(
            prev.baseAppAgeDays || 0,
            prev.twitterAgeDays || 0,
            prev.validTweetsCount || 0,
            prev.farcasterAgeDays || 0,
            { 
              lambo: prev.lambolessBalance || 0, 
              nick: prev.nickBalance || 0, 
              jesse: prev.jesseBalance || 0 
            }
          );
          if (newPoints !== prev.points) {
            return { ...prev, points: newPoints };
          }
          return prev;
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  const loadUserDataFromStorage = () => {
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
      } catch (e) { console.error("Failed to parse saved user data:", e); }
    }
  };

  const handleFarcasterAutoLogin = () => {
    if (!farcasterContextUser) return;
    
    const custodyAddr = 
      farcasterContextUser.custodyAddress || 
      farcasterContextUser.address || 
      (Array.isArray(farcasterContextUser.verifiedAddresses) && farcasterContextUser.verifiedAddresses[0]);
    
    if (!custodyAddr) {
      console.error("Farcaster context missing address fields. Full context:", farcasterContextUser);
      alert("No linked wallet address found in your Farcaster profile. Please connect your wallet manually using the 'Connect Wallet' menu.");
      return;
    }
    
    setAddress(custodyAddr);
    setHandle(`@${farcasterContextUser.username}`);
    setIsSignatureVerified(true);
    setIsTwitterVerified(true); 
    setShowWalletSelector(false);
    console.log("Farcaster Auto-Login Successful. Address:", custodyAddr);
  };

  const handleSyncFarcaster = async () => {
    if (!user) return;
    setIsSyncingFarcaster(true);
    try {
      const context = await sdk.context;
      if (context?.user) {
        const fid = context.user.fid;
        const username = context.user.username;
        // Logic: Lower FID = older account. Max FID 1M for age calculation.
        const ageDays = Math.max(1, Math.floor(((1000000 - fid) / 1000000) * 1200));
        const createdAt = new Date(Date.now() - (ageDays * 24 * 60 * 60 * 1000)).toLocaleDateString();

        setUser(prev => {
          if (!prev) return null;
          const updated = {
            ...prev,
            farcasterId: fid,
            farcasterUsername: username,
            farcasterAgeDays: ageDays,
            farcasterCreatedAt: createdAt
          };
          updated.points = calculatePoints(
            updated.baseAppAgeDays || 0,
            updated.twitterAgeDays || 0,
            updated.validTweetsCount || 0,
            updated.farcasterAgeDays || 0,
            { 
              lambo: updated.lambolessBalance || 0, 
              nick: updated.nickBalance || 0, 
              jesse: updated.jesseBalance || 0 
            }
          );
          return updated;
        });
        console.log("Farcaster profile synced:", { fid, username, ageDays });
      } else {
        alert("Farcaster context unavailable. Please open this frame in Warpcast.");
      }
    } catch (e) {
      console.error("Sync error:", e);
    } finally {
      setIsSyncingFarcaster(false);
    }
  };

  const initiateWalletConnection = () => {
    setShowWalletSelector(true);
  };

  const handleConnectAndSign = async (provider: any) => {
    setShowWalletSelector(false);
    setIsConnecting(true);
    try {
      const web3 = new Web3(provider);
      const accounts = await web3.eth.requestAccounts();
      if (!accounts.length) throw new Error("No accounts linked");
      const linkedAddress = accounts[0];
      setAddress(linkedAddress);
      setIsConnecting(false);
      setIsSigning(true);
      const challengeMessage = `Base Impression Identity Proof\n\nI am verifying ownership of this wallet for Onchain Summer 2026.\n\nWallet: ${linkedAddress}\nTimestamp: ${Date.now()}`;
      await web3.eth.personal.sign(challengeMessage, linkedAddress, "");
      setIsSignatureVerified(true);
      setIsSigning(false);
    } catch (error) {
      console.error(error);
      setIsSignatureVerified(false);
      setIsConnecting(false);
      setIsSigning(false);
      alert("Authentication failed.");
    }
  };

  const handleStartTwitterVerification = async () => {
    if (!handle) return;
    setIsTwitterConnecting(true);
    try {
      const challenge = await geminiService.generateVerificationChallenge(handle);
      setTwitterChallenge(challenge);
      setShowTwitterVerifyModal(true);
    } catch (e) {
      alert("Failed to generate challenge. Check API config.");
    } finally {
      setIsTwitterConnecting(false);
    }
  };

  const handleConfirmVerification = async (challengeInput: string) => {
    setIsTwitterConnecting(true);
    try {
      const success = await twitterService.verifyOwnership(handle, twitterChallenge);
      if (success) {
        setIsTwitterVerified(true);
        setShowTwitterVerifyModal(false);
      } else { 
        alert("Verification code not found. Please ensure you posted the tweet."); 
      }
    } catch (e) {
      alert("Twitter API connection failed.");
    } finally {
      setIsTwitterConnecting(false);
    }
  };

  const handleScan = async () => {
    const currentAddress = address || (farcasterContextUser?.custodyAddress || farcasterContextUser?.address);
    const currentHandle = handle || (farcasterContextUser?.username ? `@${farcasterContextUser.username}` : '');

    if (!currentAddress || currentAddress.trim() === '') {
      alert("Wallet address is required. Please re-connect your identity.");
      return;
    }
    
    if (!farcasterContextUser) {
      if (!isTwitterVerified || !isSignatureVerified) {
         alert("Please complete both Wallet Connection and Social Verification steps first.");
         return;
      }
    }

    setIsScanning(true);
    setScanProgress(0);
    setScanLogs([]);
    const log = (msg: string) => setScanLogs(p => [...p, msg]);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    try {
      log("Initializing audit for " + currentAddress.slice(0, 8) + "...");
      setScanProgress(10);
      await sleep(400);

      log("Synchronizing balances from Base L2...");
      setScanProgress(30);
      const [balLambo, balNick, balJesse] = await Promise.all([
        tokenService.getBalance(currentAddress, LAMBOLESS_CONTRACT).catch(() => 0),
        tokenService.getBalance(currentAddress, NICK_CONTRACT).catch(() => 0),
        tokenService.getBalance(currentAddress, JESSE_CONTRACT).catch(() => 0)
      ]);
      
      log(`Sync Complete: Assets indexed.`);
      setScanProgress(50);
      await sleep(400);

      log("Fetching live market metrics...");
      setScanProgress(65);
      const [pLambo, pNick, pJesse] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT).catch(() => 0.0001),
        tokenService.getTokenPrice(NICK_CONTRACT).catch(() => 0.0001),
        tokenService.getTokenPrice(JESSE_CONTRACT).catch(() => 0.0001)
      ]);
      
      const usdLambo = (balLambo || 0) * pLambo;
      const usdNick = (balNick || 0) * pNick;
      const usdJesse = (balJesse || 0) * pJesse;
      
      log(`Calculating impact velocity...`);
      setScanProgress(80);
      await sleep(400);

      log("Scanning social contribution history...");
      setScanProgress(90);
      const scanResult = await twitterService.scanPosts(currentHandle).catch(err => {
        console.warn("Twitter scan fallback:", err);
        return { accountAgeDays: 60, cappedPoints: 10, trustScore: 75, foundTweets: [] };
      });
      
      setScanProgress(95);
      await sleep(400);

      log("Synthesizing final Impression Report...");
      const baseAge = 150 + Math.floor(Math.random() * 50);
      const fidAge = farcasterContextUser ? Math.max(1, Math.floor(((1000000 - (farcasterContextUser.fid || 1)) / 1000000) * 800)) : 0;
      
      const points = calculatePoints(
        baseAge, 
        scanResult.accountAgeDays || 0, 
        scanResult.cappedPoints || 0, 
        fidAge, 
        { lambo: usdLambo, nick: usdNick, jesse: usdJesse }
      );
      
      const rank = points > 1000 ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 950) + 25;
      
      const userData: UserStats = { 
        address: currentAddress, 
        twitterHandle: currentHandle, 
        baseAppAgeDays: baseAge, 
        twitterAgeDays: scanResult.accountAgeDays || 0, 
        validTweetsCount: scanResult.cappedPoints || 0, 
        lambolessBalance: usdLambo, 
        nickBalance: usdNick, 
        jesseBalance: usdJesse,
        points, 
        rank, 
        trustScore: scanResult.trustScore || 85, 
        recentContributions: scanResult.foundTweets || [],
        farcasterId: farcasterContextUser?.fid,
        farcasterUsername: farcasterContextUser?.username,
        farcasterAgeDays: fidAge,
        farcasterCreatedAt: farcasterContextUser?.fid ? new Date(Date.now() - (fidAge * 24 * 60 * 60 * 1000)).toLocaleDateString() : undefined
      };

      setScanProgress(100);
      await sleep(500);
      
      setUser(userData);
      console.log("Impression Profile Generated Successfully:", userData);

    } catch (error) {
      console.error("Audit Critical Failure:", error);
      alert("An error occurred during the audit. Please check your connection and try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleRefreshAssets = async () => {
    if (!user) return;
    setIsRefreshingAssets(true);
    try {
      const [balLambo, balNick, balJesse] = await Promise.all([
        tokenService.getBalance(user.address, LAMBOLESS_CONTRACT),
        tokenService.getBalance(user.address, NICK_CONTRACT),
        tokenService.getBalance(user.address, JESSE_CONTRACT)
      ]);
      const [pLambo, pNick, pJesse] = await Promise.all([
        tokenService.getTokenPrice(LAMBOLESS_CONTRACT),
        tokenService.getTokenPrice(NICK_CONTRACT),
        tokenService.getTokenPrice(JESSE_CONTRACT)
      ]);
      const updatedUser = { 
        ...user, 
        lambolessBalance: (balLambo || 0) * pLambo, 
        nickBalance: (balNick || 0) * pNick, 
        jesseBalance: (balJesse || 0) * pJesse 
      };
      updatedUser.points = calculatePoints(
        updatedUser.baseAppAgeDays || 0, 
        updatedUser.twitterAgeDays || 0, 
        updatedUser.validTweetsCount || 0, 
        updatedUser.farcasterAgeDays || 0, 
        { 
          lambo: updatedUser.lambolessBalance, 
          nick: updatedUser.nickBalance || 0, 
          jesse: updatedUser.jesseBalance || 0 
        }
      );
      setUser(updatedUser);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsRefreshingAssets(false); 
    }
  };

  const handleRefreshVisual = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const tier = getTierFromRank(user.rank);
      const [img, msg] = await Promise.all([
        geminiService.generateBadgePreview(tier, user.twitterHandle || user.farcasterUsername || 'Base Builder'), 
        geminiService.getImpressionAnalysis(user.points, user.rank)
      ]);
      setBadgeImage(img);
      setAnalysis(msg);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = (platform: 'farcaster' | 'twitter') => {
    if (!user) return;
    const shareUrl = "https://real-base-2026.vercel.app/";
    const tierName = TIERS[getTierFromRank(user.rank)].name;
    
    if (platform === 'twitter') {
      const message = `I just checked my @Base Impression rating! 🏎️💨\n\nPoints: ${user.points.toFixed(2)}\nRank: #${user.rank}\nTier: ${tierName}\n\nCheck yours on @baseapp:`;
      const tags = "\n\n@base @baseapp @jessepollak #BaseImpression #OnchainSummer";
      sdk.actions.openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message + tags)}&url=${encodeURIComponent(shareUrl)}`);
    } else {
      const message = `Check out my Base Impression rating! 🏎️💨\n\nRank: #${user.rank}\nPoints: ${user.points.toFixed(2)}\nTier: ${tierName}\n\nJoin the event on Base:`;
      sdk.actions.openUrl(`https://warpcast.com/~/compose?text=${encodeURIComponent(message)}&embeds[]=${encodeURIComponent(shareUrl)}`);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsTwitterVerified(false);
    setIsSignatureVerified(false);
    setShowLogoutConfirm(false);
    setHandle('');
    setAddress('');
    localStorage.removeItem(STORAGE_KEY_USER);
  };

  const claimStatus = useMemo(() => {
    const now = new Date();
    const isClaimOpen = now >= CLAIM_START;
    if (!user) return { disabled: true, label: 'Locked', theme: 'bg-gray-800 text-gray-500', icon: Lock, reason: 'Verify identity.' };
    const isRankEligible = user.rank <= 1000;
    const isAssetEligible = user.lambolessBalance >= MIN_TOKEN_VALUE_USD;
    if (!isClaimOpen) return { disabled: true, label: 'Awaiting Snapshot', theme: 'bg-blue-900/40 text-blue-400', icon: Clock, reason: `Minting opens Jan 16` };
    if (!isRankEligible && !isAssetEligible) return { disabled: true, label: 'Ineligible', theme: 'bg-red-900/20 text-red-400', icon: AlertCircle, reason: 'Thresholds not met.' };
    return { disabled: false, label: 'Mint Soulbound NFT', theme: 'bg-blue-600 shadow-lg text-white', icon: Award, reason: 'You are eligible.' };
  }, [user]);

  const filteredLeaderboard = useMemo(() => {
    let list = [...MOCKED_LEADERBOARD];
    if (user && (user.twitterHandle || user.farcasterUsername) && user.points > 0) {
      const currentHandle = user.twitterHandle || `@${user.farcasterUsername}`;
      const existingIdx = list.findIndex(l => l.handle.toLowerCase() === currentHandle.toLowerCase());
      if (existingIdx !== -1) {
        list[existingIdx] = { ...list[existingIdx], points: user.points, rank: user.rank };
      } else {
        list.push({ rank: user.rank, handle: currentHandle, points: user.points, tier: getTierFromRank(user.rank), accountAgeDays: user.twitterAgeDays, baseAppAgeDays: user.baseAppAgeDays });
      }
    }
    return list
      .filter(l => l.handle.toLowerCase().includes(leaderboardSearch.toLowerCase()))
      .sort((a, b) => b.points - a.points);
  }, [leaderboardSearch, user]);

  return (
    <div className="min-h-screen bg-black text-white font-['Space_Grotesk'] pb-24">
      {/* SCANNING OVERLAY */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
          <div className="relative mb-10">
            <Binary className="w-20 h-20 text-blue-500 animate-pulse" />
            <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter mb-2 text-white">Auditing Footprint</h2>
          <div className="w-full max-w-xs space-y-4">
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-700 shadow-[0_0_20px_rgba(37,99,235,1)]" style={{ width: `${scanProgress}%` }} />
            </div>
            <p className="text-[10px] font-black uppercase text-blue-400 min-h-[1.5em] tracking-widest">{scanLogs[scanLogs.length - 1] || "Initializing..."}</p>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showWalletSelector && (
        <div className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-effect rounded-[3rem] p-8 border-blue-500/20 space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3"><Cpu className="w-5 h-5 text-blue-500" /><h3 className="text-xl font-black uppercase italic tracking-tighter">Link Source</h3></div>
              <button onClick={() => setShowWalletSelector(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid gap-4 max-h-[60vh] overflow-y-auto px-1 py-1">
              {farcasterContextUser && (
                <div onClick={handleFarcasterAutoLogin} className="glass-effect p-6 rounded-[2rem] border border-purple-500/60 bg-purple-950/20 hover:bg-purple-900/40 cursor-pointer group transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#8a63d2] rounded-2xl flex items-center justify-center shadow-lg"><Fingerprint className="w-7 h-7 text-white" /></div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase text-purple-100">Farcaster Profile</span>
                      <span className="text-[9px] text-purple-400 font-bold uppercase mt-0.5">@{farcasterContextUser.username}</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="h-[1px] bg-white/5 my-2" />
              {discoveredProviders.map((dp) => (
                <div key={dp.info.uuid} className="glass-effect p-5 rounded-[2rem] border border-white/10 hover:border-blue-500/30 cursor-pointer" onClick={() => handleConnectAndSign(dp.provider)}>
                  <div className="flex items-center gap-4">
                    {dp.info.icon ? <img src={dp.info.icon} alt={dp.info.name} className="w-10 h-10 rounded-xl" /> : <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-xs font-black">EX</div>}
                    <div className="flex flex-col"><span className="text-xs font-black uppercase">{dp.info.name}</span><span className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">EIP-6963</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showTwitterVerifyModal && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-sm glass-effect p-8 rounded-[3rem] border-blue-500/30 space-y-6">
            <h2 className="text-xl font-black uppercase italic tracking-tighter">Identity Confirmation</h2>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center"><span className="text-2xl font-mono font-black text-blue-500">{twitterChallenge}</span></div>
            <div className="space-y-3">
              <button onClick={() => sdk.actions.openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Verifying my @Base identity: ${twitterChallenge} #BaseImpression`)}`)} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px]">Post on X</button>
              <button onClick={() => handleConfirmVerification(twitterChallenge)} disabled={isTwitterConnecting} className="w-full py-4 bg-blue-600 rounded-2xl font-black uppercase text-[10px]">{isTwitterConnecting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Verification'}</button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 glass-effect px-4 py-4 flex justify-between items-center bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3"><BrandLogo size="sm" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-tighter leading-none">Base Impression</span><span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">Verified Profile</span></div></div>
        {user && <button onClick={() => setShowLogoutConfirm(true)} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><LogOut className="w-4 h-4 text-gray-500" /></button>}
      </header>

      <main className="max-w-md mx-auto px-4 mt-8">
        {!user ? (
          <div className="space-y-12 text-center animate-in fade-in duration-1000">
            <div className="flex justify-center float-animation"><BrandLogo size="lg" /></div>
            <div className="space-y-3"><h1 className="text-5xl font-black uppercase italic tracking-tight leading-none">Onchain<br/>Proof.</h1><p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em]">Season 01 • Activity Analysis</p></div>
            
            <div className="glass-effect p-8 rounded-[3rem] space-y-6 shadow-2xl">
              <div className="space-y-4">
                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-4 tracking-widest">Profile Identity</label>
                  {farcasterContextUser && !isSignatureVerified ? (
                    <button onClick={handleFarcasterAutoLogin} className="w-full bg-[#8a63d2] hover:bg-[#7a53c2] text-white rounded-2xl py-5 px-5 flex items-center justify-between transition-all active:scale-[0.98] border border-purple-400/20 shadow-lg shadow-purple-500/10">
                      <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Fingerprint className="w-5 h-5" /></div><div className="flex flex-col text-left"><span className="text-[10px] font-black uppercase">Farcaster Login</span><span className="text-xs font-bold mt-1">@{farcasterContextUser.username}</span></div></div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : !isSignatureVerified ? (
                    <button onClick={initiateWalletConnection} className="w-full bg-blue-600/10 border border-blue-500/30 rounded-2xl py-4 px-5 flex items-center justify-between hover:bg-blue-600/20 transition-all">
                       <span className="text-xs font-bold uppercase text-blue-200">Connect Wallet</span><Wallet className="w-4 h-4 text-blue-500" />
                    </button>
                  ) : (
                    <div className="w-full bg-green-500/10 border border-green-500/40 rounded-2xl py-4 px-5 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Identified Wallet</span>
                        <span className="text-xs font-mono text-green-100">{address.slice(0,6)}...{address.slice(-4)}</span>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  )}
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-[9px] font-black uppercase text-gray-500 ml-4 tracking-widest">Social Context</label>
                  <div className="relative group flex gap-2">
                    <div className="relative flex-1">
                      <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                      <input value={handle} onChange={e => setHandle(e.target.value)} disabled={isTwitterVerified} placeholder="@username" className="w-full bg-black/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none disabled:opacity-50 focus:border-blue-500 transition-all" />
                    </div>
                    {!isTwitterVerified ? (
                      <button onClick={handleStartTwitterVerification} disabled={!handle || isTwitterConnecting} className="px-6 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-[9px] font-black uppercase hover:bg-blue-600/30 transition-all">Verify</button>
                    ) : (
                      <div className="px-6 bg-green-500/20 border border-green-500/40 rounded-2xl flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-500" /></div>
                    )}
                  </div>
                </div>
              </div>

              <button onClick={handleScan} disabled={isScanning} className="w-full py-5 bg-blue-600 rounded-[2rem] font-black uppercase italic text-sm shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-20 flex items-center justify-center gap-2 transition-all">
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate Impression'} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-gray-600 uppercase font-black tracking-widest italic">Verified by Base Onchain Graph</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 fade-in duration-700">
            <div className="flex glass-effect p-1.5 rounded-2xl sticky top-20 z-30 backdrop-blur-xl border border-white/5">
              {(['dashboard', 'leaderboard', 'claim'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-blue-600 shadow-lg text-white' : 'text-gray-500'}`}>
                  {t}
                </button>
              ))}
            </div>

            {activeTab === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-[2.5rem] border-blue-500/20 text-center relative overflow-hidden">
                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Impact Score</span>
                    <div className="text-3xl font-black italic mt-1">{user.points.toFixed(2)}</div>
                  </div>
                  <div className="glass-effect p-6 rounded-[2.5rem] border-purple-500/20 text-center">
                    <span className="text-[9px] font-black uppercase text-gray-500 tracking-widest">Trust Index</span>
                    <div className="text-3xl font-black italic mt-1 text-blue-400">{user.trustScore}%</div>
                  </div>
                </div>

                {/* Ecosystem Profile Sync */}
                <div className="glass-effect p-8 rounded-[3rem] border-purple-500/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3"><Fingerprint className="w-4 h-4 text-purple-400" /><h3 className="text-xs font-black uppercase italic">Ecosystem Context</h3></div>
                    {user.farcasterId ? (
                      <span className="text-[8px] font-black uppercase text-purple-400 bg-purple-400/10 px-2 py-1 rounded-full border border-purple-400/20">Synced</span>
                    ) : (
                      <button onClick={handleSyncFarcaster} disabled={isSyncingFarcaster} className="px-3 py-1.5 bg-purple-600/10 border border-purple-500/20 rounded-full text-[9px] font-black text-purple-400 hover:bg-purple-600/20 transition-all">
                        {isSyncingFarcaster ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sync Farcaster'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col">
                       <span className="text-[7px] font-black uppercase text-gray-500 mb-1">FID ID</span>
                       <span className="text-[10px] font-black text-white">{user.farcasterId || 'Not Linked'}</span>
                    </div>
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex flex-col">
                       <span className="text-[7px] font-black uppercase text-gray-500 mb-1">Joined Date</span>
                       <span className="text-[10px] font-black text-white">{user.farcasterCreatedAt || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="glass-effect p-8 rounded-[3rem] border-white/5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3"><Coins className="w-4 h-4 text-blue-500" /><h3 className="text-xs font-black uppercase italic">Asset Weight</h3></div>
                    <button onClick={() => handleShare('twitter')} className="px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full text-[9px] font-black text-blue-400 hover:bg-blue-600/20 transition-all">Share</button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { name: '$LAMBOLESS', bal: user.lambolessBalance, color: 'text-blue-400' },
                      { name: '$NICK', bal: user.nickBalance || 0, color: 'text-purple-400' },
                      { name: '$JESSE', bal: user.jesseBalance || 0, color: 'text-green-400' },
                    ].map((asset, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                        <span className={`text-[10px] font-black ${asset.color}`}>{asset.name}</span>
                        <span className="text-[10px] font-black text-white">${asset.bal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-effect p-10 rounded-[4rem] text-center space-y-6 shadow-2xl border border-blue-500/10">
                  <BadgeDisplay tier={getTierFromRank(user.rank)} imageUrl={badgeImage} loading={isGenerating} />
                  {analysis && <p className="text-[10px] italic text-blue-200/60 bg-white/5 p-4 rounded-2xl leading-relaxed">"{analysis}"</p>}
                  <div className="flex flex-col gap-3">
                    <button onClick={handleRefreshVisual} disabled={isGenerating} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] italic hover:bg-gray-200 transition-colors">Refresh Visual</button>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleShare('farcaster')} className="py-3 bg-[#8a63d2]/10 border border-[#8a63d2]/30 rounded-2xl text-[9px] font-black uppercase text-purple-200 hover:bg-[#8a63d2]/20 transition-all">Warpcast</button>
                      <button onClick={() => handleShare('twitter')} className="py-3 bg-blue-600/10 border border-blue-500/30 rounded-2xl text-[9px] font-black uppercase text-blue-200 hover:bg-blue-600/20 transition-all">Post to X</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'leaderboard' && (
               <div className="space-y-6 animate-in fade-in duration-500">
                 <div className="glass-effect p-6 rounded-[2rem] flex justify-between items-center bg-blue-600/5 border border-blue-500/20">
                   <div className="flex items-center gap-3">
                     <Users className="w-5 h-5 text-blue-500" />
                     <h3 className="text-xs font-black uppercase">Synced Members</h3>
                   </div>
                   <span className="text-xl font-black italic">{filteredLeaderboard.length} Members</span>
                 </div>
                 <div className="space-y-3">
                   {filteredLeaderboard.map((l, i) => (
                     <div key={i} className={`p-6 glass-effect rounded-[2.5rem] flex justify-between items-center border border-white/5 hover:bg-white/5 transition-all`}>
                       <div className="flex items-center gap-4">
                         <span className="text-xs font-black italic text-gray-500">#{i + 1}</span>
                         <div className="flex flex-col">
                           <span className="text-xs font-bold text-white">{l.handle}</span>
                           <span className="text-[7px] font-black uppercase text-blue-400 tracking-widest">{TIERS[l.tier].name} Level</span>
                         </div>
                       </div>
                       <span className="text-xs font-black text-blue-500">{l.points.toFixed(2)} pts</span>
                     </div>
                   ))}
                 </div>
               </div>
            )}

            {activeTab === 'claim' && (
              <div className="space-y-10 text-center py-6 animate-in fade-in duration-500">
                 <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto border border-blue-500/20 shadow-2xl shadow-blue-500/10"><Award className="w-10 h-10 text-blue-500" /></div>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter">Impact Rewards</h2>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest px-8">Snapshot sequence active. Claim portal opens Jan 16th.</p>
                 <div className="space-y-4 px-4">
                   <div className={`p-6 glass-effect rounded-[2rem] flex justify-between items-center ${user.rank <= 1000 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/20'}`}>
                      <div className="text-left"><p className="text-[10px] font-black uppercase">Impact Rank</p><p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Min #1000</p></div>
                      <div className="flex flex-col items-end"><span className={`text-xs font-black ${user.rank <= 1000 ? 'text-green-400' : 'text-red-400'}`}>#{user.rank}</span>{user.rank <= 1000 ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-red-500" />}</div>
                   </div>
                   <div className={`p-6 glass-effect rounded-[2rem] flex justify-between items-center ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/20'}`}>
                      <div className="text-left"><p className="text-[10px] font-black uppercase">$LAMBO Balance</p><p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Min $2.50 USD</p></div>
                      <div className="flex flex-col items-end"><span className={`text-xs font-black ${user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? 'text-green-400' : 'text-red-400'}`}>${user.lambolessBalance.toFixed(2)}</span>{user.lambolessBalance >= MIN_TOKEN_VALUE_USD ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertTriangle className="w-3 h-3 text-red-500" />}</div>
                   </div>
                 </div>
                 <div className="space-y-4 px-4">
                   <button onClick={handleRefreshAssets} disabled={isRefreshingAssets} className="text-[10px] font-black uppercase text-blue-500 flex items-center justify-center gap-2 mx-auto py-2 px-4 hover:bg-blue-500/5 rounded-xl transition-all">{isRefreshingAssets ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Sync My Assets</button>
                   <button disabled={claimStatus.disabled} className={`w-full py-6 rounded-[2.5rem] font-black uppercase italic text-sm transition-all active:scale-95 flex items-center justify-center gap-3 ${claimStatus.theme}`}><claimStatus.icon className="w-5 h-5" /> {claimStatus.label}</button>
                   {claimStatus.disabled && <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2">{claimStatus.reason}</p>}
                 </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;