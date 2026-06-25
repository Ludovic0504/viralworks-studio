import { useCallback, useEffect, useId, useRef, useState } from "react";
import { fetchFile } from "@ffmpeg/util";
import {
  Camera,
  CheckCircle2,
  GripVertical,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserCircle,
  Video,
  Wand2,
  X,
} from "lucide-react";
import PageTitle from "@/composants/interface/TitrePage";
import BadgeQuotaVideo from "@/composants/video/BadgeQuotaVideo";
import ModalBibliothequeAvatars from "@/composants/studio/avatar/ModalBibliothequeAvatars";
import ModalAbonnementRequis from "@/composants/studio/avatar/ModalAbonnementRequis";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { useAuth } from "@/contexte/FournisseurAuth";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import { hasSeedancePlan } from "@/bibliotheque/supabase/premiumAccess";
import { getSeedanceMonthlyLimit } from "@/bibliotheque/supabase/planQuotas";
import { fetchSeedanceQuota } from "@/bibliotheque/supabase/seedanceQuota";
import { getFFmpeg } from "@/bibliotheque/videoUtils";
import {
  buildVideoEditPrompt,
} from "@/bibliotheque/video/buildVideoEditPrompt";
import { detectTransformationTiming } from "@/bibliotheque/video/detectTransformationTiming";
import { editVideoSeedance, pollKieTask } from "@/bibliotheque/video/editVideoSeedance";
import {
  clearEditVideoWorkflow,
  deriveEditVideoWorkflowPhase,
  loadEditVideoWorkflow,
  saveEditVideoWorkflow,
} from "@/bibliotheque/video/editVideoWorkflowState";

const FFMPEG_EDIT_SRC = "edit_src.mp4";
const FFMPEG_EDIT_OUT = "edit_out.mp4";
const FFMPEG_STRIP_SRC = "edit_strip_src.mp4";
const FFMPEG_COMPRESS_SRC = "edit_compress_src.mp4";
const FFMPEG_COMPRESS_OUT = "edit_compress_out.mp4";

const FILMSTRIP_THUMB_INTERVAL_SEC = 2;
const FILMSTRIP_MAX_THUMBS = 60;

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
/** Minimum Seedance / Kie (r2v) : largeur × hauteur ≥ 409 600 px (~640×640). */
const SEEDANCE_MIN_PIXELS = 409600;
const MAX_VIDEO_SECONDS = 15;
const MIN_SELECTION_SECONDS = 4;
const TIMELINE_TICK_STEP_SEC = 5;
const TIMELINE_TICK_STEP_MOBILE_SEC = 10;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

const ACCEPTED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const REF_IMAGE_MODES = [
  {
    id: "final",
    label: "État final",
    hint: "La vidéo se transforme progressivement pour ressembler à ta photo.",
  },
  {
    id: "inspiration",
    label: "Inspiration",
    hint: "L'IA s'inspire du style et des couleurs, sans copier l'image à l'identique.",
  },
];

const EDIT_TILES = [
  {
    id: "avatar",
    label: "Avatar IA",
    description: "Présente ta vidéo à l'écran tout au long du clip",
    Icon: UserCircle,
  },
  {
    id: "rendu",
    label: "Rendu visuel",
    description: "Guide le style ou le résultat final avec une photo",
    Icon: ImageIcon,
  },
  {
    id: "chg",
    label: "Élément de scène",
    description: "Ajoute ou remplace un objet, meuble, décor…",
    Icon: Wand2,
  },
];

const AVATAR_SLOT_COUNT = 3;

