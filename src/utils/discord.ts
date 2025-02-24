import { createDreams } from "@daydreamsai/core";
import { discord } from "@daydreamsai/core/extensions";

// Create a minimal agent with the Discord extension.
// We use a dummy model since we're only using the Discord functionality.
const agent = createDreams({
  model: "dummy-model",
  extensions: [discord],
});

/**
 * Starts the Daydreams Discord Bot.
 * This initializes the connection using the DISCORD_TOKEN from your environment.
 */
export async function startDiscordBot(): Promise<void> {
  console.log("Starting Daydreams Discord Bot...");
  await agent.start();
  console.log("Daydreams Discord Bot started");
}

/**
 * Sends a Discord notification when a buy signal is triggered.
 * @param signal - An object containing the buy alert details.
 */
export async function sendDiscordNotification(signal: any): Promise<void> {
  const message = `Buy Signal Detected for ${signal.token}:
Current Price: $${signal.currentPrice}
Baseline Price: $${signal.averagePrice}
Drop: ${(signal.percentageDrop * 100).toFixed(2)}%
Action: ${signal.suggestedAction}`;

  try {
    // Send the message using the Discord extension.
    await agent.extensions.discord.sendMessage({ content: message });
    console.log("Discord notification sent");
  } catch (error) {
    console.error("Error sending Discord notification:", error);
  }
}
