// src/index.ts
// -------------------------------------------------------------
// Description: Unified entry point for the GMX Trading Agent.
//   Initializes the Daydreams agent with the native Discord extension for
//   command handling, processes natural language trade and alert commands
//   (via Deepseek), and starts continuous alert monitoring.
// Last Update: feat: Switched from discord.js to Daydreams native Discord integration; streamlined command parsing and response handling
// -------------------------------------------------------------

import { z } from "zod";
import { createDreams, createContainer } from "@daydreamsai/core";
import { discord } from "@daydreamsai/core/extensions";
import { createGroq } from "@ai-sdk/groq";
import { startAlertMonitoring } from "./agents/gmx/alerts/alertManager";
import { parseTradeCommand } from "./agents/gmx/prompts/main";
import { parseAlertCommand } from "./agents/gmx/prompts/alert";
import { placeTrade } from "./agents/gmx/actions/index";
import { registerCustomAlert } from "./agents/gmx/alerts/alertManager";
import {
  getExpectedOutput,
  computeMinOut,
} from "./agents/gmx/actions/priceOracle";
import { setAgent } from "./utils/discord"; // Import setAgent from discord.ts

// Define an interface for the Discord client
interface DiscordClientLike {
  sendMessage(message: { channelId: string; content: string }): Promise<void>;
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY! });

if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is not set in the environment");
  process.exit(1);
}

// Set up Daydreams with the discord extension
const container = createContainer();
const agent = createDreams({
  model: groq("llama-3.1-70b") as any, // Temporary type assertion
  extensions: [discord],
  container,
});

// Set the agent for discord.ts
setAgent(agent); // This line fixes the undefined _agent issue

// Function to send static messages to Discord
async function sendDiscordResponse(channelId: string, content: string) {
  const discordClient = agent.container.resolve<DiscordClientLike>("discord");
  await discordClient.sendMessage({ channelId, content });
}

// Handle incoming Discord messages
async function handleDiscordMessage(message: {
  text: string;
  chat: { id: string };
  user: { id: string; name: string };
}) {
  const botId = "1343682994585468929"; // Your bot’s ID
  const botMentionRegex = new RegExp(`^<@!?${botId}>`, "i");
  if (!botMentionRegex.test(message.text)) return;

  const commandText = message.text.replace(botMentionRegex, "").trim();
  try {
    await sendDiscordResponse(
      message.chat.id,
      "Command received! Processing..."
    );
    if (/\balert\b/i.test(commandText)) {
      const parsedAlert = await parseAlertCommand(commandText);
      await registerAlert(parsedAlert, message);
      await sendDiscordResponse(
        message.chat.id,
        `Alert registered for ${parsedAlert.token} at ${(parsedAlert.threshold * 100).toFixed(3)}% drop!`
      );
    } else {
      const parsedTrade = await parseTradeCommand(commandText);
      await executeTrade(parsedTrade, message);
    }
  } catch (error) {
    console.error("Error:", error);
    await sendDiscordResponse(message.chat.id, "Error processing command.");
  }
}

// Execute trades with static message responses
async function executeTrade(
  parsedCommand: any,
  message: { chat: { id: string }; user: { id: string; name: string } }
) {
  const channelId = message.chat.id;
  const computedMinOut = await computeMinOut(
    parsedCommand.tokenIn,
    parsedCommand.tokenOut,
    parsedCommand.amountIn,
    parsedCommand.slippage ?? 0.02
  );
  await sendDiscordResponse(
    channelId,
    `Trade: ${parsedCommand.amountIn} ${parsedCommand.tokenIn} → ${computedMinOut} ${parsedCommand.tokenOut}. Confirm with 'yes'.`
  );
  const confirmation = await waitForConfirmation(message);
  if (confirmation !== "yes") {
    await sendDiscordResponse(channelId, "Trade cancelled.");
    return;
  }
  const tx = await placeTrade(parsedCommand);
  const estimatedOutput = await getExpectedOutput(
    parsedCommand.tokenIn,
    parsedCommand.tokenOut,
    parsedCommand.amountIn
  );
  await sendDiscordResponse(
    channelId,
    `Swapped for ~${estimatedOutput} ${parsedCommand.tokenOut}. Tx: https://arbiscan.io/tx/${tx.hash}`
  );
}

// Placeholder for confirmation logic
async function waitForConfirmation(message: {
  chat: { id: string };
  user: { id: string; name: string };
}): Promise<string> {
  return "yes"; // Replace with real confirmation logic if needed
}

// Register alerts
async function registerAlert(
  parsedAlert: any,
  message: { chat: { id: string }; user: { id: string; name: string } }
) {
  await registerCustomAlert({
    token: parsedAlert.token,
    threshold: parsedAlert.threshold,
    customSlippage: parsedAlert.customSlippage,
    userId: message.user.id,
  });
}

// Main startup function
async function main() {
  console.log("Starting GMX Trading Agent...");
  await agent.start();
  agent.inputs["discord:message"] = {
    schema: z.object({
      text: z.string(),
      chat: z.object({ id: z.string() }),
      user: z.object({ id: z.string(), name: z.string() }),
    }),
    handler: async (params) => {
      await handleDiscordMessage(params);
      return true;
    },
  };
  console.log("Listening for Discord commands...");
  startAlertMonitoring(10000);
}

main().catch(console.error);