function newInstructionId() {
  return `instr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** UI ref mode ids → prompt schema values */
function toVideoEditRefImageMode(uiMode) {
  if (uiMode === "final") return "état_final";
  if (uiMode === "inspiration") return "inspiration";
  return null;
}

function isAcceptedVideoFile(file) {
  const mime = String(file.type || "").toLowerCase();
  if (ACCEPTED_VIDEO_TYPES.has(mime)) return true;
  const name = String(file.name || "").toLowerCase();
  return name.endsWith(".mp4") || name.endsWith(".mov");
}

function isAcceptedImageFile(file) {
  const mime = String(file.type || "").toLowerCase();
  if (ACCEPTED_IMAGE_TYPES.has(mime)) return true;
  return String(file.type || "").startsWith("image/");
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(String(rd.result || ""));
    rd.onerror = () => reject(new Error("Impossible de lire l'image."));
    rd.readAsDataURL(file);
  });
}

function formatTimecode(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function clampSelectionRange(start, duration, totalDuration) {
  const maxDur = Math.min(MAX_VIDEO_SECONDS, totalDuration);
  let d = Math.min(Math.max(duration, MIN_SELECTION_SECONDS), maxDur);
  let s = Math.max(0, start);
  if (s + d > totalDuration) s = Math.max(0, totalDuration - d);
  return { start: s, duration: d };
}

function buildTimelineTicks(totalDurationSec, stepSec = TIMELINE_TICK_STEP_SEC) {
  const ticks = [];
  for (let t = 0; t <= totalDurationSec; t += stepSec) {
    ticks.push(t);
  }
  const last = Math.floor(totalDurationSec);
  if (last > 0 && ticks[ticks.length - 1] !== last) {
    ticks.push(last);
  }
  return ticks;
}

async function safeDeleteFfmpegFile(ffmpeg, path) {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    /* ignore */
  }
}

function revokeFilmstripUrls(frames) {
  for (const frame of frames) {
    if (frame?.url) URL.revokeObjectURL(frame.url);
  }
}

function stripThumbFilename(index) {
  return `strip_${String(index).padStart(4, "0")}.jpg`;
}

async function waitVideoEvent(el, eventName, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`video: ${eventName} timeout`)), timeoutMs);
    const ok = () => {
      window.clearTimeout(timer);
      el.removeEventListener(eventName, ok);
      el.removeEventListener("error", bad);
      resolve();
    };
    const bad = () => {
      window.clearTimeout(timer);
      el.removeEventListener(eventName, ok);
      el.removeEventListener("error", bad);
      reject(new Error("video: erreur de chargement"));
    };
    el.addEventListener(eventName, ok, { once: true });
    el.addEventListener("error", bad, { once: true });
  });
}

async function extractFilmstripViaFfmpeg(file, totalDurationSec, interval) {
  const ffmpeg = await getFFmpeg();
  for (let i = 1; i <= FILMSTRIP_MAX_THUMBS; i++) {
    await safeDeleteFfmpegFile(ffmpeg, stripThumbFilename(i));
  }
  await safeDeleteFfmpegFile(ffmpeg, FFMPEG_STRIP_SRC);

  await ffmpeg.writeFile(FFMPEG_STRIP_SRC, await fetchFile(file));

  const fps = 1 / interval;
  const code = await ffmpeg.exec([
    "-i",
    FFMPEG_STRIP_SRC,
    "-vf",
    `fps=${fps},scale=320:-1`,
    "-q:v",
    "8",
    "strip_%04d.jpg",
  ]);

  if (code !== 0) {
    await safeDeleteFfmpegFile(ffmpeg, FFMPEG_STRIP_SRC);
    throw new Error("Extraction FFmpeg des vignettes échouée.");
  }

  const frames = [];
  for (let i = 1; i <= FILMSTRIP_MAX_THUMBS; i++) {
    const name = stripThumbFilename(i);
    try {
      const raw = await ffmpeg.readFile(name);
      if (!(raw instanceof Uint8Array) || raw.byteLength < 64) break;
      const timeSec = Math.min((i - 1) * interval, totalDurationSec);
      frames.push({
        timeSec,
        url: URL.createObjectURL(new Blob([raw], { type: "image/jpeg" })),
      });
      await safeDeleteFfmpegFile(ffmpeg, name);
    } catch {
      break;
    }
  }

  await safeDeleteFfmpegFile(ffmpeg, FFMPEG_STRIP_SRC);
  if (frames.length === 0) {
    throw new Error("Aucune vignette extraite de la vidéo.");
  }
  return frames;
}

async function extractFilmstripViaCanvas(file, totalDurationSec, interval) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    await waitVideoEvent(video, "loadedmetadata");
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible.");

    const frames = [];
    for (let t = 0; t <= totalDurationSec && frames.length < FILMSTRIP_MAX_THUMBS; t += interval) {
      const seekTo = Math.min(Math.max(0, t), Math.max(0, totalDurationSec - 0.05));
      video.currentTime = seekTo;
      await waitVideoEvent(video, "seeked");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.78);
      });
      if (blob) {
        frames.push({
          timeSec: Math.min(t, totalDurationSec),
          url: URL.createObjectURL(blob),
        });
      }
    }

    if (frames.length === 0) {
      throw new Error("Aucune vignette extraite de la vidéo.");
    }
    return frames;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}

async function extractFilmstripThumbnails(file, totalDurationSec) {
  const interval = Math.max(
    FILMSTRIP_THUMB_INTERVAL_SEC,
    totalDurationSec / FILMSTRIP_MAX_THUMBS
  );
  try {
    return await extractFilmstripViaFfmpeg(file, totalDurationSec, interval);
  } catch {
    return extractFilmstripViaCanvas(file, totalDurationSec, interval);
  }
}

function getBlobVideoDimensions(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      cleanup();
      if (!width || !height) {
        reject(new Error("Dimensions vidéo invalides."));
        return;
      }
      resolve({ width, height });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Impossible de lire les dimensions de la vidéo."));
    };

    video.src = url;
  });
}

function computeMinUpscaleDimensions(width, height, minPixels = SEEDANCE_MIN_PIXELS) {
  if (width * height >= minPixels) return null;
  const scale = Math.sqrt(minPixels / (width * height));
  return {
    width: Math.ceil((width * scale) / 2) * 2,
    height: Math.ceil((height * scale) / 2) * 2,
  };
}

function buildDownscaleFilter(maxWidth, width, height, minPixels = SEEDANCE_MIN_PIXELS) {
  let targetW = Math.min(maxWidth, width);
  if (targetW % 2 !== 0) targetW -= 1;
  let targetH = Math.round((targetW * height) / width);
  if (targetH % 2 !== 0) targetH += 1;
  if (targetW * targetH < minPixels) {
    const upscaled = computeMinUpscaleDimensions(width, height, minPixels);
    if (upscaled) {
      return `scale=${upscaled.width}:${upscaled.height}`;
    }
  }
  return `scale=${targetW}:${targetH}`;
}

async function blobMeetsSeedanceLimits(blob, maxBytes) {
  if (blob.size > maxBytes) return false;
  const { width, height } = await getBlobVideoDimensions(blob);
  return width * height >= SEEDANCE_MIN_PIXELS;
}

async function reencodeVideoBlob(blob, { scaleFilter, crf, bitrateKbps }) {
  const ffmpeg = await getFFmpeg();
  for (const path of [FFMPEG_COMPRESS_SRC, FFMPEG_COMPRESS_OUT]) {
    await safeDeleteFfmpegFile(ffmpeg, path);
  }

  await ffmpeg.writeFile(FFMPEG_COMPRESS_SRC, await fetchFile(blob));
  const result = await runFfmpegCompressPass(ffmpeg, { crf, scaleFilter, bitrateKbps });

  for (const path of [FFMPEG_COMPRESS_SRC, FFMPEG_COMPRESS_OUT]) {
    await safeDeleteFfmpegFile(ffmpeg, path);
  }

  return result;
}

async function upscaleVideoBlobToMinPixels(blob, onStatus) {
  const { width, height } = await getBlobVideoDimensions(blob);
  const target = computeMinUpscaleDimensions(width, height);
  if (!target) return blob;

  onStatus?.("Adaptation de la résolution pour l'IA…");

  const result = await reencodeVideoBlob(blob, {
    scaleFilter: `scale=${target.width}:${target.height}`,
    crf: 18,
  });
  if (!result) {
    throw new Error("Impossible d'adapter la résolution de la vidéo.");
  }
  return result;
}

/** Upscale si trop petit, compresse si trop lourd — contraintes Seedance/Kie. */
async function finalizeVideoForSeedance(blob, onStatus) {
  let current = blob;

  const dims = await getBlobVideoDimensions(current);
  if (dims.width * dims.height < SEEDANCE_MIN_PIXELS) {
    current = await upscaleVideoBlobToMinPixels(current, onStatus);
  }

  if (current.size > MAX_VIDEO_BYTES) {
    current = await compressVideoBlobUnderMaxBytes(current, MAX_VIDEO_BYTES, onStatus);
  }

  const finalDims = await getBlobVideoDimensions(current);
  if (finalDims.width * finalDims.height < SEEDANCE_MIN_PIXELS) {
    throw new Error(
      "La résolution de ta vidéo est trop faible pour Seedance. Utilise une vidéo plus nette.",
    );
  }
  if (current.size > MAX_VIDEO_BYTES) {
    throw new Error(
      "Impossible d'optimiser la vidéo pour l'envoi. Essaie un extrait plus court.",
    );
  }

  return current;
}

function getBlobDurationSeconds(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const dur = video.duration;
      cleanup();
      if (!Number.isFinite(dur) || dur <= 0) {
        reject(new Error("Durée vidéo invalide."));
        return;
      }
      resolve(dur);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Impossible de lire la vidéo."));
    };

    video.src = url;
  });
}

async function readFfmpegOutputBlob(ffmpeg, outputPath) {
  const raw = await ffmpeg.readFile(outputPath);
  if (!(raw instanceof Uint8Array) || raw.byteLength === 0) {
    return null;
  }
  return new Blob([raw], { type: "video/mp4" });
}

async function runFfmpegCompressPass(ffmpeg, { crf, scaleFilter, bitrateKbps }) {
  await safeDeleteFfmpegFile(ffmpeg, FFMPEG_COMPRESS_OUT);

  const args = ["-i", FFMPEG_COMPRESS_SRC];
  if (scaleFilter) {
    args.push("-vf", scaleFilter);
  }

  if (bitrateKbps != null) {
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-b:v",
      `${bitrateKbps}k`,
      "-maxrate",
      `${Math.max(bitrateKbps + 128, Math.floor(bitrateKbps * 1.25))}k`,
      "-bufsize",
      `${bitrateKbps * 2}k`,
    );
  } else {
    args.push("-c:v", "libx264", "-preset", "fast", "-crf", String(crf));
  }

  args.push(
    "-c:a",
    "aac",
    "-b:a",
    "96k",
    "-movflags",
    "+faststart",
    FFMPEG_COMPRESS_OUT,
  );

  const code = await ffmpeg.exec(args);
  if (code !== 0) return null;
  return readFfmpegOutputBlob(ffmpeg, FFMPEG_COMPRESS_OUT);
}

/** Ré-encode l'extrait si nécessaire pour rester sous la limite Kie (50 Mo), qualité max en priorité. */
async function compressVideoBlobUnderMaxBytes(blob, maxBytes, onStatus) {
  if (blob.size <= maxBytes) return blob;

  onStatus?.("Optimisation de la vidéo pour l'envoi…");

  const ffmpeg = await getFFmpeg();
  for (const path of [FFMPEG_COMPRESS_SRC, FFMPEG_COMPRESS_OUT]) {
    await safeDeleteFfmpegFile(ffmpeg, path);
  }

  await ffmpeg.writeFile(FFMPEG_COMPRESS_SRC, await fetchFile(blob));
  const durationSec = await getBlobDurationSeconds(blob);
  const { width: srcW, height: srcH } = await getBlobVideoDimensions(blob);
  const budgetKbps = Math.max(
    400,
    Math.floor((maxBytes * 8 * 0.88) / durationSec / 1000),
  );

  const attempts = [
    { crf: 18, scaleFilter: null },
    { crf: 20, scaleFilter: null },
    { crf: 22, scaleFilter: null },
    { crf: 23, scaleFilter: buildDownscaleFilter(1920, srcW, srcH) },
    { crf: 25, scaleFilter: buildDownscaleFilter(1280, srcW, srcH) },
    { crf: 27, scaleFilter: buildDownscaleFilter(1280, srcW, srcH) },
    { crf: 28, scaleFilter: buildDownscaleFilter(854, srcW, srcH) },
  ];

  for (const attempt of attempts) {
    const result = await runFfmpegCompressPass(ffmpeg, attempt);
    if (result && (await blobMeetsSeedanceLimits(result, maxBytes))) {
      for (const path of [FFMPEG_COMPRESS_SRC, FFMPEG_COMPRESS_OUT]) {
        await safeDeleteFfmpegFile(ffmpeg, path);
      }
      return result;
    }
  }

  for (const factor of [1, 0.85, 0.7, 0.55]) {
    const targetKbps = Math.max(350, Math.floor(budgetKbps * factor));
    const result = await runFfmpegCompressPass(ffmpeg, {
      crf: null,
      scaleFilter: buildDownscaleFilter(854, srcW, srcH),
      bitrateKbps: targetKbps,
    });
    if (result && (await blobMeetsSeedanceLimits(result, maxBytes))) {
      for (const path of [FFMPEG_COMPRESS_SRC, FFMPEG_COMPRESS_OUT]) {
        await safeDeleteFfmpegFile(ffmpeg, path);
      }
      return result;
    }
  }

  for (const path of [FFMPEG_COMPRESS_SRC, FFMPEG_COMPRESS_OUT]) {
    await safeDeleteFfmpegFile(ffmpeg, path);
  }
  throw new Error(
    "Impossible d'optimiser la vidéo pour l'envoi. Essaie un extrait plus court.",
  );
}

async function trimVideoSegmentWithFfmpeg(
  file,
  startSec,
  durationSec,
  totalDurationSec,
  { onStatus } = {},
) {
  const start = Math.max(0, startSec);
  const duration = Math.max(0.1, durationSec);
  const isFullClip =
    start < 0.05 && Math.abs(duration - totalDurationSec) < 0.1 && totalDurationSec <= MAX_VIDEO_SECONDS;

  if (isFullClip) {
    const fullBlob = new Blob([file], { type: file.type || "video/mp4" });
    return finalizeVideoForSeedance(fullBlob, onStatus);
  }

  const ffmpeg = await getFFmpeg();
  for (const p of [FFMPEG_EDIT_SRC, FFMPEG_EDIT_OUT]) {
    await safeDeleteFfmpegFile(ffmpeg, p);
  }

  await ffmpeg.writeFile(FFMPEG_EDIT_SRC, await fetchFile(file));

  const startStr = String(start);
  const durationStr = String(duration);

  const copyArgs = [
    "-ss",
    startStr,
    "-i",
    FFMPEG_EDIT_SRC,
    "-t",
    durationStr,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    FFMPEG_EDIT_OUT,
  ];

  let code = await ffmpeg.exec(copyArgs);

  if (code !== 0) {
    await safeDeleteFfmpegFile(ffmpeg, FFMPEG_EDIT_OUT);
    const encodeArgs = [
      "-ss",
      startStr,
      "-i",
      FFMPEG_EDIT_SRC,
      "-t",
      durationStr,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      FFMPEG_EDIT_OUT,
    ];
    code = await ffmpeg.exec(encodeArgs);
  }

  if (code !== 0) {
    for (const p of [FFMPEG_EDIT_SRC, FFMPEG_EDIT_OUT]) {
      await safeDeleteFfmpegFile(ffmpeg, p);
    }
    throw new Error("Impossible de découper l'extrait vidéo.");
  }

  const raw = await ffmpeg.readFile(FFMPEG_EDIT_OUT);
  if (!(raw instanceof Uint8Array)) {
    for (const p of [FFMPEG_EDIT_SRC, FFMPEG_EDIT_OUT]) {
      await safeDeleteFfmpegFile(ffmpeg, p);
    }
    throw new Error("Découpage vidéo : sortie invalide.");
  }

  for (const p of [FFMPEG_EDIT_SRC, FFMPEG_EDIT_OUT]) {
    await safeDeleteFfmpegFile(ffmpeg, p);
  }

  const trimmedBlob = new Blob([raw], { type: "video/mp4" });
  return finalizeVideoForSeedance(trimmedBlob, onStatus);
}

function getBlobVideoAspectRatio(blob) {
  return getBlobVideoDimensions(blob).then(({ width, height }) =>
    height > width ? "9:16" : "16:9",
  );
}

function getVideoDurationSeconds(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const dur = video.duration;
      cleanup();
      if (!Number.isFinite(dur) || dur <= 0) {
        reject(new Error("Durée vidéo invalide."));
        return;
      }
      resolve(dur);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Impossible de lire la vidéo."));
    };

    video.src = url;
  });
}

function EditVideoTile({ tile, active, badge, onClick }) {
  const Icon = tile.Icon;
  return (
    <button
      type="button"
      className={`edit-video-tile ${active ? "is-active" : ""} ${badge > 0 ? "has-badge" : ""}`}
      onClick={onClick}
      aria-expanded={active}
    >
      <Icon className="edit-video-tile-icon" strokeWidth={1.75} aria-hidden />
      <span className="edit-video-tile-name">{tile.label}</span>
      <span className="edit-video-tile-desc">{tile.description}</span>
      <CheckCircle2 className="edit-video-tile-check" strokeWidth={2} aria-hidden />
      {badge > 0 ? (
        <span className="edit-video-tile-badge" aria-label={`${badge} changement${badge > 1 ? "s" : ""}`}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function EditVideoFormPanel({ icon: Icon, title, hint, children }) {
  return (
    <div className="edit-video-form-panel">
      <div className="edit-video-panel-hd">
        <Icon className="edit-video-panel-hd-icon" strokeWidth={2} aria-hidden />
        <span className="edit-video-panel-hd-title">{title}</span>
        {hint ? <span className="edit-video-panel-hd-hint">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function EditVideoAvatarSlot({ label, preview, onPick, onClear }) {
  return (
    <div className="edit-video-av-slot-wrap">
      <button
        type="button"
        onClick={onPick}
        className={`edit-video-av-slot ${preview ? "is-filled" : ""}`}
        aria-label={label}
      >
        {preview ? (
          <img src={preview} alt="" className="edit-video-av-slot-img" />
        ) : (
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
      </button>
      {preview ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="edit-video-av-slot-clear"
          aria-label={`Retirer ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
      <span className={`edit-video-av-slot-lbl ${preview ? "is-filled" : ""}`}>{label}</span>
    </div>
  );
}

