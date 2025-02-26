// src/agents/gmx/prompts/main.ts
// -------------------------------------------------------------
// Description: Parses natural language trading commands into structured command
// parameters using Deepseek via the Groq SDK. The output JSON includes a commandType,
// tokenIn, tokenOut, amountIn, and an optional slippage. If the LLM returns "amount"
// instead of "amountIn", it is transformed accordingly.
// Last Update: feat(prompts): Added commandType & amount transformation, removed extraneous logs
// -------------------------------------------------------------

import { createPrompt, createParser } from "@daydreamsai/core";
import { z } from "zod";
import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!, // Use your actual API key here
});

// Updated schema now includes a commandType field.
export const commandParametersSchema = z.object({
  commandType: z.enum(["trade", "alert"]),
  tokenIn: z.string().min(1, "tokenIn is required"),
  tokenOut: z.string().min(1, "tokenOut is required"),
  amountIn: z.number().positive("amountIn must be positive"),
  // Allow null and transform null to a default value of 0.02.
  slippage: z
    .number()
    .nullable()
    .optional()
    .transform((val) => (val === null ? 0.02 : val)),
});

// Export the CommandParameters type.
export type CommandParameters = z.infer<typeof commandParametersSchema>;

// Create a prompt that instructs the AI to output ONLY a JSON object wrapped in a markdown code block.
// The JSON object should include the new commandType field along with the trade parameters.
export const tradeCommandPrompt = createPrompt(
  `You are a JSON-only trading command parser for a crypto trading bot.
Return ONLY a JSON object (wrapped in a markdown code block with "json") with the following keys:
- commandType: either "trade" or "alert"
- tokenIn: the token symbol to spend (e.g. "USDC", "WETH", "LINK")
- tokenOut: the token symbol to receive (or monitor in the case of alerts)
- amountIn: a positive number representing the input amount (human-readable)
- slippage: an optional positive number representing the desired slippage (e.g., 0.01 for 1%)
Your output MUST be wrapped in a markdown code block. Do not include any extra text.

Example:
Input: "trade! buy $0.77 USDC for WETH with 1% slippage"
Output:
\`\`\`json
{"commandType": "trade", "tokenIn": "USDC", "tokenOut": "WETH", "amountIn": 0.77, "slippage": 0.01}
\`\`\``,
  (args: { command: string }) => ({ command: args.command })
);

// Create a parser that extracts and validates the JSON object using our updated schema.
export const tradeCommandParser = createParser<
  { think?: string; output: CommandParameters | null },
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
      state.output = commandParametersSchema.parse(JSON.parse(element.content));
    },
  }
);

/**
 * queryDeepseek
 *
 * Calls Deepseek via the Groq SDK to parse a natural language trading command.
 * It removes any <think> tags, extracts the JSON block, transforms keys as needed,
 * and validates the output.
 *
 * @param command The natural language trading command.
 * @returns A Promise resolving to command parameters (including commandType).
 */
async function queryDeepseek(command: string): Promise<CommandParameters> {
  const completion = (await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are a JSON-only trading command parser for a crypto trading bot.
Return ONLY a JSON object (wrapped in a markdown code block with "json") with the following keys:
{"commandType": "<trade or alert>", "tokenIn": "<token symbol to spend>", "tokenOut": "<token symbol to receive>", "amountIn": <number>, "slippage": <number (optional)>}
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

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in response from Deepseek.");
  }

  let cleaned = content.trim();
  // Remove any <think> tags.
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Extract the JSON block using a regex.
  const jsonMatch = cleaned.match(/{[\s\S]*}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON found in Deepseek response");
  }
  const jsonStr = jsonMatch[0];

  // Parse the JSON.
  const parsedObj = JSON.parse(jsonStr);

  // Transform the parsed object: if "amount" exists but "amountIn" does not, assign it.
  if (parsedObj.amount !== undefined && parsedObj.amountIn === undefined) {
    parsedObj.amountIn = parsedObj.amount;
  }

  return commandParametersSchema.parse(parsedObj);
}

/**
 * Parses a natural language trading command into structured command parameters.
 *
 * @param command The natural language trading command.
 * @returns A Promise resolving to command parameters.
 */
export async function parseTradeCommand(
  command: string
): Promise<CommandParameters> {
  console.log("Processing trade command:", command);
  try {
    const commandParams = await queryDeepseek(command);
    console.log("Deepseek returned:", JSON.stringify(commandParams, null, 2));
    return commandParams;
  } catch (error: any) {
    console.error("Error processing trade command:", error);
    // Signal failure by returning a default error object.
    return {
      commandType: "trade",
      tokenIn: "ERROR",
      tokenOut: "ERROR",
      amountIn: 0,
      slippage: 0,
    };
  }
}

// Export queryDeepseek as deepseekCall if needed elsewhere.
export { queryDeepseek as deepseekCall };
