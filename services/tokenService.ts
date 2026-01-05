
import { ethers } from 'ethers';
import { geminiService } from './geminiService.ts';

const MINIMAL_ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base-mainnet.public.blastapi.io"
];

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens/";
const GECKOTERMINAL_API = "https://api.geckoterminal.com/api/v2/networks/base/tokens/";

interface PriceCache {
  value: number;
  timestamp: number;
}

export class TokenService {
  private currentRpcIndex: number = 0;
  private priceCache: Record<string, PriceCache> = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private getProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(RPC_URLS[this.currentRpcIndex]);
  }

  private rotateRpc() {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % RPC_URLS.length;
  }

  async getBalance(walletAddress: string, tokenContractAddress: string, retries: number = 3): Promise<number> {
    if (!walletAddress || !tokenContractAddress) return 0;

    try {
      const normalizedWallet = ethers.getAddress(walletAddress);
      const normalizedToken = ethers.getAddress(tokenContractAddress);
      
      const provider = this.getProvider();
      const contract = new ethers.Contract(normalizedToken, MINIMAL_ERC20_ABI, provider);
      
      const balancePromise = contract.balanceOf(normalizedWallet);
      const decimalsPromise = contract.decimals().catch(() => 18);
      
      const [balance, decimals] = await Promise.all([balancePromise, decimalsPromise]);
      return parseFloat(ethers.formatUnits(balance, decimals));
    } catch (error: any) {
      if (retries > 0) {
        this.rotateRpc();
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.getBalance(walletAddress, tokenContractAddress, retries - 1);
      }
      return 0;
    }
  }

  /**
   * Multi-source real-time pricing engine with fallbacks and caching.
   */
  async getTokenPrice(contractAddress: string): Promise<number> {
    const now = Date.now();
    const normalizedAddress = contractAddress.toLowerCase();

    // Check Cache
    if (this.priceCache[normalizedAddress] && (now - this.priceCache[normalizedAddress].timestamp < this.CACHE_DURATION)) {
      return this.priceCache[normalizedAddress].value;
    }

    let price = 0;

    // Source 1: DexScreener
    try {
      const response = await fetch(`${DEXSCREENER_API}${normalizedAddress}`, { signal: AbortSignal.timeout(4000) });
      const data = await response.json();
      if (data.pairs?.[0]?.priceUsd) {
        price = parseFloat(data.pairs[0].priceUsd);
      }
    } catch (e) { console.warn(`[TokenService] DexScreener failed for ${contractAddress}`); }

    // Source 2: GeckoTerminal Fallback
    if (price === 0) {
      try {
        const response = await fetch(`${GECKOTERMINAL_API}${normalizedAddress}`, { signal: AbortSignal.timeout(4000) });
        const data = await response.json();
        if (data.data?.attributes?.price_usd) {
          price = parseFloat(data.data.attributes.price_usd);
        }
      } catch (e) { console.warn(`[TokenService] GeckoTerminal failed for ${contractAddress}`); }
    }

    // Source 3: AI Intelligence Fallback (Gemini with Search Grounding)
    if (price === 0) {
      try {
        console.log(`[TokenService] Invoking Gemini Search grounding for ${contractAddress}`);
        price = await geminiService.getTokenPrice("Token", contractAddress);
      } catch (e) { console.warn(`[TokenService] AI Fallback failed for ${contractAddress}`); }
    }

    // Final sanity check
    if (price <= 0) price = 0.0001;

    // Update Cache
    this.priceCache[normalizedAddress] = { value: price, timestamp: now };
    return price;
  }
}

export const tokenService = new TokenService();
