import { useEffect, useRef } from "react";
import {
  attachSilentVideoLock,
  drawVideoCover,
  enforceSilentVideo,
} from "@/bibliotheque/media/lockSilentVideo";

function blockMediaSave(event) {
  event.preventDefault();
}

/**
 * Vidéo de démo muette : lecture via canvas (pas de contrôles navigateur / tap-to-unmute).
 * La balise <video> est cachée et verrouillée en mute permanent.
 */
export default function AccueilDemoVideo({ src, preload, label, className }) {
  const shellRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!video || !canvas || !shell) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let frameId = 0;
    let stopped = false;
    let detachSilentLock = attachSilentVideoLock(video);

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(shell.clientWidth * dpr));
      const height = Math.max(1, Math.round(shell.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const paint = () => {
      if (stopped) return;
      enforceSilentVideo(video);
      resizeCanvas();
      drawVideoCover(ctx, video, shell.clientWidth, shell.clientHeight);
      frameId = window.requestAnimationFrame(paint);
    };

    const startPlayback = () => {
      enforceSilentVideo(video);
      void video.play().catch(() => {});
      if (!frameId) paint();
    };

    video.addEventListener("loadeddata", startPlayback);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startPlayback();
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (!stopped) resizeCanvas();
          })
        : null;
    resizeObserver?.observe(shell);

    return () => {
      stopped = true;
      window.cancelAnimationFrame(frameId);
      frameId = 0;
      video.removeEventListener("loadeddata", startPlayback);
      detachSilentLock();
      detachSilentLock = () => {};
      resizeObserver?.disconnect();
      video.pause();
    };
  }, [src]);

  return (
    <div
      ref={shellRef}
      className={className}
      onContextMenu={blockMediaSave}
      onDragStart={blockMediaSave}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        defaultMuted
        playsInline
        preload={preload}
        draggable={false}
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        aria-hidden
        className="accueil-demo-video-source"
      />
      <canvas
        ref={canvasRef}
        className="accueil-demo-video h-full w-full object-cover"
        role="img"
        aria-label={label}
      />
      <div
        className="absolute inset-0 z-[1]"
        onContextMenu={blockMediaSave}
        onDragStart={blockMediaSave}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 text-center text-[8px] font-bold uppercase tracking-widest text-white/45">
        {label}
      </div>
    </div>
  );
}
