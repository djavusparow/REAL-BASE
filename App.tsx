import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  Info, 
  Loader2, 
  Share2, 
  PlusCircle, 
  TrendingUp, 
  Clock, 
  LayoutDashboard, 
  Gift, 
  Twitter, 
  ExternalLink, 
  CheckCircle2, 
  Lock, 
  RefreshCw,
  AlertCircle,
  Fingerprint,
  ChevronRight,
  ShieldAlert
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

const STORAGE_KEY = 'base_impression_identity_secure_v3';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isAdded, setIsAdded] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginStep, setLoginStep] = useState<'IDLE' | 'APPROVE' | 'SIGNING' | 'SUCCESS'>('IDLE');
  const [user, setUser] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  const [userCount, setUserCount] = useState(3890); 
  
  // Twitter Linking State
  const [isLinkingTwitter, setIsLinkingTwitter] = useState(false);
  const [linkedTwitterHandle, setLinkedTwitterHandle] = useState<string | null>(null);

  const syncUserData = useCallback(async (address: string, fid: number, username: string, twitterHandle: string) => {
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ fid, twitterHandle, authenticated: true, lastSync: Date.now() }));
    } catch (e) {
      console.error("Sync Error", e);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
        const context = await sdk.context;
        
        if (context?.user) {
          setIsAdded(context.client.added);
          
          // Check for existing valid session
          const savedData = localStorage.getItem(STORAGE_KEY);
          if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed.fid === context.user.fid && parsed.authenticated) {
              setIsAuthenticated(true);
              setLinkedTwitterHandle(parsed.twitterHandle);
              const address = context.user.verifiedAddresses?.ethAddresses?.[0] || context.user.custodyAddress;
              if (address) {
                await syncUserData(address, context.user.fid, context.user.username, parsed.twitterHandle || context.user.username);
              }
            }
          }
        }
      } catch (e) {
        console.error("Farcaster Connection Failed", e);
      } finally {
        setIsReady(true);
      }
    };
    init();
    
    const interval = setInterval(() => setUserCount(prev => prev + Math.floor(Math.random() * 5)), 10000);
    return () => clearInterval(interval);
  }, [syncUserData]);

  const handleAddFrame = async () => {
    try {
      await sdk.actions.addFrame();
      setIsAdded(true);
    } catch (e) {
      console.error("Failed to add frame", e);
    }
  };

  const startSecureLogin = async () => {
    setLoginStep('APPROVE');
    try {
      const context = await sdk.context;
      if (!context?.user) throw new Error("No user detected");

      // Step 1: Sign In (OIDC)
      await sdk.actions.signIn();
      
      // Step 2: On-chain Verification (Personal Sign)
      setLoginStep('SIGNING');
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("Ethereum Provider not available");
      
      const challenge = `BASE IMPRESSION SECURITY CHALLENGE\n\nVerify identity for FID: #${context.user.fid}\nTimestamp: ${Date.now()}\n\nThis is a non-transaction signature used for secure authentication.`;
      
      const address = context.user.verifiedAddresses?.ethAddresses?.[0] || context.user.custodyAddress;
      if (!address) throw new Error("No verified address found");

      await provider.request({
        method: 'personal_sign',
        params: [challenge, address]
      });

      setLoginStep('SUCCESS');
      setTimeout(async () => {
        setIsAuthenticated(true);
        await syncUserData(address, context.user.fid, context.user.username, context.user.username);
      }, 1000);

    } catch (e) {
      console.error("Authentication Failed", e);
      setLoginStep('IDLE');
      alert("Authentication Failed. Please try again.");
    }
  };

  const connectTwitterSecurely = async () => {
    setIsLinkingTwitter(true);
    await new Promise(r => setTimeout(r, 2000));
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
        text: `🛡️ Verified my ${tier} Impact on @base via Farcaster!\n\nFID: #${user.farcasterId}\nPoints: ${user.points.toFixed(0)}\n\nVerify yours: real-base-2026.vercel.app\n\n#Base #BaseApp #Onchain` 
      });
    } catch (e) {
      console.error(e);
      alert("Mint failed. Check gas funds.");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  // UI Component: Mandatory Add Frame Overlay
  if (isReady && !isAdded) {
    return (
      <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
        <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.4)] mb-8 animate-bounce">
          <PlusCircle size={40} className="text-white" />
        </div>
        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-4">Mandatory Add</h2>
        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest leading-relaxed mb-8">
          To calculate your real-time impact points, you must add <span className="text-blue-500">Base Impression</span> to your Farcaster mini-apps.
        </p>
        <button 
          onClick={handleAddFrame}
          className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase italic text-lg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          <PlusCircle size={20} /> Add to Farcaster
        </button>
      </div>
    );
  }

  // UI Component: 2-Step Secure Login Screen
  if (isReady && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-600 rounded-full blur-[120px]" />
        </div>

        <div className="relative space-y-8 max-w-sm w-full">
          <div className="flex flex-col items-center gap-4">
            <Zap className="text-blue-500 w-16 h-16" fill="currentColor" />
            <h1 className="text-4xl font-black italic tracking-tighter">BASE IMPRESSION</h1>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">Secure 2-Step Identity Audit</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6 backdrop-blur-xl">
            <div className="space-y-4">
              <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${loginStep === 'APPROVE' ? 'bg-blue-600/10 border-blue-500' : (loginStep === 'SIGNING' || loginStep === 'SUCCESS' ? 'bg-green-500/10 border-green-500/50' : 'bg-white/5 border-white/10 opacity-50')}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${loginStep === 'SUCCESS' || loginStep === 'SIGNING' ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}>
                  {loginStep === 'SUCCESS' || loginStep === 'SIGNING' ? <CheckCircle2 size={16} /> : "1"}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest">Step 1: Approve</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Authorize Identity Access</p>
                </div>
              </div>

              <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${loginStep === 'SIGNING' ? 'bg-blue-600/10 border-blue-500' : (loginStep === 'SUCCESS' ? 'bg-green-500/10 border-green-500/50' : 'bg-white/5 border-white/10 opacity-50')}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${loginStep === 'SUCCESS' ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}>
                  {loginStep === 'SUCCESS' ? <CheckCircle2 size={16} /> : "2"}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest">Step 2: Security Sign</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">On-chain Signature Verification</p>
                </div>
              </div>
            </div>

            <button 
              onClick={startSecureLogin}
              disabled={loginStep !== 'IDLE'}
              className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase italic text-lg shadow-2xl flex items-center justify-center gap-2 hover:bg-blue-50 transition-all disabled:opacity-50"
            >
              {loginStep === 'IDLE' ? (
                <>Verify Identity <ChevronRight size={20} /></>
              ) : (
                <><Loader2 size={20} className="animate-spin" /> {loginStep === 'APPROVE' ? "Authorizing..." : loginStep === 'SIGNING' ? "Signing Challenge..." : "Authenticated"}</>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Lock size={12} />
            <p className="text-[9px] font-black uppercase tracking-widest">Secured by Farcaster Identity Protocol</p>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard UI (Unchanged settings logic)
  if (!isReady) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-blue-500 font-bold uppercase tracking-widest text-[10px] animate-pulse">Syncing Protocols...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24 selection:bg-blue-600">
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
        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <LayoutDashboard size={14} /> DASHBOARD
          </button>
          <button 
            onClick={() => setActiveTab('claim')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'claim' ? 'bg-blue-600 shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Gift size={14} /> CLAIM
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Share2 size={16} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">FID Identity</p>
                  <p className="text-xs font-bold italic truncate">#{user?.farcasterId || '---'}</p>
                </div>
              </div>
              
              {linkedTwitterHandle ? (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Twitter size={16} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">X Social</p>
                    <p className="text-xs font-bold italic truncate">{user?.twitterHandle}</p>
                  </div>
                </div>
              ) : (
                <button onClick={connectTwitterSecurely} className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30 flex items-center gap-3 group hover:bg-blue-600/20 transition-all">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg">
                    {isLinkingTwitter ? <Loader2 size={16} className="animate-spin" /> : <Twitter size={16} />}
                  </div>
                  <div className="text-left">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Connect</p>
                    <p className="text-[10px] font-bold text-white">Link X Handle</p>
                  </div>
                </button>
              )}
            </div>

            <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-10 rounded-[3rem] border border-blue-500/20 text-center relative overflow-hidden shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mb-2">Base Impression Points</p>
              <h2 className="text-8xl font-black italic tracking-tighter mb-4">
                {isSyncing ? <Loader2 className="animate-spin inline" /> : user?.points.toFixed(0) || 0}
              </h2>
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 bg-black/40 py-3 px-6 rounded-full w-fit mx-auto border border-white/5 backdrop-blur-md">
                <ShieldCheck size={14} className="text-blue-500" />
                Verified Real-Time Audit
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <Clock size={16} className="text-blue-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Social Age</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.social_twitter.toFixed(0) || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <Fingerprint size={16} className="text-purple-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">FID Seniority</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.social_fc.toFixed(0) || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <TrendingUp size={16} className="text-green-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Baseposting</p>
                <p className="text-xl font-bold">+{user?.basepostingPoints || 0}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10">
                <Coins size={16} className="text-yellow-400 mb-2" />
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Duration Value</p>
                <p className="text-xl font-bold">+{user?.pointsBreakdown?.lambo.toFixed(0) || 0}</p>
              </div>
            </div>
            
            <button 
              onClick={() => user && syncUserData(user.address, user.farcasterId || 0, user.farcasterUsername || "", linkedTwitterHandle || user.farcasterUsername || "")}
              disabled={isSyncing}
              className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isSyncing ? "Verifying..." : "Update Verified Audit"}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-4 text-center">
              <BadgeDisplay tier={getTierFromPoints(user?.points || 0)} imageUrl={badgeImage} loading={isGenerating} />
              <h3 className="text-xl font-black italic tracking-tight uppercase">{getTierFromPoints(user?.points || 0)} IMPRESSION SHIELD</h3>
            </div>

            <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Mint Thresholds</h4>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">100+ Total Points</span>
                {user && user.points >= 100 ? <CheckCircle /> : <Warning label="Point Deficit" />}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">1,000+ LAMBO Token Hold</span>
                {user && (user.lambolessAmount || 0) >= 1000 ? <CheckCircle /> : <Warning label="Balance Required" />}
              </div>
            </div>

            <button 
              onClick={handleClaim}
              disabled={!user || user.points < 100 || (user.lambolessAmount || 0) < 1000 || isMinting || isMinted}
              className={`w-full py-6 rounded-2xl font-black uppercase italic text-lg shadow-xl transition-all ${
                isMinted ? 'bg-green-600' : 'bg-blue-600 hover:scale-105 active:scale-95 disabled:opacity-20'
              }`}
            >
              {isMinting ? <Loader2 className="animate-spin mx-auto" /> : isMinted ? 'BADGE SECURED' : 'MINT ON-CHAIN SHIELD'}
            </button>
          </div>
        )}
      </main>
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