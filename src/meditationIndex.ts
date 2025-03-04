// src/meditationIndex.ts
// -------------------------------------------------------------
// Description: Entry point for the Meditation Agent.
//   Initializes the Daydreams agent with the native Discord extension for
//   command handling and processes meditation-related commands.
// Last Update: feat(split): Separated Meditation Agent into its own entry point
// -------------------------------------------------------------

import { z } from "zod";
import { createDreams, createContainer } from "@daydreamsai/core";
import { discord } from "@daydreamsai/core/extensions";
import { createGroq } from "@ai-sdk/groq";
import { setAgent as setMeditationAgent } from "./utils/discordMeditation";
import { handleMeditationRequest } from "./agents/meditation";

// Define an interface for the Discord client
interface DiscordClientLike {
  sendMessage(message: { channelId: string; content: string }): Promise<void>;
}

// Load environment variables and set for Meditation
const DISCORD_TOKEN_MEDITATION = process.env.DISCORD_TOKEN_MEDITATION;
const GROQ_API_KEY_MEDITATION = process.env.GROQ_API_KEY_MEDITATION;
process.env.DISCORD_TOKEN = DISCORD_TOKEN_MEDITATION; // Set for discord extension
process.env.DISCORD_BOT_NAME = "Meditation Bot"; // Set bot name

// Validate environment variables
if (!DISCORD_TOKEN_MEDITATION || !GROQ_API_KEY_MEDITATION) {
  console.error(
    "Missing environment variables: DISCORD_TOKEN_MEDITATION or GROQ_API_KEY_MEDITATION"
  );
  process.exit(1);
}

// Set up Daydreams for Meditation agent
const meditationContainer = createContainer();
const meditationAgent = createDreams({
  model: createGroq({ apiKey: GROQ_API_KEY_MEDITATION })(
    "llama-3.1-70b"
  ) as any,
  extensions: [discord],
  container: meditationContainer,
});
setMeditationAgent(meditationAgent); // Set Meditation agent for discordMeditation.ts

// Function to send static messages for Meditation
async function sendMeditationDiscordResponse(
  channelId: string,
  content: string
) {
  const discordClient =
    meditationAgent.container.resolve<DiscordClientLike>("discord");
  await discordClient.sendMessage({ channelId, content });
}

// Handle incoming Discord messages for Meditation
async function handleMeditationDiscordMessage(message: {
  text: string;
  chat: { id: string };
  user: { id: string; name: string };
}) {
  const botId = "1346096355252240444"; // Meditation bot’s ID
  const botMentionRegex = new RegExp(`^<@!?${botId}>`, "i");
  const meditationTrigger = "hey meditation agent";

  if (!botMentionRegex.test(message.text)) return;

  const commandText = message.text.replace(botMentionRegex, "").trim();

  if (commandText.toLowerCase().startsWith(meditationTrigger)) {
    const meditationRequest = commandText
      .slice(meditationTrigger.length)
      .trim();
    await handleMeditationRequest(
      meditationRequest,
      message.chat.id,
      sendMeditationDiscordResponse
    );
  } else {
    await sendMeditationDiscordResponse(
      message.chat.id,
      "Hey there! Say 'hey meditation agent' followed by your request, like 'hey meditation agent, create a meditation for focus'."
    );
  }
}

// Main startup function for Meditation
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
