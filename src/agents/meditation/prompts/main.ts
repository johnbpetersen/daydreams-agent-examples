// src/agents/meditation/prompts/main.ts
// -------------------------------------------------------------
// Description: Parses natural language meditation requests into structured
// parameters (theme, setting, duration) using Groq's LLM. Outputs a JSON object
// with best-guess values for missing fields.
// Last Update: feat(meditation): Added meditation request parser with LLM best-guess logic
// -------------------------------------------------------------

import { z } from "zod";
import { Groq } from "groq-sdk";
import { meditationParametersSchema } from "./schema";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY_MEDITATION!, // Use Meditation-specific key
});

/**
 * Parses a natural language meditation request into structured parameters.
 *
 * Calls Groq's LLM to convert the user's request into a JSON object with the keys:
 * - theme (string): Main focus or emotion (e.g., "peace", "focus"). Defaults to "relaxation".
 * - setting (string): Imagined location (e.g., "forest", "beach"). Defaults to "nature".
 * - duration (string): Length of the meditation (e.g., "5 minutes"). Defaults to "5 minutes".
 *
 * Returns ONLY the JSON object wrapped in a markdown code block with "json".
 *
 * @param request The natural language meditation request.
 * @returns A Promise resolving to meditation parameters.
 */
export async function parseMeditationRequest(
  request: string
): Promise<{ theme: string; setting: string; duration: string }> {
  console.log("Processing meditation request:", request);

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a JSON-only meditation request parser. Parse the user's request into a JSON object with these keys:
- theme (string): The main focus or emotion (e.g., "peace", "focus"). Guess if not specified (e.g., "relaxation").
- setting (string): The imagined location (e.g., "forest", "beach"). Guess if not specified (e.g., "nature").
- duration (string): The length (e.g., "5 minutes"). Default to "5 minutes" if not specified.
Return ONLY the JSON object wrapped in a markdown code block with "json". No extra text.

Example input: "I want a 5-minute meditation about peace in a forest"
Example output:
\`\`\`json
{"theme": "peace", "setting": "forest", "duration": "5 minutes"}
\`\`\`

Example input: "I want a meditation"
Example output:
\`\`\`json
{"theme": "relaxation", "setting": "nature", "duration": "5 minutes"}
\`\`\``,
        },
        {
          role: "user",
          content: `Parse this request into JSON: ${request}`,
        },
      ],
      model: "deepseek-r1-distill-llama-70b",
      temperature: 0.1, // Low temperature for consistency
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in Groq response");
    }

    // Extract JSON from markdown code block
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      console.log("No JSON code block found. Raw content:", content);
      throw new Error("No JSON code block found in response");
    }
    const jsonStr = jsonMatch[1];
    console.log("Extracted JSON string:", jsonStr);

    // Parse and validate JSON
    const parsedJson = JSON.parse(jsonStr);
    console.log("Parsed JSON object:", parsedJson);

    const validated = meditationParametersSchema.parse(parsedJson);
    console.log("Validated meditation parameters:", validated);

    return validated;
  } catch (error) {
    console.error("Meditation request parsing error:", error);
    // Fallback with best-guess values
    return { theme: "relaxation", setting: "nature", duration: "5 minutes" };
  }
}
