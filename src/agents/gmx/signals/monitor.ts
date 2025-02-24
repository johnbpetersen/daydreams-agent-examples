import { getTokenPrice } from "../actions/priceOracle";
import type { Signal, SignalRule } from "./types";
import { sendDiscordNotification } from "../../../utils/discord";

// Store the baseline price when the monitor starts
let initialPrice: number | null = null;

export async function monitorToken(rule: SignalRule): Promise<void> {
  try {
    const currentPrice = await getTokenPrice(rule.token);

    // On first run, set the initial price
    if (initialPrice === null) {
      initialPrice = currentPrice;
      console.log(`Initial price for ${rule.token} set at $${initialPrice}`);
    }

    // Calculate the percentage change from the initial price
    const priceChange = ((currentPrice - initialPrice) / initialPrice) * 100;
    const formattedChange =
      (priceChange >= 0 ? "+" : "") + priceChange.toFixed(2) + "%";

    console.log(
      `Token: ${rule.token} | Current Price: $${currentPrice} | Change from initial: ${formattedChange}`
    );

    // If the current price is below the initial price, check if the drop exceeds the threshold
    if (currentPrice < initialPrice) {
      const percentageDrop = (initialPrice - currentPrice) / initialPrice;
      if (percentageDrop >= rule.threshold) {
        const signal: Signal = {
          token: rule.token,
          currentPrice,
          averagePrice: initialPrice, // using the initial price as the baseline
          percentageDrop,
          suggestedAction: "BUY",
          timestamp: Date.now(),
        };
        console.log("Buy signal detected:", signal);
        await sendDiscordNotification(signal);
      }
    }
  } catch (error) {
    console.error("Error in monitorToken:", error);
  }
}
