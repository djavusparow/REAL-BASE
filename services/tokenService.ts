
import { ethers } from 'ethers';
import { TOKEN_CONTRACT } from '../constants.ts';

const MINIMAL_ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const BASE_RPC_URL = "https://mainnet.base.org";

export class TokenService {
  private provider: ethers.JsonRpcProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  }

  async getBalance(address: string): Promise<number> {
    try {
      const contract = new ethers.Contract(TOKEN_CONTRACT, MINIMAL_ERC20_ABI, this.provider);
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(address),
        contract.decimals()
      ]);
      
      return parseFloat(ethers.formatUnits(balance, decimals));
    } catch (error) {
      console.error("Token Balance Fetch Error:", error);
      return 0;
    }
  }
}

export const tokenService = new TokenService();
