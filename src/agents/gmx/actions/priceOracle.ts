// src/agents/gmx/actions/priceOracle.ts

import { ethers } from "ethers";
import dotenv from "dotenv";
import { TOKEN_CONFIG, GMX_VAULT_ADDRESS, GMX_RPC_URL } from "../config";

const WETH_ADDRESS = TOKEN_CONFIG.WETH.address;

dotenv.config();

// Define the GMX Vault ABI for price fetching.
const VAULT_ABI = [
  "function getMinPrice(address _token) view returns (uint256)",
];

// Create a provider.
const provider = new ethers.JsonRpcProvider(GMX_RPC_URL);

// Instantiate the GMX Vault contract.
const gmxVault = new ethers.Contract(GMX_VAULT_ADDRESS, VAULT_ABI, provider);

/**
 * Calculates the expected minimum output (minOut) for a given trade,
 * applying a specified slippage tolerance.
 *
 * This helper currently supports only the WETH <-> USDC pair.
 *
 * @param tokenIn - The symbol for the input token ("WETH" or "USDC")
 * @param tokenOut - The symbol for the output token ("WETH" or "USDC")
 * @param amountIn - The amount of tokenIn (in human-readable units, e.g., ETH or USDC)
 * @param slippageTolerance - Slippage tolerance as a decimal (e.g., 0.02 for 2%)
 * @returns The minimum acceptable output amount after applying slippage.
 */
export async function getExpectedOutput(
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
  slippageTolerance: number
): Promise<number> {
  // Get the current price of ETH from the GMX Vault.
  // GMX Vault returns the price with 30 decimals (price in USDC per ETH).
  const priceBN = await gmxVault.getMinPrice(WETH_ADDRESS);
  const ethPrice = parseFloat(ethers.formatUnits(priceBN, 30)); // e.g., 2737.44 USDC per ETH

  let expectedOutput: number;
  if (tokenIn.toUpperCase() === "WETH" && tokenOut.toUpperCase() === "USDC") {
    // For a buy order: Convert ETH to USDC.
    expectedOutput = amountIn * ethPrice;
  } else if (
    tokenIn.toUpperCase() === "USDC" &&
    tokenOut.toUpperCase() === "WETH"
  ) {
    // For a sell order: Convert USDC to ETH.
    expectedOutput = amountIn / ethPrice;
  } else {
    throw new Error("Unsupported token pair in getExpectedOutput");
  }
  // Apply slippage tolerance.
  return expectedOutput * (1 - slippageTolerance);
}
