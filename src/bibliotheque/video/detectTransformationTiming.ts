import { fetchFile } from "@ffmpeg/util";
import { getFFmpeg } from "@/bibliotheque/videoUtils";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

const FFMPEG_TIMING_SRC = "timing_detect_src.mp4";

function timingFrameFilename(index: number): string {
  return `timing_${String(index).padStart(4, "0")}.jpg`;
}

function computeFrameExtraction(durationSec: number): {
  fps: number;
  totalFrames: number;
} {
  let fps = 2;
  let totalFrames = Math.round(fps * durationSec);
  if (totalFrames > 24) {
    fps = Math.round((24 / durationSec) * 100) / 100;
    totalFrames = Math.min(Math.round(fps * durationSec), 24);
  } else {
    fps = Math.round(fps * 100) / 100;
    totalFrames = Math.round(fps * durationSec);
  }
  return { fps, totalFrames: Math.max(1, totalFrames) };
}

/** JPEG ~70 % → q:v FFmpeg (échelle 2–31). */
function jpegQualityToQv(qualityPercent: number): number {
  return Math.min(31, Math.max(2, Math.round(31 - (qualityPercent / 100) * 29)));
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function dataUrlToBase64(dataUrl: string): string {
  const trimmed = dataUrl.trim();
  const comma = trimmed.indexOf(",");
  return comma >= 0 ? trimmed.slice(comma + 1) : trimmed;
}

async function safeDeleteFfmpegFile(
  ffmpeg: Awaited<ReturnType<typeof getFFmpeg>>,
  path: string,
): Promise<void> {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    /* ignore */
  }
}

async function extractTimingFramesAsBase64(
  videoBlob: Blob,
  durationSec: number,
): Promise<{ frames: string[]; totalFrames: number }> {
  const { fps, totalFrames } = computeFrameExtraction(durationSec);
  const ffmpeg = await getFFmpeg();
  const qv = jpegQualityToQv(70);

  for (let i = 1; i <= totalFrames; i++) {
    await safeDeleteFfmpegFile(ffmpeg, timingFrameFilename(i));
  }
  await safeDeleteFfmpegFile(ffmpeg, FFMPEG_TIMING_SRC);

  await ffmpeg.writeFile(FFMPEG_TIMING_SRC, await fetchFile(videoBlob));

  const code = await ffmpeg.exec([
    "-i",
    FFMPEG_TIMING_SRC,
    "-vf",
    `fps=${fps},scale=320:-1`,
    "-frames:v",
    String(totalFrames),
    "-q:v",
    String(qv),
    "timing_%04d.jpg",
  ]);

  if (code !== 0) {
    await safeDeleteFfmpegFile(ffmpeg, FFMPEG_TIMING_SRC);
    throw new Error("Extraction FFmpeg des frames timing échouée.");
  }

  const frames: string[] = [];
  for (let i = 1; i <= totalFrames; i++) {
    const name = timingFrameFilename(i);
    try {
      const raw = await ffmpeg.readFile(name);
      if (!(raw instanceof Uint8Array) || raw.byteLength < 64) break;
      frames.push(uint8ArrayToBase64(raw));
      await safeDeleteFfmpegFile(ffmpeg, name);
    } catch {
      break;
    }
  }

  await safeDeleteFfmpegFile(ffmpeg, FFMPEG_TIMING_SRC);

  if (frames.length === 0) {
    throw new Error("Aucune frame extraite pour l'analyse timing.");
  }

  return { frames, totalFrames };
}

async function getStudioApiAuth(): Promise<{
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configuration Supabase manquante");
  }

  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("Veuillez vous connecter pour analyser la vidéo.");
  }

  return { accessToken, supabaseUrl, supabaseAnonKey };
}

export async function detectTransformationTiming(
  videoBlob: Blob,
  refImageDataUrl: string,
  durationSec: number,
): Promise<{ anchorSecond: number | null }> {
  try {
    if (!(videoBlob instanceof Blob) || videoBlob.size === 0) {
      throw new Error("Vidéo manquante pour l'analyse timing.");
    }
    if (!refImageDataUrl?.trim()) {
      throw new Error("Image de référence manquante.");
    }
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error("Durée vidéo invalide.");
    }

    const { frames, totalFrames } = await extractTimingFramesAsBase64(
      videoBlob,
      durationSec,
    );
    const refImage = dataUrlToBase64(refImageDataUrl);

    const auth = await getStudioApiAuth();
    const url = `${auth.supabaseUrl.replace(/\/$/, "")}/functions/v1/detect-transformation-timing`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.accessToken}`,
        apikey: auth.supabaseAnonKey,
      },
      body: JSON.stringify({
        frames,
        refImage,
        totalFrames,
        durationSec,
      }),
    });

    const text = await res.text();
    let data: { anchorSecond?: number | null; error?: string };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      console.error("[detect-transformation-timing] réponse invalide:", res.status, text);
      return { anchorSecond: null };
    }

    if (
      typeof data.anchorSecond === "number" &&
      Number.isFinite(data.anchorSecond)
    ) {
      return { anchorSecond: data.anchorSecond };
    }

    if (data.error) {
      console.error("[detect-transformation-timing]", data.error);
    }
    return { anchorSecond: null };
  } catch (err) {
    console.error("[detect-transformation-timing]", err);
    return { anchorSecond: null };
  }
}
