import { z } from "zod";
import { tradeParametersSchema } from "./prompts/schema";

/**
 * TradeParameters
 * Inferred from the tradeParametersSchema. You can extend this type later if you need additional fields.
 */
export type TradeParameters = z.infer<typeof tradeParametersSchema>;

/**
 * ActionResult
 * Represents the outcome of an action (such as a swap or approval).
 */
export interface ActionResult {
  success: boolean;
  transactionHash?: string; // Transaction hash if the action was successful
  error?: string; // Error message if something went wrong
}

/**
 * ApprovalResult
 * Represents the result of a token approval action.
 */
export interface ApprovalResult {
  approved: boolean;
  allowance: string; // String representation of the allowance (BigNumber formatted)
}

// You can add additional GMX-specific types here as needed.
