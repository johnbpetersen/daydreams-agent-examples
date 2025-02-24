// src/agents/gmx/actions/index.ts

import { ethers } from "ethers";
import type { TradeParameters } from "../prompts/main";
import dotenv from "dotenv";
import {
  TOKEN_CONFIG,
  GMX_ROUTER_ADDRESS,
  GMX_VAULT_ADDRESS,
  GMX_RPC_URL,
  PRIVATE_KEY,
} from "../config";
// Rename the imported functions to avoid naming conflicts.
import {
  getExpectedOutput as importedGetExpectedOutput,
  computeMinOut as importedComputeMinOut,
  getTokenPrice,
} from "./priceOracle";

dotenv.config();

// --- Provider and Wallet ---
const provider = new ethers.JsonRpcProvider(GMX_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// --- Contract ABIs ---
const VAULT_ABI = [
  "function getMinPrice(address _token) view returns (uint256)",
];

const ROUTER_ABI = [
  "function swap(address[] memory _path, uint256 _amountIn, uint256 _minOut, address _receiver) external payable",
  "function getAmountOut(address _tokenIn, address _tokenOut, uint256 _amountIn) external view returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

// --- Contract Instances ---
// GMX Vault instance (for price data)
const gmxVault = new ethers.Contract(GMX_VAULT_ADDRESS, VAULT_ABI, provider);

// Instantiate the GMX Router with wallet as signer.
const gmxRouter = new ethers.Contract(GMX_ROUTER_ADDRESS, ROUTER_ABI, wallet);

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
 * Approves the GMX Router to spend a specified amount of the given token.
 */
export async function approveToken(
  tokenSymbol: string,
  amount: number
): Promise<void> {
  try {
    const { address, decimals } = getTokenConfig(tokenSymbol);
    const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);
    const tokenWithSigner = tokenContract.connect(wallet);
    const amountBN = ethers.parseUnits(amount.toString(), decimals);

    console.log(
      `Submitting approval for GMX Router to spend ${tokenSymbol}...`
    );
    const tx = await (tokenWithSigner as any).approve(
      GMX_ROUTER_ADDRESS,
      amountBN
    );
    console.log("Approval transaction submitted, waiting for confirmation...");
    await tx.wait();
    console.log("Approval confirmed.");
  } catch (error) {
    console.error(`Error approving ${tokenSymbol}:`, error);
    throw error;
  }
}

/**
 * Executes a swap trade on GMX using the Router contract.
 * Converts human‑readable amounts to BigNumbers using token decimals,
 * computes minOut dynamically via our price oracle,
 * checks allowance if needed, and then executes the swap.
 */
export async function placeTrade(
  order: TradeParameters
): Promise<ethers.TransactionReceipt> {
  try {
    // Look up token configurations for tokenIn and tokenOut.
    const tokenInConfig = getTokenConfig(order.tokenIn);
    const tokenOutConfig = getTokenConfig(order.tokenOut);

    // Convert amountIn using tokenIn decimals.
    const amountInBN = ethers.parseUnits(
      order.amountIn.toString(),
      tokenInConfig.decimals
    );

    // Compute minOut dynamically using our helper.
    const computedMinOut = await importedComputeMinOut(
      order.tokenIn,
      order.tokenOut,
      order.amountIn,
      order.slippage ?? 0.02
    );

    // Convert with maximum precision
    const minOutStr = computedMinOut.toFixed(tokenOutConfig.decimals);
    const finalMinOutBN = ethers.parseUnits(minOutStr, tokenOutConfig.decimals);

    // Add more debug logging
    console.log(`
Detailed conversion steps:
1. Raw computedMinOut: ${computedMinOut}
2. Formatted with decimals: ${minOutStr}
3. As BigNumber: ${finalMinOutBN.toString()}
4. Token decimals: ${tokenOutConfig.decimals}
`);

    // Verify the values are reasonable
    if (
      finalMinOutBN.toString() === "0" ||
      finalMinOutBN.toString() === "225"
    ) {
      throw new Error(
        `Invalid minOut value calculated: ${finalMinOutBN.toString()}`
      );
    }

    // For non-native tokens, check allowance.
    if (order.tokenIn.toUpperCase() !== "ETH") {
      const tokenContract = new ethers.Contract(
        tokenInConfig.address,
        ERC20_ABI,
        provider
      );
      const currentAllowance: bigint = await tokenContract.allowance(
        wallet.address,
        GMX_ROUTER_ADDRESS
      );
      console.log(`DEBUG: Current allowance: ${currentAllowance}`);
      if (currentAllowance < amountInBN) {
        console.log("Allowance insufficient, approving token...");
        await approveToken(order.tokenIn, order.amountIn);
      } else {
        console.log("Sufficient allowance exists.");
      }
    }

    // Log the trade parameters.
    console.log("Executing swap with parameters:");
    console.log("Path:", [tokenInConfig.address, tokenOutConfig.address]);
    console.log("Amount In (BigNumber):", amountInBN.toString());
    console.log("Final minOut (BigNumber):", finalMinOutBN.toString());
    console.log(
      `DEBUG: tokenIn ${order.tokenIn} decimals: ${tokenInConfig.decimals}`
    );
    console.log(
      `DEBUG: tokenOut ${order.tokenOut} decimals: ${tokenOutConfig.decimals}`
    );
    console.log(`DEBUG: amountIn (human-readable): ${order.amountIn}`);

    // Execute the swap via the GMX Router.
    const tx = await (gmxRouter as any).swap(
      [tokenInConfig.address, tokenOutConfig.address],
      amountInBN,
      finalMinOutBN,
      wallet.address,
      { value: 0n }
    );
    console.log("Trade submitted, waiting for confirmation...");
    const receipt = await tx.wait();
    return receipt;
  } catch (error) {
    console.error("Error executing trade:", error);
    throw error;
  }
}
