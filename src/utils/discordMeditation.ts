// src/utils/discordMeditation.ts
const DISCORD_TOKEN_MEDITATION = process.env.DISCORD_TOKEN_MEDITATION;

let _agent: any;

export function setAgent(agentInstance: any) {
  _agent = agentInstance;
}

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
