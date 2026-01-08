import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  Loader2, 
  TrendingUp, 
  LayoutDashboard, 
  Gift, 
  Twitter, 
  RefreshCw,
  Fingerprint,
  ChevronRight,
  Coins,
  LogOut,
  CheckCircle2,
  ShieldAlert,
  UserCheck,
  Smartphone,
  Info
} from 'lucide-react';
import { sdk } from '@farcaster/frame-sdk';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { UserStats, RankTier } from './types';
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

const STORAGE_KEY = 'base_impression_v5_secure';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginStep, setLoginStep] = useState<'IDLE' | 'APPROVE' | 'SIGNING' | 'SUCCESS'>('IDLE');
  const [user, setUser] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  
  const [isLinkingTwitter, setIsLinkingTwitter] = useState(false);
  const [linkedTwitterHandle, setLinkedTwitterHandle] = useState<string | null>(null);

  const syncUserData = useCallback(async (address: string, fid: number, username: string, twitterHandle: string) => {
    setIsSyncing(true);
    try {
      const context = await sdk.context;
      const lamboBalance = await tokenService.getBalance(address, LAMBOLESS_CONTRACT);
      const lamboPrice = await tokenService.getTokenPrice(LAMBOLESS_CONTRACT);
      const lamboUsdValue = lamboBalance * lamboPrice;
      const twitterAudit = await twitterService.scanPosts(twitterHandle);

      const { total, breakdown } = calculateDetailedPoints(
        1, 
        twitterAudit.accountAgeDays,
        twitterAudit.totalValidPosts,
        fid,
        { lambo: lamboUsdValue },
        twitterAudit.basepostingPoints
      );

      const stats: any = {
        address,
        twitterHandle: twitterHandle.startsWith('@') ? twitterHandle : `@${twitterHandle}`,
        twitterAgeDays: twitterAudit.accountAgeDays,
        validTweetsCount: twitterAudit.totalValidPosts,
        basepostingPoints: twitterAudit.basepostingPoints,
        lambolessBalance: lamboUsdValue,
        lambolessAmount: lamboBalance,
        points: total,
        farcasterId: fid,
        farcasterUsername: username,
        farcasterDisplayName: context?.user?.displayName || username,
        farcasterPfp: context?.user?.pfpUrl,
        pointsBreakdown: breakdown
      };

      setUser(stats);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ fid, twitterHandle, authenticated: true, address }));
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
          const savedData = localStorage.getItem(STORAGE_KEY);
          if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed.fid === context.user.fid && parsed.authenticated) {
              setIsAuthenticated(true);
              setLinkedTwitterHandle(parsed.twitterHandle);
              await syncUserData(parsed.address, context.user.fid, context.user.username, parsed.twitterHandle || context.user.username);
            }
          }
        }
      } catch (e) {
        console.error("Init Error", e);
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, [syncUserData]);

  const startFarcasterLogin = async () => {
    setLoginStep('APPROVE');
    try {
      const context = await sdk.context;
      if (!context?.user) throw new Error("Please open in Farcaster");

      const generatedNonce = Math.random().toString(36).substring(2, 15);
      const signInResult = await sdk.actions.signIn({ nonce: generatedNonce });
      if (!signInResult) throw new Error("Login rejected");
      
      setLoginStep('SIGNING');
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("Wallet not found");
      
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      const address = ethers.getAddress(accounts[0]);

      const challenge = `BASE IMPRESSION LOGIN\n\nFID: #${context.user.fid}\nVerify your on-chain and social footprint.`;
      await provider.request({ method: 'personal_sign', params: [challenge, address] });

      setLoginStep('SUCCESS');
      setTimeout(async () => {
        setIsAuthenticated(true);
        await syncUserData(address, context.user.fid, context.user.username, context.user.username);
      }, 500);
    } catch (e: any) {
      setLoginStep('IDLE');
      alert(e.message || "Login failed");
    }
  };

  const linkTwitter = async () => {
    setIsLinkingTwitter(true);
    const handle = prompt("Enter X (Twitter) Handle:", user?.farcasterUsername || "");
    if (handle) {
      const sanitized = handle.replace('@', '');
      setLinkedTwitterHandle(sanitized);
      if (user) await syncUserData(user.address, user.farcasterId || 0, user.farcasterUsername || "", sanitized);
    }
    setIsLinkingTwitter(false);
  };

  const handleMint = async () => {
    if (!user || isGenerating || isMinting) return;
    
    setIsGenerating(true);
    try {
      const tier = getTierFromPoints(user.points);
      const preview = await geminiService.generateBadgePreview(tier, user.farcasterUsername || "BaseUser");
      setBadgeImage(preview);
      
      setIsMinting(true);
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("Wallet not found");
      
      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      await contract.methods.mintBadge(preview || "", tierMap[tier] || 3).send({ from: user.address });
      
      setIsMinted(true);
      sdk.actions.cast({ text: `I just minted my ${tier} Impact Badge on @base! #BaseImpression #Onchain` });
    } catch (e: any) {
      alert(e.message || "Mint failed");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  if (!isReady) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 space-y-12 text-center">
        <div className="space-y-4">
          <Zap className="w-20 h-20 text-blue-500 mx-auto" fill="currentColor" />
          <h1 className="text-5xl font-black italic tracking-tighter uppercase">Base Impression</h1>
          <p className="text-gray-400 max-w-xs mx-auto text-sm font-bold uppercase tracking-widest">Connect Farcaster to verify your on-chain social identity.</p>
        </div>
        
        <div className="w-full max-w-sm bg-white/5 border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-xl">
           <button 
             onClick={startFarcasterLogin}
             disabled={loginStep !== 'IDLE'}
             className="w-full py-6 bg-white text-black rounded-2xl font-black uppercase italic text-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
           >
             {loginStep === 'IDLE' ? (
               <>Connect Farcaster <ChevronRight /></>
             ) : (
               <><Loader2 className="animate-spin" /> {loginStep}...</>
             )}
           </button>
           <p className="text-[10px] text-gray-500 mt-6 uppercase tracking-widest leading-relaxed">By connecting, you authorize Base Impression to read your FID and wallet address for score calculation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans pb-24">
      <header className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <Zap className="text-blue-500" fill="currentColor" />
          <h1 className="text-lg font-black italic tracking-tighter uppercase">Base Impression</h1>
        </div>
        <button onClick={() => { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }} className="p-2 bg-white/5 rounded-full hover:bg-red-500/10 transition-colors">
          <LogOut size={16} className="text-gray-400" />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-8">
        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-xl' : 'text-gray-500'}`}
          >
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('claim')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'claim' ? 'bg-blue-600 shadow-xl' : 'text-gray-500'}`}
          >
            <Gift size={14} /> Claim
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-10 rounded-[3rem] border border-blue-500/20 text-center relative overflow-hidden shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mb-2">Total Impact Score</p>
              <h2 className="text-8xl font-black italic tracking-tighter">{isSyncing ? <Loader2 className="animate-spin inline" /> : user?.points || 0}</h2>
              <div className="mt-6 inline-flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20 text-[10px] font-bold uppercase tracking-widest">
                <ShieldCheck size={12} className="text-blue-400" /> Verified On-chain
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {/* FID Section */}
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                    <Fingerprint size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-500">FID: #{user?.farcasterId}</p>
                    <p className="text-lg font-black italic">@{user?.farcasterUsername}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-blue-400">Points</p>
                  <p className="text-xl font-black italic">+{user?.pointsBreakdown?.social_fc}</p>
                </div>
              </div>

              {/* Twitter Section */}
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                    <Twitter size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-500">Twitter</p>
                    <p className="text-lg font-black italic">{user?.twitterHandle}</p>
                  </div>
                </div>
                <div className="text-right">
                  {linkedTwitterHandle ? (
                    <>
                      <p className="text-[10px] font-black uppercase text-blue-400">Points</p>
                      <p className="text-xl font-black italic">+{user?.pointsBreakdown?.social_twitter}</p>
                    </>
                  ) : (
                    <button onClick={linkTwitter} className="text-[10px] font-black uppercase bg-blue-600 px-3 py-1.5 rounded-lg">Connect</button>
                  )}
                </div>
              </div>

              {/* Baseposting Section */}
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/20">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-500">Baseposting</p>
                    <p className="text-lg font-black italic">{user?.basepostingPoints / 10} Contributions</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-blue-400">Points</p>
                  <p className="text-xl font-black italic">+{user?.basepostingPoints}</p>
                </div>
              </div>

              {/* Token Holder Section */}
              <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400 border border-yellow-500/20">
                    <Coins size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-gray-500">Asset Holder</p>
                    <p className="text-lg font-black italic">{user?.lambolessBalance >= 2.5 ? 'YES' : 'NO'} (${user?.lambolessBalance.toFixed(2)})</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-blue-400">Points</p>
                  <p className="text-xl font-black italic">+{user?.pointsBreakdown?.lambo}</p>
                </div>
              </div>
            </div>

            <button onClick={() => syncUserData(user?.address || "", user?.farcasterId || 0, user?.farcasterUsername || "", linkedTwitterHandle || "")} disabled={isSyncing} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest active:scale-95 transition-all">
              {isSyncing ? <Loader2 className="animate-spin" /> : <RefreshCw />} Refresh Audit
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center space-y-4">
               <BadgeDisplay tier={getTierFromPoints(user?.points || 0)} imageUrl={badgeImage} loading={isGenerating} />
               <h3 className="text-3xl font-black italic tracking-tighter uppercase">{getTierFromPoints(user?.points || 0)} Impression Badge</h3>
             </div>

             <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Points Eligibility</span>
                  {user?.points >= 1000 ? <CheckCircle2 className="text-green-500" /> : <ShieldAlert className="text-red-500" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Hold $LAMBOLESS (min $2.5)</span>
                  {user?.lambolessBalance >= 2.5 ? <CheckCircle2 className="text-green-500" /> : <ShieldAlert className="text-red-500" />}
                </div>
                <div className="pt-4 border-t border-white/5 text-center">
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Claim is free, users pay gas on Base</p>
                </div>
             </div>

             <button 
               onClick={handleMint}
               disabled={user?.points < 1000 || user?.lambolessBalance < 2.5 || isMinting || isMinted}
               className={`w-full py-6 rounded-2xl font-black uppercase italic text-xl shadow-2xl transition-all ${isMinted ? 'bg-green-600' : 'bg-blue-600 hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:grayscale'}`}
             >
               {isMinting ? <><Loader2 className="animate-spin inline mr-2" /> Minting...</> : isMinted ? 'Minted Successfully' : 'Mint NFT Badge'}
             </button>

             {(user?.points < 1000 || user?.lambolessBalance < 2.5) && (
               <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                 <Info className="text-yellow-500 shrink-0" size={16} />
                 <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider leading-relaxed">
                   Requirements not met. To claim, you need at least 1000 points and hold $2.5 worth of $LAMBOLESS.
                 </p>
               </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
