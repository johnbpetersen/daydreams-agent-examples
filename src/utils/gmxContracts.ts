import { ethers } from "ethers";
import type { TradeParameters } from "./groq";

// Ensure your .env file contains GMX_RPC_URL, for example:
// GMX_RPC_URL=https://arb1.arbitrum.io/rpc
const rpcUrl = process.env.GMX_RPC_URL;
if (!rpcUrl) {
  throw new Error("GMX_RPC_URL is not defined in your environment variables.");
}

// Create a provider from the RPC URL
const provider = new ethers.JsonRpcProvider(rpcUrl);

/**
 * -------------------------------
 * Price Fetching via GMX Vault
 * -------------------------------
 */

// GMX Vault contract address on Arbitrum (used for price data)
const GMX_VAULT_ADDRESS = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

// Minimal ABI for fetching the market price from the vault.
// The function getMinPrice expects a token address and returns a uint256.
// Note: GMX prices are typically represented with 30 decimals.
const VAULT_ABI = [
  "function getMinPrice(address _token) view returns (uint256)",
];

// Create a contract instance for the GMX Vault
const gmxVault = new ethers.Contract(GMX_VAULT_ADDRESS, VAULT_ABI, provider);

// WETH token address on Arbitrum (used as an example token)
const WETH_ADDRESS = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";

/**
 * Fetches the current market price for WETH using GMX Vault.
 * @returns {Promise<number>} The market price, formatted as a number.
 */
export async function getGMXPrice(): Promise<number> {
  try {
    // Call getMinPrice with the WETH token address
    const price = await gmxVault.getMinPrice(WETH_ADDRESS);
    // Format the price from a BigNumber using 30 decimals (adjust if needed)
    const formattedPrice = parseFloat(ethers.formatUnits(price, 30));
    return formattedPrice;
  } catch (error) {
    console.error("Error fetching GMX price:", error);
    throw error;
  }
}

/**
 * -------------------------------
 * Trade Execution via GMX Router
 * -------------------------------
 */

// Update to use the correct GMX Router address
const GMX_ROUTER_ADDRESS = "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064";

// Update the Router ABI
const ROUTER_ABI = [
  "function swap(address[] memory _path, uint256 _amountIn, uint256 _minOut, address _receiver) external payable",
  "function getAmountOut(address _tokenIn, address _tokenOut, uint256 _amountIn) external view returns (uint256)",
];

// Update Router interface to match the ABI
interface GMXRouter extends ethers.BaseContract {
  swap(
    path: string[],
    amountIn: bigint,
    minOut: bigint,
    receiver: string,
    options?: { value: bigint }
  ): Promise<ethers.ContractTransactionResponse>;

  getAmountOut(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<bigint>;
}

// Create a typed contract instance
const gmxRouter = new ethers.Contract(
  GMX_ROUTER_ADDRESS,
  ROUTER_ABI,
  provider
) as unknown as GMXRouter;

/**
 * -------------------------------
 * Wallet Setup
 * -------------------------------
 */

// Retrieve the private key from your environment variables (use a test wallet!)
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error("PRIVATE_KEY is not defined in your environment variables.");
}

// Create a wallet instance using the private key and connect it to the provider
const wallet = new ethers.Wallet(privateKey, provider);

/**
 * -------------------------------
 * Approve WETH for GMX Router
 * -------------------------------
 */

// Update the ERC20 ABI to include balanceOf
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

// Update the interface to include balanceOf
interface IERC20 extends ethers.BaseContract {
  approve: {
    (
      spender: string,
      amount: bigint
    ): Promise<ethers.ContractTransactionResponse>;
    name: string;
  };
  balanceOf: {
    (account: string): Promise<bigint>;
    name: string;
  };
  allowance: {
    (owner: string, spender: string): Promise<bigint>;
    name: string;
  };
}

/**
 * Approves the GMX Router to spend a specified amount of WETH.
 * @param amount The amount of WETH to approve (as a number, assumed to be 18 decimals).
 * @returns {Promise<any>} The approval transaction response.
 */
export async function approveWETH(amount: number): Promise<any> {
  try {
    const wethContract = new ethers.Contract(
      WETH_ADDRESS,
      ERC20_ABI,
      provider
    ) as unknown as IERC20;
    const wethWithSigner = wethContract.connect(wallet) as unknown as IERC20;
    const amountBN = ethers.parseUnits(amount.toString(), 18);

    console.log("Submitting approval for GMX Router to spend WETH...");
    const tx = await wethWithSigner.approve(GMX_ROUTER_ADDRESS, amountBN);
    console.log("Approval transaction submitted, waiting for confirmation...");
    await tx.wait();
    console.log("Approval confirmed.");
    return tx;
  } catch (error) {
    console.error("Error during approval:", error);
    throw error;
  }
}

