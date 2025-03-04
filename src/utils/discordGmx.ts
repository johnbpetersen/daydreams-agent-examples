// src/utils/discordGmx.ts
// -------------------------------------------------------------
// Description: Provides Discord integration for the GMX Trading Agent,
//   including functions to set the agent instance and send messages (with optional
//   file attachments) to a designated Discord channel. Also includes a helper
//   function for formatting and sending buy signal notifications.
// Last Update: feat(gmx): Updated message sending and added notification helper
// -------------------------------------------------------------

import type { Signal } from "../agents/gmx/signals/types";

const DISCORD_TOKEN_GMX = process.env.DISCORD_TOKEN_GMX;

let _agent: any;

/**
 * Sets the agent instance for sending Discord messages.
 * @param agentInstance - The Daydreams agent instance.
 */
export function setAgent(agentInstance: any) {
  _agent = agentInstance;
}

/**
 * Sends a message to a Discord channel using the GMX agent.
 *
 * @param channelId - The Discord channel ID to send the message to.
 * @param content - The content of the message.
 * @param options - Optional settings, e.g., a file path for an attachment.
 */
export async function sendDiscordMessage(
  channelId: string,
  content: string,
  options: { file?: string } = {}
): Promise<void> {
  if (!DISCORD_TOKEN_GMX || !channelId) {
    console.log("Discord credentials or channel ID missing, skipping message");
    return;
  }
  if (!_agent) {
    console.error("Agent not set. Cannot send message.");
    return;
  }

  try {
    const discordClient = _agent.container.resolve("discord") as any;
    await discordClient.sendMessage({
      channelId,
      content,
      ...(options.file && { file: options.file }),
    });
    console.log("Message sent");
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

/**
 * Sends a buy signal notification to a Discord channel.
 *
 * @param channelId - The Discord channel ID.
 * @param signal - The buy signal information.
 */
export async function sendGmxNotification(
  channelId: string,
  signal: Signal
): Promise<void> {
  const messageContent = `🚨 **Buy Signal Detected** 🚨
**Token:** ${signal.token}
**Current Price:** $${signal.currentPrice.toFixed(2)}
**Drop:** ${(signal.percentageDrop * 100).toFixed(2)}%
**Action:** ${signal.suggestedAction}
**Time:** ${new Date(signal.timestamp).toLocaleString()}`;
  await sendDiscordMessage(channelId, messageContent);
}
