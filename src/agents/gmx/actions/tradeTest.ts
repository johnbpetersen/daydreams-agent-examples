// src/agents/gmx/actions/tradeTest.ts

import type { TradeParameters } from "../prompts/main";
import { computeMinOut } from "./index"; // Import computeMinOut from your actions/index.ts
import { parseTradeCommand } from "../prompts/main";

async function testTrade() {
  try {
    // Define your test command. According to our flow,
    // tokenIn should be USDC and tokenOut should be LINK.
    const command = "please buy link with $0.44 usdc";
    console.log("Testing trade command:", command);

    // Parse the natural language command.
    const parsed: TradeParameters = await parseTradeCommand(command);
    console.log("Parsed trade parameters (before computing minOut):", parsed);

    // Compute minOut dynamically using our price oracle helper.
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
