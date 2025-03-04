// src/agents/gmx/alerts/alertManager.ts
// -------------------------------------------------------------
// Description: Manages custom alerts for the GMX Trading Agent.
//   This module registers alerts, continuously monitors them by comparing
//   current prices to baseline prices, and sends Discord notifications via
//   the Daydreams-based notification system when the specified price drop
//   thresholds are met. It also resets the alert trigger if conditions are no longer met.
// Last Update: feat(alert): Refactored alert registration and monitoring; integrated Discord notifications via Daydreams
// -------------------------------------------------------------

import { getTokenPrice } from "../actions/priceOracle";
import { sendGmxNotification } from "../../../utils/discordGmx";

export interface Signal {
  token: string;
  currentPrice: number;
  averagePrice: number;
  percentageDrop: number;
  suggestedAction: string;
  timestamp: number;
}

export interface Alert {
  token: string; // Token to monitor (e.g., "LINK")
  threshold: number; // Drop threshold as a decimal (e.g., 0.05 for 5%)
  customSlippage?: number; // Optional slippage override
  userId: string; // Discord user ID who set the alert
  baselinePrice: number; // Price at the time of registration (in USD)
  triggered: boolean; // Whether the alert has been triggered
}

// In-memory store for alerts.
const alerts: Alert[] = [];

/**
 * Registers a new alert by capturing the current price as baseline.
 * @param alertData - The alert details (excluding baselinePrice and triggered flag)
 * @throws An error if the current price cannot be retrieved.
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
 * For each alert, checks if the current price drop meets or exceeds the threshold.
 * If so, sends a Discord notification and marks the alert as triggered.
 * If the price recovers above the threshold, resets the triggered flag.
 */
export async function monitorAlerts(): Promise<void> {
  for (const alert of alerts) {
    try {
      const currentPrice = await getTokenPrice(alert.token);
      const percentDrop =
        (alert.baselinePrice - currentPrice) / alert.baselinePrice;
      console.log(
        `DEBUG: Monitoring ${alert.token}: baseline ${alert.baselinePrice} USD, current ${currentPrice} USD, drop ${(percentDrop * 100).toFixed(2)}%`
      );

      if (percentDrop >= alert.threshold && !alert.triggered) {
        console.log(
          `DEBUG: Alert condition met for ${alert.token}. Notifying user ${alert.userId}.`
        );
        const signal: Signal = {
          token: alert.token,
          currentPrice,
          averagePrice: alert.baselinePrice,
          percentageDrop: percentDrop,
          suggestedAction: "BUY",
          timestamp: Date.now(),
        };
        await sendGmxNotification(process.env.DISCORD_CHANNEL_ID!, signal);
        alert.triggered = true;
      } else if (percentDrop < alert.threshold && alert.triggered) {
        console.log(
          `DEBUG: Resetting alert for ${alert.token} as price drop is no longer met.`
        );
        alert.triggered = false;
      }
    } catch (error) {
      console.error(`Error monitoring alert for ${alert.token}:`, error);
    }
  }
}

/**
 * Starts periodic monitoring of registered alerts.
 * @param intervalMs - The interval in milliseconds between checks (default is 10000 ms)
 */
export function startAlertMonitoring(intervalMs: number = 10000): void {
  setInterval(monitorAlerts, intervalMs);
  console.log(`DEBUG: Alert monitoring started with interval ${intervalMs} ms`);
}
