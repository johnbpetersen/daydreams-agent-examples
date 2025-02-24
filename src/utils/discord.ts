import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import type { Signal } from "../agents/gmx/signals/types";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

export async function startDiscordBot(): Promise<void> {
  if (!DISCORD_TOKEN) {
    console.log("No Discord token found, skipping Discord integration");
    return;
  }
  try {
    await client.login(DISCORD_TOKEN);
    console.log("Discord bot connected");
  } catch (error) {
    console.error("Failed to start Discord bot:", error);
  }
}

export async function sendDiscordNotification(signal: Signal): Promise<void> {
  if (!DISCORD_CHANNEL_ID || !client.isReady()) return;

  const messageContent = `🚨 **Buy Signal Detected** 🚨
    
**Token:** ${signal.token}
**Current Price:** $${signal.currentPrice.toFixed(2)}
**Baseline Price:** $${signal.averagePrice.toFixed(2)}
**Drop:** ${(signal.percentageDrop * 100).toFixed(2)}%
**Action:** ${signal.suggestedAction}
**Time:** ${new Date(signal.timestamp).toLocaleString()}`;

  try {
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (channel instanceof TextChannel) {
      await channel.send(messageContent);
      console.log("Discord notification sent");
    }
  } catch (error) {
    console.error("Error sending Discord notification:", error);
  }
}
