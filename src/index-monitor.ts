import { startDiscordBot } from "./utils/discord";
import { monitorToken } from "./agents/gmx/signals/monitor";

// Boot the Discord agent before starting monitoring.
(async () => {
  await startDiscordBot();
  console.log("Agent booted in monitor process. Starting monitoring...");

  // Now set up your monitoring rule for WETH (or your desired token)
  const wethRule = { token: "WETH", threshold: 0.001 };

  setInterval(() => {
    monitorToken(wethRule);
  }, 10000); // check every 10 seconds
})();
