// src/index.ts
// -------------------------------------------------------------
// Description: Unified entry point for the Daydreams Agent Examples.
//   Initializes both the GMX and Meditation agents using separate containers,
//   configures environment variables for each, and sets up message handlers for
//   processing Discord commands for trades and custom meditations.
// Last Update: feat: Refactored to support separate agents for GMX and Meditation;
//             consolidated environment setup and unified Discord message handling.
//             Still needs to be refactored to launch both agents at once.
// -------------------------------------------------------------

import { z } from "zod";
import { createDreams, createContainer } from "@daydreamsai/core";
import { discord } from "@daydreamsai/core/extensions";
import { createGroq } from "@ai-sdk/groq";
import { startAlertMonitoring } from "./agents/gmx/alerts/alertManager";
import { parseTradeCommand } from "./agents/gmx/prompts/main"; // Correct path
import { parseAlertCommand } from "./agents/gmx/prompts/alert"; // Correct path
import { placeTrade } from "./agents/gmx/actions/index"; // Correct path
import { registerCustomAlert } from "./agents/gmx/alerts/alertManager"; // Already correct
import {
  getExpectedOutput,
  computeMinOut,
} from "./agents/gmx/actions/priceOracle"; // Correct path
import { setAgent as setGmxAgent } from "./utils/discordGmx"; // Updated to new name
import { handleMeditationRequest } from "./agents/meditation";
import { setAgent as setMeditationAgent } from "./utils/discordMeditation";

interface DiscordClientLike {
  sendMessage(message: { channelId: string; content: string }): Promise<void>;
}

// Load environment variables for both agents
const DISCORD_TOKEN_GMX = process.env.DISCORD_TOKEN_GMX;
const DISCORD_TOKEN_MEDITATION = process.env.DISCORD_TOKEN_MEDITATION;
const GROQ_API_KEY_GMX = process.env.GROQ_API_KEY_GMX;
const GROQ_API_KEY_MEDITATION = process.env.GROQ_API_KEY_MEDITATION;

if (
  !DISCORD_TOKEN_GMX ||
  !DISCORD_TOKEN_MEDITATION ||
  !GROQ_API_KEY_GMX ||
  !GROQ_API_KEY_MEDITATION
) {
  console.error("Missing environment variables");
  process.exit(1);
}

// GMX Agent Setup
const gmxContainer = createContainer();
process.env.DISCORD_TOKEN = DISCORD_TOKEN_GMX; // Set for GMX
const gmxAgent = createDreams({
  model: createGroq({ apiKey: GROQ_API_KEY_GMX })("llama-3.1-70b") as any,
  extensions: [discord],
  container: gmxContainer,
});
setGmxAgent(gmxAgent);

// Meditation Agent Setup
const meditationContainer = createContainer();
process.env.DISCORD_TOKEN = DISCORD_TOKEN_MEDITATION; // Set for Meditation (overwrites GMX!)
const meditationAgent = createDreams({
  model: createGroq({ apiKey: GROQ_API_KEY_MEDITATION })(
    "llama-3.1-70b"
  ) as any,
  extensions: [discord],
  container: meditationContainer,
});
setMeditationAgent(meditationAgent);

// Message sending functions
const sendGmxDiscordResponse = (channelId: string, content: string) =>
  gmxAgent.container
    .resolve<DiscordClientLike>("discord")
    .sendMessage({ channelId, content });

const sendMeditationDiscordResponse = (channelId: string, content: string) =>
  meditationAgent.container
    .resolve<DiscordClientLike>("discord")
    .sendMessage({ channelId, content });

// GMX Message Handler
async function handleGmxDiscordMessage({
  text,
  chat: { id: channelId },
  user,
}: any) {
  const botId = "1343682994585468929";
  const botMentionRegex = new RegExp(`^<@!?${botId}>`, "i");
  if (!botMentionRegex.test(text)) return true; // Early return for non-matching messages

  const commandText = text.replace(botMentionRegex, "").trim();
  try {
    await sendGmxDiscordResponse(channelId, "Command received! Processing...");
    if (/\balert\b/i.test(commandText)) {
      const parsedAlert = await parseAlertCommand(commandText);
      await registerCustomAlert({ ...parsedAlert, userId: user.id });
      await sendGmxDiscordResponse(
        channelId,
        `Alert registered for ${parsedAlert.token} at ${(parsedAlert.threshold * 100).toFixed(3)}% drop!`
      );
    } else {
      const parsedTrade = await parseTradeCommand(commandText);
      const computedMinOutVal = await computeMinOut(
        parsedTrade.tokenIn,
        parsedTrade.tokenOut,
        parsedTrade.amountIn,
        parsedTrade.slippage ?? 0.02
      );
      await sendGmxDiscordResponse(
        channelId,
        `Trade: ${parsedTrade.amountIn} ${parsedTrade.tokenIn} → ${computedMinOutVal} ${parsedTrade.tokenOut}. Confirm with 'yes'.`
      );
      // Confirmation logic (placeholder: assume "yes")
      const tx = await placeTrade(parsedTrade);
      const estimatedOutput = await getExpectedOutput(
        parsedTrade.tokenIn,
        parsedTrade.tokenOut,
        parsedTrade.amountIn
      );
      await sendGmxDiscordResponse(
        channelId,
        `Swapped for ~${estimatedOutput} ${parsedTrade.tokenOut}. Tx: https://arbiscan.io/tx/${tx.hash}`
      );
    }
  } catch (error) {
    console.error("Error in GMX command:", error);
    await sendGmxDiscordResponse(channelId, "Error processing command.");
  }
  return true;
}

// Meditation Message Handler
async function handleMeditationDiscordMessage({
  text,
  chat: { id: channelId },
  user,
}: any) {
  const botId = "1346096355252240444";
  const botMentionRegex = new RegExp(`^<@!?${botId}>`, "i");
  if (!botMentionRegex.test(text)) return true; // Early return for non-matching messages

  const commandText = text.replace(botMentionRegex, "").trim();
  if (commandText) {
    await handleMeditationRequest(
      commandText,
      channelId,
      sendMeditationDiscordResponse
    );
  } else {
    await sendMeditationDiscordResponse(
      channelId,
      "Hey there! Mention me with your meditation request, like '@Meditation Bot, create a meditation for focus'."
    );
  }
  return true;
}

// Main startup
async function main() {
  console.log("Starting both agents...");
  await Promise.all([gmxAgent.start(), meditationAgent.start()]);

  gmxAgent.inputs["discord:message"] = {
    schema: z.object({
      text: z.string(),
      chat: z.object({ id: z.string() }),
      user: z.object({ id: z.string(), name: z.string() }),
    }),
    handler: async (params) => handleGmxDiscordMessage(params),
  };

  meditationAgent.inputs["discord:message"] = {
    schema: z.object({
      text: z.string(),
      chat: z.object({ id: z.string() }),
      user: z.object({ id: z.string(), name: z.string() }),
    }),
    handler: async (params) => handleMeditationDiscordMessage(params),
  };

  console.log("Both agents are running!");
  startAlertMonitoring(10000); // Start GMX alerts
}

main().catch(console.error);
