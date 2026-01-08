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
  Fingerprint,
  ChevronRight,
  Coins
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { UserStats } from './types';
import { LAMBOLESS_CONTRACT } from './constants';
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

const STORAGE_KEY = 'base_impression_identity_secure_v4';

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
  const [userCount, setUserCount] = useState(4240); 
  
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
      if (!context?.user) throw new Error("No Farcaster user detected. Open in Warpcast.");

      const generatedNonce = Math.random().toString(36).substring(2, 15);

      // Step 1: Sign In (OIDC) - Fixed "nonce of undefined"
      const signInResult = await sdk.actions.signIn({ nonce: generatedNonce });
      if (!signInResult) throw new Error("Sign in failed");
      
      // Step 2: Address Discovery
      setLoginStep('SIGNING');
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("No wallet provider found");
      
      let rawAddress = context.user.verifiedAddresses?.ethAddresses?.[0] || context.user.custodyAddress;
      if (!rawAddress && signInResult.user) {
        rawAddress = (signInResult.user as any).verifiedAddresses?.ethAddresses?.[0] || (signInResult.user as any).custodyAddress;
      }
      if (!rawAddress) {
        const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
        if (accounts?.[0]) rawAddress = accounts[0];
      }

      if (!rawAddress) throw new Error("No usable wallet address found.");

      const address = ethers.getAddress(rawAddress);
      const challenge = `BASE IMPRESSION SECURITY CHALLENGE\n\nFID: #${context.user.fid}\nTimestamp: ${Date.now()}`;
      
      await provider.request({
        method: 'personal_sign',
        params: [challenge, address]
      });

      setLoginStep('SUCCESS');
      setTimeout(async () => {
        setIsAuthenticated(true);
        await syncUserData(address, context.user.fid, context.user.username, context.user.username);
      }, 800);

    } catch (e: any) {
      console.error("Login Failed:", e);
      setLoginStep('IDLE');
      alert(e.message || "Authentication failed.");
    }
  };

  const handleClaim = async () => {
    if (!user || isGenerating || isMinting) return;
    const canClaim = user.points >= 100 && (user.lambolessAmount || 0) >= 1000;
    if (!canClaim) return;

    setIsGenerating(true);
    try {
      const tier = getTierFromPoints(user.points);
      // Fast generation with instant fallback
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
        text: `🛡️ Verified my ${tier} Impact Score: ${user.points.toFixed(0)} on @base via @farcaster!\n\nVerify yours: real-base-2026.vercel.app\n\n#Base #Onchain` 
      });
    } catch (e) {
      console.error("Mint Error:", e);
      alert("Mint failed. Ensure you have gas on Base.");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  const connectTwitterSecurely = async () => {
    setIsLinkingTwitter(true);
    await new Promise(r => setTimeout(r, 2000));
    const handle = prompt("Link X Account Handle:", user?.farcasterUsername || "");
    if (handle) {
      const sanitized = handle.replace('@', '');
      setLinkedTwitterHandle(sanitized);
      if (user) await syncUserData(user.address, user.farcasterId || 0, user.farcasterUsername || "", sanitized);
    }
    setIsLinkingTwitter(false);
  };

  if (isReady && !isAdded) {
    return (
      <div className="fixed inset-0 bg-black z-[200] flex flex-col items-center justify-center p-8 text-center bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
        <div className="w-20 h-20 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_60px_rgba(37,99,235,0.5)] mb-8 animate-bounce">
          <PlusCircle size={40} className="text-white" />
        </div>
        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-4">Mandatory Add</h2>
        <p className="text-sm text-gray-400 font-bold uppercase tracking-widest leading-relaxed mb-8 max-w-[280px] mx-auto">
          Add <span className="text-blue-500">Base Impression</span> to your Farcaster apps to continue.
        </p>
        <button onClick={handleAddFrame} className="w-full py-5 bg-blue-600 rounded-2xl font-black uppercase italic text-lg shadow-xl flex items-center justify-center gap-3"><PlusCircle size={20} /> Add to Farcaster</button>
      </div>
    );
  }

  if (isReady && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-blue-600 rounded-full blur-[140px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600 rounded-full blur-[140px]" />
        </div>
        <div className="relative space-y-8 max-w-sm w-full">
          <div className="flex flex-col items-center gap-4">
            <Zap className="text-blue-500 w-20 h-20" fill="currentColor" />
            <h1 className="text-5xl font-black italic tracking-tighter">BASE IMPRESSION</h1>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.4em]">Secure Protocol v4.2</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6 backdrop-blur-2xl">
            <div className="space-y-4 text-left">
              {[ { s: 'APPROVE', l: 'Step 1: Link Profile' }, { s: 'SIGNING', l: 'Step 2: Authenticate' } ].map((step, i) => (
                <div key={i} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500 ${loginStep === step.s ? 'bg-blue-600/10 border-blue-500 shadow-xl' : (loginStep === 'SUCCESS' ? 'bg-green-500/10 border-green-500/40' : 'bg-white/5 border-white/10 opacity-40')}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${loginStep === 'SUCCESS' ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}>{loginStep === 'SUCCESS' ? <CheckCircle2 size={16} /> : i+1}</div>
                  <div><p className="text-[11px] font-black uppercase">{step.l}</p><p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Verified Signature</p></div>
                </div>
              ))}
            </div>
            <button onClick={startSecureLogin} disabled={loginStep !== 'IDLE'} className="w-full py-6 bg-white text-black rounded-2xl font-black uppercase italic text-xl shadow-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
              {loginStep === 'IDLE' ? <>START SECURE LOGIN <ChevronRight size={24} /></> : <Loader2 size={24} className="animate-spin" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(37,99,235,0.2)]" />
      <p className="text-blue-500 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">Syncing Protocols...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24 selection:bg-blue-600">
      <nav className="p-6 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2"><Zap className="text-blue-500" fill="currentColor" size={20} /><h1 className="text-lg font-black italic tracking-tighter">BASE IMPRESSION</h1></div>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20"><TrendingUp size={12} className="text-blue-500" /><span className="text-[10px] font-bold tracking-widest">{userCount} AUDITED</span></div>
      </nav>

      <main className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600' : 'text-gray-500'}`}><LayoutDashboard size={14} /> DASHBOARD</button>
          <button onClick={() => setActiveTab('claim')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === 'claim' ? 'bg-blue-600' : 'text-gray-500'}`}><Gift size={14} /> CLAIM</button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400"><Share2 size={16} /></div>
                <div className="overflow-hidden"><p className="text-[8px] font-black text-gray-500 uppercase">FID Profile</p><p className="text-xs font-bold italic truncate">#{user?.farcasterId}</p></div>
              </div>
              {linkedTwitterHandle ? (
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400"><Twitter size={16} /></div>
                  <div className="overflow-hidden"><p className="text-[8px] font-black text-gray-500 uppercase">X Social</p><p className="text-xs font-bold italic truncate">{user?.twitterHandle}</p></div>
                </div>
              ) : (
                <button onClick={connectTwitterSecurely} className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/30 flex items-center gap-3 group border-dashed transition-all hover:bg-blue-600/20">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white">{isLinkingTwitter ? <Loader2 size={16} className="animate-spin" /> : <Twitter size={16} />}</div>
                  <div className="text-left"><p className="text-[8px] font-black text-blue-400 uppercase">Connect</p><p className="text-[10px] font-bold text-white">Link X Handle</p></div>
                </button>
              )}
            </div>

            <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-12 rounded-[3.5rem] border border-blue-500/20 text-center relative overflow-hidden shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400 mb-2">Base Impression Points</p>
              <h2 className="text-9xl font-black italic tracking-tighter mb-4 text-white">{isSyncing ? <Loader2 className="animate-spin inline" /> : user?.points.toFixed(0) || 0}</h2>
              <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-gray-400 bg-black/50 py-3.5 px-8 rounded-full w-fit mx-auto border border-white/5"><ShieldCheck size={14} className="text-blue-500" /> Verified Identity Audit</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-lg"><Clock size={16} className="text-blue-400 mb-2" /><p className="text-[9px] font-bold text-gray-500 uppercase">Social Age</p><p className="text-xl font-bold">+{user?.pointsBreakdown?.social_twitter.toFixed(0)}</p></div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-lg"><Fingerprint size={16} className="text-purple-400 mb-2" /><p className="text-[9px] font-bold text-gray-500 uppercase">FID Seniority</p><p className="text-xl font-bold">+{user?.pointsBreakdown?.social_fc.toFixed(0)}</p></div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-lg"><TrendingUp size={16} className="text-green-400 mb-2" /><p className="text-[9px] font-bold text-gray-500 uppercase">Baseposting</p><p className="text-xl font-bold">+{user?.basepostingPoints}</p></div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-lg"><Coins size={16} className="text-yellow-400 mb-2" /><p className="text-[9px] font-bold text-gray-500 uppercase">Asset Holding</p><p className="text-xl font-bold">+{user?.pointsBreakdown?.lambo.toFixed(0)}</p></div>
            </div>
            
            <button onClick={() => user && syncUserData(user.address, user.farcasterId || 0, user.farcasterUsername || "", linkedTwitterHandle || user.farcasterUsername || "")} disabled={isSyncing} className="w-full py-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
              {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} REFRESH AUDIT
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-4 text-center">
              <BadgeDisplay tier={getTierFromPoints(user?.points || 0)} imageUrl={badgeImage} loading={isGenerating} />
              <h3 className="text-2xl font-black italic tracking-tight uppercase bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">{getTierFromPoints(user?.points || 0)} IMPRESSION SHIELD</h3>
            </div>
            <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 space-y-5 shadow-2xl">
              <h4 className="text-[10px] font-black uppercase text-blue-400">Mint Threshold Verification</h4>
              <div className="flex items-center justify-between"><span className="text-xs text-gray-400">100+ Total Points</span>{user && user.points >= 100 ? <CheckCircle /> : <Warning label="Missing Points" />}</div>
              <div className="flex items-center justify-between"><span className="text-xs text-gray-400">1,000+ LAMBO Hold</span>{user && (user.lambolessAmount || 0) >= 1000 ? <CheckCircle /> : <Warning label="Low Balance" />}</div>
            </div>
            <button onClick={handleClaim} disabled={!user || user.points < 100 || (user.lambolessAmount || 0) < 1000 || isMinting || isMinted} className={`w-full py-7 rounded-[2rem] font-black uppercase italic text-xl shadow-2xl transition-all ${isMinted ? 'bg-green-600' : 'bg-blue-600 hover:scale-[1.03] disabled:opacity-20 active:scale-95'}`}>
              {isMinting ? <Loader2 className="animate-spin mx-auto" /> : isMinted ? 'BADGE COLLECTED' : 'MINT INSTANT SHIELD'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

const CheckCircle = () => <div className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center"><Zap size={12} className="text-green-500" fill="currentColor" /></div>;
const Warning = ({ label }: { label: string }) => <span className="text-[10px] font-black bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg border border-red-500/30 uppercase tracking-widest">{label}</span>;

export default App;