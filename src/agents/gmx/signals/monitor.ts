// src/agents/gmx/signals/monitor.ts
// -------------------------------------------------------------
// Description: Monitors token prices via the GMX Vault price oracle.
//   On first run, sets a baseline price and then calculates the percentage
//   change from that baseline. If the price drop meets or exceeds the specified
//   threshold and no alert has yet been triggered, a buy signal is generated
//   and a Discord notification is sent. The trigger flag resets if the drop condition
//   is no longer met.
// Last Update: feat(monitor): Added buy signal detection and notification logic
// -------------------------------------------------------------

import { getTokenPrice } from "../actions/priceOracle";
import type { Signal, SignalRule } from "./types";
import { sendGmxNotification } from "../../../utils/discordGmx";

// Baseline price when monitoring starts.
let initialPrice: number | null = null;

// Tracks whether a buy signal has been triggered for each token.
const triggeredSignals: { [token: string]: boolean } = {};

export async function monitorToken(rule: SignalRule): Promise<void> {
  try {
    const currentPrice = await getTokenPrice(rule.token);

    // Set the baseline price on the first run.
    if (initialPrice === null) {
      initialPrice = currentPrice;
      console.log(`Initial price for ${rule.token} set at $${initialPrice}`);
    }

    // Calculate the percentage change from the baseline.
    const priceChange = ((currentPrice - initialPrice) / initialPrice) * 100;
    const formattedChange =
      (priceChange >= 0 ? "+" : "") + priceChange.toFixed(2) + "%";
    console.log(
      `Token: ${rule.token} | Current Price: $${currentPrice} | Change from initial: ${formattedChange}`
    );

    // Calculate the percentage drop.
    const percentageDrop = (initialPrice - currentPrice) / initialPrice;

    // If the drop meets/exceeds the threshold and no alert has been triggered:
    if (percentageDrop >= rule.threshold && !triggeredSignals[rule.token]) {
      const signal: Signal = {
        token: rule.token,
        currentPrice,
        averagePrice: initialPrice,
        percentageDrop,
        suggestedAction: "BUY",
        timestamp: Date.now(),
      };
      console.log("Buy signal detected:", signal);

      // Mark the token as triggered to prevent duplicate notifications.
      triggeredSignals[rule.token] = true;

      // Send the Discord notification.
      await sendGmxNotification(process.env.DISCORD_CHANNEL_ID!, signal);
    }
    // Reset the triggered flag if the drop condition is no longer met.
    else if (percentageDrop < rule.threshold) {
      triggeredSignals[rule.token] = false;
    }
  } catch (error) {
    console.error("Error in monitorToken:", error);
  }
}
