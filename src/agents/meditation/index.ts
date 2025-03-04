/**
 * File: src/agents/meditation/index.ts
 * -------------------------------------------------------------
 * Description: Generates a meditation script using Groq/Deepseek and converts it into
 *   audio files via the ElevenLabs API. It processes each spoken segment separately,
 *   inserting standard audio cues (gong, standard opening, silence) as needed.
 *   This version uses the Daydreams native Discord integration for command handling,
 *   refined ElevenLabs TTS integration (using fs/promises for file operations), and
 *   includes temporary file cleanup.
 * Last Update: feat(meditation): Updated header; refined audio generation and cleanup logic;
 *   integrated standard opening and closing cues.
 * -------------------------------------------------------------
 */

import { sendDiscordMessage } from "../../utils/discordMeditation";
import { createGroqClient, queryLLM } from "../../utils/groq";
import { parseMeditationRequest } from "./prompts/main";
import { ElevenLabsClient } from "elevenlabs";
import * as path from "path";
import * as fs from "fs/promises";

const elevenLabsClient = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const SILENCE_FILES = {
  "1s": path.join(__dirname, "assets", "silence_1s.mp3"),
  "3s": path.join(__dirname, "assets", "silence_3s.mp3"),
  "5s": path.join(__dirname, "assets", "silence_5s.mp3"),
  "10s": path.join(__dirname, "assets", "silence_10s.mp3"),
  "20s": path.join(__dirname, "assets", "silence_20s.mp3"),
  "30s": path.join(__dirname, "assets", "silence_30s.mp3"),
  "60s": path.join(__dirname, "assets", "silence_60s.mp3"),
} as const;

const STANDARD_OPENING_FILE = path.join(
  __dirname,
  "assets",
  "standard_opening.mp3"
);
const GONG_FILE = path.join(__dirname, "assets", "gong.mp3");
const VOICE_SPEED = 0.88;

async function cleanupTempFiles(tempFiles: string[]): Promise<void> {
  for (const file of tempFiles) {
    try {
      if (await fs.exists(file)) {
        await fs.unlink(file);
        console.log(`Cleaned up temp file: ${file}`);
      }
    } catch (error) {
      console.error(`Failed to clean up temp file ${file}:`, error);
    }
  }
}

