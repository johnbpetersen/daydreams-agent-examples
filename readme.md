⚠️ **Warning**: This is pre‑alpha software under active development. Expect
frequent breaking changes and bugs. It is currently set up to make live trades
on the Arbitrum network using real tokens—use at your own risk.

# GMX Trading Agent Example

## Overview

The GMX Trading Agent is an example project that demonstrates:

- **Natural Language Trades:** Users send trade commands (e.g., “buy 0.77 USDC
  for WETH with 1% slippage”) via Discord. These commands are parsed and
  executed on GMX.
- **Buy Signal Monitoring:** The agent continuously monitors token prices and
  issues alerts when specified conditions are met (e.g., "alert me when WETH
  drops by 0.1%").

This project leverages the
[Daydreams framework](https://github.com/daydreamsai/daydreams) along with
Deepseek (via Groq) to convert natural language commands into structured JSON
parameters for executing trades and setting up alerts.

## Installation

### Prerequisites

- [Bun](https://bun.sh) (or Node.js if you adapt the scripts)
- Git

### Setup Steps

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/yourusername/gmx-trading-agent.git
   cd gmx-trading-agent

   ```

2. **Install Dependencies:**

   ```bash
   bun install
   ```

3. **Enviroment Setup:**

   ```bash
   cp .env.example .env
   ```

   Fill in the required environment variables:

   - DISCORD_TOKEN
   - DISCORD_CHANNEL_ID
   - GROQ_API_KEY
   - GMX_RPC_URL
   - GMX_VAULT_ADDRESS
   - GMX_ROUTER_ADDRESS
   - PRIVATE_KEY

   Refer to the comments in .env.example for guidance on obtaining each key.

### Getting Started

```bash
bun run src/index.ts
```

The unified entry point (src/index.ts) initializes the Discord bot,
distinguishes between processes for trade and alert commands (which must be sent
as messages that start with a bot mention), and begins alert monitoring or trade
execution.

## How to Use on Discord

### Discord Bot Setup

1. Create a [new application](https://discord.com/developers/applications).
2. Ensure it has proper permissions: send messages, read messsage history, view
   channels, and embed links.
3. Copy your bot token and add it to your .env file as DISCORD_TOKEN.
4. Add the bot to your discord server.

### Trade Command Example:

@GMX-Trading-Agent swap $1 usdc for weth

The bot will respond with trade details, ask for confirmation, and then execute
the trade with an Arbiscan confirmation link.

### Alert Command Example:

@GMX-Trading-Agent set up a buy alert for WETH if there's a 0.1% drop

The bot will register the alert and notify you when conditions are met.

## File Structure

```bash
src/
├── agents/
│   └── gmx/
│       ├── actions/
│       │   ├── index.ts         # Main trading actions: placeTrade, approveToken, etc.
│       │   ├── priceOracle.ts   # Price retrieval and computation functions
│       │   ├── tradeTest.ts     # Test harness for trade commands (optional)
│       │   └── priceoracletests.ts  # Test harness for price oracle (optional)
│       ├── alerts/
│       │   └── alertManager.ts  # Alert registration and monitoring logic
│       ├── prompts/
│       │   ├── main.ts          # Natural language trade command parser and schema
│       │   ├── alert.ts         # Alert command parser and schema
│       │   └── schema.ts        # Shared schema definitions (if needed)
│       ├── config.ts            # Global configuration (token addresses, RPC, etc.)
│       └── index.ts             # Placeholder for GMX‑specific bootstrapping (if needed)
├── utils/
│   ├── discord.ts             # Discord bot integration (notifications, command handling)
│   └── groq.ts                # Groq/Deepseek integration helper
└── index.ts                 # Unified entry point for the application
```

## Future Roadmap

While this GMX Trading Agent is fully functional as a demo, there are several
exciting enhancements possible to continue development:

- **Simplify Decimal Conversions:**  
  Refine the process for computing `minOut` values to improve accuracy and
  handle tokens with non‑18 decimals (e.g., WBTC) more gracefully.

- **Upgrade to GMX v2 Contracts:**  
  Migrate from GMX v1 to v2 contracts to take advantage of improved liquidity,
  faster updates, and additional features.

- **Enable Futures Trading:**  
  Extend functionality to support futures trading, allowing the agent to execute
  a wider range of strategies.

- **Enhanced Daydreams Integration:**  
  Integrate upcoming Daydreams framework features such as episodic memory and
  autonomous goal planning to improve strategy reflection and decision-making.

- **Advanced Price Monitoring:**  
  Implement additional technical indicators (e.g., moving averages, RSI) and
  integrate external price APIs for more robust signal detection.

- **Autonomous Trading Strategies:**  
  Develop modules for the agent to autonomously plan, execute, and adjust
  trading strategies based on market conditions.

- **User Interface Enhancements:**  
  Consider building a simple web or CLI dashboard to provide real-time trade
  updates, configuration management, and historical reporting.

- **Community Collaboration:**  
  Create clear contribution guidelines and a list of “good first issues” to
  encourage community feedback and collaborative development.

These roadmap items will guide future development, helping transform this
example into a more sophisticated and autonomous trading system.

## Troubleshooting

- Missing Environment Variables: Ensure your .env file is set up correctly and
  all required variables are provided.
- Price Conversion Issues: The computation of minOut can be sensitive,
  especially for tokens with non‑18 decimals. Review the logs for detailed
  conversion steps.
- Discord Command Not Processed: Verify that commands are sent with a proper bot
  mention (e.g., @GMX Trading Agent ...).

## Contributing

Looking to contribute? Send a message to jbp3 in the Daydreams Discord.
