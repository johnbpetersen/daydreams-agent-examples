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
