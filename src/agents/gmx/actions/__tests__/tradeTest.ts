// src/agents/gmx/actions/__tests__/tradeTest.ts
// -------------------------------------------------------------
// Description: Test harness for parsing and computing trade parameters.
//   This file uses the Deepseek integration to parse a sample trade command,
//   computes the minimum output (minOut) using the price oracle, and logs the
//   final trade order for verification.
// Last Update: feat(tradeTest): Updated to use new CommandParameters schema and computeMinOut from priceOracle
// -------------------------------------------------------------

import type { CommandParameters } from "../../prompts/main";
import { computeMinOut } from "../priceOracle"; // Correct import from priceOracle
import { parseTradeCommand } from "../../prompts/main";

async function testTrade() {
  try {
    // Define a test command using the updated command format.
    const command = "trade! buy $0.77 USDC for WETH with 1% slippage";
    console.log("Testing trade command:", command);

    // Parse the natural language command.
    const parsed: CommandParameters = await parseTradeCommand(command);
    console.log("Parsed trade parameters (before computing minOut):", parsed);

    // Compute minOut dynamically using the price oracle helper.
    // If no slippage was provided in the command, default to 2% (0.02).
    const computedMinOut = await computeMinOut(
      parsed.tokenIn,
      parsed.tokenOut,
      parsed.amountIn,
      parsed.slippage ?? 0.02
    );

    // Construct the full order with the computed minOut.
    const fullOrder = { ...parsed, minOut: computedMinOut };
    console.log("Final trade order:", fullOrder);
  } catch (error) {
    console.error("Error testing trade command:", error);
  }
}

testTrade();
