// src/agents/gmx/actions/priceOracle.ts
// -------------------------------------------------------------
// Description: Provides functions to retrieve token prices from the GMX Vault
// and calculate trade outputs. It uses a 30-decimal price standard from the GMX Vault,
// validates price ranges for specific tokens, and computes both expected output and
// minimum acceptable output (minOut) based on a slippage tolerance.
// Last Update: feat(priceOracle): Improved logging and precision handling
// -------------------------------------------------------------

import { ethers } from "ethers";
import { GMX_VAULT_ADDRESS, GMX_RPC_URL, TOKEN_CONFIG } from "../config";
import dotenv from "dotenv";

dotenv.config();

// Set up provider and the GMX Vault contract.
const provider = new ethers.JsonRpcProvider(GMX_RPC_URL);
const VAULT_ABI = [
  "function getMinPrice(address _token) view returns (uint256)",
];
const gmxVault = new ethers.Contract(GMX_VAULT_ADDRESS, VAULT_ABI, provider);

/**
 * Looks up token configuration by symbol.
 * Throws an error if the token is not found.
 */
function getTokenConfig(tokenSymbol: string): {
  address: string;
  decimals: number;
} {
  const token = TOKEN_CONFIG[tokenSymbol.toUpperCase()];
  if (!token || !token.address) {
    throw new Error(`Token config for ${tokenSymbol} not found`);
  }
  return token;
}

/**
 * Retrieves the current price for a token from the GMX Vault.
 * The price is converted from 30 decimals to a JavaScript number.
 *
 * @param tokenSymbol - The symbol of the token (e.g. "WBTC", "USDC").
 * @returns The token price in USD.
 * @throws An error if the fetched price is outside acceptable ranges.
 */
export async function getTokenPrice(tokenSymbol: string): Promise<number> {
  const { address } = getTokenConfig(tokenSymbol);
  const priceBN = await gmxVault.getMinPrice(address);
  const price = parseFloat(ethers.formatUnits(priceBN, 30));
  console.log(`Fetched price for ${tokenSymbol}: ${price} USD`);

  // Validate price ranges.
  if (tokenSymbol.toUpperCase() === "USDC") {
    if (price < 0.8 || price > 1.2) {
      throw new Error(`USDC price ${price} USD is out of acceptable range.`);
    }
  } else if (tokenSymbol.toUpperCase() === "WBTC") {
    if (price < 5000 || price > 150000) {
      throw new Error(`WBTC price ${price} USD is out of acceptable range.`);
    }
  } else {
    if (price <= 0) {
      throw new Error(`Fetched price for ${tokenSymbol} is invalid.`);
    }
  }
  return price;
}

/**
 * Computes the expected output for a trade from tokenIn to tokenOut.
 * Calculation: (amountIn * price(tokenIn)) / price(tokenOut)
 *
 * @param tokenIn - The token being spent.
 * @param tokenOut - The token being received.
 * @param amountIn - The human‑readable amount of tokenIn.
 * @returns The expected output in tokenOut's human‑readable units.
 */
export async function getExpectedOutput(
  tokenIn: string,
  tokenOut: string,
  amountIn: number
): Promise<number> {
  const priceIn = await getTokenPrice(tokenIn);
  const priceOut = await getTokenPrice(tokenOut);
  const expected = (amountIn * priceIn) / priceOut;
  const expectedStr = expected.toFixed(12);
  console.log(
    `Price calculation:\n${amountIn} ${tokenIn} * ${priceIn} USD / ${priceOut} USD\n` +
      `Raw result = ${expected}\nFormatted result = ${expectedStr} ${tokenOut}`
  );
  return parseFloat(expectedStr);
}

/**
 * Computes the minimum acceptable output (minOut) by applying a slippage tolerance.
 *
 * @param tokenIn - The token being spent.
 * @param tokenOut - The token being received.
 * @param amountIn - The human‑readable amount of tokenIn.
 * @param slippage - Slippage tolerance (default 0.02 for 2%).
 * @returns The minimum acceptable output in tokenOut's human‑readable units.
 */
export async function computeMinOut(
  tokenIn: string,
  tokenOut: string,
  amountIn: number,
  slippage: number = 0.02
): Promise<number> {
  const expectedOutput = await getExpectedOutput(tokenIn, tokenOut, amountIn);
  const minOut = expectedOutput * (1 - slippage);
  const minOutStr = minOut.toFixed(12);
  console.log(
    `After applying ${slippage * 100}% slippage:\n` +
      `Expected output = ${expectedOutput}\nMinOut = ${minOutStr} ${tokenOut}\n` +
      `Raw calculation = ${minOut}`
  );
  return parseFloat(minOutStr);
}
