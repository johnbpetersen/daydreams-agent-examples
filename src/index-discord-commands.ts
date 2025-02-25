import { Client, GatewayIntentBits } from "discord.js";
import { parseTradeCommand } from "./agents/gmx/prompts/main";
import { parseAlertCommand } from "./agents/gmx/prompts/alert";
import { placeTrade } from "./agents/gmx/actions/index";
import { registerCustomAlert } from "./agents/gmx/alerts/alertManager";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
if (!DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is not set in the environment");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`Discord Bot logged in as ${client.user?.tag}`);
});

client.on("messageCreate", async (message) => {
  // Ignore messages sent by bots.
  if (message.author.bot) return;

  const botMention = `<@${client.user?.id}>`;
  if (message.content.startsWith(botMention)) {
    console.log("Received command:", message.content);

    try {
      // Acknowledge receipt.
      await message.channel.send("Command received! Processing...");

      // Remove the bot mention.
      const commandText = message.content.replace(botMention, "").trim();
      console.log("Lowercased command text:", commandText.toLowerCase());

      // Check if the command is an alert command.
      if (/^alert!\s*/i.test(commandText)) {
        // Process alert command.
        const parsedAlert = await parseAlertCommand(commandText);
        console.log("Parsed alert command:", parsedAlert);
        await registerAlert(parsedAlert, message);
        await message.channel.send("Alert command processed.");
      } else {
        // Process trade command.
        const parsedTrade = await parseTradeCommand(commandText);
        console.log("Parsed trade command:", parsedTrade);
        await executeTrade(parsedTrade, message);
        await message.channel.send("Trade command processed.");
      }
    } catch (error) {
      console.error("Failed to process command:", error);
      await message.channel.send("There was an error processing your command.");
    }
  }
});

// Executes a trade command.
async function executeTrade(parsedCommand: any, message: any) {
  console.log("Executing trade with parameters:", parsedCommand);
  try {
    // Pass the full parsed command (including commandType) directly to placeTrade.
    const tx = await placeTrade(parsedCommand);
    console.log("Trade executed successfully:", tx);
  } catch (error) {
    console.error("Error executing trade:", error);
    throw error;
  }
}

// Registers a custom alert.
async function registerAlert(
  parsedAlert: {
    commandType: "alert";
    token: string;
    threshold: number;
    customSlippage?: number;
  },
  message: any
) {
  console.log("Registering alert with parameters:", parsedAlert);
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
    console.error("Error registering alert:", error);
    throw error;
  }
}

client.login(DISCORD_TOKEN).catch((error) => {
  console.error("Failed to login:", error);
});
