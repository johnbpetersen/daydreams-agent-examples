// src/utils/discordAgent.ts
// -------------------------------------------------------------
// Description: Centralized Daydreams agent setup for Discord integration.
//   Defines the agent and a reusable Discord message context.
// Last Update: feat(discordAgent): Reverted to content/channelId for output
// -------------------------------------------------------------

import { createDreams, createContainer } from "@daydreamsai/core";
import { discord } from "@daydreamsai/core/extensions";
import { z } from "zod";

export const discordMessageContext = {
  type: "discord:channel",
  schema: z.object({
    content: z.string(),
    channelId: z.string(),
  }),
} as const;

// A dummy model to serve as a placeholder for Discord message generation.
const dummyModel = {
  async generate(messages: any, options?: any) {
    return { content: options?.content || "" };
  },
} as any;

export const agent = createDreams({
  model: dummyModel,
  extensions: [discord],
  container: createContainer(),
});