function EditVideoResolutionPills({ value, onChange }) {
  return (
    <div className="edit-video-toolbar" role="group" aria-label="Qualité de génération">
      {["480p", "720p"].map((res) => (
        <button
          key={res}
          type="button"
          className={`edit-video-pill ${value === res ? "is-active" : ""}`}
          onClick={() => onChange(res)}
        >
          <Sparkles className="edit-video-pill-icon" strokeWidth={2} aria-hidden />
          {res}
        </button>
      ))}
    </div>
  );
}

function VideoFilmstrip({
  frames,
  totalDurationSec,
  startSec,
  selectionDurationSec,
  needsSelectionWindow,
  onRangeChange,
  disabled,
}) {
  const trackRef = useRef(null);
  const [hoverSec, setHoverSec] = useState(null);
  const dragRef = useRef({
    active: false,
    mode: "move",
    pointerId: null,
    originClientX: 0,
    originStartSec: 0,
    originDurationSec: 0,
    originEndSec: 0,
  });
  const [tickStepSec, setTickStepSec] = useState(TIMELINE_TICK_STEP_SEC);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () =>
      setTickStepSec(mq.matches ? TIMELINE_TICK_STEP_MOBILE_SEC : TIMELINE_TICK_STEP_SEC);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const endSec = startSec + selectionDurationSec;
  const leftPct = totalDurationSec > 0 ? (startSec / totalDurationSec) * 100 : 0;
  const widthPct = totalDurationSec > 0 ? (selectionDurationSec / totalDurationSec) * 100 : 100;
  const hoverPct =
    hoverSec != null && totalDurationSec > 0
      ? (Math.min(hoverSec, totalDurationSec) / totalDurationSec) * 100
      : 0;
  const ticks = buildTimelineTicks(totalDurationSec, tickStepSec);

  const clientXToSec = useCallback(
    (clientX) => {
      const track = trackRef.current;
      if (!track || totalDurationSec <= 0) return 0;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * totalDurationSec;
    },
    [totalDurationSec]
  );

  const applyRange = useCallback(
    (start, duration) => {
      onRangeChange(clampSelectionRange(start, duration, totalDurationSec));
    },
    [onRangeChange, totalDurationSec]
  );

  const beginDrag = useCallback((e, mode) => {
    if (disabled) return;
    e.stopPropagation();
    dragRef.current.active = true;
    dragRef.current.mode = mode;
    dragRef.current.pointerId = e.pointerId;
    dragRef.current.originClientX = e.clientX;
    dragRef.current.originStartSec = startSec;
    dragRef.current.originDurationSec = selectionDurationSec;
    dragRef.current.originEndSec = startSec + selectionDurationSec;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [disabled, selectionDurationSec, startSec]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      if (dragRef.current.pointerId != null && e.pointerId !== dragRef.current.pointerId) return;

      const mode = dragRef.current.mode;
      if (mode === "move") {
        const track = trackRef.current;
        if (!track || totalDurationSec <= 0) return;
        const rect = track.getBoundingClientRect();
        if (rect.width <= 0) return;
        const deltaPx = e.clientX - dragRef.current.originClientX;
        const deltaSec = (deltaPx / rect.width) * totalDurationSec;
        applyRange(dragRef.current.originStartSec + deltaSec, dragRef.current.originDurationSec);
        return;
      }

      if (mode === "resize-left") {
        const newStart = clientXToSec(e.clientX);
        const newDuration = dragRef.current.originEndSec - newStart;
        applyRange(newStart, newDuration);
        return;
      }

      if (mode === "resize-right") {
        const newEnd = clientXToSec(e.clientX);
        const newDuration = newEnd - dragRef.current.originStartSec;
        applyRange(dragRef.current.originStartSec, newDuration);
      }
    };

    const onUp = (e) => {
      if (!dragRef.current.active) return;
      if (dragRef.current.pointerId != null && e.pointerId !== dragRef.current.pointerId) return;
      dragRef.current.active = false;
      dragRef.current.pointerId = null;
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [applyRange, clientXToSec, totalDurationSec]);

  const onTrackPointerDown = (e) => {
    if (disabled || !needsSelectionWindow) return;
    const target = e.target;
    if (target instanceof HTMLElement && target.closest("[data-timeline-window]")) return;
    const center = clientXToSec(e.clientX);
    applyRange(center - selectionDurationSec / 2, selectionDurationSec);
  };

  const onTrackPointerMove = (e) => {
    if (disabled || dragRef.current.active) return;
    setHoverSec(clientXToSec(e.clientX));
  };

  return (
    <div className="edit-video-filmstrip">
      {needsSelectionWindow ? (
        <p className="mb-3 text-[10px] leading-snug text-gray-400 sm:text-xs">
          Glisse pour choisir l&apos;extrait (4 à 15 s) à envoyer à l&apos;IA
        </p>
      ) : (
        <p className="mb-3 text-[10px] leading-snug text-gray-400 sm:text-xs">
          Toute la vidéo sera envoyée à l&apos;IA ({formatTimecode(totalDurationSec)})
        </p>
      )}

      <div className={`relative ${needsSelectionWindow ? "pt-4 sm:pt-7" : "pt-4"}`}>
        {needsSelectionWindow ? (
          <div
            className="pointer-events-none absolute top-0 z-10 hidden h-5 w-full text-[10px] font-medium text-gray-400 sm:block"
            aria-hidden
          >
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${leftPct}%` }}
            >
              {formatTimecode(startSec)}
            </span>
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap text-emerald-300/90"
              style={{ left: `${leftPct + widthPct / 2}%` }}
            >
              {Math.round(selectionDurationSec)}s
            </span>
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${leftPct + widthPct}%` }}
            >
              {formatTimecode(endSec)}
            </span>
          </div>
        ) : null}

        <div className="pointer-events-none absolute -top-1 left-0 right-0 h-4" aria-hidden>
          {ticks.map((t) => {
            const pct = totalDurationSec > 0 ? (t / totalDurationSec) * 100 : 0;
            return (
              <span
                key={t}
                className="absolute -translate-x-1/2 text-[9px] leading-none text-gray-500"
                style={{ left: `${pct}%` }}
              >
                {formatTimecode(t)}
              </span>
            );
          })}
        </div>

        <div
          ref={trackRef}
          className={`relative h-[50px] min-h-[50px] overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] sm:h-20 sm:min-h-[80px] ${
            disabled ? "pointer-events-none opacity-50" : "cursor-crosshair"
          }`}
          style={{ touchAction: "none" }}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onTrackPointerMove}
          onPointerLeave={() => setHoverSec(null)}
          role="presentation"
        >
          <div className="flex h-full w-full">
            {frames.map((frame, index) => (
              <img
                key={`${frame.timeSec}-${index}`}
                src={frame.url}
                alt=""
                className="h-full min-w-0 flex-1 object-cover"
                draggable={false}
              />
            ))}
          </div>

          {needsSelectionWindow ? (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-[5] bg-black/50"
                style={{ width: `${leftPct}%` }}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-y-0 z-[5] bg-black/50"
                style={{ left: `${leftPct + widthPct}%`, right: 0 }}
                aria-hidden
              />
            </>
          ) : (
            <div
              className="pointer-events-none absolute inset-0 z-[5] border border-emerald-400/40 bg-emerald-500/15"
              aria-hidden
            />
          )}

          {hoverSec != null && !dragRef.current.active ? (
            <div
              className="pointer-events-none absolute z-30 -top-8 -translate-x-1/2 rounded-md border border-white/15 bg-[#1a2230] px-2 py-0.5 text-[10px] font-medium text-gray-200 shadow-lg"
              style={{ left: `${hoverPct}%` }}
            >
              {formatTimecode(hoverSec)}
            </div>
          ) : null}

          {needsSelectionWindow ? (
            <div
              data-timeline-window
              role="group"
              aria-label="Extrait vidéo"
              className="absolute inset-y-0 z-10 flex min-w-0 border-y-2 border-emerald-400/70"
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            >
              <button
                type="button"
                aria-label="Début de l'extrait"
                className="flex min-w-[28px] w-7 shrink-0 cursor-ew-resize items-center justify-center rounded-l-sm border border-emerald-400/80 bg-emerald-400 text-[#0d1117] sm:min-w-[24px] sm:w-2"
                onPointerDown={(e) => beginDrag(e, "resize-left")}
              >
                <GripVertical className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </button>

              <div
                className="flex min-w-0 flex-1 cursor-grab items-center justify-center bg-emerald-500/20 active:cursor-grabbing"
                onPointerDown={(e) => beginDrag(e, "move")}
              >
                <span className="sr-only">Déplacer l&apos;extrait</span>
              </div>

              <button
                type="button"
                aria-label="Fin de l'extrait"
                className="flex min-w-[28px] w-7 shrink-0 cursor-ew-resize items-center justify-center rounded-r-sm border border-emerald-400/80 bg-emerald-400 text-[#0d1117] sm:min-w-[24px] sm:w-2"
                onPointerDown={(e) => beginDrag(e, "resize-right")}
              >
                <GripVertical className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VideoPreviewBlock({
  videoFile,
  previewUrl,
  durationSec,
  selectedResolution,
  onSelectedResolutionChange,
  selectionStartSec,
  selectionDurationSec,
  needsTimeline,
  onRangeChange,
  error,
  onFile,
  onChangeVideo,
}) {
  const inputRef = useRef(null);
  const stripGenRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [stripLoading, setStripLoading] = useState(false);
  const [stripError, setStripError] = useState(null);
  const [filmstripFrames, setFilmstripFrames] = useState([]);

  useEffect(() => {
    if (!videoFile || !previewUrl || durationSec <= 0 || durationSec <= MAX_VIDEO_SECONDS) {
      setFilmstripFrames((prev) => {
        revokeFilmstripUrls(prev);
        return [];
      });
      setStripLoading(false);
      setStripError(null);
      return undefined;
    }

    const gen = ++stripGenRef.current;
    setStripLoading(true);
    setStripError(null);
    setFilmstripFrames((prev) => {
      revokeFilmstripUrls(prev);
      return [];
    });

    let cancelled = false;
    extractFilmstripThumbnails(videoFile, durationSec)
      .then((frames) => {
        if (cancelled || gen !== stripGenRef.current) {
          revokeFilmstripUrls(frames);
          return;
        }
        setFilmstripFrames(frames);
      })
      .catch((err) => {
        if (cancelled || gen !== stripGenRef.current) return;
        setStripError(
          err instanceof Error ? err.message : "Impossible d'analyser la vidéo."
        );
      })
      .finally(() => {
        if (!cancelled && gen === stripGenRef.current) setStripLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoFile, previewUrl, durationSec]);

  useEffect(() => {
    return () => {
      revokeFilmstripUrls(filmstripFrames);
    };
  }, [filmstripFrames]);

  const processFile = useCallback(
    async (file) => {
      if (!file) return;
      const result = await onFile(file);
      if (result?.ok && inputRef.current) inputRef.current.value = "";
    },
    [onFile]
  );

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    void processFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    void processFile(file);
  };

  if (previewUrl && videoFile) {
    const displayError = stripError || error;
    return (
      <div className="edit-video-vzone edit-video-vzone--loaded">
        <div className="edit-video-vzone-loaded">
          <div className="edit-video-canvas">
            <video src={previewUrl} controls playsInline />
          </div>
          {durationSec > MAX_VIDEO_SECONDS ? (
            stripLoading ? (
              <div className="edit-video-filmstrip flex min-h-[50px] items-center justify-center gap-2 sm:min-h-[80px]">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#00E676]" aria-hidden />
                <span className="text-sm text-gray-300">Analyse de la vidéo…</span>
              </div>
            ) : stripError ? (
              <p className="mt-2 text-xs text-red-400" role="alert">
                {stripError}
              </p>
            ) : (
              <VideoFilmstrip
                frames={filmstripFrames}
                totalDurationSec={durationSec}
                startSec={selectionStartSec}
                selectionDurationSec={selectionDurationSec}
                needsSelectionWindow={needsTimeline}
                onRangeChange={onRangeChange}
                disabled={stripLoading}
              />
            )
          ) : (
            <p className="edit-video-meta mt-2">
              Extrait envoyé à l&apos;IA : {durationSec}s (vidéo complète)
            </p>
          )}
          <div className="edit-video-toolbar">
            <button type="button" onClick={onChangeVideo} className="edit-video-text-link">
              Changer la vidéo
            </button>
            {durationSec > MAX_VIDEO_SECONDS ? (
              <>
                <span className="edit-video-meta" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onRangeChange({
                      start: 0,
                      duration: Math.min(MAX_VIDEO_SECONDS, durationSec),
                    })
                  }
                  className="edit-video-text-link"
                >
                  15 premières sec.
                </button>
              </>
            ) : null}
          </div>
          <div className="edit-video-quality">
            <p className="edit-video-field-label">Qualité</p>
            <EditVideoResolutionPills
              value={selectedResolution}
              onChange={onSelectedResolutionChange}
            />
            <p className="edit-video-meta">
              {selectedResolution === "480p"
                ? "Plus rapide, idéal pour tester"
                : "Haute qualité (~2,5× plus de ressources)"}
            </p>
          </div>
          {displayError && !stripError ? (
            <p className="edit-video-error mt-2" role="alert">
              {displayError}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="edit-video-vzone">
      <span className="edit-video-corner edit-video-corner--tl" aria-hidden />
      <span className="edit-video-corner edit-video-corner--tr" aria-hidden />
      <span className="edit-video-corner edit-video-corner--bl" aria-hidden />
      <span className="edit-video-corner edit-video-corner--br" aria-hidden />
      <div
        className={`edit-video-vzone-inner ${dragging ? "is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="edit-video-vzone-icon-wrap">
          <Video className="h-5 w-5 text-[#00E676]/80" strokeWidth={2} aria-hidden />
        </div>
        <div className="edit-video-vzone-copy">
          <p className="edit-video-vzone-title">Dépose ta vidéo ici</p>
          <p className="edit-video-vzone-meta">MP4 ou MOV · toute taille · 15 s envoyés à l&apos;IA</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="edit-video-vzone-btn"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Choisir un fichier
        </button>
      </div>
      {error ? (
        <p className="edit-video-error edit-video-vzone-error" role="alert">
          {error}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,.mp4,.mov"
        onChange={onInputChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}

function ReferenceImageBlock({ imageDataUrl, mode, onModeChange, onImageChange, onClear }) {
  const inputRef = useRef(null);
  const activeMode = REF_IMAGE_MODES.find((m) => m.id === mode) || REF_IMAGE_MODES[0];

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isAcceptedImageFile(f)) {
      onImageChange(null, "Format non accepté. Utilise JPG, PNG ou WebP.");
      e.target.value = "";
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      onImageChange(null, "Image trop lourde (max 30 Mo).");
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(f);
      onImageChange(dataUrl, null);
    } catch {
      onImageChange(null, "Impossible de lire l'image.");
    }
    e.target.value = "";
  };

  return (
    <div className="edit-video-rd-inner">
      <div className="edit-video-rd-photo-wrap">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`edit-video-rd-photo ${imageDataUrl ? "has-image" : ""}`}
          aria-label={imageDataUrl ? "Changer la photo de référence" : "Ajouter une photo de référence"}
        >
          {imageDataUrl ? (
            <img src={imageDataUrl} alt="" className="edit-video-rd-photo-img" />
          ) : (
            <>
              <ImageIcon className="h-4 w-4 text-[#2D3348]" strokeWidth={2} aria-hidden />
              <span>Ajouter</span>
            </>
          )}
        </button>
        {imageDataUrl ? (
          <button type="button" onClick={onClear} className="edit-video-text-link edit-video-rd-clear">
            Retirer
          </button>
        ) : (
          <p className="edit-video-rd-formats">JPG · PNG · WebP</p>
        )}
      </div>
      <div className="edit-video-rd-modes">
        <div className="edit-video-mode-btns" role="radiogroup" aria-label="Mode de référence visuelle">
          {REF_IMAGE_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              className={`edit-video-mode-btn ${mode === m.id ? "is-active" : ""}`}
              onClick={() => onModeChange(m.id)}
            >
              {m.id === "final" ? (
                <Target className="h-3 w-3" strokeWidth={2} aria-hidden />
              ) : (
                <Lightbulb className="h-3 w-3" strokeWidth={2} aria-hidden />
              )}
              {m.label}
            </button>
          ))}
        </div>
        <p className="edit-video-rd-desc">{activeMode.hint}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileChange}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}

function InstructionCard({ instruction, index, canRemove, onChange, onRemove, onAssetChange }) {
  const assetInputRef = useRef(null);
  const assetInputId = useId();

  const onAssetFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isAcceptedImageFile(f)) return;
    if (f.size > MAX_IMAGE_BYTES) return;
    try {
      const dataUrl = await readImageAsDataUrl(f);
      onAssetChange(instruction.id, dataUrl);
    } catch {
      /* ignore */
    }
    e.target.value = "";
  };

  return (
    <div className="edit-video-chg-card">
      <div className="edit-video-chg-top">
        <span className="edit-video-chg-lbl">Élément {index + 1}</span>
        {canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(instruction.id)}
            className="edit-video-chg-del"
            aria-label={`Supprimer l'élément ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="edit-video-chg-row">
        <div className="edit-video-field-wrap">
          <label className="edit-video-flabel" htmlFor={`what-${instruction.id}`}>
            Quoi ajouter ou modifier
          </label>
          <input
            id={`what-${instruction.id}`}
            type="text"
            value={instruction.what}
            onChange={(e) => onChange(instruction.id, { what: e.target.value })}
            placeholder="ex. une table en marbre blanc"
            className="edit-video-inp"
          />
        </div>
        <div className="edit-video-field-wrap">
          <label className="edit-video-flabel" htmlFor={`when-${instruction.id}`}>
            Quand dans la vidéo
          </label>
          <input
            id={`when-${instruction.id}`}
            type="text"
            value={instruction.where}
            onChange={(e) => onChange(instruction.id, { where: e.target.value })}
            placeholder="ex. au début, dès l'entrée dans la pièce"
            className="edit-video-inp"
          />
        </div>
      </div>

      <div className="edit-video-photo-row">
        <button
          type="button"
          onClick={() => assetInputRef.current?.click()}
          className={`edit-video-photo-mini ${instruction.assetDataUrl ? "has-image" : ""}`}
          aria-label="Photo de référence optionnelle"
        >
          {instruction.assetDataUrl ? (
            <img src={instruction.assetDataUrl} alt="" className="edit-video-photo-mini-img" />
          ) : (
            <Camera className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          )}
        </button>
        <span className="edit-video-photo-hint">Photo de référence · optionnel</span>
        {instruction.assetDataUrl ? (
          <button
            type="button"
            onClick={() => onAssetChange(instruction.id, null)}
            className="edit-video-text-link"
          >
            Retirer
          </button>
        ) : null}
        <input
          ref={assetInputRef}
          id={assetInputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onAssetFile}
          className="hidden"
          aria-hidden
          tabIndex={-1}
        />
      </div>
    </div>
  );
}

export default function EditVideo() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { runWithAuth } = useRequireAuthAction();
  const { plan, loading: subscriptionLoading } = usePremiumAccess();
  const videoInputRef = useRef(null);
  const trimmedSegmentBlobRef = useRef(null);
  const promptRef = useRef(null);
  const hydratingWorkflowRef = useRef(false);
  const [workflowHydrated, setWorkflowHydrated] = useState(false);

  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [selectedResolution, setSelectedResolution] = useState("480p");
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [selectionStartSec, setSelectionStartSec] = useState(0);
  const [selectionDurationSec, setSelectionDurationSec] = useState(MAX_VIDEO_SECONDS);
  const [videoError, setVideoError] = useState(null);
  const [trimming, setTrimming] = useState(false);
  const [trimError, setTrimError] = useState(null);

  const [avatars, setAvatars] = useState(() => [null, null, null]);
  const [avatarLibraryOpen, setAvatarLibraryOpen] = useState(false);
  const [activeAvatarSlot, setActiveAvatarSlot] = useState(null);
  const [dialogueEnabled, setDialogueEnabled] = useState(false);

  const [refImageDataUrl, setRefImageDataUrl] = useState(null);
  const [refImageMode, setRefImageMode] = useState("final");
  const [refImageError, setRefImageError] = useState(null);

  const [instructions, setInstructions] = useState([]);
  const [activeTile, setActiveTile] = useState(null);

  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [trimStatusMessage, setTrimStatusMessage] = useState(
    "Préparation de l'extrait…",
  );
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [resultVideoUrl, setResultVideoUrl] = useState(null);
  const [kieTaskId, setKieTaskId] = useState(null);
  const [seedanceQuota, setSeedanceQuota] = useState({
    count: 0,
    limit: 0,
    loading: true,
  });
  const pollIntervalRef = useRef(null);
  const pollAttemptsRef = useRef(0);

  const stopKiePolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

  const runKiePollCycle = useCallback(
    async (taskId) => {
      pollAttemptsRef.current += 1;
      if (pollAttemptsRef.current > 150) {
        stopKiePolling();
        setGenerateError("Timeout");
        setGenerating(false);
        setKieTaskId(null);
        return;
      }
      try {
        const poll = await pollKieTask(taskId);
        if (poll.status === "done" && poll.videoUrl) {
          stopKiePolling();
          setResultVideoUrl(poll.videoUrl);
          setGenerating(false);
          setKieTaskId(null);
          void refreshSeedanceQuotaRef.current();
        } else if (poll.status === "failed") {
          stopKiePolling();
          setGenerateError(poll.error ?? "La génération a échoué.");
          setGenerating(false);
          setKieTaskId(null);
        }
      } catch (pollErr) {
        stopKiePolling();
        setGenerateError(
          pollErr instanceof Error ? pollErr.message : "Erreur lors de la génération.",
        );
        setGenerating(false);
        setKieTaskId(null);
      }
    },
    [stopKiePolling],
  );

  const startKiePolling = useCallback(
    (taskId) => {
      setKieTaskId(taskId);
      setGenerating(true);
      setGenerateError(null);
      stopKiePolling();
      pollAttemptsRef.current = 0;
      void runKiePollCycle(taskId);
      pollIntervalRef.current = setInterval(() => {
        void runKiePollCycle(taskId);
      }, 6000);
    },
    [runKiePollCycle, stopKiePolling],
  );
  const startKiePollingRef = useRef(startKiePolling);
  startKiePollingRef.current = startKiePolling;

  const buildWorkflowSnapshot = useCallback(
    () => ({
      phase: deriveEditVideoWorkflowPhase({
        generating,
        resultVideoUrl,
        generateError,
        kieTaskId,
      }),
      videoFile,
      videoDurationSec,
      selectedResolution,
      selectionStartSec,
      selectionDurationSec,
      avatars,
      dialogueEnabled,
      refImageDataUrl,
      refImageMode,
      instructions,
      activeTile,
      kieTaskId,
      resultVideoUrl,
      generateError,
    }),
    [
      generating,
      resultVideoUrl,
      generateError,
      kieTaskId,
      videoFile,
      videoDurationSec,
      selectedResolution,
      selectionStartSec,
      selectionDurationSec,
      avatars,
      dialogueEnabled,
      refImageDataUrl,
      refImageMode,
      instructions,
      activeTile,
    ],
  );

  const persistWorkflowRef = useRef(() => {});
  persistWorkflowRef.current = () => {
    if (!userId || hydratingWorkflowRef.current) return;
    void saveEditVideoWorkflow(userId, buildWorkflowSnapshot());
  };

  const refreshSeedanceQuota = useCallback(async () => {
    if (!hasSeedancePlan(plan)) {
      setSeedanceQuota({ count: 0, limit: 0, loading: false });
      return;
    }
    const quota = await fetchSeedanceQuota();
    setSeedanceQuota({
      count: quota.count,
      limit: quota.limit || getSeedanceMonthlyLimit(plan),
      loading: false,
    });
  }, [plan]);

  const refreshSeedanceQuotaRef = useRef(refreshSeedanceQuota);
  refreshSeedanceQuotaRef.current = refreshSeedanceQuota;

  const needsTimeline = videoDurationSec > MAX_VIDEO_SECONDS;

  const handleSelectionRangeChange = useCallback(({ start, duration }) => {
    setSelectionStartSec(start);
    setSelectionDurationSec(duration);
  }, []);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  useEffect(() => {
    return () => {
      persistWorkflowRef.current();
      stopKiePolling();
    };
  }, [stopKiePolling]);

  useEffect(() => {
    if (!userId) {
      setWorkflowHydrated(true);
      return undefined;
    }

    let cancelled = false;
    hydratingWorkflowRef.current = true;
    setWorkflowHydrated(false);

    void (async () => {
      const saved = await loadEditVideoWorkflow(userId);
      if (cancelled) return;

      if (saved) {
        const hasContent =
          saved.videoFile ||
          saved.refImageDataUrl ||
          saved.instructions.length > 0 ||
          saved.avatars.some(Boolean) ||
          saved.kieTaskId ||
          saved.resultVideoUrl;

        if (hasContent) {
          setSelectedResolution(saved.selectedResolution);
          setSelectionStartSec(saved.selectionStartSec);
          setSelectionDurationSec(saved.selectionDurationSec);
          setAvatars(saved.avatars);
          setDialogueEnabled(saved.dialogueEnabled);
          setRefImageDataUrl(saved.refImageDataUrl);
          setRefImageMode(saved.refImageMode);
          setInstructions(saved.instructions);
          setActiveTile(saved.activeTile);
          setResultVideoUrl(saved.resultVideoUrl);
          setGenerateError(saved.generateError);

          if (saved.videoFile) {
            setVideoFile(saved.videoFile);
            setVideoDurationSec(saved.videoDurationSec);
            setVideoPreviewUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(saved.videoFile);
            });
          }

          if (
            saved.kieTaskId &&
            !saved.resultVideoUrl &&
            saved.phase !== "error"
          ) {
            startKiePollingRef.current(saved.kieTaskId);
          } else {
            setKieTaskId(saved.kieTaskId);
            setGenerating(false);
          }
        }
      }

      hydratingWorkflowRef.current = false;
      if (!cancelled) setWorkflowHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || !workflowHydrated || hydratingWorkflowRef.current) return undefined;
    const timer = window.setTimeout(() => {
      persistWorkflowRef.current();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [
    userId,
    workflowHydrated,
    buildWorkflowSnapshot,
    videoFile,
    videoDurationSec,
    selectedResolution,
    selectionStartSec,
    selectionDurationSec,
    avatars,
    dialogueEnabled,
    refImageDataUrl,
    refImageMode,
    instructions,
    activeTile,
    generating,
    generateError,
    resultVideoUrl,
    kieTaskId,
  ]);

  useEffect(() => {
    if (!workflowHydrated || subscriptionLoading) return;
    void refreshSeedanceQuota();
  }, [workflowHydrated, subscriptionLoading, refreshSeedanceQuota, plan]);

  useEffect(() => {
    if (avatars.every((a) => a === null)) {
      setDialogueEnabled(false);
    }
  }, [avatars]);

  const revokeAndSetPreview = useCallback((url) => {
    setVideoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const handleVideoFile = useCallback(
    async (file) => {
      setVideoError(null);
      setTrimError(null);
      setSelectedResolution("480p");
      trimmedSegmentBlobRef.current = null;
      if (!file) return { ok: false };

      if (!isAcceptedVideoFile(file)) {
        setVideoError("Format non accepté. Utilise MP4 ou MOV.");
        return { ok: false };
      }
      try {
        const duration = await getVideoDurationSeconds(file);
        setVideoFile(file);
        setVideoDurationSec(duration);
        setSelectionStartSec(0);
        setSelectionDurationSec(Math.min(MAX_VIDEO_SECONDS, duration));
        revokeAndSetPreview(URL.createObjectURL(file));
        return { ok: true };
      } catch (err) {
        setVideoError(err instanceof Error ? err.message : "Impossible de lire la vidéo.");
        return { ok: false };
      }
    },
    [revokeAndSetPreview]
  );

  const handleGenerate = useCallback(async () => {
    if (!videoFile || trimming || generating) return;
    if (subscriptionLoading) return;
    if (!hasSeedancePlan(plan)) {
      setShowSubscriptionModal(true);
      return;
    }
    setTrimError(null);
    setGenerateError(null);
    setTrimStatusMessage("Préparation de l'extrait…");
    setTrimming(true);
    try {
      const blob = await trimVideoSegmentWithFfmpeg(
        videoFile,
        selectionStartSec,
        selectionDurationSec,
        videoDurationSec,
        { onStatus: setTrimStatusMessage },
      );
      trimmedSegmentBlobRef.current = blob;

      const aspectRatio = await getBlobVideoAspectRatio(blob);

      let anchorSecond = null;
      let transformationStart = null;

      if (
        refImageDataUrl &&
        toVideoEditRefImageMode(refImageMode) === "état_final"
      ) {
        setTrimStatusMessage("Analyse de la vidéo en cours...");
        const timing = await detectTransformationTiming(
          blob,
          refImageDataUrl,
          selectionDurationSec,
        );
        if (timing.anchorSecond !== null) {
          const detectedAnchor =
            Math.round(timing.anchorSecond * 10) / 10;
          if (detectedAnchor < 1.5) {
            console.warn(
              "[timing] anchorSecond trop faible, ignoré:",
              detectedAnchor,
            );
          } else {
            anchorSecond = detectedAnchor;
            transformationStart =
              Math.round(Math.max(0.5, anchorSecond - 1.5) * 10) / 10;
          }
        }
        setTrimStatusMessage("Préparation de l'extrait…");
      }

      const videoEditConfig = {
        avatarUrls: avatars.map((a) => a?.url ?? null),
        refImageUrl: refImageDataUrl,
        refImageMode: refImageDataUrl ? toVideoEditRefImageMode(refImageMode) : null,
        modifications: instructions
          .filter((i) => i.what.trim() !== "")
          .map((i) => ({
            what: i.what,
            where: i.where,
            assetUrl: i.assetDataUrl,
          })),
        durationSec: selectionDurationSec,
        dialogueEnabled: dialogueEnabled,
        aspectRatio,
        ...(anchorSecond != null && transformationStart != null
          ? { anchorSecond, transformationStart }
          : {}),
      };

      const prompt = buildVideoEditPrompt(videoEditConfig);
      promptRef.current = prompt;

      if (import.meta.env.DEV) {
        console.log("[edit-video] prompt construit :", prompt);
      }

      setTrimming(false);
      setGenerating(true);
      try {
        const { taskId } = await editVideoSeedance({
          prompt,
          videoBlob: blob,
          avatarUrls: avatars.map((a) => a?.url ?? null),
          refImageDataUrl: refImageDataUrl ?? null,
          dialogueEnabled,
          resolution: selectedResolution,
          durationSec: selectionDurationSec,
          aspectRatio,
        });
        startKiePolling(taskId);
        void refreshSeedanceQuotaRef.current();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur lors de la génération.";
        if (
          message.includes("Abonnement Pro ou Studio requis") ||
          message.includes("Abonnement requis")
        ) {
          setShowSubscriptionModal(true);
        } else {
          setGenerateError(message);
        }
        setGenerating(false);
      }
    } catch (err) {
      setTrimError(err instanceof Error ? err.message : "Impossible de préparer l'extrait vidéo.");
    } finally {
      setTrimming(false);
    }
  }, [
    videoFile,
    trimming,
    generating,
    selectionStartSec,
    selectionDurationSec,
    videoDurationSec,
    avatars,
    refImageDataUrl,
    refImageMode,
    instructions,
    dialogueEnabled,
    selectedResolution,
    startKiePolling,
    plan,
    subscriptionLoading,
  ]);

  const handleNewEdit = useCallback(() => {
    stopKiePolling();
    setResultVideoUrl(null);
    setGenerateError(null);
    setKieTaskId(null);
    setGenerating(false);
    if (userId) {
      void saveEditVideoWorkflow(userId, {
        ...buildWorkflowSnapshot(),
        phase: "draft",
        resultVideoUrl: null,
        generateError: null,
        kieTaskId: null,
      });
    }
  }, [userId, buildWorkflowSnapshot, stopKiePolling]);

  const changeVideo = () => {
    videoInputRef.current?.click();
  };

  const onHiddenVideoInput = (e) => {
    const file = e.target.files?.[0];
    void handleVideoFile(file);
    e.target.value = "";
  };

  const openAvatarLibraryForSlot = useCallback(
    (slotIndex) => {
      void runWithAuth(() => {
        setActiveAvatarSlot(slotIndex);
        setAvatarLibraryOpen(true);
        return true;
      });
    },
    [runWithAuth]
  );

  const clearAvatarSlot = useCallback((slotIndex) => {
    setAvatars((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  }, []);

  const handleAvatarLibrarySelect = useCallback(
    (url) => {
      setAvatars((prev) => {
        if (activeAvatarSlot === null) return prev;
        const next = [...prev];
        next[activeAvatarSlot] = { url, source: "library" };
        return next;
      });
      setAvatarLibraryOpen(false);
      setActiveAvatarSlot(null);
    },
    [activeAvatarSlot]
  );

  const closeAvatarLibrary = useCallback(() => {
    setAvatarLibraryOpen(false);
    setActiveAvatarSlot(null);
  }, []);

  const updateInstruction = (id, patch) => {
    setInstructions((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeInstruction = (id) => {
    setInstructions((prev) => prev.filter((row) => row.id !== id));
  };

  const addInstruction = () => {
    setInstructions((prev) => {
      if (prev.length >= 8) return prev;
      return [...prev, { id: newInstructionId(), what: "", where: "", assetDataUrl: null }];
    });
  };

  const switchTile = (tileId) => {
    setActiveTile((prev) => {
      const next = prev === tileId ? null : tileId;
      if (next === "chg") {
        setInstructions((inst) =>
          inst.length === 0
            ? [{ id: newInstructionId(), what: "", where: "", assetDataUrl: null }]
            : inst,
        );
      }
      return next;
    });
  };

  const handleRefImageChange = (dataUrl, error) => {
    setRefImageDataUrl(dataUrl);
    setRefImageError(error);
  };

  const hasPlan = hasSeedancePlan(plan);
  const chgBadgeCount = instructions.length;
  const seedanceRemaining = Math.max(
    0,
    seedanceQuota.limit - seedanceQuota.count,
  );

  return (
    <div className="edit-video-shell">
      <div className="edit-video-page-head">
        <PageTitle
          green="Éditer"
          white="ma vidéo"
          subtitle="Importe ton clip, choisis ce que tu veux modifier, puis lance la génération."
          className="mb-0"
          titleClassName="!text-xl sm:!text-2xl !font-semibold"
        />
        {hasPlan ? (
          <BadgeQuotaVideo
            remaining={seedanceRemaining}
            limit={seedanceQuota.limit}
            loading={seedanceQuota.loading}
            title="Vidéos Seedance restantes ce mois-ci"
          />
        ) : null}
      </div>

      <div className="edit-video-body">
          <VideoPreviewBlock
            videoFile={videoFile}
            previewUrl={videoPreviewUrl}
            durationSec={videoDurationSec}
            selectedResolution={selectedResolution}
            onSelectedResolutionChange={setSelectedResolution}
            selectionStartSec={selectionStartSec}
            selectionDurationSec={selectionDurationSec}
            needsTimeline={needsTimeline}
            onRangeChange={handleSelectionRangeChange}
            error={videoError || trimError}
            onFile={handleVideoFile}
            onChangeVideo={changeVideo}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            onChange={onHiddenVideoInput}
            className="hidden"
            aria-hidden
            tabIndex={-1}
          />

          <div className="edit-video-modifiers">
            <p className="edit-video-seclabel">Que veux-tu modifier ?</p>

            <div className="edit-video-tiles">
              {EDIT_TILES.map((tile) => (
                <EditVideoTile
                  key={tile.id}
                  tile={tile}
                  active={activeTile === tile.id}
                  badge={tile.id === "chg" ? chgBadgeCount : 0}
                  onClick={() => switchTile(tile.id)}
                />
              ))}
            </div>

            {activeTile === "avatar" ? (
              <EditVideoFormPanel icon={UserCircle} title="Avatar IA" hint="· jusqu'à 3 références">
                <div className="edit-video-av-slots">
                  {Array.from({ length: AVATAR_SLOT_COUNT }, (_, slotIndex) => (
                    <EditVideoAvatarSlot
                      key={slotIndex}
                      label={`Slot ${slotIndex + 1}`}
                      preview={avatars[slotIndex]?.url ?? null}
                      onPick={() => openAvatarLibraryForSlot(slotIndex)}
                      onClear={() => clearAvatarSlot(slotIndex)}
                    />
                  ))}
                </div>
                {avatars.some((a) => a !== null) ? (
                  <div className="edit-video-toggle-row">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white/90">Dialogue synchronisé</p>
                      <p className="edit-video-meta mt-0.5">
                        Voix générée en français, adaptée à la scène
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={dialogueEnabled}
                      onClick={() => setDialogueEnabled((prev) => !prev)}
                      className={`edit-video-toggle-switch ${dialogueEnabled ? "is-on" : ""}`}
                    >
                      <span className="edit-video-toggle-knob" />
                    </button>
                  </div>
                ) : null}
              </EditVideoFormPanel>
            ) : null}

            {activeTile === "rendu" ? (
              <EditVideoFormPanel icon={ImageIcon} title="Rendu visuel cible">
                <ReferenceImageBlock
                  imageDataUrl={refImageDataUrl}
                  mode={refImageMode}
                  onModeChange={setRefImageMode}
                  onImageChange={handleRefImageChange}
                  onClear={() => {
                    setRefImageDataUrl(null);
                    setRefImageError(null);
                  }}
                />
                {refImageError ? (
                  <p className="edit-video-error edit-video-panel-error" role="alert">
                    {refImageError}
                  </p>
                ) : null}
              </EditVideoFormPanel>
            ) : null}

            {activeTile === "chg" ? (
              <EditVideoFormPanel icon={Wand2} title="Éléments de scène">
                <div className="edit-video-chg-list">
                  {instructions.map((row, index) => (
                    <InstructionCard
                      key={row.id}
                      instruction={row}
                      index={index}
                      canRemove={instructions.length > 1}
                      onChange={updateInstruction}
                      onRemove={removeInstruction}
                      onAssetChange={(id, assetDataUrl) => updateInstruction(id, { assetDataUrl })}
                    />
                  ))}
                </div>
                {instructions.length < 8 ? (
                  <button type="button" onClick={addInstruction} className="edit-video-add-chg-btn">
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                    Ajouter un changement
                  </button>
                ) : null}
              </EditVideoFormPanel>
            ) : null}
          </div>

          {resultVideoUrl ? (
          <div className="edit-video-result">
            <p className="edit-video-field-label mb-2">Résultat</p>
            <video
              src={resultVideoUrl}
              controls
              autoPlay
              className="edit-video-canvas w-full overflow-hidden rounded-lg"
            />
            <div className="edit-video-toolbar mt-3">
              <a
                href={resultVideoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="edit-video-pill"
              >
                Télécharger
              </a>
              <button
                type="button"
                onClick={handleNewEdit}
                className="edit-video-pill"
              >
                Nouvelle édition
              </button>
            </div>
          </div>
        ) : null}

        {generateError ? (
          <div className="edit-video-error flex flex-col gap-2">
            <p role="alert">{generateError}</p>
            <button
              type="button"
              onClick={() => setGenerateError(null)}
              className="edit-video-text-link w-fit"
            >
              Réessayer
            </button>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!videoFile || trimming || generating}
          onClick={() => void handleGenerate()}
          className="edit-video-cta"
        >
          {trimming ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {trimStatusMessage}
            </>
          ) : generating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Génération…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
              Générer ma vidéo
            </>
          )}
        </button>
      </div>

      <ModalBibliothequeAvatars
        open={avatarLibraryOpen}
        onClose={closeAvatarLibrary}
        onSelect={handleAvatarLibrarySelect}
      />

      <ModalAbonnementRequis
        open={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        description="L'édition vidéo IA est disponible avec les abonnements ViralWorks Pro ou Studio."
      />
    </div>
  );
}
