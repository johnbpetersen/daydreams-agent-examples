// src/agents/gmxTradingAgent.ts

// Print a startup message immediately
console.log("GMX Trading Agent is launching...");

// Import the necessary functions from the Daydreams core package
import { createDreams, cli } from "@daydreamsai/core/v1";

// Create the agent instance with a model identifier and an extension
const agent = createDreams({
  model: "deepseek-r1-distill-llama-70b",
  extensions: [cli],
});

// Start the agent and log the outcome
agent
  .start()
  .then(() => {
    console.log("GMX Trading Agent started successfully.");
  })
  .catch((error) => {
    console.error("Failed to start GMX Trading Agent:", error);
  });
