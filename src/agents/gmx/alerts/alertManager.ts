// src/agents/gmx/alerts/alertManager.ts

import { getTokenPrice } from "../actions/priceOracle";
import { sendDiscordNotification } from "../../../utils/discord"; // Adjust the path if needed

// Define the Signal interface (if not already defined elsewhere).
// This should match what sendDiscordNotification expects.
export interface Signal {
  token: string;
  currentPrice: number;
  averagePrice: number;
  percentageDrop: number;
  suggestedAction: string;
  timestamp: number;
}

// Define the Alert interface.
export interface Alert {
  token: string; // Token to monitor (e.g., "LINK")
  threshold: number; // Percentage drop threshold as a decimal (e.g., 0.05 for 5%)
  customSlippage?: number; // Optional slippage override (if applicable)
  userId: string; // Discord user ID who set the alert
  baselinePrice: number; // Price captured at the time of registration (in USD)
  triggered: boolean; // Whether the alert has already been triggered
}

// In-memory store for alerts.
const alerts: Alert[] = [];

/**
 * Registers a new alert.
 * Captures the current price as the baseline and stores the alert.
 *
 * @param alertData - The alert details (excluding baselinePrice and triggered flag)
 */
export async function registerCustomAlert(
  alertData: Omit<Alert, "baselinePrice" | "triggered">
): Promise<void> {
  try {
    const baselinePrice = await getTokenPrice(alertData.token);
    const newAlert: Alert = {
      ...alertData,
      baselinePrice,
      triggered: false,
    };
    alerts.push(newAlert);
    console.log(
      `DEBUG: Registered alert for ${alertData.token} with baseline price ${baselinePrice} USD and threshold ${alertData.threshold}`
    );
  } catch (error) {
    console.error(`Error registering alert for ${alertData.token}:`, error);
    throw error;
  }
}

/**
 * Monitors all registered alerts.
 * For each alert, checks if the current price has dropped by the specified threshold relative to the baseline.
 * If the condition is met and the alert hasn't been triggered, sends a Discord notification.
 * Optionally, resets the alert trigger if the price recovers.
 */
export async function monitorAlerts(): Promise<void> {
  for (const alert of alerts) {
    try {
      const currentPrice = await getTokenPrice(alert.token);
      // Calculate percentage drop from the baseline.
      const percentDrop =
        (alert.baselinePrice - currentPrice) / alert.baselinePrice;
      console.log(
        `DEBUG: Monitoring alert for ${alert.token}: baseline ${alert.baselinePrice} USD, current ${currentPrice} USD, drop ${(percentDrop * 100).toFixed(2)}%`
      );

      // If the price drop meets or exceeds the threshold and the alert hasn't been triggered:
      if (percentDrop >= alert.threshold && !alert.triggered) {
        console.log(
          `DEBUG: Alert condition met for ${alert.token}. Triggering notification for user ${alert.userId}.`
        );
        // Construct a Signal object to send via Discord.
        const signal: Signal = {
          token: alert.token,
          currentPrice: currentPrice,
          averagePrice: alert.baselinePrice,
          percentageDrop: percentDrop,
          suggestedAction: "BUY", // or adjust as needed
          timestamp: Date.now(),
        };
        await sendDiscordNotification(signal);
        // Mark the alert as triggered so it doesn't repeatedly notify.
        alert.triggered = true;
      }
      // Optionally, if the price recovers above the threshold, reset the alert trigger.
      else if (percentDrop < alert.threshold && alert.triggered) {
        console.log(
          `DEBUG: Alert for ${alert.token} reset as the drop is no longer met.`
        );
        alert.triggered = false;
      }
    } catch (error) {
      console.error(`Error monitoring alert for ${alert.token}:`, error);
    }
  }
}

/**
 * Starts periodic monitoring of alerts.
 *
 * @param intervalMs - The interval in milliseconds between checks (default 10000 ms)
 */
export function startAlertMonitoring(intervalMs: number = 10000): void {
  setInterval(monitorAlerts, intervalMs);
  console.log(`DEBUG: Alert monitoring started with interval ${intervalMs} ms`);
}
