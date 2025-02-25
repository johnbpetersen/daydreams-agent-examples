import { createPrompt, createParser } from "@daydreamsai/core";
import { z } from "zod";
import { Groq } from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

// Define the alert parameters schema.
export const alertParametersSchema = z.object({
  commandType: z.literal("alert"),
  token: z.string().min(1, "token is required"),
  threshold: z.number().positive("threshold must be positive"),
  customSlippage: z.number().optional(),
});

export type AlertParameters = z.infer<typeof alertParametersSchema>;

// Create a distinct alert prompt.
export const alertCommandPrompt = createPrompt(
  `You are a JSON-only alert command parser for a crypto trading agent.
Return ONLY a JSON object (wrapped in a markdown code block with "json") with exactly these keys:
- commandType: the literal "alert"
- token: the token symbol to monitor (for example, "WETH")
- threshold: the drop threshold as a decimal (for example, 0.001 for 0.1%)
- customSlippage: an optional number for slippage tolerance
Do not include any extra text outside the JSON block.

Example:
Input: "alert! set up a buy alert for WETH if there's a 0.1% drop"
Output:
\`\`\`json
{"commandType": "alert", "token": "WETH", "threshold": 0.001}
\`\`\``,
  (args: { command: string }) => ({ command: args.command })
);

// Create an alert parser.
export const alertCommandParser = createParser<
  { think?: string; output: AlertParameters | null },
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
      state.output = alertParametersSchema.parse(JSON.parse(element.content));
    },
  }
);

export async function parseAlertCommand(
  command: string
): Promise<AlertParameters> {
  console.log("Processing alert command:", command);

  try {
    // Call Groq directly first
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a JSON-only alert command parser. Return ONLY a JSON object wrapped in a markdown code block with "json".
The JSON must have these exact keys:
- commandType: always "alert"
- token: the token symbol to monitor (e.g., "WETH")
- threshold: the drop threshold as a decimal (e.g., 0.001 for 0.1%)
- customSlippage: (optional) slippage tolerance as decimal`,
        },
        {
          role: "user",
          content: command,
        },
      ],
      model: "deepseek-r1-distill-llama-70b",
      temperature: 0.1, // Lower temperature for more consistent outputs
    });

    console.log("Raw Groq response:", completion.choices[0]?.message?.content);

    // Extract JSON from the response
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in Groq response");
    }

    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      console.log("No JSON code block found. Raw content:", content);
      throw new Error("No JSON code block found in response");
    }

    const jsonStr = jsonMatch[1];
    console.log("Extracted JSON string:", jsonStr);

    // Parse the JSON
    const parsedJson = JSON.parse(jsonStr);
    console.log("Parsed JSON object:", parsedJson);

    // Validate with our schema
    const validated = alertParametersSchema.parse(parsedJson);
    console.log("Validated alert parameters:", validated);

    return validated;
  } catch (error) {
    console.error("Alert parsing error:", error);
    throw error;
  }
}
