import { z } from "zod";

export const tradeParametersSchema = z.object({
  tokenIn: z.string().min(1, "tokenIn is required"),
  tokenOut: z.string().min(1, "tokenOut is required"),
  amountIn: z.number().positive("amountIn must be positive"),
  // Remove minOut from here since we’ll calculate it dynamically.
  slippage: z.number().optional(), // Optionally still allow a slippage override from the command.
});

export type TradeParameters = z.infer<typeof tradeParametersSchema>;
