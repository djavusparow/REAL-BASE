import { ethers } from 'ethers';

const MINIMAL_ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Public RPC Base dengan urutan prioritas yang diperbarui
const RPC_URLS = [
  "https://mainnet.base.org",
  "https://base.llamarpc.com",
  "https://base-mainnet.public.blastapi.io",
  "https://1rpc.io/base",
  "https://gateway.tenderly.co/public/base"
];

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens/";

export class TokenService {
  private currentRpcIndex: number = 0;

  private getProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(RPC_URLS[this.currentRpcIndex]);
  }

  private rotateRpc() {
    this.currentRpcIndex = (this.currentRpcIndex + 1) % RPC_URLS.length;
    console.warn(`[TokenService] Rotating to RPC: ${RPC_URLS[this.currentRpcIndex]}`);
  }

  /**
   * Mengambil saldo token dengan mekanisme rotasi RPC dan retry otomatis.
   */
  async getBalance(walletAddress: string, tokenContractAddress: string, retries: number = 3): Promise<number> {
    if (!walletAddress || !tokenContractAddress) return 0;

    try {
      const normalizedWallet = ethers.getAddress(walletAddress);
      const normalizedToken = ethers.getAddress(tokenContractAddress);
      
      const provider = this.getProvider();
      const contract = new ethers.Contract(normalizedToken, MINIMAL_ERC20_ABI, provider);
      
      // Mengambil balance dan decimals
      const balancePromise = contract.balanceOf(normalizedWallet);
      const decimalsPromise = contract.decimals().catch(() => 18); // Default 18 jika gagal
      
      const [balance, decimals] = await Promise.all([balancePromise, decimalsPromise]);
      
      const formattedBalance = parseFloat(ethers.formatUnits(balance, decimals));
      
      if (formattedBalance >= 0) {
        return formattedBalance;
      }
      return 0;
    } catch (error: any) {
      console.error(`[TokenService] Attempt failed for ${tokenContractAddress}:`, error.message);
      
      if (retries > 0) {
        this.rotateRpc();
        // Delay sedikit sebelum retry
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.getBalance(walletAddress, tokenContractAddress, retries - 1);
      }
      
      return 0;
    }
  }

  /**
   * Mengambil harga real-time dari DexScreener.
   */
  async getTokenPrice(contractAddress: string): Promise<number> {
    try {
      const normalizedAddress = contractAddress.toLowerCase();
      const response = await fetch(`${DEXSCREENER_API}${normalizedAddress}`, {
        headers: { 'Accept': 'application/json' },
        // Timeout 5 detik
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) throw new Error("Price API Unavailable");
      
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const basePairs = data.pairs.filter((p: any) => p.chainId === 'base');
        
        if (basePairs.length > 0) {
          const bestPair = basePairs.sort((a: any, b: any) => 
            (parseFloat(b.liquidity?.usd || "0")) - (parseFloat(a.liquidity?.usd || "0"))
          )[0];
          
          if (bestPair && bestPair.priceUsd) {
            return parseFloat(bestPair.priceUsd);
          }
        }
      }
      
      return 0.0001; 
    } catch (error) {
      console.error(`[TokenService] Price Fetch Error for ${contractAddress}:`, error);
      return 0.0001;
    }
  }
}

export const tokenService = new TokenService();