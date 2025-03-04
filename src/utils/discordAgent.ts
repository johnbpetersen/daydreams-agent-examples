// src/utils/discordAgent.ts
// -------------------------------------------------------------
// Description: Sets up a centralized Daydreams agent for Discord integration.
//   Defines a Discord message context and provides a helper function to create
//   a new Discord agent instance using a dummy model (placeholder) which can be
//   replaced with an actual Groq model if needed.
// Last Update: feat(discord): Created agent setup utility for Discord messaging
// -------------------------------------------------------------

import { createDreams, createContainer } from "@daydreamsai/core";
import { discord } from "@daydreamsai/core/extensions";
import { z } from "zod";

/**
 * A context definition for Discord messages.
 * Specifies that each message must include a string content and a channelId.
 */
export const discordMessageContext = {
  type: "discord:channel",
  schema: z.object({
    content: z.string(),
    channelId: z.string(),
  }),
} as const;

/**
 * Dummy model placeholder.
 * This model simply returns the content provided in options.
 * Replace with an actual Groq model if needed.
 */
const dummyModel = {
  async generate(messages: any, options?: any) {
    return { content: options?.content || "" };
  },
} as any;

/**
 * Creates a new Daydreams Discord agent.
 *
 * @param params - An object containing:
 *   - name: The name to identify the agent (not currently used in the dummy model).
 *   - groqApiKey: (Optional) API key to initialize a real Groq model.
 * @returns A new Daydreams agent instance configured with the Discord extension.
 */
export function createDiscordAgent({
  name,
  groqApiKey,
}: {
  name: string;
  groqApiKey?: string;
}) {
  // For now, we use the dummyModel as a placeholder. If a groqApiKey is provided,
  // you can replace dummyModel with an actual call to create a Groq-based model.
  return createDreams({
    model: dummyModel,
    extensions: [discord],
    container: createContainer(),
  });
}
