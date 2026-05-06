/**
 * Client-side video helpers (FFmpeg WebAssembly).
 * - Requires browser: fetch + Web Workers + WASM.
 * - Remote videoUrl: server must allow CORS for fetch() to succeed.
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/** Latest @ffmpeg/core published on npm (independent of @ffmpeg/ffmpeg version). */
const FFMPEG_CORE_NPM_VERSION = "0.12.10";

const INPUT_FILE = "input.mp4";
const OUTPUT_PNG = "last.png";

const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_NPM_VERSION}/dist/esm`;

let singleton: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Returns a single shared FFmpeg instance, loaded once and reused.
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (singleton?.loaded) {
    return singleton;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      singleton = ffmpeg;
      return ffmpeg;
    })();
  }
  return loadPromise;
}

async function safeDeleteFile(ffmpeg: FFmpeg, path: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    // ignore missing file
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r !== "string") {
        reject(new Error("FileReader did not return a data URL"));
        return;
      }
      resolve(r);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

async function pngFileDataToDataUrl(data: Uint8Array | string): Promise<string> {
  if (!(data instanceof Uint8Array)) {
    throw new Error("Expected PNG binary output from ffmpeg");
  }
  return blobToDataUrl(new Blob([data], { type: "image/png" }));
}

/**
 * Décode la dernière image d'une vidéo MP4 accessible par URL.
 * Retourne une data URL PNG `data:image/png;base64,...`.
 */
export async function extractLastFrame(videoUrl: string): Promise<string> {
  const ffmpeg = await getFFmpeg();

  await safeDeleteFile(ffmpeg, INPUT_FILE);
  await safeDeleteFile(ffmpeg, OUTPUT_PNG);

  const videoData = await fetchFile(videoUrl);
  await ffmpeg.writeFile(INPUT_FILE, videoData);

  const exitCode = await ffmpeg.exec([
    "-sseof",
    "-0.1",
    "-i",
    INPUT_FILE,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    OUTPUT_PNG,
  ]);

  if (exitCode !== 0) {
    await safeDeleteFile(ffmpeg, INPUT_FILE);
    await safeDeleteFile(ffmpeg, OUTPUT_PNG);
    throw new Error(`ffmpeg extractLastFrame failed with exit code ${exitCode}`);
  }

  const raw = await ffmpeg.readFile(OUTPUT_PNG);

  await safeDeleteFile(ffmpeg, INPUT_FILE);
  await safeDeleteFile(ffmpeg, OUTPUT_PNG);

  return pngFileDataToDataUrl(raw);
}
