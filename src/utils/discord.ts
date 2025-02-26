// src/utils/discord.ts
// -------------------------------------------------------------
// Description: Encapsulates the Discord integration for the GMX Trading Agent.
//   Provides functions to start the Discord bot and send notifications (e.g.,
//   buy signal alerts) to a specified Discord channel.
// Last Update: chore(discord): Cleaned up logging and added header documentation
// -------------------------------------------------------------

import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import type { Signal } from "../agents/gmx/signals/types";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

/**
 * Starts the Discord bot using the provided DISCORD_TOKEN.
 * Logs connection success or error.
 */
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

/**
 * Sends a Discord notification to the designated channel with the buy signal details.
 *
 * @param signal - The buy signal information including token, current price,
 *                 baseline price, percentage drop, action, and timestamp.
 */
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