export async function generateMeditationScript(
  request: string
): Promise<{ script: string; audioFiles: string[] }> {
  const groqClient = createGroqClient(process.env.GROQ_API_KEY_MEDITATION!);
  const systemPrompt = `You are a meditation script generator crafting an epic, immersive experience. The user has requested: '${request}'. Create a meditation script that follows this structure:

1. **Opening (45-70s total)**:
   - **Summary Intro (~15-20s)**: Welcome the listener with a soothing tone, summarize their request by filling in the subject (e.g., gratitude, releasing limiting beliefs) and goal (e.g., embrace your potential, find peace), using a phrase like "Welcome to this meditation on [subject] where we’ll [goal]." Keep it concise and evocative.
   - Then a line break.
   - **Scene-Setting (~30-45s)**: Paint a vivid scene tied to their request (e.g., an eagle on a mountain, a beach at dusk), mention their goal explicitly, and end with a deep breath cue. Use sensory details (sight, sound, touch) to draw them in.

2. **Middle (3-5 segments)**: Guide them through 3-5 short segments (1-2 sentences each), each focusing on a sensory moment or reflection that deepens their requested experience. Separate each segment with a blank line.

3. **Closing (30-60s)**: Ground them gently with a return to awareness, reinforce their goal, cue a final deep breath, and end with a gentle close.

Use soft, evocative language—think gentle, flowing, vivid imagery—and keep the pace slow. Weave the user’s request throughout the script naturally, don’t force it into rigid categories unless specified. Return the script as plain text with blank lines between sections and segments—no [PAUSE_Xs] markers needed, we'll handle pacing programmatically. Aim for a total duration close to what they asked, balancing spoken parts and silence for a calming flow.`;
  const userMessage = "Generate the meditation script.";

  const runId = Date.now().toString(); // Unique ID for this run
  const tempFiles: string[] = []; // Track temp files for cleanup

  try {
    console.log(`Starting script generation for request: ${request}`);
    const scriptRaw = await queryLLM(groqClient, systemPrompt, userMessage);
    console.log("Raw script from LLM:", scriptRaw);

    const llmScript = scriptRaw
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/\*\*.*?(\n|$)/g, "")
      .replace(/^\s*\d+\.\s*/gm, "")
      .replace(/---/g, "")
      .trim();
    console.log("LLM-generated script (cleaned):", llmScript);

    const standardOpening =
      "Let’s begin as we always do. Take a deep breath in, and as you exhale, let go of your surroundings, your thoughts, and anything pulling you from this moment. Focus on connecting to your breath as we start our journey.";
    const sections = llmScript.split("\n\n").filter((s) => s.trim().length > 0);
    const closingParts = sections[sections.length - 1].split(
      "Take one final, deep breath"
    );
    const script = `${sections[0]}\n\n${standardOpening}\n\n${sections.slice(1, -1).join("\n\n")}\n\n${closingParts[0]}\n\nTake one final, deep breath${closingParts[1]}`;
    console.log(
      "Generated script with standard opening and split closing:",
      script
    );

    const finalSections = script
      .split("\n\n")
      .filter((s) => s.trim().length > 0);
    console.log("Script sections:", finalSections);

    const audioFiles: string[] = [];
    const outputDir = path.join(__dirname, "meditations");
    await fs.mkdir(outputDir, { recursive: true });
    console.log("Ensured output directory exists:", outputDir);

    // Add opening gong
    audioFiles.push(GONG_FILE);
    console.log("Added opening gong");

    for (let i = 0; i < finalSections.length; i++) {
      const section = finalSections[i].trim();
      const segmentLogPrefix = `[Section ${i}: '${section}']`;

      if (section === standardOpening) {
        console.log(
          `${segmentLogPrefix} Adding standard opening file: ${STANDARD_OPENING_FILE}`
        );
        audioFiles.push(STANDARD_OPENING_FILE);
        audioFiles.push(SILENCE_FILES["5s"]);
      } else {
        const sentences = section
          .split(/(?<=\.)\s+/)
          .filter((s) => s.length > 0);
        const sectionWithPauses = sentences.join(" <1s> ");
        const spokenFile = path.join(outputDir, `spoken_${runId}_${i}.mp3`);
        tempFiles.push(spokenFile); // Track for cleanup
        console.log(
          `${segmentLogPrefix} Cleaned and paced section: '${sectionWithPauses}'`
        );
        console.log(`${segmentLogPrefix} Generating audio file: ${spokenFile}`);
        await generateSpokenAudio(
          sectionWithPauses,
          spokenFile,
          runId,
          tempFiles
        );
        audioFiles.push(spokenFile);
        let trailingSilence: string;
        if (i === 0)
          trailingSilence = "3s"; // After Summary Intro
        else if (i === finalSections.length - 2)
          trailingSilence = "30s"; // Before final breath
        else if (i === finalSections.length - 1)
          trailingSilence = "10s"; // End
        else trailingSilence = "5s"; // Middle sections
        audioFiles.push(
          SILENCE_FILES[trailingSilence as keyof typeof SILENCE_FILES]
        );
        console.log(
          `${segmentLogPrefix} Added ${trailingSilence} trailing silence`
        );
      }
    }

    // Add closing gong
    audioFiles.push(GONG_FILE);
    console.log("Added closing gong");

    console.log("Final audio files list:", audioFiles);
    return { script, audioFiles };
  } catch (error) {
    console.error("Top-level error in generateMeditationScript:", error);
    await cleanupTempFiles(tempFiles);
    return {
      script: `A moment of calm inspired by your request: ${request}. Relax... Enjoy. (Error: ${error})`,
      audioFiles: [],
    };
  }
}

