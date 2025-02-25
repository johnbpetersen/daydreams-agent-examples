import { startDiscordBot } from "./utils/discord";
import { startAlertMonitoring } from "./agents/gmx/alerts/alertManager";
import { Client, GatewayIntentBits } from "discord.js";
import { parseTradeCommand } from "./agents/gmx/prompts/main";
import { placeTrade } from "./agents/gmx/actions/index";
import { parseAlertCommand } from "./agents/gmx/prompts/alert";
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

discordClient.once("ready", () => {
  console.log(
    `Discord Bot for commands logged in as ${discordClient.user?.tag}`
  );
});

discordClient.on("messageCreate", async (message) => {
  // Log every received message (for debugging).
  console.log(
    `Discord message received from ${message.author.tag}: ${message.content}`
  );

  // Ignore messages sent by bots.
  if (message.author.bot) return;

  // Check if the message starts with a mention of our bot.
  const botId = discordClient.user?.id;
  const botMention1 = `<@${botId}>`;
  const botMention2 = `<@!${botId}>`;
  if (
    message.content.startsWith(botMention1) ||
    message.content.startsWith(botMention2)
  ) {
    console.log("Processing Discord command:", message.content);

    try {
      await message.channel.send("Command received! Processing...");

      // Remove the bot mention.
      let commandText = message.content;
      if (commandText.startsWith(botMention1)) {
        commandText = commandText.replace(botMention1, "").trim();
      } else if (commandText.startsWith(botMention2)) {
        commandText = commandText.replace(botMention2, "").trim();
      }
      console.log("Command text after removing mention:", commandText);
      console.log("Lowercased command text:", commandText.toLowerCase());

      // Use regex to check for the word "alert" anywhere.
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
  }
});

// Executes a trade command with Discord-based confirmation.
async function executeTrade(parsedCommand: any, message: any) {
  console.log("Executing trade with parameters from Discord:", parsedCommand);
  try {
    // Calculate computed minOut.
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

    // Await confirmation.
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

    const tx = await placeTrade(parsedCommand);
    console.log("Trade executed successfully:", tx);

    // Calculate expected output.
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
    const confirmationMsg = `Alert has been registered successfully! I'll notify you when the price of ${parsedAlert.token} drops by ${(parsedAlert.threshold * 100).toFixed(3)}%.`;
    const processedMsg = `Alert command successfully processed. Now we wait for ${parsedAlert.token} to hit our target 😈`;
    await message.channel.send(confirmationMsg);
    await message.channel.send(processedMsg);
  } catch (error) {
    console.error("Error registering alert from Discord:", error);
    await message.channel.send("There was an error registering your alert.");
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
