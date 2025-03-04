⚠️ **Warning**: This is pre‑alpha software under active development. Expect
frequent breaking changes and bugs. It is currently set up to make live trades
on the Arbitrum network using real tokens—use at your own risk.

# Meditation Agent Example

## Overview

The Meditation Agent is an example project that demonstrates:

- **Custom Meditation Generation:** Users send natural language meditation
  requests via Discord (e.g., “I need a meditation for stress relief while
  walking in a forest”). These requests are parsed and transformed into detailed
  meditation scripts using Groq/Deepseek.
- **Audio Synthesis & Pacing:** The agent uses the ElevenLabs API to generate
  spoken audio for each segment of the meditation script. Pre‑recorded silence
  tracks and audio processing (via ffmpeg) are used to create a cohesive,
  calming final meditation track.
- **Customizable Experience:** The meditation is generated dynamically to
  reflect the user’s input, ensuring a unique and immersive guided meditation
  experience each time.

This project leverages the
[Daydreams framework](https://github.com/daydreamsai/daydreams) along with
Deepseek (via Groq) to convert natural language requests into structured
meditation scripts and then uses ElevenLabs to generate the corresponding audio.

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

   - DISCORD_TOKEN_MEDITATION
   - DISCORD_CHANNEL_ID_MEDITATION
   - GROQ_API_KEY_MEDITATION
   - ELEVENLABS_API_KEY

   Refer to the comments in .env.example for guidance on obtaining each key.

### Getting Started

```bash
bun run src/meditationIndex.ts
```

The entry point (src/meditationIndex.ts) initializes the Meditation Agent,
processes user meditation requests from Discord, generates custom meditation
scripts, synthesizes spoken audio for each script segment, and concatenates the
final track.

## How to Use on Discord

### Discord Bot Setup

1. Create a [new application](https://discord.com/developers/applications).
2. Ensure it has proper permissions: send messages, read messsage history, view
   channels, and embed links.
3. Copy your bot token and add it to your .env file as DISCORD_TOKEN.
4. Add your bot token as DISCORD_TOKEN_MEDITATION in your .env file.

### Trade Command Example:

@Meditation Bot, I need a meditation for stress relief while walking in a
forest.

The bot will reply confirming receipt and later return your custom meditation
script along with a link to the final audio file.

## File Structure

```bash
src/
├── agents/
│   ├── meditation/
│   │   ├── index.ts                # Meditation agent entry point: generates scripts, synthesizes audio, and concatenates final track
│   │   └── prompts/
│   │       ├── main.ts             # Parses natural language meditation requests using Groq/Deepseek
│   │       └── schema.ts           # Zod schema for meditation parameters
│   ├── gmx/                       # (GMX agent files -- separate repository or branch)
│   └── ...                        # Additional agents may be added here
├── utils/
│   ├── discordMeditation.ts       # Discord integration for the Meditation Agent
│   └── groq.ts                    # Groq/Deepseek integration helper
└── index.ts                       # Unified entry point (if applicable)
```

## Future Roadmap

Some potential enhancements for the Meditation Agent include:

- **Enhanced Script Customization:** Incorporate more advanced LLM prompting and
  contextual cues for even more personalized meditations.
- **Dynamic Pacing Controls:** Experiment with varied silence and spoken audio
  durations to better match user preferences.
- **Audio Processing Improvements:** Refine audio synthesis and concatenation
  (e.g., using improved ffmpeg workflows or alternative TTS engines).
- **User Interface Development:** Create a simple web or mobile dashboard to
  allow users to submit requests and view/download their meditation tracks.
- **Community Contributions:** Welcome feedback and contributions—check our
  GitHub issues for “good first issues.”

## Troubleshooting

- Missing Environment Variables: Ensure your .env file is correctly set up.
- Audio Synthesis Issues: Check logs for errors related to the ElevenLabs API or
  ffmpeg.
- Discord Bot Not Responding: Verify that the bot is correctly invited to your
  server and has appropriate permissions.
- Script Generation Problems: Review Groq/Deepseek logs to ensure the LLM
  returns valid JSON.

## Contributing

Looking to contribute? Send a message to jbp3 in the Daydreams Discord.