async function generateSpokenAudio(
  text: string,
  outputPath: string,
  runId: string,
  tempFiles: string[]
): Promise<void> {
  console.log(`[generateSpokenAudio] Starting for text: '${text}'`);
  console.log(`[generateSpokenAudio] Target output path: ${outputPath}`);

  const outputDir = path.join(__dirname, "meditations");
  const tempFile = path.join(outputDir, `temp_${runId}_${Date.now()}.mp3`);
  const tempAdjustedFile = path.join(
    outputDir,
    `temp_adjusted_${runId}_${Date.now()}.mp3`
  );
  tempFiles.push(tempFile, tempAdjustedFile);

  try {
    console.log(
      `[generateSpokenAudio] Calling ElevenLabs API with Emily's voice...`
    );
    const response = await elevenLabsClient.generate({
      text: text.replace(/<1s>/g, " "),
      voice: "LcfcDJNUP1GQjkzn1xUU",
      model_id: "eleven_monolingual_v1",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    });

    const chunks = [];
    for await (const chunk of response) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    await fs.writeFile(tempFile, buffer);
    console.log(`[generateSpokenAudio] Wrote temp file: ${tempFile}`);

    console.log(
      `[generateSpokenAudio] Slowing audio to ${VOICE_SPEED * 100}% speed...`
    );
    let ffmpegProcess = Bun.spawn(
      [
        "ffmpeg",
        "-i",
        tempFile,
        "-filter:a",
        `atempo=${VOICE_SPEED}`,
        "-c:a",
        "mp3",
        "-y",
        tempAdjustedFile,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    let stderr = await new Response(ffmpegProcess.stderr).text();
    await ffmpegProcess.exited;
    if (ffmpegProcess.exitCode !== 0) {
      throw new Error(`ffmpeg failed to slow audio: ${stderr}`);
    }

    const segments = text.split("<1s>").filter((s) => s.trim().length > 0);
    if (segments.length > 1) {
      const silenceFile = SILENCE_FILES["1s"];
      const listFilePath = path.join(
        outputDir,
        `temp_list_${runId}_${Date.now()}.txt`
      );
      tempFiles.push(listFilePath);
      let fileList = "";
      for (let i = 0; i < segments.length; i++) {
        fileList += `file '${path.resolve(tempAdjustedFile)}'\n`;
        if (i < segments.length - 1) {
          fileList += `file '${path.resolve(silenceFile)}'\n`;
        }
      }
      await fs.writeFile(listFilePath, fileList);
      ffmpegProcess = Bun.spawn(
        [
          "ffmpeg",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listFilePath,
          "-c:a",
          "mp3",
          "-y",
          outputPath,
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      stderr = await new Response(ffmpegProcess.stderr).text();
      await ffmpegProcess.exited;
      if (ffmpegProcess.exitCode !== 0) {
        throw new Error(`ffmpeg failed to insert silences: ${stderr}`);
      }
    } else {
      await fs.rename(tempAdjustedFile, outputPath);
      tempFiles.splice(tempFiles.indexOf(tempAdjustedFile), 1);
    }

    console.log(
      `[generateSpokenAudio] Successfully wrote final file to: ${outputPath}`
    );
  } catch (error) {
    console.error(`[generateSpokenAudio] Error:`, error);
    throw error;
  } finally {
    await cleanupTempFiles(tempFiles.filter((f) => f !== outputPath));
  }
}

async function stackSilence(duration: string): Promise<string> {
  const seconds = parseInt(duration.replace("s", ""));
  const outputFile = path.join(
    __dirname,
    "meditations",
    `stacked_silence_${seconds}s.mp3`
  );
  const availableDurations = Object.keys(SILENCE_FILES)
    .map((d) => parseInt(d.replace("s", "")))
    .sort((a, b) => b - a);

  let remaining = seconds;
  const filesToStack: string[] = [];

  for (const dur of availableDurations) {
    while (remaining >= dur) {
      filesToStack.push(SILENCE_FILES[`${dur}s` as keyof typeof SILENCE_FILES]);
      remaining -= dur;
    }
  }

  if (filesToStack.length === 0) {
    console.warn(
      `No silence files available for stacking ${seconds}s; defaulting to 5s`
    );
    return SILENCE_FILES["5s"];
  }

  const listFilePath = path.join(
    __dirname,
    "meditations",
    `stacked_list_${Date.now()}.txt`
  );
  const tempFiles: string[] = [listFilePath];
  try {
    const fileList = filesToStack
      .map((file) => `file '${path.resolve(file)}'`)
      .join("\n");
    await fs.writeFile(listFilePath, fileList);

    const ffmpegProcess = Bun.spawn(
      [
        "ffmpeg",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFilePath,
        "-c:a",
        "mp3",
        "-y",
        outputFile,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const stderr = await new Response(ffmpegProcess.stderr).text();
    await ffmpegProcess.exited;
    if (ffmpegProcess.exitCode !== 0) {
      throw new Error(
        `ffmpeg failed to stack silence for ${seconds}s: ${stderr}`
      );
    }

    console.log(`Stacked silence created: ${outputFile}`);
    return outputFile;
  } catch (error) {
    console.error(`Failed to stack silence:`, error);
    throw error;
  } finally {
    await cleanupTempFiles(tempFiles);
  }
}

async function createFinalMeditationAudio(
  audioFiles: string[],
  outputPath: string,
  tempFiles: string[]
): Promise<void> {
  const listFilePath = path.join(
    __dirname,
    "meditations",
    `input_${Date.now()}.txt`
  );
  tempFiles.push(listFilePath);

  try {
    const fileList = audioFiles
      .map((file) => `file '${path.resolve(file)}'`)
      .join("\n");
    await fs.writeFile(listFilePath, fileList);
    console.log(`Created ffmpeg input list at: ${listFilePath}`);
    console.log(`Input list content:\n${fileList}`);

    for (const file of audioFiles) {
      console.log(`Checking file: ${file} - Exists: ${await fs.exists(file)}`);
    }

    console.log(`Combining audio files into ${outputPath}...`);
    const ffmpegProcess = Bun.spawn(
      [
        "ffmpeg",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFilePath,
        "-c:a",
        "mp3",
        "-y",
        outputPath,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const stdout = await new Response(ffmpegProcess.stdout).text();
    const stderr = await new Response(ffmpegProcess.stderr).text();
    console.log(`ffmpeg stdout: ${stdout}`);
    console.log(`ffmpeg stderr: ${stderr}`);

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
  await sendResponse(
    channelId,
    "Thank you for your request! I’m now crafting a personalized meditation experience just for you. Your custom meditation file will be ready shortly—please hold tight."
  );

  const runId = Date.now().toString();
  const tempFiles: string[] = [];
  const finalOutputPath = path.join(
    __dirname,
    "meditations",
    `final_meditation_${runId}.mp3`
  );

  try {
    const { script, audioFiles } = await generateMeditationScript(request);
    tempFiles.push(
      ...audioFiles.filter((f) =>
        f.startsWith(path.join(__dirname, "meditations"))
      )
    );
    console.log("Request complete. Audio files generated:", audioFiles);

    await createFinalMeditationAudio(audioFiles, finalOutputPath, tempFiles);
    await sendResponse(
      channelId,
      `Your custom meditation is now complete! Listen to your personalized track here: ${finalOutputPath}`
    );
  } catch (error) {
    console.error("Failed to create final meditation audio:", error);
    await sendResponse(
      channelId,
      "Oops! There was an error creating your meditation. Please try again later."
    );
  } finally {
    await cleanupTempFiles(tempFiles);
  }
}
