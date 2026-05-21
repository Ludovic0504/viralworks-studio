import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { capture, shutdown } from "./posthog.mjs";

const PORT = Number(process.env.VIDEO_AUDIO_PORT || process.env.PORT || 8788);
const PIPELINE_TOKEN = String(process.env.VIDEO_AUDIO_PIPELINE_TOKEN || "").trim();
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || ""
).trim();
const OUTPUT_BUCKET = String(process.env.VIDEO_OUTPUT_BUCKET || "generated-videos").trim();
const TTS_MODEL = String(process.env.TTS_MODEL || "gpt-4o-mini-tts").trim();
const TTS_VOICE = String(process.env.TTS_VOICE || "alloy").trim();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

function assertAuth(req, res) {
  if (!PIPELINE_TOKEN) return true;
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token && token === PIPELINE_TOKEN) return true;
  res.status(401).json({ error: "Unauthorized pipeline token." });
  return false;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function cleanText(value, max = 2000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function writeUrlToFile(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outputPath, buf);
}

function runCmd(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${bin} exited ${code}\n${stderr || stdout}`));
    });
  });
}

async function generateTtsMp3(text, outPath) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing for TTS.");
  const t = cleanText(text, 3500);
  if (!t) throw new Error("voice_text is empty.");
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: t,
      format: "mp3",
    }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`TTS failed (${res.status}): ${msg}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
}

function resolveMusicUrl(payload) {
  const direct = String(payload?.music_bed_url || "").trim();
  if (isHttpUrl(direct)) return direct;
  const style = String(payload?.music_style || "cinematic")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  const specific = String(process.env[`MUSIC_BED_URL_${style}`] || "").trim();
  if (isHttpUrl(specific)) return specific;
  const fallback = String(process.env.MUSIC_BED_URL_DEFAULT || "").trim();
  if (isHttpUrl(fallback)) return fallback;
  return "";
}

async function ensureBucket(bucket) {
  if (!supabase) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing.");
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets failed: ${error.message}`);
  const exists = (data || []).some((b) => b.id === bucket);
  if (exists) return;
  const { error: createErr } = await supabase.storage.createBucket(bucket, { public: true });
  if (createErr) throw new Error(`createBucket failed: ${createErr.message}`);
}

async function uploadOutput(localPath, userId) {
  if (!supabase) throw new Error("Supabase storage is not configured.");
  await ensureBucket(OUTPUT_BUCKET);
  const data = await fs.readFile(localPath);
  const filePath = `${userId}/${Date.now()}-${randomUUID()}.mp4`;
  const { error: uploadErr } = await supabase.storage.from(OUTPUT_BUCKET).upload(filePath, data, {
    contentType: "video/mp4",
    upsert: false,
    cacheControl: "3600",
  });
  if (uploadErr) throw new Error(`upload failed: ${uploadErr.message}`);
  const { data: pub } = supabase.storage.from(OUTPUT_BUCKET).getPublicUrl(filePath);
  return pub.publicUrl;
}

async function processVideo(payload) {
  const tmpDir = path.join(os.tmpdir(), `video-audio-${randomUUID()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const srcPath = path.join(tmpDir, "source.mp4");
  const voicePath = path.join(tmpDir, "voice.mp3");
  const musicPath = path.join(tmpDir, "music.mp3");
  const outPath = path.join(tmpDir, "output.mp4");
  const warnings = [];

  try {
    await writeUrlToFile(payload.source_video_url, srcPath);

    const enableTts = payload.enable_tts !== false;
    const enableMusic = payload.enable_music !== false;

    let hasVoice = false;
    let hasMusic = false;

    if (enableTts && cleanText(payload.voice_text, 20_000)) {
      try {
        await generateTtsMp3(payload.voice_text, voicePath);
        hasVoice = true;
      } catch (err) {
        warnings.push(`TTS skipped: ${err.message}`);
      }
    }

    if (enableMusic) {
      try {
        const musicUrl = resolveMusicUrl(payload);
        if (musicUrl) {
          await writeUrlToFile(musicUrl, musicPath);
          hasMusic = true;
        } else {
          warnings.push("Music skipped: no MUSIC_BED_URL configured for selected style.");
        }
      } catch (err) {
        warnings.push(`Music skipped: ${err.message}`);
      }
    }

    const ffmpegArgs = ["-y", "-i", srcPath];
    if (hasVoice) ffmpegArgs.push("-i", voicePath);
    if (hasMusic) ffmpegArgs.push("-i", musicPath);

    if (hasVoice && hasMusic) {
      ffmpegArgs.push(
        "-filter_complex",
        "[1:a]volume=1.0[voice];[2:a]volume=0.18[music];[voice][music]amix=inputs=2:duration=longest:dropout_transition=2[aout]",
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        outPath
      );
    } else if (hasVoice) {
      ffmpegArgs.push(
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        outPath
      );
    } else if (hasMusic) {
      ffmpegArgs.push(
        "-filter_complex",
        "[1:a]volume=0.2[aout]",
        "-map",
        "0:v:0",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        outPath
      );
    } else {
      ffmpegArgs.push("-map", "0:v:0", "-map", "0:a?", "-c", "copy", "-movflags", "+faststart", outPath);
    }

    await runCmd("ffmpeg", ffmpegArgs, tmpDir);
    return { outPath, warnings, hadAudioLayers: hasVoice || hasMusic };
  } finally {
    // kept for cleanup by caller after upload
  }
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    ffmpegRequired: true,
    supabaseConfigured: Boolean(supabase),
    ttsConfigured: Boolean(OPENAI_API_KEY),
  });
});

app.post("/api/video-postprocess", async (req, res) => {
  try {
    if (!assertAuth(req, res)) return;

    const payload = req.body || {};
    const sourceVideoUrl = String(payload.source_video_url || "").trim();
    const userId = cleanText(payload.user_id, 128) || "anon";
    if (!isHttpUrl(sourceVideoUrl)) {
      return res.status(400).json({ error: "source_video_url must be a valid http(s) URL." });
    }

    capture(userId, "video_postprocess_started", {
      enable_tts: payload.enable_tts !== false,
      enable_music: payload.enable_music !== false,
    });

    const { outPath, warnings, hadAudioLayers } = await processVideo(payload);
    let outputUrl = sourceVideoUrl;
    try {
      outputUrl = await uploadOutput(outPath, userId);
    } finally {
      await fs.rm(path.dirname(outPath), { recursive: true, force: true });
    }

    capture(userId, "video_postprocess_completed", {
      audio_applied: hadAudioLayers,
      warnings_count: warnings.length,
    });

    return res.json({
      status: "success",
      audio_applied: hadAudioLayers,
      video_url: outputUrl,
      warnings,
    });
  } catch (error) {
    console.error("video-postprocess error:", error);
    capture("anon", "video_postprocess_failed", {
      error: error instanceof Error ? error.message : "Internal server error",
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`[video-audio-pipeline] listening on :${PORT}`);
});

process.on("SIGTERM", async () => {
  await shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await shutdown();
  process.exit(0);
});

