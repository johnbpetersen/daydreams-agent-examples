// src/utils/discord.ts
import type { Signal } from "../agents/gmx/signals/types";

const DISCORD_TOKEN_GMX = process.env.DISCORD_TOKEN_GMX;

let _agent: any;

export function setAgent(agentInstance: any) {
  _agent = agentInstance;
}

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

// Optional: Keep GMX-specific formatting as a helper
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
