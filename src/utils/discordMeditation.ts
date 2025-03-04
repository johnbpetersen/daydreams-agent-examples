// src/utils/discordMeditation.ts
// -------------------------------------------------------------
// Description: Provides Discord integration for the Meditation Agent,
//   including functions to set the agent and send messages (with optional
//   file attachments) to a designated Discord channel.
// Last Update: feat(meditation): Added header documentation and streamlined message sending
// -------------------------------------------------------------

const DISCORD_TOKEN_MEDITATION = process.env.DISCORD_TOKEN_MEDITATION;

let _agent: any;

/**
 * Sets the agent instance for sending Discord messages.
 * @param agentInstance - The Daydreams agent instance.
 */
export function setAgent(agentInstance: any) {
  _agent = agentInstance;
}

/**
 * Sends a Discord message using the Meditation agent.
 *
 * @param channelId - The Discord channel ID to send the message to.
 * @param content - The message content.
 * @param options - Optional settings, such as a file path for an attachment.
 */
export async function sendDiscordMessage(
  channelId: string,
  content: string,
  options: { file?: string } = {}
): Promise<void> {
  if (!DISCORD_TOKEN_MEDITATION || !channelId) {
    console.log(
      "Meditation Discord credentials or channel ID missing, skipping message"
    );
    return;
  }
  if (!_agent) {
    console.error("Meditation agent not set. Cannot send message.");
    return;
  }

  try {
    const discordClient = _agent.container.resolve("discord") as any;
    await discordClient.sendMessage({
      channelId,
      content,
      ...(options.file && { file: options.file }),
    });
    console.log("Meditation message sent");
  } catch (error) {
    console.error("Error sending meditation message:", error);
  }
}
