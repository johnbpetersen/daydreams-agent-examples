import { getTokenPrice } from "../actions/priceOracle";
import type { Signal, SignalRule } from "./types";
import { sendDiscordNotification } from "../../../utils/discord";

// Store the baseline price when the monitor starts.
let initialPrice: number | null = null;

// Object to track whether a buy signal has already been triggered per token.
const triggeredSignals: { [token: string]: boolean } = {};

export async function monitorToken(rule: SignalRule): Promise<void> {
  try {
    const currentPrice = await getTokenPrice(rule.token);

    // On first run, set the initial price.
    if (initialPrice === null) {
      initialPrice = currentPrice;
      console.log(`Initial price for ${rule.token} set at $${initialPrice}`);
    }

    // Calculate the percentage change from the initial price.
    const priceChange = ((currentPrice - initialPrice) / initialPrice) * 100;
    const formattedChange =
      (priceChange >= 0 ? "+" : "") + priceChange.toFixed(2) + "%";
    console.log(
      `Token: ${rule.token} | Current Price: $${currentPrice} | Change from initial: ${formattedChange}`
    );

    // Calculate the percentage drop.
    const percentageDrop = (initialPrice - currentPrice) / initialPrice;

    // If the drop meets/exceeds the threshold and a signal hasn't been triggered yet:
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

      // Mark this token as triggered so we don't send duplicate notifications.
      triggeredSignals[rule.token] = true;

      // Send the notification.
      await sendDiscordNotification(signal);
    }
    // Optional: reset the triggered flag if the drop condition is no longer met.
    else if (percentageDrop < rule.threshold) {
      triggeredSignals[rule.token] = false;
    }
  } catch (error) {
    console.error("Error in monitorToken:", error);
  }
}
