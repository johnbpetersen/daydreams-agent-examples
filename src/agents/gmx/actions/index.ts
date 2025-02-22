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

// Instantiate the GMX Router with the wallet as signer.
const gmxRouter = new ethers.Contract(GMX_ROUTER_ADDRESS, ROUTER_ABI, wallet);

// --- Helper Functions ---

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
 *
 * @param tokenSymbol The symbol of the token to approve (e.g., "WETH", "USDC").
 * @param amount The amount to approve, as a number.
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
    // Use two-step casting if needed for ethers v6 (here we assume it's not needed, adjust if it is)
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
 *
 * @param order Contains tokenIn, tokenOut, amountIn, and minOut (all in human-readable format).
 * @returns The transaction receipt.
 */
export async function placeTrade(
  order: TradeParameters
): Promise<ethers.TransactionReceipt> {
  try {
    // Look up token configurations for tokenIn and tokenOut.
    const tokenInConfig = getTokenConfig(order.tokenIn);
    const tokenOutConfig = getTokenConfig(order.tokenOut);

    // Convert amounts using the appropriate decimals.
    const amountInBN = ethers.parseUnits(
      order.amountIn.toString(),
      tokenInConfig.decimals
    );
    const minOutBN = ethers.parseUnits(
      order.minOut.toString(),
      tokenOutConfig.decimals
    );

    // For orders where tokenIn requires approval (e.g. an ERC20 token), check allowance.
    // Here we assume that if tokenIn is not native (like ETH), it needs approval.
    if (order.tokenIn.toUpperCase() !== "ETH") {
      const tokenContract = new ethers.Contract(
        tokenInConfig.address,
        ERC20_ABI,
        provider
      );
      const currentAllowance = await tokenContract.allowance(
        wallet.address,
        GMX_ROUTER_ADDRESS
      );
      if (currentAllowance.lt(amountInBN)) {
        console.log("Allowance insufficient, approving token...");
        await approveToken(order.tokenIn, order.amountIn);
      } else {
        console.log("Sufficient allowance exists.");
      }
    }

    console.log("Executing swap with parameters:");
    console.log("Path:", [tokenInConfig.address, tokenOutConfig.address]);
    console.log("Amount In:", amountInBN.toString());
    console.log("Min Out:", minOutBN.toString());
    console.log("Receiver:", wallet.address);

    // Call the swap function on the router.
    // If you encounter type errors with connect, use a two-step cast as shown below.
    const routerWithSigner = gmxRouter; // gmxRouter is already instantiated with wallet as signer.
    const tx = await (routerWithSigner as unknown as any).swap(
      [tokenInConfig.address, tokenOutConfig.address],
      amountInBN,
      minOutBN,
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
