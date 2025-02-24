import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// 1. Set up the provider (using your GMX_RPC_URL from .env)
const provider = new ethers.JsonRpcProvider(process.env.GMX_RPC_URL);

// 2. Define the GMX Vault contract address and its ABI
const GMX_VAULT_ADDRESS =
  process.env.GMX_VAULT_ADDRESS || "0x489ee077994B6658eAfA855C308275EAd8097C4A";
const VAULT_ABI = [
  "function getMinPrice(address _token) view returns (uint256)",
];

// 3. Create a contract instance for the GMX Vault
const gmxVault = new ethers.Contract(GMX_VAULT_ADDRESS, VAULT_ABI, provider);

// 4. Set the token address for Bitcoin (Wrapped Bitcoin on Arbitrum)
// (Ensure you verify this address with a trusted source)
const WBTC_ADDRESS = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function queryBitcoinPrice() {
  try {
    // 5. Call the getMinPrice function for WBTC
    const priceBN = await gmxVault.getMinPrice(WBTC_ADDRESS);

    // 6. Format the price from a BigNumber (assuming 30 decimals as per GMX standards)
    const price = parseFloat(ethers.formatUnits(priceBN, 30));

    console.log(`The current GMX price for Wrapped Bitcoin is $${price}`);
  } catch (error) {
    console.error("Error fetching Bitcoin price from GMX Vault:", error);
  }
}

queryBitcoinPrice();
