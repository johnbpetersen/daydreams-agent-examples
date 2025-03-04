// src/agents/meditation/index.ts
// -------------------------------------------------------------
// Description: Generates a meditation script using Groq/Deepseek, converts it into audio files
//   via ElevenLabs API, and concatenates them with silence into a single final MP3 using ffmpeg.
// Last Update: fix(meditation): Ensure silence tracks are included in final output
// -------------------------------------------------------------

import { sendDiscordMessage } from "../../utils/discordMeditation";
import { createGroqClient, queryLLM } from "../../utils/groq";
import { parseMeditationRequest } from "./prompts/main";
import { ElevenLabsClient } from "elevenlabs";
import * as path from "path";
import * as fs from "fs/promises";

// Initialize ElevenLabs client
const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const SILENCE_FILE = path.join(__dirname, "assets", "silence_5s.mp3");

export async function generateMeditationScript(
  theme: string,
  setting: string,
  duration: string
): Promise<{ script: string; audioFiles: string[] }> {
  const groqClient = createGroqClient(process.env.GROQ_API_KEY_MEDITATION!);
  const systemPrompt = `You are a meditation script generator. Create a short, calming meditation script based on these inputs:
- Theme: ${theme}
- Setting: ${setting}
- Duration: ${duration}
Generate exactly 3 short lines of text with a [PAUSE_5s] marker after the first and second lines (2 pauses total). Keep it soothing and vivid, using sensory details related to the setting.
Return ONLY the script as plain text with no extra commentary or tags like <think>.

Example:
Input: Theme: peace, Setting: forest, Duration: 5 minutes
Output:
Welcome to a serene forest, where the air is calm and the trees stand tall. [PAUSE_5s]
Listen to the soothing sound of a gentle stream flowing through the woods. [PAUSE_5s]
Breathe deeply, letting the peaceful energy of the forest surround you.`;
  const userMessage = "Generate the meditation script.";

  try {
    console.log(
      `Starting script generation for theme: ${theme}, setting: ${setting}, duration: ${duration}`
    );
    const scriptRaw = await queryLLM(groqClient, systemPrompt, userMessage);
    console.log("Raw script from LLM:", scriptRaw);

    // Clean up any <think> tags
    const script = scriptRaw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    console.log("Cleaned script:", script);

    const segments = script.split(/(\[PAUSE_\d+s\])/);
    console.log("Script segments:", segments);

    const audioFiles: string[] = [];
    const outputDir = path.join(__dirname, "meditations");
    await fs.mkdir(outputDir, { recursive: true });
    console.log("Ensured output directory exists:", outputDir);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i].trim();
      if (!segment) {
        console.log(`Skipping empty segment at index ${i}`);
        continue;
      }

      const segmentLogPrefix = `[Segment ${i}: '${segment}']`;
      if (segment.match(/\[PAUSE_\d+s\]/)) {
        console.log(`${segmentLogPrefix} Adding silence file: ${SILENCE_FILE}`);
        audioFiles.push(SILENCE_FILE);
      } else {
        const spokenFile = path.join(outputDir, `spoken_${i}.mp3`);
        console.log(`${segmentLogPrefix} Generating audio file: ${spokenFile}`);
        try {
          await generateSpokenAudio(segment, spokenFile);
          audioFiles.push(spokenFile);
          console.log(
            `${segmentLogPrefix} Successfully added audio file: ${spokenFile}`
          );
        } catch (error) {
          console.error(`${segmentLogPrefix} Failed to generate audio:`, error);
          audioFiles.push(`ERROR_${spokenFile}`);
        }
      }
    }

    console.log("Final audio files list:", audioFiles);
    return { script, audioFiles };
  } catch (error) {
    console.error("Top-level error in generateMeditationScript:", error);
    return {
      script: `A ${theme} moment in ${setting}. [PAUSE_5s] Relax... [PAUSE_5s] Enjoy. (Error: ${error})`,
      audioFiles: [],
    };
  }
}

