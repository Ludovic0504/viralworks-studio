const SILENT_VIDEO_EVENTS = [
  "volumechange",
  "play",
  "playing",
  "loadedmetadata",
  "loadeddata",
  "canplay",
  "canplaythrough",
  "ratechange",
] as const;

type VideoWithAudioTracks = HTMLVideoElement & {
  audioTracks?: { length: number; [index: number]: { enabled: boolean } };
};

/** Force une balise vidéo à rester muette (volume 0, pistes audio désactivées). */
export function enforceSilentVideo(video: HTMLVideoElement | null) {
  if (!video) return;

  video.muted = true;
  video.defaultMuted = true;
  video.volume = 0;

  const tracks = (video as VideoWithAudioTracks).audioTracks;
  if (tracks) {
    for (let i = 0; i < tracks.length; i += 1) {
      tracks[i].enabled = false;
    }
  }
}

/** Maintient une vidéo muette tant que le composant est monté. */
export function attachSilentVideoLock(video: HTMLVideoElement): () => void {
  const enforce = () => enforceSilentVideo(video);

  enforce();
  for (const eventName of SILENT_VIDEO_EVENTS) {
    video.addEventListener(eventName, enforce);
  }

  return () => {
    for (const eventName of SILENT_VIDEO_EVENTS) {
      video.removeEventListener(eventName, enforce);
    }
  };
}

/** Dessine une vidéo en object-fit: cover dans un canvas. */
export function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !width || !height) return;

  const scale = Math.max(width / vw, height / vh);
  const drawW = vw * scale;
  const drawH = vh * scale;
  const offsetX = (width - drawW) / 2;
  const offsetY = (height - drawH) / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(video, 0, 0, vw, vh, offsetX, offsetY, drawW, drawH);
}
