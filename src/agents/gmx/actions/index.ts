// src/agents/gmx/actions/index.ts

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
  order: CommandParameters
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

    // Debug logging: Show conversion details.
    console.log(`DEBUG: order.amountIn (human-readable): ${order.amountIn}`);
    console.log(
      `DEBUG: tokenIn (${order.tokenIn}) decimals: ${tokenInConfig.decimals}`
    );
    console.log(`DEBUG: Converted amountInBN: ${amountInBN.toString()}`);

    // Compute expected output for the trade.
    const expectedOutput = await importedGetExpectedOutput(
      order.tokenIn,
      order.tokenOut,
      order.amountIn
    );
    console.log(
      `DEBUG: Expected output from getExpectedOutput: ${expectedOutput}`
    );

    // Compute minOut dynamically using our helper.
    const computedMinOut = await importedComputeMinOut(
      order.tokenIn,
      order.tokenOut,
      order.amountIn,
      order.slippage ?? 0.02
    );
    console.log(`DEBUG: Raw computedMinOut: ${computedMinOut}`);

    // Use floor rounding to avoid rounding up.
    const factor = Math.pow(10, tokenOutConfig.decimals);
    const rawMinOutUnits = Math.floor(computedMinOut * factor);
    console.log(
      `DEBUG: Raw computedMinOut in token units (before adjustment): ${computedMinOut * factor}`
    );
    console.log(`DEBUG: Floored minOut units (raw): ${rawMinOutUnits}`);

    // For tokens with non-18 decimals (e.g., WBTC with 8 decimals), subtract 1 unit for safety.
    let adjustedMinOutUnits = rawMinOutUnits;
    if (tokenOutConfig.decimals !== 18) {
      adjustedMinOutUnits = Math.max(rawMinOutUnits - 1, 0);
      console.log(
        `DEBUG: Adjusted minOut units after subtracting 1: ${adjustedMinOutUnits}`
      );
    }

    const minOutStr = (adjustedMinOutUnits / factor).toFixed(
      tokenOutConfig.decimals
    );
    const finalMinOutBN = ethers.parseUnits(minOutStr, tokenOutConfig.decimals);

    // Log detailed conversion steps.
    console.log(`
Detailed conversion steps:
1. Raw computedMinOut: ${computedMinOut}
2. Computed in token units (raw): ${computedMinOut * factor}
3. Floored token units: ${rawMinOutUnits}
4. Adjusted token units: ${adjustedMinOutUnits}
5. Formatted with decimals: ${minOutStr}
6. As BigNumber: ${finalMinOutBN.toString()}
7. Token decimals (tokenOut): ${tokenOutConfig.decimals}
`);

    // Verify the values are reasonable.
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
      console.log(
        `DEBUG: Current allowance for ${order.tokenIn}: ${currentAllowance}`
      );
      if (currentAllowance < amountInBN) {
        console.log("Allowance insufficient, approving token...");
        await approveToken(order.tokenIn, order.amountIn);
      } else {
        console.log("Sufficient allowance exists.");
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
        `DEBUG: Wallet balance for ${order.tokenIn}: ${balanceBN.toString()}`
      );
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

    // Optionally, call the router's getAmountOut function for comparison.
    try {
      const routerAmountOutBN = await gmxRouter.getAmountOut(
        tokenInConfig.address,
        tokenOutConfig.address,
        amountInBN
      );
      console.log(
        `DEBUG: Router.getAmountOut returned: ${routerAmountOutBN.toString()}`
      );
    } catch (err) {
      console.log("DEBUG: Router.getAmountOut not available or failed", err);
    }

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
