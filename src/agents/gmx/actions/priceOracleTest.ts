// src/agents/gmx/actions/priceOracleTest.ts

import { getExpectedOutput } from "./priceOracle";

async function testPriceOracle() {
  try {
    // For example, if you want to convert 0.1 WETH to USDC with a 2% slippage tolerance:
    const tokenIn = "WETH";
    const tokenOut = "USDC";
    const amountIn = 0.1;
    const slippageTolerance = 0.02;

    const minOut = await getExpectedOutput(
      tokenIn,
      tokenOut,
      amountIn,
      slippageTolerance
    );
    console.log(
      `For ${amountIn} ${tokenIn}, the expected minimum output in ${tokenOut} is: ${minOut}`
    );
  } catch (error) {
    console.error("Error testing price oracle:", error);
  }
}

testPriceOracle();
