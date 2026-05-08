/**
 * Client-side video helpers (FFmpeg WebAssembly).
 * - URLs GCS / Vertex : téléchargement via Edge `image-proxy`.
 * - Dernière frame : priorité à video + canvas (seek sur blob local) ; ffmpeg.wasm en secours
 *   (évite les échecs fréquents de `-sseof` dans le build WASM).
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { getBrowserSupabase } from "./supabase/client-navigateur";

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
 * Aligné sur la allowlist de `supabase/functions/image-proxy/index.ts`.
 */
function shouldFetchVideoViaImageProxy(url: string): boolean {
  const u = String(url || "").trim();
  if (!/^https?:\/\//i.test(u)) return false;
  const lower = u.toLowerCase();
  return (
    lower.includes("hailuo-image") ||
    lower.includes("aliyuncs.com") ||
    lower.includes("supabase.co") ||
    lower.includes("supabase") ||
    lower.includes("storage.googleapis.com") ||
    lower.includes("googleapis.com")
  );
}

async function buildAuthenticatedImageProxyRequest(originalUrl: string): Promise<Request> {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configuration Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  const endpoint = `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(originalUrl)}`;
  let bearer = supabaseAnonKey;
  try {
    const supabase = getBrowserSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) bearer = session.access_token;
  } catch {
    /* ignore */
  }
  return new Request(endpoint, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${bearer}`,
    },
  });
}

/** MP4 « brand » à partir du premier ftyp (offset 4..8). */
function looksLikeMp4(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const b0 = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70; // "ftyp"
  return b0;
}

/**
 * `fetchFile` de @ffmpeg/util ne supporte pas `Request` : il retourne un Uint8Array vide.
 * Pour image-proxy il faut impérativement `fetch(request)`.
 */
async function fetchVideoThroughImageProxy(originalUrl: string): Promise<Uint8Array> {
  const res = await fetch(await buildAuthenticatedImageProxyRequest(originalUrl));
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok) {
    const snippet = (await res.text().catch(() => "")).slice(0, 280);
    throw new Error(
      `image-proxy a échoué (HTTP ${res.status}). ${snippet || ct || "sans détail"}`.trim()
    );
  }
  if (ct.includes("application/json")) {
    const snippet = (await res.clone().text().catch(() => "")).slice(0, 280);
    throw new Error(`image-proxy a renvoyé du JSON au lieu d’une vidéo : ${snippet}`);
  }
  const buf = await res.arrayBuffer();
  const raw = new Uint8Array(buf);
  if (raw.byteLength < 512) {
    const head = new TextDecoder("utf-8", { fatal: false }).decode(raw.slice(0, 200));
    throw new Error(
      `Réponse image-proxy trop courte (${raw.byteLength} o). Début : ${head.replace(/\s+/g, " ").slice(0, 120)}`
    );
  }
  if (!looksLikeMp4(raw) && !ct.includes("video/") && !ct.includes("octet-stream")) {
    const head = new TextDecoder("utf-8", { fatal: false }).decode(raw.slice(0, 80));
    if (head.trimStart().startsWith("<?xml") || head.includes("<svg")) {
      throw new Error(
        "image-proxy a renvoyé une image SVG (souvent une erreur / URL expirée), pas le MP4."
      );
    }
  }
  return raw;
}

export async function loadVideoBytesForFfmpeg(videoUrl: string): Promise<Uint8Array> {
  const trimmed = String(videoUrl || "").trim();
  if (!trimmed) {
    throw new Error("URL vidéo manquante pour extractLastFrame.");
  }

  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    const raw = await fetchFile(trimmed);
    if (!(raw instanceof Uint8Array)) {
      throw new Error("fetchFile did not return Uint8Array");
    }
    return raw;
  }

  if (shouldFetchVideoViaImageProxy(trimmed)) {
    return fetchVideoThroughImageProxy(trimmed);
  }

  const raw = await fetchFile(trimmed);
  if (!(raw instanceof Uint8Array)) {
    throw new Error("fetchFile did not return Uint8Array");
  }
  return raw;
}

/**
 * Dernière frame via decode navigateur (blob:) — évite les bugs ffmpeg.wasm sur -sseof.
 */
async function extractLastFrameFromVideoBlob(blob: Blob): Promise<string> {
  const blobUrl = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.preload = "auto";
  video.src = blobUrl;

  const wait = <K extends keyof HTMLMediaElementEventMap>(
    el: HTMLVideoElement,
    ev: K,
    ms: number
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(`video: ${String(ev)} timeout`)), ms);
      const ok = () => {
        window.clearTimeout(timer);
        el.removeEventListener(ev, ok as EventListener);
        el.removeEventListener("error", bad);
        resolve();
      };
      const bad = () => {
        window.clearTimeout(timer);
        el.removeEventListener(ev, ok as EventListener);
        el.removeEventListener("error", bad);
        reject(new Error("video: erreur de chargement ou de seek"));
      };
      el.addEventListener(ev, ok as EventListener, { once: true });
      el.addEventListener("error", bad, { once: true });
    });

  try {
    video.load();
    await wait(video, "loadedmetadata", 120_000);

    const dur = video.duration;
    if (!Number.isFinite(dur) || dur <= 0) {
      throw new Error("Durée vidéo invalide");
    }

    const offsets = [
      Math.max(0, dur - 1 / 30),
      Math.max(0, dur - 0.08),
      Math.max(0, dur - 0.35),
      Math.max(0, dur - 1.2),
      Math.max(0, dur * 0.5),
    ];

    let lastErr: Error | null = null;
    for (const t of offsets) {
      try {
        video.pause();
        video.currentTime = t;
        await wait(video, "seeked", 45_000);
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) {
          throw new Error("Dimensions vidéo nulles");
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Canvas 2D indisponible");
        }
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        if (dataUrl && dataUrl.startsWith("data:image/png") && dataUrl.length > 64) {
          return dataUrl;
        }
        throw new Error("toDataURL invalide");
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
      }
    }
    throw lastErr ?? new Error("Impossible d'extraire une image depuis la vidéo");
  } finally {
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(blobUrl);
  }
}

async function extractLastFrameWithFfmpegFallback(videoData: Uint8Array): Promise<string> {
  const ffmpeg = await getFFmpeg();
  await safeDeleteFile(ffmpeg, INPUT_FILE);
  await safeDeleteFile(ffmpeg, OUTPUT_PNG);
  await ffmpeg.writeFile(INPUT_FILE, videoData);

  const attempts: string[][] = [
    ["-sseof", "-1", "-i", INPUT_FILE, "-an", "-frames:v", "1", "-q:v", "2", OUTPUT_PNG],
    ["-sseof", "-0.5", "-i", INPUT_FILE, "-an", "-frames:v", "1", "-q:v", "2", OUTPUT_PNG],
    ["-i", INPUT_FILE, "-an", "-vf", "reverse", "-frames:v", "1", "-q:v", "2", OUTPUT_PNG],
  ];

  let lastCode = 1;
  for (const args of attempts) {
    await safeDeleteFile(ffmpeg, OUTPUT_PNG);
    lastCode = await ffmpeg.exec(args);
    if (lastCode === 0) {
      const raw = await ffmpeg.readFile(OUTPUT_PNG);
      await safeDeleteFile(ffmpeg, INPUT_FILE);
      await safeDeleteFile(ffmpeg, OUTPUT_PNG);
      return pngFileDataToDataUrl(raw);
    }
  }

  await safeDeleteFile(ffmpeg, INPUT_FILE);
  await safeDeleteFile(ffmpeg, OUTPUT_PNG);
  throw new Error(`ffmpeg extractLastFrame failed (dernier code ${lastCode})`);
}

/**
 * Décode la dernière image d'une vidéo MP4 accessible par URL.
 * Retourne une data URL PNG `data:image/png;base64,...`.
 */
export async function extractLastFrame(videoUrl: string): Promise<string> {
  const videoData = await loadVideoBytesForFfmpeg(videoUrl);
  if (videoData.byteLength < 64) {
    throw new Error("Fichier vidéo trop petit ou vide après téléchargement");
  }

  const blob = new Blob([videoData], { type: "video/mp4" });
  try {
    return await extractLastFrameFromVideoBlob(blob);
  } catch (canvasErr) {
    console.warn("[videoUtils] extractLastFrame: canvas a échoué, essai ffmpeg:", canvasErr);
    return extractLastFrameWithFfmpegFallback(videoData);
  }
}
