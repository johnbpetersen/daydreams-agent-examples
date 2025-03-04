⚠️ **Warning**: This is pre‑alpha software under active development. Expect
frequent breaking changes and bugs. Use at your own risk.

This repository contains examples of custom agents built with the Daydreams
framework. The two primary agents showcased here are:

- [GMX Trading Agent](src/agents/gmx/README.md): Processes natural language
  trade and alert commands via Discord, executes trades on GMX, and monitors
  price signals.
- [Meditation Agent](src/agents/meditation/README.md): Generates personalized
  meditation scripts from user input, converts them into custom audio tracks
  using ElevenLabs, and assembles a complete meditation track.

## File Structure

```bash
.

├── src
│   ├── agents
│   │   ├── gmx
│   │   │   ├── actions/             \# Trading actions, price computation, and tests
│   │   │   ├── alerts/              \# Alert registration and monitoring logic
│   │   │   ├── prompts/             \# LLM-based natural language parsers for trade/alert commands
│   │   │   ├── config.ts            \# Global configuration for GMX (token addresses, RPC, etc.)
│   │   │   └── README.md            \# \[Link to GMX Agent README\](./src/agents/gmx/README.md)
│   │   └── meditation
│   │       ├── prompts/             \# LLM-based meditation request parser and schema
│   │       ├── index.ts             \# Meditation script generation and audio processing
│   │       └── README.md            \# \[Link to Meditation Agent README\](./src/agents/meditation/README.md)
│   └── utils
│       ├── discord.ts             \# GMX Discord integration
│       ├── discordMeditation.ts    \# Meditation Discord integration
│       └── groq.ts                \# Groq/Deepseek integration helper
└── README.md                        \# This overall project README
```

## Contributing

Looking to contribute? Send a message to jbp3 in the Daydreams Discord.
