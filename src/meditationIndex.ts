// src/meditationIndex.ts
// -------------------------------------------------------------
// Description: Entry point for the Meditation Agent.
//   Initializes the Daydreams agent with the native Discord extension for
//   command handling and processes meditation-related commands.
// Last Update: feat(ux): Simplified @mention trigger and updated Discord responses
// -------------------------------------------------------------

import { z } from "zod";
import { createDreams, createContainer } from "@daydreamsai/core";
import { discord } from "@daydreamsai/core/extensions";
import { createGroq } from "@ai-sdk/groq";
import { setAgent as setMeditationAgent } from "./utils/discordMeditation";
import { handleMeditationRequest } from "./agents/meditation";

interface DiscordClientLike {
  sendMessage(message: { channelId: string; content: string }): Promise<void>;
}

const DISCORD_TOKEN_MEDITATION = process.env.DISCORD_TOKEN_MEDITATION;
const GROQ_API_KEY_MEDITATION = process.env.GROQ_API_KEY_MEDITATION;
process.env.DISCORD_TOKEN = DISCORD_TOKEN_MEDITATION; // Set for discord extension
process.env.DISCORD_BOT_NAME = "Meditation Bot"; // Set bot name

if (!DISCORD_TOKEN_MEDITATION || !GROQ_API_KEY_MEDITATION) {
  console.error(
    "Missing environment variables: DISCORD_TOKEN_MEDITATION or GROQ_API_KEY_MEDITATION"
  );
  process.exit(1);
}

const meditationContainer = createContainer();
const meditationAgent = createDreams({
  model: createGroq({ apiKey: GROQ_API_KEY_MEDITATION })(
    "llama-3.1-70b"
  ) as any,
  extensions: [discord],
  container: meditationContainer,
});
setMeditationAgent(meditationAgent); // Provide the agent to the discordMeditation module

async function sendMeditationDiscordResponse(
  channelId: string,
  content: string
) {
  const discordClient =
    meditationAgent.container.resolve<DiscordClientLike>("discord");
  await discordClient.sendMessage({ channelId, content });
}

async function handleMeditationDiscordMessage(message: {
  text: string;
  chat: { id: string };
  user: { id: string; name: string };
}) {
  const botId = "1346096355252240444"; // Meditation bot’s ID
  const botMentionRegex = new RegExp(`^<@!?${botId}>`, "i");

  if (!botMentionRegex.test(message.text)) return;

  const commandText = message.text.replace(botMentionRegex, "").trim();
  if (commandText) {
    await handleMeditationRequest(
      commandText,
      message.chat.id,
      sendMeditationDiscordResponse
    );
  } else {
    await sendMeditationDiscordResponse(
      message.chat.id,
      "Hey there! Please mention me (@Meditation Bot) with your meditation request, e.g., '@Meditation Bot, create a meditation for focus'."
    );
  }
}

async function main() {
  console.log("Starting Meditation Agent...");
  await meditationAgent.start();

  meditationAgent.inputs["discord:message"] = {
    schema: z.object({
      text: z.string(),
      chat: z.object({ id: z.string() }),
      user: z.object({ id: z.string(), name: z.string() }),
    }),
    handler: async (params) => {
      await handleMeditationDiscordMessage(params);
      return true;
    },
  };

  console.log("Meditation Agent is listening for Discord commands...");
}

main().catch(console.error);
