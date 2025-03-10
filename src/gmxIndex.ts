// src/gmxIndex.ts
// -------------------------------------------------------------
// Description: Entry point for the GMX Trading Agent.
//   Initializes the Daydreams agent with the native Discord extension for
//   command handling, processes natural language trade and alert commands
//   (via Deepseek), and starts continuous alert monitoring.
// Last Update: feat(split): Separated GMX Trading Agent into its own entry point
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
import { setAgent as setGmxAgent } from "./utils/discordGmx";

// Define an interface for the Discord client
interface DiscordClientLike {
  sendMessage(message: { channelId: string; content: string }): Promise<void>;
}

// Load and validate environment variables for GMX
const DISCORD_TOKEN_GMX = process.env.DISCORD_TOKEN_GMX;
const GROQ_API_KEY_GMX = process.env.GROQ_API_KEY_GMX;
if (!DISCORD_TOKEN_GMX || !GROQ_API_KEY_GMX) {
  console.error(
    "Missing environment variables: DISCORD_TOKEN_GMX or GROQ_API_KEY_GMX"
  );
  process.exit(1);
}
process.env.DISCORD_TOKEN = DISCORD_TOKEN_GMX; // Set for discord extension
process.env.DISCORD_BOT_NAME = "GMX Trading Bot";

// Set up Daydreams for GMX agent
const gmxContainer = createContainer();
const gmxAgent = createDreams({
  model: createGroq({ apiKey: GROQ_API_KEY_GMX })("llama-3.1-70b") as any,
  extensions: [discord],
  container: gmxContainer,
});
setGmxAgent(gmxAgent); // Provide the agent instance to discord integration

// Utility to send static messages for GMX
async function sendGmxDiscordResponse(channelId: string, content: string) {
  const discordClient =
    gmxAgent.container.resolve<DiscordClientLike>("discord");
  await discordClient.sendMessage({ channelId, content });
}

// Handle incoming Discord messages for GMX
async function handleGmxDiscordMessage(message: {
  text: string;
  chat: { id: string };
  user: { id: string; name: string };
}) {
  const botId = "1343682994585468929"; // GMX bot’s ID
  const botMentionRegex = new RegExp(`^<@!?${botId}>`, "i");
  if (!botMentionRegex.test(message.text)) return;

  const commandText = message.text.replace(botMentionRegex, "").trim();

  try {
    await sendGmxDiscordResponse(
      message.chat.id,
      "Command received! Processing..."
    );
    if (/\balert\b/i.test(commandText)) {
      const parsedAlert = await parseAlertCommand(commandText);
      await registerCustomAlert({ ...parsedAlert, userId: message.user.id });
      await sendGmxDiscordResponse(
        message.chat.id,
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
        message.chat.id,
        `Trade: ${parsedTrade.amountIn} ${parsedTrade.tokenIn} → ${computedMinOutVal} ${parsedTrade.tokenOut}. Confirm with 'yes'.`
      );
      const confirmation = await waitForConfirmation(message);
      if (confirmation !== "yes") {
        await sendGmxDiscordResponse(message.chat.id, "Trade cancelled.");
        return;
      }
      const tx = await placeTrade(parsedTrade);
      const estimatedOutput = await getExpectedOutput(
        parsedTrade.tokenIn,
        parsedTrade.tokenOut,
        parsedTrade.amountIn
      );
      await sendGmxDiscordResponse(
        message.chat.id,
        `Swapped for ~${estimatedOutput} ${parsedTrade.tokenOut}. Tx: https://arbiscan.io/tx/${tx.hash}`
      );
    }
  } catch (error) {
    console.error("Error in GMX command:", error);
    await sendGmxDiscordResponse(message.chat.id, "Error processing command.");
  }
  return true; // Explicitly return true
}

// Placeholder for confirmation logic
async function waitForConfirmation(message: {
  chat: { id: string };
  user: { id: string; name: string };
}): Promise<string> {
  // TODO: Replace with real confirmation logic (e.g., waiting for a user response)
  return "yes";
}

// Main startup function for GMX
async function main() {
  console.log("Starting GMX Trading Agent...");
  await gmxAgent.start();

  gmxAgent.inputs["discord:message"] = {
    schema: z.object({
      text: z.string(),
      chat: z.object({ id: z.string() }),
      user: z.object({ id: z.string(), name: z.string() }),
    }),
    handler: async (params) => {
      await handleGmxDiscordMessage(params);
      return true;
    },
  };

  console.log("GMX Trading Agent is listening for Discord commands...");
  startAlertMonitoring(10000); // Start alert monitoring every 10 seconds
}

main().catch(console.error);