async function generateSpokenAudio(
  text: string,
  outputPath: string
): Promise<void> {
  console.log(`[generateSpokenAudio] Starting for text: '${text}'`);
  console.log(`[generateSpokenAudio] Target output path: ${outputPath}`);

  try {
    console.log(`[generateSpokenAudio] Calling ElevenLabs API...`);
    const response = await elevenLabsClient.generate({
      text,
      voice: "21m00Tcm4TlvDq8ikWAM", // Rachel's voice ID
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    });

    console.log(`[generateSpokenAudio] API response received`);

    // Collect the stream into a buffer
    const chunks = [];
    for await (const chunk of response) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    await fs.writeFile(outputPath, buffer);

    console.log(
      `[generateSpokenAudio] Successfully wrote file to: ${outputPath}`
    );
  } catch (error) {
    console.error(`[generateSpokenAudio] Error:`, error);
    throw error;
  }
}

async function createFinalMeditationAudio(
  audioFiles: string[],
  outputPath: string
): Promise<void> {
  const listFilePath = path.join(__dirname, "meditations", "input.txt");

  try {
    // Create the list of files for ffmpeg with absolute paths
    const fileList = audioFiles
      .map((file) => `file '${path.resolve(file)}'`)
      .join("\n");
    await fs.writeFile(listFilePath, fileList);
    console.log(`Created ffmpeg input list at: ${listFilePath}`);
    console.log(`Input list content:\n${fileList}`);

    // Verify each file exists
    for (const file of audioFiles) {
      console.log(`Checking file: ${file} - Exists: ${await fs.exists(file)}`);
    }

    // Run ffmpeg to concatenate the files
    console.log(`Combining audio files into ${outputPath}...`);
    const ffmpegProcess = Bun.spawn(
      [
        "ffmpeg",
        "-f",
        "concat", // Use the concat demuxer
        "-safe",
        "0", // Allow absolute paths
        "-i",
        listFilePath, // Input file list
        "-c:a",
        "mp3", // Ensure output is MP3 (re-encode if needed)
        "-y", // Overwrite output file if it exists
        outputPath, // Output file
      ],
      {
        stdout: "pipe", // Capture stdout for logging
        stderr: "pipe", // Capture stderr for error details
      }
    );

    // Log ffmpeg output in real-time
    const stdout = await new Response(ffmpegProcess.stdout).text();
    const stderr = await new Response(ffmpegProcess.stderr).text();
    console.log(`ffmpeg stdout: ${stdout}`);
    console.log(`ffmpeg stderr: ${stderr}`);

    // Wait for ffmpeg to finish
    await ffmpegProcess.exited;
    if (ffmpegProcess.exitCode !== 0) {
      throw new Error(
        `ffmpeg failed with exit code ${ffmpegProcess.exitCode}: ${stderr}`
      );
    }

    console.log(`Final meditation audio created at: ${outputPath}`);
  } catch (error) {
    console.error(`Error in createFinalMeditationAudio:`, error);
    throw error;
  } finally {
    // Clean up the temp file
    try {
      await fs.unlink(listFilePath);
      console.log(`Cleaned up temp file: ${listFilePath}`);
    } catch (cleanupError) {
      console.error(`Failed to clean up temp file:`, cleanupError);
    }
  }
}

export async function handleMeditationRequest(
  request: string,
  channelId: string,
  sendResponse: (channelId: string, content: string) => Promise<void>
): Promise<void> {
  console.log(
    `Handling meditation request: '${request}' for channel: ${channelId}`
  );
  await sendResponse(channelId, "No problem. We're working on it!");

  const { theme, setting, duration } = await parseMeditationRequest(request);
  console.log(
    `Parsed request - Theme: ${theme}, Setting: ${setting}, Duration: ${duration}`
  );

  const { script, audioFiles } = await generateMeditationScript(
    theme,
    setting,
    duration
  );
  console.log("Request complete. Audio files generated:", audioFiles);

  // Generate the final combined audio
  const finalOutputPath = path.join(
    __dirname,
    "meditations",
    "final_meditation.mp3"
  );
  try {
    await createFinalMeditationAudio(audioFiles, finalOutputPath);
    await sendResponse(
      channelId,
      `Here's your meditation script:\n${script}\n\nFinal audio ready at: ${finalOutputPath}`
    );
  } catch (error) {
    console.error("Failed to create final meditation audio:", error);
    await sendResponse(
      channelId,
      `Here's your meditation script:\n${script}\n\nError creating final audio: ${error}`
    );
  }
}
