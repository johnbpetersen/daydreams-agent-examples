// src/utils/groq.ts
// -------------------------------------------------------------
// Description: Provides utilities for interacting with the Groq API,
//   including creating a Groq client, querying the LLM, and parsing
//   trading commands into structured JSON data.
// Last Update: feat(core): Updated error messages and cleaned up query logic
// -------------------------------------------------------------

import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

/**
 * Creates a Groq client with the provided API key.
 *
 * @param apiKey - The API key to use for the Groq client.
 * @returns A Groq client instance.
 */
export function createGroqClient(apiKey: string): Groq {
  return new Groq({ apiKey });
}

/**
 * Queries the LLM using the Groq client and returns the raw content.
 *
 * @param groqClient - The Groq client instance.
 * @param systemPrompt - The system prompt setting the context.
 * @param userMessage - The user message.
 * @param model - The model to use (default: "deepseek-r1-distill-llama-70b").
 * @returns The response content as a string.
 */
export async function queryLLM(
  groqClient: Groq,
  systemPrompt: string,
  userMessage: string,
  model: string = "deepseek-r1-distill-llama-70b"
): Promise<string> {
  try {
    const completion = await groqClient.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      model,
      temperature: 0,
      max_tokens: 1500,
    });

    if (!completion.choices || completion.choices.length === 0) {
      throw new Error("No choices in response from Groq.");
    }
    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response from Groq.");
    }
    return content;
  } catch (error) {
    console.error("Error querying LLM:", error);
    throw error;
  }
}

/**
 * Interface representing the parsed trade parameters.
 */
export interface TradeParameters {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  minOut: number;
}

/**
 * Parses a natural language trading command using Groq and returns structured trade parameters.
 *
 * @param groqClient - The Groq client instance.
 * @param command - The trading command to parse.
 * @returns The parsed trade parameters.
 */
export async function parseTradeCommand(
  groqClient: Groq,
  command: string
): Promise<TradeParameters> {
  const systemPrompt = `You are a JSON-only trading command parser. You must output ONLY the JSON object with no extra commentary.
WETH = 0x82af49447d8a07e3bd95bd0d56f35241523fbab1
USDC = 0xff970a61a04b1ca14834a43f5de4533ebddb5cc8

Format: {"tokenIn":"<address>","tokenOut":"<address>","amountIn":<number>,"minOut":<number>}

Example input: "buy 0.00015 eth worth of usdc"
Example output: {"tokenIn":"0x82af49447d8a07e3bd95bd0d56f35241523fbab1","tokenOut":"0xff970a61a04b1ca14834a43f5de4533ebddb5cc8","amountIn":0.00015,"minOut":0.27}

IMPORTANT: Return ONLY the JSON object.`;
  const userMessage = `Return ONLY a JSON object for: ${command}`;
  const response = await queryLLM(groqClient, systemPrompt, userMessage);

  // Remove any <think> tags and trim the response
  const trimmed = response.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  // Split by new lines and reverse to find the last valid JSON string
  const lines = trimmed.split("\n").map((line) => line.trim());
  const jsonStr = lines
    .reverse()
    .find((line) => line.startsWith("{") && line.endsWith("}"));
  if (!jsonStr) throw new Error("No valid JSON found in response");

  const parsed = JSON.parse(jsonStr);
  if (
    !parsed.tokenIn ||
    !parsed.tokenOut ||
    typeof parsed.amountIn !== "number" ||
    typeof parsed.minOut !== "number"
  ) {
    throw new Error("Missing required fields in JSON response");
  }
  return parsed;
}
