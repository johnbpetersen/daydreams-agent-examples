// src/agents/gmx/actions/__tests__/priceOracleTests.ts
// -------------------------------------------------------------
// Description: Test harness for querying token prices from the GMX Vault price oracle.
//   It sets up a provider, creates a contract instance for the GMX Vault, and queries
//   the price for Wrapped Bitcoin (WBTC) using GMX's 30-decimal price standard.
// Last Update: feat(priceOracleTest): Cleaned up and documented GMX Vault price query test
// -------------------------------------------------------------

import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// Set up the provider using the GMX_RPC_URL from the environment.
const provider = new ethers.JsonRpcProvider(process.env.GMX_RPC_URL);

// Define the GMX Vault contract address and its ABI.
const GMX_VAULT_ADDRESS =
  process.env.GMX_VAULT_ADDRESS || "0x489ee077994B6658eAfA855C308275EAd8097C4A";
const VAULT_ABI = [
  "function getMinPrice(address _token) view returns (uint256)",
];

// Create a contract instance for the GMX Vault.
const gmxVault = new ethers.Contract(GMX_VAULT_ADDRESS, VAULT_ABI, provider);

// Set the token address for Wrapped Bitcoin (WBTC on Arbitrum).
const WBTC_ADDRESS = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

async function queryBitcoinPrice() {
  try {
    // Call getMinPrice for WBTC.
    const priceBN = await gmxVault.getMinPrice(WBTC_ADDRESS);
    // Format the price using 30 decimals as per GMX standards.
    const price = parseFloat(ethers.formatUnits(priceBN, 30));
    console.log(`The current GMX price for Wrapped Bitcoin is $${price}`);
  } catch (error) {
    console.error("Error fetching Bitcoin price from GMX Vault:", error);
  }
}

queryBitcoinPrice();
