// src/utils/discordAgent.ts
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

const dummyModel = {
  async generate(messages: any, options?: any) {
    return { content: options?.content || "" };
  },
} as any;

export function createDiscordAgent({
  name,
  groqApiKey,
}: {
  name: string;
  groqApiKey?: string;
}) {
  return createDreams({
    model: dummyModel, // Replace with actual Grok model if needed, using grokApiKey
    extensions: [discord],
    container: createContainer(),
  });
}
