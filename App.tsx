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
  Info,
  Lock,
  UserCheck,
  Smartphone,
  CheckCircle,
  ExternalLink
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

const STORAGE_KEY = 'base_impression_v6_secure';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isTwitterLinked, setIsTwitterLinked] = useState(false);
  const [loginStep, setLoginStep] = useState<'IDLE' | 'SIWE' | 'TWITTER' | 'SUCCESS'>('IDLE');
  const [user, setUser] = useState<UserStats | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'claim'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [badgeImage, setBadgeImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  
  // Stats global simulasi
  const globalStats = { totalFarcaster: 124500, totalTwitter: 85200, connected: 4240 };

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
        { lambo: lamboUsdValue },
        twitterAudit.basepostingPoints
      );

      const stats: any = {
        address,
        twitterHandle: `@${twitterHandle}`,
        twitterAgeDays: twitterAudit.accountAgeDays,
        validTweetsCount: twitterAudit.totalValidPosts,
        basepostingPoints: twitterAudit.basepostingPoints,
        lambolessBalance: lamboUsdValue,
        lambolessAmount: lamboBalance,
        points: total,
        farcasterId: fid,
        farcasterUsername: username,
        pointsBreakdown: breakdown
      };

      setUser(stats);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ fid, twitterHandle, authenticated: true, twitterLinked: true, address }));
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
              setIsTwitterLinked(parsed.twitterLinked);
              await syncUserData(parsed.address, context.user.fid, context.user.username, parsed.twitterHandle);
            }
          }
        }
      } catch (e) { console.error(e); } finally { setIsReady(true); }
    };
    init();
  }, [syncUserData]);

  const handleLogin = async () => {
    setLoginStep('SIWE');
    try {
      const context = await sdk.context;
      if (!context?.user) throw new Error("Gunakan Farcaster Client");

      // 1. SIWE Farcaster Login
      const signInResult = await sdk.actions.signIn({ nonce: Math.random().toString(36).substring(7) });
      if (!signInResult) throw new Error("Login Ditolak");
      
      const provider = sdk.wallet?.ethProvider;
      if (!provider) throw new Error("Wallet tidak ditemukan");
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      const address = ethers.getAddress(accounts[0]);

      // Pop-up Izin
      if (!confirm(`Konfirmasi Keamanan:\nAplikasi BASE IMPRESSION akan membaca FID #${context.user.fid} dan alamat wallet ${address}. Lanjutkan?`)) return;

      const challenge = `BASE IMPRESSION SIWE\nFID: #${context.user.fid}\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      await provider.request({ method: 'personal_sign', params: [challenge, address] });
      
      setIsAuthenticated(true);
      setLoginStep('TWITTER');
    } catch (e: any) {
      alert(e.message || "Gagal Login");
      setLoginStep('IDLE');
    }
  };

  const handleTwitterLink = async () => {
    try {
      if (!confirm("Izin Akses Twitter:\nBASE IMPRESSION meminta izin untuk mengakses Username, User ID, dan Tanggal Pembuatan Akun Twitter Anda melalui OAuth 2.0.")) return;
      
      const twitterUser = await twitterService.authenticate();
      setIsTwitterLinked(true);
      setLoginStep('SUCCESS');
      
      const context = await sdk.context;
      const provider = sdk.wallet?.ethProvider;
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      
      setTimeout(async () => {
        await syncUserData(accounts[0], context!.user.fid, context!.user.username, twitterUser.username);
      }, 1000);
    } catch (e) {
      alert("Twitter link failed");
      setLoginStep('IDLE');
    }
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
      const web3 = new Web3(provider);
      const contract = new web3.eth.Contract(MINIMAL_NFT_ABI, NFT_CONTRACT_ADDRESS);
      
      const tierMap: Record<string, number> = { 'PLATINUM': 0, 'GOLD': 1, 'SILVER': 2, 'BRONZE': 3 };
      await contract.methods.mintBadge(preview || "", tierMap[tier] || 3).send({ from: user.address });
      
      setIsMinted(true);
    } catch (e: any) {
      alert(e.message || "Mint gagal");
    } finally {
      setIsGenerating(false);
      setIsMinting(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm("Anda yakin ingin memutuskan koneksi? Sesi akan dihapus.")) {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  if (!isReady) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  if (!isAuthenticated || !isTwitterLinked) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 space-y-12 text-center bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black">
        <div className="space-y-4">
          <Zap className="w-24 h-24 text-blue-500 mx-auto" fill="currentColor" />
          <h1 className="text-5xl font-black italic tracking-tighter uppercase text-white">Base Impression</h1>
          <p className="text-gray-400 max-w-xs mx-auto text-xs font-bold uppercase tracking-widest leading-loose">On-chain Contribution & Social Audit Protocol</p>
        </div>

        <div className="w-full max-w-sm bg-white/5 border border-white/10 p-8 rounded-[3rem] backdrop-blur-3xl space-y-4">
          {!isAuthenticated ? (
            <button 
              onClick={handleLogin} 
              className="w-full py-6 bg-white text-black rounded-2xl font-black uppercase italic text-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              {loginStep === 'SIWE' ? <Loader2 className="animate-spin" /> : "Connect Farcaster"}
            </button>
          ) : (
            <button 
              onClick={handleTwitterLink} 
              className="w-full py-6 bg-[#1DA1F2] text-white rounded-2xl font-black uppercase italic text-xl flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              {loginStep === 'TWITTER' ? <Loader2 className="animate-spin" /> : "Connect Twitter"}
            </button>
          )}
          
          <div className="pt-4 grid grid-cols-2 gap-2">
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <p className="text-[8px] text-gray-500 uppercase font-black">Audit global</p>
              <p className="text-sm font-bold">{globalStats.connected}+ User</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
              <p className="text-[8px] text-gray-500 uppercase font-black">Twitter OAuth</p>
              <p className="text-sm font-bold">Secure V2</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-24 selection:bg-blue-600">
      <header className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-2">
          <Zap className="text-blue-500" fill="currentColor" />
          <h1 className="text-lg font-black italic tracking-tighter uppercase">Base Impression</h1>
        </div>
        <button onClick={handleDisconnect} className="p-2 bg-red-500/10 rounded-full hover:bg-red-500/20 transition-all">
          <LogOut size={16} className="text-red-500" />
        </button>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-8">
        <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-xl' : 'text-gray-500'}`}>
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button onClick={() => setActiveTab('claim')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'claim' ? 'bg-blue-600 shadow-xl' : 'text-gray-500'}`}>
            <Gift size={14} /> Claim
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-blue-600/20 to-transparent p-12 rounded-[3.5rem] border border-blue-500/20 text-center relative overflow-hidden shadow-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400 mb-2">Total Accumulated Points</p>
              <h2 className="text-8xl font-black italic tracking-tighter">{isSyncing ? <Loader2 className="animate-spin inline" /> : user?.points || 0}</h2>
              <div className="mt-8 flex justify-center">
                 <div className="px-4 py-2 bg-blue-500/10 rounded-full border border-blue-500/20 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                   <ShieldCheck size={14} /> Identity Audited
                 </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400"><Fingerprint size={20} /></div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-black">FID: #{user?.farcasterId}</p>
                    <p className="text-sm font-bold">Farcaster Seniority</p>
                  </div>
                </div>
                <p className="text-lg font-black">+{user?.pointsBreakdown?.social_fc} Pts</p>
              </div>

              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400"><Twitter size={20} /></div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-black">{user?.twitterHandle}</p>
                    <p className="text-sm font-bold">X Account Age</p>
                  </div>
                </div>
                <p className="text-lg font-black">+{user?.pointsBreakdown?.social_twitter} Pts</p>
              </div>

              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-400"><TrendingUp size={20} /></div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-black">{user?.basepostingPoints / 10} Mentions</p>
                    <p className="text-sm font-bold">BASEPOSTING</p>
                  </div>
                </div>
                <p className="text-lg font-black">+{user?.basepostingPoints} Pts</p>
              </div>

              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-400"><Coins size={20} /></div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase font-black">{user?.lambolessBalance >= 2.5 ? "Yes" : "No"}</p>
                    <p className="text-sm font-bold">Token Holder ($2.5+)</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-lg font-black">+{user?.pointsBreakdown?.lambo} Pts</p>
                   <p className="text-[9px] text-gray-500 font-bold">${user?.lambolessBalance.toFixed(2)} USD</p>
                </div>
              </div>
            </div>

            <button onClick={() => user && syncUserData(user.address, user.farcasterId || 0, user.farcasterUsername || "", user.twitterHandle.replace('@',''))} disabled={isSyncing} className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
              {isSyncing ? <Loader2 className="animate-spin" /> : <RefreshCw size={14} />} Re-Calculate Points
            </button>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4">
              <BadgeDisplay tier={getTierFromPoints(user?.points || 0)} imageUrl={badgeImage} loading={isGenerating} />
              <div className="space-y-1">
                 <h3 className="text-3xl font-black italic tracking-tighter uppercase">{getTierFromPoints(user?.points || 0)} TIER</h3>
                 <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Impression Eligibility Status</p>
              </div>
            </div>

            <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Min. Tier Requirement</span>
                {user && user.points >= 1000 ? <CheckCircle2 className="text-green-500" /> : <ShieldAlert className="text-red-500" />}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">$LAMBOLESS Balance (>$2.5)</span>
                {user && user.lambolessBalance >= 2.5 ? <CheckCircle2 className="text-green-500" /> : <ShieldAlert className="text-red-500" />}
              </div>
              
              <div className="pt-4 border-t border-white/5 space-y-4">
                 <div className="flex items-center justify-between text-[10px] font-bold uppercase text-gray-500">
                    <span>Platinum: >5000</span>
                    <span>Gold: >3000</span>
                    <span>Silver: >1000</span>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
               <button 
                 onClick={handleMint}
                 disabled={!user || user.points < 1000 || user.lambolessBalance < 2.5 || isMinting || isMinted}
                 className={`w-full py-7 rounded-3xl font-black uppercase italic text-xl shadow-2xl transition-all ${isMinted ? 'bg-green-600' : 'bg-blue-600 hover:scale-[1.03] active:scale-95 disabled:opacity-30 disabled:grayscale'}`}
               >
                 {isMinting ? "Processing..." : isMinted ? "Badge Collected" : "Mint NFT Badge"}
               </button>
               
               {(!user || user.points < 1000 || user.lambolessBalance < 2.5) && (
                 <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                    <Info size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] font-bold text-red-500 uppercase leading-relaxed">Ineligible: Anda membutuhkan minimal 1000 poin dan $2.5 token $LAMBOLESS di jaringan Base.</p>
                 </div>
               )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;