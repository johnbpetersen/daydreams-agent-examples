// src/agents/gmx/prompts/schema.ts
// -------------------------------------------------------------
// Description: Defines the Zod schema for parsing trade parameters from
//   natural language commands. It requires tokenIn, tokenOut, and a positive
//   number for amountIn, with an optional slippage override.
// Last Update: chore(schema): verified and cleaned up trade parameters schema
// -------------------------------------------------------------

import { z } from "zod";

export const tradeParametersSchema = z.object({
  tokenIn: z.string().min(1, "tokenIn is required"),
  tokenOut: z.string().min(1, "tokenOut is required"),
  amountIn: z.number().positive("amountIn must be positive"),
  // minOut is calculated dynamically; therefore, it is omitted from this schema.
  slippage: z.number().optional(), // Optionally allow a slippage override.
});

export type TradeParameters = z.infer<typeof tradeParametersSchema>;
