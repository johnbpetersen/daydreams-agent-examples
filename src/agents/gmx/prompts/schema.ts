import { z } from "zod";

export const tradeParametersSchema = z.object({
  tokenIn: z.string().min(1, "tokenIn is required"),
  tokenOut: z.string().min(1, "tokenOut is required"),
  amountIn: z.number().positive("amountIn must be a positive number"),
  minOut: z.number().positive("minOut must be a positive number"),
});

export type TradeParameters = z.infer<typeof tradeParametersSchema>;
