// src/utils/discord.ts
// -------------------------------------------------------------
// Description: Provides Discord integration using Daydreams' native
//   Discord extension for sending notifications. It exposes functions
//   to set the agent instance and send notifications with buy signal details.
// Last Update: feat(discord): Updated to use Daydreams core for notifications
// -------------------------------------------------------------

import type { Signal } from "../agents/gmx/signals/types";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

let _agent: any;

export function setAgent(agentInstance: any) {
  _agent = agentInstance;
}

export async function sendDiscordNotification(signal: Signal): Promise<void> {
  if (!DISCORD_TOKEN || !DISCORD_CHANNEL_ID) {
    console.log("Discord credentials missing, skipping notification");
    return;
  }

  if (!_agent) {
    console.error("Agent not set. Cannot send notification.");
    return;
  }

  const messageContent = `🚨 **Buy Signal Detected** 🚨
**Token:** ${signal.token}
**Current Price:** $${signal.currentPrice.toFixed(2)}
**Drop:** ${(signal.percentageDrop * 100).toFixed(2)}%
**Action:** ${signal.suggestedAction}
**Time:** ${new Date(signal.timestamp).toLocaleString()}`;

  try {
    const discordClient = _agent.container.resolve("discord") as any;
    await discordClient.sendMessage({
      channelId: DISCORD_CHANNEL_ID,
      content: messageContent,
    });
    console.log("Notification sent");
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}