/**
 * Executes a token swap trade on GMX using the Router contract.
 * @param order An object containing trade details:
 *   - tokenIn: Address of the token to swap from.
 *   - tokenOut: Address of the token to swap to.
 *   - amountIn: Amount of tokenIn to swap (as a number, assumed to be 18 decimals).
 *   - minOut: Minimum acceptable amount of tokenOut (as a number; for USDC, typically 6 decimals).
 * @returns {Promise<any>} The transaction response.
 */
export async function placeTrade(order: TradeParameters): Promise<any> {
  try {
    // First check WETH allowance
    const wethContract = new ethers.Contract(
      WETH_ADDRESS,
      ERC20_ABI,
      provider
    ) as unknown as IERC20;

    const currentAllowance = await wethContract.allowance(
      wallet.address,
      GMX_ROUTER_ADDRESS
    );
    const amountInBN = ethers.parseUnits(order.amountIn.toString(), 18);

    // If allowance is insufficient, approve first
    if (currentAllowance < amountInBN) {
      console.log(
        "Insufficient allowance. Current:",
        ethers.formatUnits(currentAllowance, 18)
      );
      console.log("Approving WETH for GMX Router...");
      await approveWETH(order.amountIn);
      console.log("Approval completed.");
    } else {
      console.log(
        "Sufficient allowance exists:",
        ethers.formatUnits(currentAllowance, 18)
      );
    }

    const routerWithSigner = gmxRouter.connect(wallet) as unknown as GMXRouter;

    console.log("Executing swap with parameters:");
    console.log("Path:", [order.tokenIn, order.tokenOut]);
    console.log("Amount In:", ethers.formatUnits(amountInBN, 18), "WETH");
    console.log("Min Out:", order.minOut, "USDC");
    console.log("Receiver:", wallet.address);

    // Execute the swap
    const tx = await routerWithSigner.swap(
      [order.tokenIn, order.tokenOut],
      amountInBN,
      ethers.parseUnits(order.minOut.toString(), 6), // USDC has 6 decimals
      wallet.address,
      { value: 0n } // Use bigint literal with 'n' suffix
    );

    console.log("Trade submitted, waiting for confirmation...");
    const receipt = await tx.wait();
    return receipt;
  } catch (error) {
    console.error("Error executing trade:", error);
    throw error;
  }
}

/**
 * -------------------------------
 * Test Trade Flow
 * -------------------------------
 * This function (optionally) approves a small amount of WETH and then attempts a swap.
 */
async function testTradeFlow() {
  try {
    // First check WETH balance
    const wethContract = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);
    const balance = await wethContract.balanceOf(wallet.address);
    console.log("WETH Balance:", ethers.formatUnits(balance, 18));

    // Check allowance
    const allowance = await wethContract.allowance(
      wallet.address,
      GMX_ROUTER_ADDRESS
    );
    console.log("Current allowance:", ethers.formatUnits(allowance, 18));

    // Always approve first to ensure sufficient allowance
    await approveWETH(0.001);

    // Define intended trade parameters:
    const amountIn = 0.0001; // WETH amount as a number
    const minOut = "0.27"; // USDC minimum acceptable output as a string for precise conversion

    // Log the conversion results for clarity:
    const convertedAmountIn = ethers.parseUnits(amountIn.toString(), 18);
    const convertedMinOut = ethers.parseUnits(minOut, 6);
    // Get the wallet's address to use as the receiver.
    const receiver = wallet.address;

    // ----- LOGGING BEFORE SWAP -----
    console.log("Preparing to call swap with the following parameters:");
    console.log("Token In (WETH):", WETH_ADDRESS);
    console.log(
      "Token Out (USDC):",
      "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8"
    );
    console.log(
      "Amount In (WETH, as BigNumber):",
      convertedAmountIn.toString()
    );
    console.log("Min Out (USDC, as BigNumber):", convertedMinOut.toString());
    console.log("Receiver Address:", receiver);
    // --------------------------------

    // Execute a swap: Swap 0.0001 WETH for USDC.
    // Note: placeTrade expects minOut as a number, so we convert the string with parseFloat.
    const tx = await placeTrade({
      tokenIn: WETH_ADDRESS, // WETH on Arbitrum
      tokenOut: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC on Arbitrum
      amountIn: amountIn, // 0.0001 WETH
      minOut: parseFloat(minOut), // 0.27 USDC as a number
    });
    console.log("Swap transaction successful:", tx);
  } catch (error) {
    console.error("Test trade flow failed:", error);
  }
}

// Run the test trade flow
// testTradeFlow();
