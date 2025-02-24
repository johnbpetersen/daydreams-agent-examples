import { monitorToken } from "./agents/gmx/signals/monitor";

// Define the ETH rule with a threshold of 0.1% drop for testing
const ethRule = { token: "WETH", threshold: 0.001 };

// Start the monitor: Check WETH price every 10 seconds
setInterval(() => {
  monitorToken(ethRule);
}, 10000);

console.log(
  "Buy signal monitor started for WETH. Checking every 10 seconds..."
);
