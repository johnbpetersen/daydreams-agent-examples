// src/agents/gmx/signals/types.ts
// -------------------------------------------------------------
// Description: Defines types for signal monitoring in the GMX Trading Agent.
//   - SignalRule: Contains the token and threshold for triggering an alert.
//   - Signal: Contains details of a detected signal (current price, average price,
//             percentage drop, suggested action, and timestamp).
// Last Update: chore: Added header documentation for signal types
// -------------------------------------------------------------

export interface SignalRule {
  token: string; // e.g., "BTC" or "ETH"
  threshold: number; // e.g., 0.05 for a 5% drop
}

export interface Signal {
  token: string;
  currentPrice: number;
  averagePrice: number;
  percentageDrop: number;
  suggestedAction: string; // e.g., "BUY"
  timestamp: number;
}
