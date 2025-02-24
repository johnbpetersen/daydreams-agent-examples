// src/agents/gmx/prompts/main.ts

import { createPrompt, createParser } from "@daydreamsai/core/v1";
import { z } from "zod";
import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!, // Use your actual API key here
});

// Updated schema: we do not require minOut since it will be computed on-chain.
export const tradeParametersSchema = z.object({
  tokenIn: z.string().min(1, "tokenIn is required"),
  tokenOut: z.string().min(1, "tokenOut is required"),
  amountIn: z.number().positive("amountIn must be positive"),
  slippage: z.number().optional(), // Optional custom slippage override.
});

// Export the TradeParameters type.
export type TradeParameters = z.infer<typeof tradeParametersSchema>;

// Create a prompt that instructs the AI to output ONLY a JSON object wrapped in a markdown code block.
export const tradeCommandPrompt = createPrompt(
  `You are a JSON-only trading command parser for a crypto trading bot.
Return ONLY a JSON object (wrapped in a markdown code block with "json") with the following keys:
- tokenIn: the token symbol to spend (e.g. "USDC", "WETH", "LINK")
- tokenOut: the token symbol to receive
- amountIn: a positive number representing the input amount (human-readable)
- slippage: an optional positive number representing the desired slippage (e.g., 0.01 for 1%)

Your output MUST be wrapped in a markdown code block. Do not include any extra text.

Example:
Input: "sell $0.77 USDC for WETH with 1% slippage"
Output:
\`\`\`json
{"tokenIn": "USDC", "tokenOut": "WETH", "amountIn": 0.77, "slippage": 0.01}
\`\`\``,
  (args: { command: string }) => ({ command: args.command })
);

// Create a parser that extracts and validates the JSON object using our schema.
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
 * Calls Deepseek via the Groq SDK to parse a natural language trading command.
 * This function removes any <think> tags, extracts the JSON block, and validates it.
 *
 * @param command The natural language trading command.
 * @returns A Promise resolving to trade parameters.
 */
async function queryDeepseek(command: string): Promise<TradeParameters> {
  // Call the actual Deepseek API via Groq.
  const completion = (await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a JSON-only trading command parser for a crypto trading bot.
Return ONLY a JSON object (wrapped in a markdown code block with "json") with the following keys:
{"tokenIn": "<token symbol to spend>", "tokenOut": "<token symbol to receive>", "amountIn": <number>, "slippage": <number (optional)>}
Do not include any extra text.`,
      },
      {
        role: "user",
        content: `Parse this command into JSON: ${command}`,
      },
    ],
    model: "deepseek-r1-distill-llama-70b",
    temperature: 0,
    max_tokens: 1500,
  })) as { choices: { message: { content: string } }[] };

  console.log("Full API Response:", JSON.stringify(completion, null, 2));

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in response from Deepseek.");
  }

  let cleaned = content.trim();
  console.log("Raw response:", cleaned);

  // Remove any <think> tags if present.
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  console.log("Response after stripping <think> tags:", cleaned);

  // Extract the JSON block using a regex.
  const jsonMatch = cleaned.match(/{[\s\S]*}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON found in Deepseek response");
  }
  const jsonStr = jsonMatch[0];
  console.log("Extracted JSON:", jsonStr);

  const parsed = JSON.parse(jsonStr);
  return tradeParametersSchema.parse(parsed);
}

/**
 * Parses a natural language trading command into structured trade parameters.
 * This function calls the Deepseek integration and returns the result.
 *
 * @param command The natural language trading command.
 * @returns A Promise resolving to trade parameters.
 */
export async function parseTradeCommand(
  command: string
): Promise<TradeParameters> {
  console.log("Processing trade command:", command);
  try {
    const tradeParams = await queryDeepseek(command);
    console.log("Deepseek returned:", JSON.stringify(tradeParams, null, 2));
    return tradeParams;
  } catch (error: any) {
    console.error("Error processing trade command:", error);
    // Instead of using arbitrary defaults, signal failure.
    return {
      tokenIn: "ERROR",
      tokenOut: "ERROR",
      amountIn: 0,
      slippage: 0,
    };
  }
}

// Export queryDeepseek as deepseekCall if needed elsewhere.
export { queryDeepseek as deepseekCall };
