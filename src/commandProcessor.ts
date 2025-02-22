// src/commandProcessor.ts

import type { TradeParameters } from "./utils/groq";
import { queryDeepseek } from "./utils/groq";

interface TradeOrder {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  minOut: number;
}

/**
 * This function simulates an integration with the Deepseek LLM.
 * In a real-world scenario, you'd call Deepseek's API using your API key.
 * For now, we return a hard-coded trade order for demonstration.
 */
export async function getTradeCommand(
  command: string
): Promise<TradeParameters> {
  console.log("Processing command:", command);
  try {
    const response = await queryDeepseek(command);
    console.log("Deepseek response:", response);

    // Validate the response
    if (
      !response.tokenIn ||
      !response.tokenOut ||
      !response.amountIn ||
      !response.minOut
    ) {
      throw new Error("Invalid response format from Deepseek");
    }

    return {
      tokenIn: response.tokenIn,
      tokenOut: response.tokenOut,
      amountIn: response.amountIn,
      minOut: response.minOut,
    };
  } catch (error) {
    console.error("Error processing command:", error);
    // Return a default order if there's an error
    return {
      tokenIn: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
      tokenOut: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC
      amountIn: 0.0001,
      minOut: 0.27,
    };
  }
}
