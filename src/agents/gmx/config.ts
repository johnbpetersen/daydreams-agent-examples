// src/agents/gmx/config.ts
// -------------------------------------------------------------
// Description: Contains configuration for the GMX Trading Agent on Arbitrum.
//   This includes static token mappings (addresses and decimals) and essential
//   contract addresses (GMX router, vault, RPC URL, and private key).
// Last Update: chore(config): initial token mapping and contract address configuration
// -------------------------------------------------------------

import dotenv from "dotenv";
dotenv.config();

export const TOKEN_CONFIG: Record<
  string,
  { address: string; decimals: number }
> = {
  // 1. Tether USD (USDT)
  USDT: {
    address:
      process.env.USDT_ADDRESS || "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
    decimals: 6,
  },
  // 2. Bridged USDC (USDC.e)
  USDC: {
    address:
      process.env.USDC_ADDRESS || "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
    decimals: 6,
  },
  // 3. Dai Stablecoin (DAI)
  DAI: {
    address:
      process.env.DAI_ADDRESS || "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
    decimals: 18,
  },
  // 4. Wrapped Bitcoin (WBTC)
  WBTC: {
    address:
      process.env.WBTC_ADDRESS || "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",
    decimals: 8,
  },
  // 5. ChainLink Token (LINK)
  LINK: {
    address:
      process.env.LINK_ADDRESS || "0xf97f4df75117a78c1A5a0DBb814Af92458539FB4",
    decimals: 18,
  },
  // 6. Uniswap (UNI)
  UNI: {
    address:
      process.env.UNI_ADDRESS || "0xfa7F8980b0f1E64A2062791cc3b0871572f1F7f0",
    decimals: 18,
  },
  // 7. Wrapped Ether (WETH)
  WETH: {
    address:
      process.env.WETH_ADDRESS || "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    decimals: 18,
  },
  // 8. Arbitrum (ARB)
  ARB: {
    address:
      process.env.ARB_ADDRESS || "0x912ce59144191c1204e64559fe8253a0e49e6548",
    decimals: 18,
  },
  // 9. Curve DAO Token (CRV)
  CRV: {
    address:
      process.env.CRV_ADDRESS || "0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978",
    decimals: 18,
  },
  // 11. USDS Stablecoin (USDS)
  USDS: {
    address:
      process.env.USDS_ADDRESS || "0x6491c05A82219b8D1479057361ff1654749b876b",
    decimals: 18,
  },
  // 13. GMX (GMX)
  GMX: {
    address:
      process.env.GMX_ADDRESS || "0xfc5a1a6eb076aef2c3dc2b192745c52ba2a2f33a",
    decimals: 18,
  },
};

export const GMX_ROUTER_ADDRESS =
  process.env.GMX_ROUTER_ADDRESS ||
  "0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064";
export const GMX_VAULT_ADDRESS =
  process.env.GMX_VAULT_ADDRESS || "0x489ee077994B6658eAfA855C308275EAd8097C4A";
export const GMX_RPC_URL =
  process.env.GMX_RPC_URL || "https://arb1.arbitrum.io/rpc";
export const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
