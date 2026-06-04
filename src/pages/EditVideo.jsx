import { useCallback, useEffect, useId, useRef, useState } from "react";
import { fetchFile } from "@ffmpeg/util";
import { GripVertical, Loader2, Plus, Upload, X } from "lucide-react";
import PageTitle from "@/composants/interface/TitrePage";
import ModalBibliothequeAvatars from "@/composants/studio/avatar/ModalBibliothequeAvatars";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { getFFmpeg } from "@/bibliotheque/videoUtils";
import {
  buildVideoEditPrompt,
} from "@/bibliotheque/video/buildVideoEditPrompt";
import { detectTransformationTiming } from "@/bibliotheque/video/detectTransformationTiming";
import { editVideoSeedance, pollKieTask } from "@/bibliotheque/video/editVideoSeedance";

const FFMPEG_EDIT_SRC = "edit_src.mp4";
const FFMPEG_EDIT_OUT = "edit_out.mp4";
const FFMPEG_STRIP_SRC = "edit_strip_src.mp4";

const FILMSTRIP_THUMB_INTERVAL_SEC = 2;
const FILMSTRIP_MAX_THUMBS = 60;

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
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
    hint: "Le système génère une transformation progressive avant/après",
  },
  {
    id: "inspiration",
    label: "Inspiration",
    hint: "Le système s'inspire du style sans reproduire exactement",
  },
];

const COMING_SOON_MESSAGE =
  "Cette fonctionnalité arrive très bientôt. Nous intégrons actuellement l'API Seedance 2.0 pour rendre cela possible.";

const AVATAR_SLOT_COUNT = 3;

const INPUT_CLASS =
  "w-full rounded-lg border border-white/10 bg-[#161d2e] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:border-cyan-500/40 focus:outline-none";

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

async function trimVideoSegmentWithFfmpeg(file, startSec, durationSec, totalDurationSec) {
  const start = Math.max(0, startSec);
  const duration = Math.max(0.1, durationSec);
  const isFullClip =
    start < 0.05 && Math.abs(duration - totalDurationSec) < 0.1 && totalDurationSec <= MAX_VIDEO_SECONDS;

  if (isFullClip) {
    return new Blob([file], { type: file.type || "video/mp4" });
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

  return new Blob([raw], { type: "video/mp4" });
}

function getBlobVideoAspectRatio(blob) {
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
      const aspectRatio =
        video.videoHeight > video.videoWidth ? "9:16" : "16:9";
      cleanup();
      resolve(aspectRatio);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Impossible de lire les dimensions de la vidéo."));
    };

    video.src = url;
  });
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

function SectionCard({ title, children, className = "" }) {
  return (
    <section
      className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 ${className}`.trim()}
    >
      {title ? <h2 className="mb-3 text-sm font-semibold text-gray-200">{title}</h2> : null}
      {children}
    </section>
  );
}

function EditVideoAvatarSlot({ selection, isLast, onChoose, onClear }) {
  const separatorClass = isLast
    ? ""
    : "border-b border-white/10 pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4";

  if (selection) {
    return (
      <div
        className={`flex min-w-0 flex-1 flex-col items-center gap-2 px-1 sm:px-3 ${separatorClass}`.trim()}
      >
        <div className="w-[100px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#161d2e]">
          <img
            src={selection.url}
            alt=""
            className="aspect-[2/3] w-full object-cover [object-position:16%_center]"
          />
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={onChoose}
            className="text-xs text-cyan-400/90 underline-offset-2 hover:underline"
          >
            Changer
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
          >
            <X className="h-3 w-3" aria-hidden />
            Retirer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center justify-center px-1 sm:px-3 ${separatorClass}`.trim()}
    >
      <button
        type="button"
        onClick={onChoose}
        className="inline-flex w-full max-w-[200px] items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-medium text-gray-200 transition hover:border-cyan-500/30 hover:bg-white/[0.08]"
      >
        Choisir un avatar
      </button>
    </div>
  );
}

function ComingSoonModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="studio-panel max-w-xl w-full overflow-hidden border border-white/10 bg-[#131920]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="edit-video-coming-soon-title"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 id="edit-video-coming-soon-title" className="text-base font-semibold text-gray-200">
            Bientôt disponible
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <p className="text-sm leading-relaxed text-gray-300">{COMING_SOON_MESSAGE}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition-all hover:bg-white/10"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
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
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
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
      <div className="flex flex-col gap-3">
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black">
          <video
            src={previewUrl}
            controls
            playsInline
            className="h-full w-full object-cover"
          />
        </div>
        {durationSec > MAX_VIDEO_SECONDS ? (
          stripLoading ? (
            <div className="flex min-h-[50px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 sm:min-h-[80px]">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-emerald-400" aria-hidden />
              <span className="text-sm text-gray-300">Analyse de la vidéo…</span>
            </div>
          ) : stripError ? (
            <p className="text-xs text-red-400" role="alert">
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
          <p className="text-xs text-gray-500">
            Toute la vidéo sera envoyée à l&apos;IA ({durationSec}s)
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 self-start text-xs">
          <button
            type="button"
            onClick={onChangeVideo}
            className="text-cyan-400/90 underline-offset-2 hover:underline"
          >
            Changer la vidéo
          </button>
          {durationSec > MAX_VIDEO_SECONDS ? (
            <>
              <span className="text-gray-500" aria-hidden>
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
                className="text-emerald-400 underline-offset-2 hover:underline"
              >
                <span className="hidden sm:inline">Sélectionner les 15 premières secondes</span>
                <span className="inline sm:hidden">15 premières sec.</span>
              </button>
            </>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-300">Qualité de génération</p>
          <div
            className="flex w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-1"
            role="tablist"
            aria-label="Qualité de génération"
          >
            {(["480p", "720p"]).map((res) => (
              <button
                key={res}
                type="button"
                role="tab"
                aria-selected={selectedResolution === res}
                onClick={() => onSelectedResolutionChange(res)}
                className={`flex-1 rounded-lg px-2 py-2 text-center text-[11px] font-medium transition sm:text-xs ${
                  selectedResolution === res
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {res}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {selectedResolution === "480p"
              ? "Recommandé — rendu plus rapide, consommation de crédits réduite"
              : "Rendu haute qualité — consomme environ 2.5x plus"}
          </p>
        </div>
        {displayError && !stripError ? (
          <p className="text-xs text-red-400" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-xs text-gray-400 transition hover:text-gray-300 ${
          dragging
            ? "border-cyan-500/50 bg-cyan-500/5 text-gray-300"
            : "border-white/20 hover:border-cyan-500/30"
        }`}
      >
        <Upload className="h-6 w-6" aria-hidden />
        <span className="text-center text-sm text-gray-300">
          Glisse ta vidéo ici ou clique pour importer
        </span>
        <span className="text-center text-[11px] text-gray-500">
          MP4, MOV — 720p recommandé, 50 Mo max. Au-delà de 15 s, choisis l&apos;extrait sur la
          pellicule.
        </span>
      </button>
      {error ? (
        <p className="text-xs text-red-400" role="alert">
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

  const activeMode = REF_IMAGE_MODES.find((m) => m.id === mode) || REF_IMAGE_MODES[0];

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex w-full min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-1"
        role="tablist"
        aria-label="Mode image de référence"
      >
        {REF_IMAGE_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => onModeChange(m.id)}
            className={`flex-1 rounded-lg px-2 py-2 text-center text-[11px] font-medium transition sm:text-xs ${
              mode === m.id
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">{activeMode.hint}</p>

      {imageDataUrl ? (
        <div className="flex items-center gap-3">
          <img
            src={imageDataUrl}
            alt=""
            className="h-24 w-24 shrink-0 rounded-lg border border-white/10 object-cover"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-left text-xs text-cyan-400/90 underline-offset-2 hover:underline"
            >
              Changer l&apos;image
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
            >
              <X className="h-3 w-3" aria-hidden />
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-6 text-xs text-gray-400 transition hover:border-cyan-500/30 hover:text-gray-300"
        >
          <Upload className="h-5 w-5" aria-hidden />
          Importer une image (JPG, PNG, WebP, max 30 Mo)
        </button>
      )}
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
    <div className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4">
      {canRemove ? (
        <button
          type="button"
          onClick={() => onRemove(instruction.id)}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-gray-200"
          aria-label={`Supprimer la modification ${index + 1}`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      <div className="flex flex-col gap-3 pr-8">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400" htmlFor={`what-${instruction.id}`}>
            Quoi
          </label>
          <input
            id={`what-${instruction.id}`}
            type="text"
            value={instruction.what}
            onChange={(e) => onChange(instruction.id, { what: e.target.value })}
            placeholder='ex: "Ajouter une table en marbre", "Peindre les murs en blanc cassé"'
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-400" htmlFor={`where-${instruction.id}`}>
            Où dans la vidéo
          </label>
          <input
            id={`where-${instruction.id}`}
            type="text"
            value={instruction.where}
            onChange={(e) => onChange(instruction.id, { where: e.target.value })}
            placeholder='ex: "dans le salon", "sur le mur du fond", "au centre de la pièce"'
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Le système détecte automatiquement le bon moment dans ta vidéo
          </p>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-gray-400">Asset de référence (optionnel)</span>
          {instruction.assetDataUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={instruction.assetDataUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg border border-white/10 object-cover"
              />
              <button
                type="button"
                onClick={() => onAssetChange(instruction.id, null)}
                className="text-xs text-gray-400 hover:text-gray-200"
              >
                Retirer
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => assetInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 px-3 py-4 text-[11px] text-gray-500 transition hover:border-cyan-500/30 hover:text-gray-400"
              >
                <Upload className="h-4 w-4" aria-hidden />
                Photo de l&apos;objet ou du style voulu (optionnel)
              </button>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EditVideo() {
  const { runWithAuth } = useRequireAuthAction();
  const videoInputRef = useRef(null);
  const trimmedSegmentBlobRef = useRef(null);
  const promptRef = useRef(null);

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

  const [instructions, setInstructions] = useState(() => [
    { id: newInstructionId(), what: "", where: "", assetDataUrl: null },
  ]);

  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [trimStatusMessage, setTrimStatusMessage] = useState(
    "Préparation de l'extrait…",
  );
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [resultVideoUrl, setResultVideoUrl] = useState(null);
  const [kieTaskId, setKieTaskId] = useState(null);
  const pollIntervalRef = useRef(null);
  const pollAttemptsRef = useRef(0);

  const stopKiePolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollAttemptsRef.current = 0;
  }, []);

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

  useEffect(() => () => stopKiePolling(), [stopKiePolling]);

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
      if (file.size > MAX_VIDEO_BYTES) {
        setVideoError("Vidéo trop lourde (max 50 Mo).");
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
    setTrimError(null);
    setGenerateError(null);
    setTrimStatusMessage("Préparation de l'extrait…");
    setTrimming(true);
    try {
      const blob = await trimVideoSegmentWithFfmpeg(
        videoFile,
        selectionStartSec,
        selectionDurationSec,
        videoDurationSec
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
          anchorSecond =
            Math.round(timing.anchorSecond * 10) / 10;
          transformationStart =
            Math.round(Math.max(0.5, anchorSecond - 1.5) * 10) / 10;
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
        setKieTaskId(taskId);
        stopKiePolling();
        pollAttemptsRef.current = 0;
        pollIntervalRef.current = setInterval(() => {
          void (async () => {
            pollAttemptsRef.current += 1;
            if (pollAttemptsRef.current > 150) {
              stopKiePolling();
              setGenerateError("Timeout");
              setGenerating(false);
              return;
            }
            try {
              const poll = await pollKieTask(taskId);
              if (poll.status === "done" && poll.videoUrl) {
                stopKiePolling();
                setResultVideoUrl(poll.videoUrl);
                setGenerating(false);
              } else if (poll.status === "failed") {
                stopKiePolling();
                setGenerateError(poll.error ?? "La génération a échoué.");
                setGenerating(false);
              }
            } catch (pollErr) {
              stopKiePolling();
              setGenerateError(
                pollErr instanceof Error
                  ? pollErr.message
                  : "Erreur lors de la génération.",
              );
              setGenerating(false);
            }
          })();
        }, 6000);
      } catch (err) {
        setGenerateError(
          err instanceof Error ? err.message : "Erreur lors de la génération.",
        );
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
    stopKiePolling,
  ]);

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
    setInstructions((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)));
  };

  const addInstruction = () => {
    setInstructions((prev) => {
      if (prev.length >= 8) return prev;
      return [...prev, { id: newInstructionId(), what: "", where: "", assetDataUrl: null }];
    });
  };

  const handleRefImageChange = (dataUrl, error) => {
    setRefImageDataUrl(dataUrl);
    setRefImageError(error);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-4 pb-10 sm:px-6 lg:max-w-4xl lg:gap-6 lg:py-6 lg:pb-12">
      <PageTitle
        green="Éditer"
        white="ma vidéo"
        subtitle="Ajoute ton avatar, transforme la scène et modifie ta vidéo existante avec l'IA"
        titleClassName="max-lg:text-[28px]"
        className="max-lg:mb-2"
      />

      <SectionCard title="Ta vidéo">
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
      </SectionCard>

      <SectionCard title="Avatar IA (optionnel)">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          {Array.from({ length: AVATAR_SLOT_COUNT }, (_, slotIndex) => (
            <EditVideoAvatarSlot
              key={slotIndex}
              selection={avatars[slotIndex]}
              isLast={slotIndex === AVATAR_SLOT_COUNT - 1}
              onChoose={() => openAvatarLibraryForSlot(slotIndex)}
              onClear={() => clearAvatarSlot(slotIndex)}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
          L&apos;avatar présentera ta vidéo tout au long du clip
        </p>
        {avatars.some((a) => a !== null) ? (
          <div className="mt-3 flex items-center justify-between gap-4 border border-[#222] rounded-xl bg-[#111] px-4 py-3 min-h-[44px]">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-200">Ajouter un dialogue</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Un dialogue sera généré et synchronisé avec ta vidéo
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={dialogueEnabled}
              onClick={() => setDialogueEnabled((prev) => !prev)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                dialogueEnabled ? "bg-emerald-500/80" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  dialogueEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Image de référence (optionnel)">
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
          <p className="mt-2 text-xs text-red-400" role="alert">
            {refImageError}
          </p>
        ) : null}
      </SectionCard>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Ce que tu veux modifier ou ajouter</h2>
          <p className="mt-1 text-xs text-gray-500">
            Décris chaque modification et indique où elle doit apparaître dans la scène
          </p>
        </div>

        <div className="flex flex-col gap-3">
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
          <button
            type="button"
            onClick={addInstruction}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-3 text-sm text-gray-400 transition hover:border-cyan-500/30 hover:text-gray-300"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Ajouter une modification
          </button>
        ) : null}
      </section>

      <button
        type="button"
        disabled={!videoFile || trimming || generating}
        onClick={() => void handleGenerate()}
        className="btn-vws-primary inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
      >
        {trimming ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            {trimStatusMessage}
          </>
        ) : generating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Génération en cours... (peut prendre plusieurs minutes)
          </>
        ) : (
          <>Générer ma vidéo →</>
        )}
      </button>

      {generating ? (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          Génération en cours... (peut prendre plusieurs minutes)
        </div>
      ) : null}

      {generateError ? (
        <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-400" role="alert">
            {generateError}
          </p>
          <button
            type="button"
            onClick={() => setGenerateError(null)}
            className="inline-flex w-fit items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10"
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {resultVideoUrl ? (
        <div className="flex flex-col gap-3">
          <video
            src={resultVideoUrl}
            controls
            autoPlay
            className="mt-4 w-full rounded-xl border border-white/10 bg-black"
          />
          <div className="flex flex-wrap gap-2">
            <a
              href={resultVideoUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/10"
            >
              Télécharger
            </a>
            <button
              type="button"
              onClick={() => setResultVideoUrl(null)}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/10"
            >
              Nouvelle édition
            </button>
          </div>
        </div>
      ) : null}

      <ModalBibliothequeAvatars
        open={avatarLibraryOpen}
        onClose={closeAvatarLibrary}
        onSelect={handleAvatarLibrarySelect}
      />

      <ComingSoonModal open={comingSoonOpen} onClose={() => setComingSoonOpen(false)} />
    </div>
  );
}
