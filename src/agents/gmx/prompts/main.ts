import { createPrompt, createParser } from "@daydreamsai/core/v1";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { queryDeepseek } from "../../../utils/groq";
// Define a Zod schema for trade parameters.
export const tradeParametersSchema = z.object({
  tokenIn: z.string().min(1, "tokenIn is required"),
  tokenOut: z.string().min(1, "tokenOut is required"),
  amountIn: z.number().positive("amountIn must be positive"),
  minOut: z.number().positive("minOut must be positive"),
});

// Export the TradeParameters type derived from the schema.
export type TradeParameters = z.infer<typeof tradeParametersSchema>;

// Create a prompt that instructs the AI to output only a JSON object.
export const tradeCommandPrompt = createPrompt(
  `You are a JSON-only trading command parser. Output ONLY the JSON object with no extra commentary.
For reference, use the following token addresses:
WETH = 0x82af49447d8a07e3bd95bd0d56f35241523fbab1
USDC = 0xff970a61a04b1ca14834a43f5de4533ebddb5cc8

Format: {"tokenIn":"<address>","tokenOut":"<address>","amountIn":<number>,"minOut":<number>}

Example:
Input: "buy 0.00015 eth worth of usdc"
Output: {"tokenIn":"0x82af49447d8a07e3bd95bd0d56f35241523fbab1","tokenOut":"0xff970a61a04b1ca14834a43f5de4533ebddb5cc8","amountIn":0.00015,"minOut":0.27}

Return ONLY the JSON object.`,
  (args: { command: string }) => ({ command: args.command })
);

// Create a parser to extract and validate the JSON object using our schema.
export const tradeCommandParser = createParser<
  { think?: string; output: TradeParameters | null },
  {}
>(
  () => ({
    output: null,
  }),
  {
    think: (state, element) => {
      state.think = element.content;
    },
    json: (state, element) => {
      state.output = tradeParametersSchema.parse(JSON.parse(element.content));
    },
  }
);

/**
 * Parses a natural language trading command into structured trade parameters.
 * In a full integration, you'd construct a prompt, send it to your language model,
 * then use tradeCommandParser to extract the JSON.
 * For now, we simulate a response.
 *
 * @param command The natural language trading command.
 * @returns A Promise resolving to trade parameters.
 */
export async function parseTradeCommand(
  command: string
): Promise<TradeParameters> {
  console.log("Processing trade command:", command);

  // Replace the simulation with actual Deepseek call
  return await queryDeepseek(command);
}
