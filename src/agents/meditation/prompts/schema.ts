// src/agents/meditation/prompts/schema.ts
// -------------------------------------------------------------
// Description: Defines the Zod schema for parsing meditation parameters
//   from natural language commands. This includes "theme", "setting", and "duration"
//   (all as strings). This schema ensures that all required fields are provided.
// Last Update: feat(meditation): Added schema for meditation request parsing
// -------------------------------------------------------------

import { z } from "zod";

export const meditationParametersSchema = z.object({
  theme: z.string().min(1, "theme is required"),
  setting: z.string().min(1, "setting is required"),
  duration: z.string().min(1, "duration is required"), // e.g., "5 minutes"
});

export type MeditationParameters = z.infer<typeof meditationParametersSchema>;
