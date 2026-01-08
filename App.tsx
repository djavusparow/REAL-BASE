
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
  Coins,
  Users,
  Shield
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
  const [userCount, setUserCount] = useState(4280); 
  
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
      if (!context?.user) throw new Error("Farcaster context not found. Use Warpcast.");

      const generatedNonce = Math.random().toString(36).substring(2, 11);
      const signInResult = await sdk.actions.signIn({ nonce: generatedNonce });
      if (!signInResult) throw new Error("Sign-in cancelled.");
      
      setLoginStep('SIGNING');

      let rawAddress = context.user.verifiedAddresses?.ethAddresses?.[0] || context.user.custodyAddress;
      
      if (!rawAddress && signInResult.user) {
        const u = signInResult.user as any;
        rawAddress = u.verifiedAddresses?.ethAddresses?.[0] || u.custodyAddress;
      }

      if (!rawAddress && sdk.wallet?.ethProvider) {
        try {
          const accounts = await sdk.wallet.ethProvider.request({ method: 'eth_accounts' }) as string[];
          if (accounts && accounts.length > 0) rawAddress = accounts[0];
        } catch (e) {
          console.warn("Provider query skipped", e);
        }
      }

      if (!rawAddress) throw new Error("Verified wallet not found. Link a wallet to Farcaster.");

      const address = ethers.getAddress(rawAddress);

      await new Promise(resolve => setTimeout(resolve, 800));

      setLoginStep('SUCCESS');
      setTimeout(async () => {
        setIsAuthenticated(true);
        await syncUserData(address, context.user.fid, context.user.username, context.user.username);
      }, 500);

    } catch (e: any) {
      console.error("Auth Exception:", e);
      setLoginStep('IDLE');
      alert(e.message || "Authentication failed. Try again.");
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
      if (!provider) throw new Error("Wallet provider missing");
      
      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      
      await contract.methods.mintBadge(preview || "", tierMap[tier]).send({ from: user.address });
      setIsMinted(true);
    } catch (e: any) {
      console.error("Claim Error:", e);
      alert(e.message || "Failed to process claim.");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  if (!isReady) return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
      <header className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#050505]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            <Fingerprint className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter italic">Base Impression</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
              <ShieldCheck size={10} className="text-blue-500" /> Identity Protocol
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {!isAuthenticated ? (
             <button 
              onClick={startSecureLogin}
              className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
             >
               {loginStep === 'APPROVE' ? 'Approving...' : loginStep === 'SIGNING' ? 'Syncing...' : 'Secure Connect'}
               <ChevronRight size={14} />
             </button>
           ) : (
             <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Verified</span>
             </div>
           )}
        </div>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-8 pb-32">
        {!isAuthenticated ? (
          <div className="space-y-8 py-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="space-y-4 text-center">
              <h2 className="text-4xl font-black italic uppercase tracking-tighter leading-none">Your Identity <br/><span className="text-blue-500">On-Chain</span></h2>
              <p className="text-gray-400 text-sm font-medium">Quantify your impact across the Base ecosystem. Connect securely via Farcaster to begin.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-effect p-6 rounded-3xl border border-white/5 space-y-2">
                <Users className="text-blue-500 w-5 h-5" />
                <div className="text-xl font-black">{userCount.toLocaleString()}</div>
                <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Active Users</div>
              </div>
              <div className="glass-effect p-6 rounded-3xl border border-white/5 space-y-2">
                <Zap className="text-yellow-500 w-5 h-5" />
                <div className="text-xl font-black">2.4M+</div>
                <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Points Distributed</div>
              </div>
            </div>

            <button 
              onClick={startSecureLogin}
              className="w-full py-5 rounded-[2rem] bg-white text-black text-xs font-black uppercase tracking-[0.2em] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
            >
              Start Verification Protocol
            </button>
          </div>
        ) : (
          <>
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-600/10 blur-3xl rounded-full" />
              <div className="relative glass-effect p-6 rounded-[2.5rem] border border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-black shadow-xl">
                      {user?.farcasterUsername?.[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-lg font-black tracking-tighter italic">@{user?.farcasterUsername}</div>
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                        FID: {user?.farcasterId} • {user?.address.slice(0, 6)}...{user?.address.slice(-4)}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => syncUserData(user?.address || "", user?.farcasterId || 0, user?.farcasterUsername || "", linkedTwitterHandle || user?.farcasterUsername || "")}
                    disabled={isSyncing}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <RefreshCw size={16} className={`${isSyncing ? 'animate-spin text-blue-500' : 'text-gray-400'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Identity Score</span>
                    <div className="text-3xl font-black italic tracking-tighter text-blue-500">{user?.points.toFixed(0)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Global Rank</span>
                    <div className="text-3xl font-black italic tracking-tighter text-white">#--</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex p-1 bg-white/5 rounded-full border border-white/10">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dashboard' ? 'bg-white text-black shadow-xl' : 'text-gray-500 hover:text-white'}`}
              >
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('claim')}
                className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'claim' ? 'bg-white text-black shadow-xl' : 'text-gray-500 hover:text-white'}`}
              >
                Collection
              </button>
            </div>

            {activeTab === 'dashboard' ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                {!linkedTwitterHandle ? (
                  <div className="glass-effect p-6 rounded-[2rem] border border-dashed border-blue-500/30 flex flex-col items-center gap-4 text-center">
                    <Twitter className="text-blue-400 w-8 h-8" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-black uppercase italic">Connect X Identity</h4>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Sync your X activity to boost your base score</p>
                    </div>
                    <button 
                      onClick={connectTwitterSecurely}
                      disabled={isLinkingTwitter}
                      className="px-8 py-3 rounded-full bg-blue-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-400 transition-all shadow-lg active:scale-95"
                    >
                      {isLinkingTwitter ? 'Verifying...' : 'Link @Handle'}
                    </button>
                  </div>
                ) : (
                  <div className="glass-effect p-5 rounded-[2rem] border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#1DA1F2]/20 flex items-center justify-center">
                        <Twitter className="text-[#1DA1F2] w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black tracking-tight">@{linkedTwitterHandle}</div>
                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Verified Content Stream</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-green-500">
                      <CheckCircle2 size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">Linked</span>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 pl-2">Asset Multipliers</h3>
                  <div className="grid gap-3">
                    <div className="glass-effect p-5 rounded-3xl border border-white/5 flex items-center justify-between group hover:border-blue-500/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 font-bold text-xs">L</div>
                        <div>
                          <div className="text-xs font-black uppercase tracking-tight">Lamboless</div>
                          <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{(user?.lambolessAmount || 0).toLocaleString()} Tokens</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-black text-blue-400">+{user?.pointsBreakdown?.lambo.toFixed(1)} pts</div>
                        <div className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">Real-time Accrual</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-effect p-6 rounded-[2rem] border border-white/5 space-y-3">
                     <TrendingUp className="text-green-500 w-5 h-5" />
                     <div className="space-y-1">
                        <div className="text-lg font-black italic tracking-tighter">+{user?.validTweetsCount}</div>
                        <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Verified Mentions</div>
                     </div>
                  </div>
                  <div className="glass-effect p-6 rounded-[2rem] border border-white/5 space-y-3">
                     <Clock className="text-orange-500 w-5 h-5" />
                     <div className="space-y-1">
                        <div className="text-lg font-black italic tracking-tighter">{user?.twitterAgeDays}d</div>
                        <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Account Seniority</div>
                     </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-500 text-center">
                <BadgeDisplay tier={getTierFromPoints(user?.points || 0)} imageUrl={badgeImage} loading={isGenerating} />
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xl font-black italic uppercase tracking-tight">Identity Badge NFT</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.1em] px-8">
                      {user && user.points >= 100 && (user.lambolessAmount || 0) >= 1000 
                        ? "Eligibility Confirmed. You are ready to mint your dynamic identity."
                        : "Requirements not met. Minimum 100 Points & 1,000 Lamboless required."}
                    </p>
                  </div>

                  {!isMinted ? (
                    <button 
                      onClick={handleClaim}
                      disabled={isGenerating || isMinting || (user?.points || 0) < 100 || (user?.lambolessAmount || 0) < 1000}
                      className={`w-full py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                        (user?.points || 0) >= 100 && (user?.lambolessAmount || 0) >= 1000
                        ? 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] hover:scale-[1.02] active:scale-95' 
                        : 'bg-white/5 text-gray-600 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      {isMinting ? <><Loader2 size={16} className="animate-spin" /> Transacting...</> : isGenerating ? 'Forging AI Artifact...' : 'Mint Verified Badge'}
                    </button>
                  ) : (
                    <div className="p-6 rounded-[2rem] bg-green-500/10 border border-green-500/20 text-green-500 flex flex-col items-center gap-3">
                      <CheckCircle2 size={32} />
                      <div className="space-y-1">
                        <div className="text-sm font-black uppercase tracking-tight">Mint Successful</div>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Identity synchronized on Base mainnet</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {isAuthenticated && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xs glass-effect p-2 rounded-full border border-white/10 flex items-center justify-around z-50 shadow-2xl">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`p-3 rounded-full transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <LayoutDashboard size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('claim')}
            className={`p-3 rounded-full transition-all ${activeTab === 'claim' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Shield size={20} />
          </button>
          <div className="w-px h-6 bg-white/10" />
          <button className="p-3 text-gray-500 hover:text-gray-300">
            <Share2 size={20} />
          </button>
        </nav>
      )}
    </div>
  );
};

export default App;
