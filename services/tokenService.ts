import { ethers } from 'ethers';

const MINIMAL_ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const BASE_RPC_URL = "https://mainnet.base.org";
const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens/";

export class TokenService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  }

  async getBalance(walletAddress: string, tokenContractAddress: string): Promise<number> {
    try {
      const contract = new ethers.Contract(tokenContractAddress, MINIMAL_ERC20_ABI, this.provider);
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.decimals()
      ]);
      
      return parseFloat(ethers.formatUnits(balance, decimals));
    } catch (error) {
      console.error(`Token Balance Fetch Error for ${tokenContractAddress}:`, error);
      return 0;
    }
  }

  /**
   * Fetches real-time price from DexScreener for a specific token on Base.
   */
  async getTokenPrice(contractAddress: string): Promise<number> {
    try {
      const response = await fetch(`${DEXSCREENER_API}${contractAddress}`);
      const data = await response.json();
      
      // DexScreener returns an array of pairs. We look for the most liquid one on Base.
      if (data.pairs && data.pairs.length > 0) {
        // Filter for Base network and sort by liquidity if multiple pairs exist
        const basePairs = data.pairs.filter((p: any) => p.chainId === 'base');
        const bestPair = basePairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
        
        if (bestPair && bestPair.priceUsd) {
          return parseFloat(bestPair.priceUsd);
        }
      }
      return 0.0001; // Fallback
    } catch (error) {
      console.error(`DexScreener Price Fetch Error for ${contractAddress}:`, error);
      return 0.0001;
    }
  }
}

export const tokenService = new TokenService();