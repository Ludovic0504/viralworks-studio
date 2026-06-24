import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import {
  formatTimecode,
  clampSelectionRange,
  buildTimelineTicks,
  TIMELINE_TICK_STEP_SEC,
  TIMELINE_TICK_STEP_MOBILE_SEC,
} from "@/bibliotheque/video/editVideoClientUtils";

export default function EditVideoFilmstrip({
  frames,
  totalDurationSec,
  startSec,
  selectionDurationSec,
  needsSelectionWindow,
  onRangeChange,
  disabled = false,
}) {
  const trackRef = useRef(null);
  const [hoverSec, setHoverSec] = useState(null);
  const [tickStepSec, setTickStepSec] = useState(TIMELINE_TICK_STEP_SEC);
  const dragRef = useRef({
    active: false,
    mode: "move",
    pointerId: null,
    originClientX: 0,
    originStartSec: 0,
    originDurationSec: 0,
    originEndSec: 0,
  });

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
    [totalDurationSec],
  );

  const applyRange = useCallback(
    (start, duration) => {
      onRangeChange(clampSelectionRange(start, duration, totalDurationSec));
    },
    [onRangeChange, totalDurationSec],
  );

  const beginDrag = useCallback(
    (e, mode) => {
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
    },
    [disabled, selectionDurationSec, startSec],
  );

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
          {ticks.map((tick) => {
            const pct = totalDurationSec > 0 ? (tick / totalDurationSec) * 100 : 0;
            return (
              <span
                key={tick}
                className="absolute -translate-x-1/2 text-[9px] leading-none text-gray-500"
                style={{ left: `${pct}%` }}
              >
                {formatTimecode(tick)}
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
