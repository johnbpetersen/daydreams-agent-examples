// src/index.ts
// -------------------------------------------------------------
// Description: Unified entry point for the GMX Trading Agent.
//   Initializes the Discord bot for command handling (processing both
//   trade and alert commands) and starts continuous alert monitoring.
//   Only messages that explicitly start with the bot mention are processed.
// Last Update: feat: Consolidated Discord command & alert monitoring into one entry point
// -------------------------------------------------------------

import { startDiscordBot } from "./utils/discord";
import { startAlertMonitoring } from "./agents/gmx/alerts/alertManager";
import { Client, GatewayIntentBits } from "discord.js";
import { parseTradeCommand } from "./agents/gmx/prompts/main";
import { parseAlertCommand } from "./agents/gmx/prompts/alert";
import { placeTrade } from "./agents/gmx/actions/index";
import { registerCustomAlert } from "./agents/gmx/alerts/alertManager";
import {
  getExpectedOutput,
  computeMinOut,
} from "./agents/gmx/actions/priceOracle";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is not set in the environment");
  process.exit(1);
}

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Log when the client is ready.
discordClient.once("ready", () => {
  console.log(
    `Discord Bot for commands logged in as ${discordClient.user?.tag}`
  );
});

// Process only messages that start with a bot mention.
discordClient.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Create a regex to match a bot mention at the start (handles both <@id> and <@!id> formats).
  const botId = discordClient.user?.id;
  const botMentionRegex = new RegExp(`^<@!?${botId}>`, "i");
  if (!botMentionRegex.test(message.content)) {
    return;
  }

  console.log(
    `Discord message received from ${message.author.tag}: ${message.content}`
  );
  console.log("Processing Discord command:", message.content);

  try {
    await message.channel.send("Command received! Processing...");

    // Strip the bot mention from the message.
    const commandText = message.content.replace(botMentionRegex, "").trim();
    console.log("Command text after removing mention:", commandText);
    console.log("Lowercased command text:", commandText.toLowerCase());

    // If the command contains the word "alert", process it as an alert; otherwise, treat it as a trade.
    if (/\balert\b/i.test(commandText)) {
      console.log("Processing alert command...");
      const parsedAlert = await parseAlertCommand(commandText);
      console.log("Parsed alert command:", parsedAlert);
      await registerAlert(parsedAlert, message);
      const confirmationMsg = `Alert has been registered successfully! I'll notify you when the price of ${parsedAlert.token} drops by ${(parsedAlert.threshold * 100).toFixed(3)}%.`;
      const processedMsg = `Alert command successfully processed. Now we wait for ${parsedAlert.token} to hit our target 😈`;
      await message.channel.send(confirmationMsg);
      await message.channel.send(processedMsg);
    } else {
      console.log("Processing trade command...");
      const parsedTrade = await parseTradeCommand(commandText);
      console.log("Parsed trade command:", parsedTrade);
      await executeTrade(parsedTrade, message);
    }
  } catch (error) {
    console.error("Failed to process command:", error);
    await message.channel.send("There was an error processing your command.");
  }
});

// Executes a trade command with Discord-based confirmation.
async function executeTrade(parsedCommand: any, message: any) {
  console.log("Executing trade with parameters from Discord:", parsedCommand);
  try {
    // Compute minOut to provide detailed confirmation to the user.
    const computedMinOut = await computeMinOut(
      parsedCommand.tokenIn,
      parsedCommand.tokenOut,
      parsedCommand.amountIn,
      parsedCommand.slippage ?? 0.02
    );
    const confirmationMessage = `Trade Details:
- Spend: ${parsedCommand.amountIn} ${parsedCommand.tokenIn}
- Estimated receive (minOut): ${computedMinOut} ${parsedCommand.tokenOut}
Do you want to proceed with this trade? Please reply with 'yes' or 'no'.`;
    await message.channel.send(confirmationMessage);

    // Await user confirmation.
    const filter = (m: any) => m.author.id === message.author.id;
    const collected = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 30000,
      errors: ["time"],
    });
    const confirmation = collected.first()?.content.toLowerCase();
    if (confirmation !== "yes") {
      await message.channel.send("Trade cancelled.");
      console.log("Trade cancelled by user.");
      return;
    }

    // Execute the trade.
    const tx = await placeTrade(parsedCommand);
    console.log("Trade executed successfully:", tx);

    // Calculate expected output for a success message.
    const estimatedOutput = await getExpectedOutput(
      parsedCommand.tokenIn,
      parsedCommand.tokenOut,
      parsedCommand.amountIn
    );
    const successMessage = `${parsedCommand.amountIn} ${parsedCommand.tokenIn} successfully swapped for approximately ${estimatedOutput} ${parsedCommand.tokenOut}.\nView confirmation: https://arbiscan.io/tx/${tx.hash}`;
    await message.channel.send(successMessage);
  } catch (error) {
    console.error("Error executing trade from Discord:", error);
    await message.channel.send("There was an error executing the trade.");
  }
}

// Registers a custom alert from a Discord command.
async function registerAlert(
  parsedAlert: {
    commandType: "alert";
    token: string;
    threshold: number;
    customSlippage?: number;
  },
  message: any
) {
  console.log("Registering alert with parameters from Discord:", parsedAlert);
  try {
    const alertData = {
      token: parsedAlert.token,
      threshold: parsedAlert.threshold,
      customSlippage: parsedAlert.customSlippage,
      userId: message.author.id,
    };
    await registerCustomAlert(alertData);
    console.log("Alert registered:", alertData);
  } catch (error) {
    console.error("Error registering alert from Discord:", error);
    await message.channel.send("There was an error registering your alert.");
    return;
  }
}

async function main() {
  console.log("Starting unified GMX Trading Agent...");
  await startDiscordBot();
  console.log("Notification Discord Bot started.");
  await discordClient.login(DISCORD_TOKEN);
  console.log("Command Discord Client logged in.");
  startAlertMonitoring(10000);
  console.log("Alert monitoring started.");
}

main().catch(console.error);
