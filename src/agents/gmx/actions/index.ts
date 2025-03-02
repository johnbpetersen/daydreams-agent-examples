// src/agents/gmx/actions/index.ts
// -------------------------------------------------------------
// Description: Contains GMX-specific trading actions for the GMX Trading Agent.
//   This module sets up the blockchain provider and wallet, interacts with the GMX Vault
//   and Router contracts, checks token allowances, and executes swap trades.
//   Detailed logs trace conversion steps for amount conversion, minOut computation,
//   and other key parameters.
// Last Update: feat(actions): Integrated Daydreams core updates and cleaned up debug logging
// -------------------------------------------------------------

import { ethers } from "ethers";
import type { CommandParameters } from "../prompts/main";
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
const gmxVault = new ethers.Contract(GMX_VAULT_ADDRESS, VAULT_ABI, provider);
const gmxRouter = new ethers.Contract(GMX_ROUTER_ADDRESS, ROUTER_ABI, wallet);

/**
 * Looks up token configuration by symbol.
 * @throws Error if the token config is not found.
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
 * @param tokenSymbol - The token symbol.
 * @param amount - The human-readable amount to approve.
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
    console.log("Approval submitted, waiting for confirmation...");
    await tx.wait();
    console.log("Approval confirmed.");
  } catch (error) {
    console.error(`Error approving ${tokenSymbol}:`, error);
    throw error;
  }
}

/**
 * Executes a swap trade on GMX using the Router contract.
 * Converts human-readable amounts to BigNumbers using token decimals,
 * computes minOut dynamically, checks allowance if needed, and executes the swap.
 * @param order - The trade order parameters.
 * @returns The transaction receipt.
 */
export async function placeTrade(
  order: CommandParameters
): Promise<ethers.TransactionReceipt> {
  try {
    // Lookup token configurations.
    const tokenInConfig = getTokenConfig(order.tokenIn);
    const tokenOutConfig = getTokenConfig(order.tokenOut);

    // Convert amountIn using tokenIn decimals.
    const amountInBN = ethers.parseUnits(
      order.amountIn.toString(),
      tokenInConfig.decimals
    );
    console.log(`Order amount: ${order.amountIn} ${order.tokenIn}`);

    // Compute expected output.
    const expectedOutput = await importedGetExpectedOutput(
      order.tokenIn,
      order.tokenOut,
      order.amountIn
    );
    console.log(`Expected output: ${expectedOutput} ${order.tokenOut}`);

    // Compute minOut.
    const computedMinOut = await importedComputeMinOut(
      order.tokenIn,
      order.tokenOut,
      order.amountIn,
      order.slippage ?? 0.02
    );
    console.log(`Computed minOut: ${computedMinOut}`);

    // Convert computedMinOut to token units.
    const factor = Math.pow(10, tokenOutConfig.decimals);
    const rawMinOutUnits = Math.floor(computedMinOut * factor);
    let adjustedMinOutUnits = rawMinOutUnits;
    if (tokenOutConfig.decimals !== 18) {
      adjustedMinOutUnits = Math.max(rawMinOutUnits - 1, 0);
      console.log(`Adjusted minOut units: ${adjustedMinOutUnits}`);
    }
    const minOutStr = (adjustedMinOutUnits / factor).toFixed(
      tokenOutConfig.decimals
    );
    const finalMinOutBN = ethers.parseUnits(minOutStr, tokenOutConfig.decimals);

    console.log(`
Detailed conversion steps:
1. Computed minOut: ${computedMinOut}
2. Token units (raw): ${computedMinOut * factor}
3. Floored units: ${rawMinOutUnits}
4. Adjusted units: ${adjustedMinOutUnits}
5. Formatted value: ${minOutStr}
6. Final minOut (BigNumber): ${finalMinOutBN.toString()}
Token decimals (tokenOut): ${tokenOutConfig.decimals}
`);

    if (
      finalMinOutBN.toString() === "0" ||
      finalMinOutBN.toString() === "225"
    ) {
      throw new Error(
        `Invalid minOut value calculated: ${finalMinOutBN.toString()}`
      );
    }

    // Check token allowance if tokenIn is not ETH.
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
      console.log(
        `Current allowance for ${order.tokenIn}: ${currentAllowance}`
      );
      if (currentAllowance < amountInBN) {
        console.log("Allowance insufficient, approving token...");
        await approveToken(order.tokenIn, order.amountIn);
      }
    }

    // Log wallet balance for tokenIn.
    {
      const tokenContract = new ethers.Contract(
        tokenInConfig.address,
        ERC20_ABI,
        provider
      );
      const balanceBN: bigint = await tokenContract.balanceOf(wallet.address);
      console.log(
        `Wallet balance for ${order.tokenIn}: ${balanceBN.toString()}`
      );
    }

    console.log("Executing swap with parameters:");
    console.log("Path:", [tokenInConfig.address, tokenOutConfig.address]);
    console.log("Amount In (BigNumber):", amountInBN.toString());
    console.log("Final minOut (BigNumber):", finalMinOutBN.toString());

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
