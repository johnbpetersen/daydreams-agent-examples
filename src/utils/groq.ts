import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!, // Make sure GROQ_API_KEY is set in your .env
});

interface DeepseekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface TradeParameters {
  tokenIn: string;
  tokenOut: string;
  amountIn: number;
  minOut: number;
}

/**
 * Calls Deepseek via Groq to parse a natural language trading command.
 * Strips out <think> tags, splits by newline, and extracts the last valid JSON.
 *
 * @param command The natural language trading command.
 * @returns A Promise resolving to structured trade parameters.
 */
export async function queryDeepseek(command: string): Promise<TradeParameters> {
  try {
    const completion = (await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a JSON-only trading command parser. You must output ONLY the JSON object with no extra commentary.
WETH = 0x82af49447d8a07e3bd95bd0d56f35241523fbab1
USDC = 0xff970a61a04b1ca14834a43f5de4533ebddb5cc8

Format: {"tokenIn":"<address>","tokenOut":"<address>","amountIn":<number>,"minOut":<number>}

Example input: "buy 0.00015 eth worth of usdc"
Example output: {"tokenIn":"0x82af49447d8a07e3bd95bd0d56f35241523fbab1","tokenOut":"0xff970a61a04b1ca14834a43f5de4533ebddb5cc8","amountIn":0.00015,"minOut":0.27}

IMPORTANT: Return ONLY the JSON object.`,
        },
        {
          role: "user",
          content: `Return ONLY a JSON object for: ${command}`,
        },
      ],
      model: "deepseek-r1-distill-llama-70b",
      temperature: 0,
      max_tokens: 1500,
    })) as DeepseekResponse;

    console.log("Full API Response:", JSON.stringify(completion, null, 2));

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content in response from Deepseek.");
    }

    let trimmed = content.trim();
    console.log("Raw response:", trimmed);

    // Remove <think> tags
    trimmed = trimmed.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    console.log("Response after stripping <think> tags:", trimmed);

    // Split by newline and find a valid JSON line (from the bottom)
    const lines = trimmed.split("\n").map((line) => line.trim());
    let jsonStr = "";
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith("{") && lines[i].endsWith("}")) {
        jsonStr = lines[i];
        break;
      }
    }
    if (!jsonStr) {
      throw new Error("No valid JSON found in response");
    }
    console.log("Extracted JSON:", jsonStr);

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
  } catch (err: any) {
    console.error("Error parsing trade command:", err);
    // Fallback defaults if Deepseek fails (you can adjust these if needed)
    return {
      tokenIn: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
      tokenOut: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC
      amountIn: 0.0001,
      minOut: 0.27,
    };
  }
}
