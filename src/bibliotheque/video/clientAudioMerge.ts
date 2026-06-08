import { fetchFile } from "@ffmpeg/util";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { getFFmpeg, loadVideoBytesForFfmpeg } from "@/bibliotheque/videoUtils";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

export type AudioMergePostprocessResponse = {
  status?: string;
  source_video_url?: string;
  voice_url?: string | null;
  music_url?: string | null;
  merge_client_side?: boolean;
  video_url?: string;
};

const SOURCE_MP4 = "source.mp4";
const VOICE_MP3 = "voice.mp3";
const MUSIC_MP3 = "music.mp3";
const OUTPUT_MP4 = "output.mp4";

async function safeDeleteFile(ffmpeg: FFmpeg, path: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    // ignore missing file
  }
}

function buildFfmpegMergeArgs(hasVoice: boolean, hasMusic: boolean): string[] {
  if (hasVoice && hasMusic) {
    return [
      "-y",
      "-i",
      SOURCE_MP4,
      "-i",
      VOICE_MP3,
      "-i",
      MUSIC_MP3,
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
      OUTPUT_MP4,
    ];
  }
  if (hasVoice) {
    return [
      "-y",
      "-i",
      SOURCE_MP4,
      "-i",
      VOICE_MP3,
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
      OUTPUT_MP4,
    ];
  }
  return [
    "-y",
    "-i",
    SOURCE_MP4,
    "-i",
    MUSIC_MP3,
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
    OUTPUT_MP4,
  ];
}

export async function mergeClientSideAudioVideo(
  postData: AudioMergePostprocessResponse,
  options: { onProgress?: (message: string) => void } = {}
): Promise<string> {
  const sourceUrl = String(postData.source_video_url || "").trim();
  const voiceUrl = String(postData.voice_url || "").trim() || null;
  const musicUrl = String(postData.music_url || "").trim() || null;

  if (!sourceUrl) {
    throw new Error("source_video_url manquant pour la fusion audio.");
  }

  if (!postData.merge_client_side || (!voiceUrl && !musicUrl)) {
    return sourceUrl;
  }

  options.onProgress?.("Ajout de la voix en cours…");

  const ffmpeg = await getFFmpeg();
  for (const p of [SOURCE_MP4, VOICE_MP3, MUSIC_MP3, OUTPUT_MP4]) {
    await safeDeleteFile(ffmpeg, p);
  }

  await ffmpeg.writeFile(SOURCE_MP4, await loadVideoBytesForFfmpeg(sourceUrl));

  const hasVoice = Boolean(voiceUrl);
  const hasMusic = Boolean(musicUrl);

  if (hasVoice) {
    await ffmpeg.writeFile(VOICE_MP3, await fetchFile(voiceUrl!));
  }
  if (hasMusic) {
    await ffmpeg.writeFile(MUSIC_MP3, await fetchFile(musicUrl!));
  }

  const code = await ffmpeg.exec(buildFfmpegMergeArgs(hasVoice, hasMusic));
  if (code !== 0) {
    throw new Error(`ffmpeg merge failed (exit code ${code})`);
  }

  const raw = await ffmpeg.readFile(OUTPUT_MP4);
  const bytes =
    raw instanceof Uint8Array ? raw : new Uint8Array(raw as unknown as ArrayBuffer);
  const blob = new Blob([bytes], { type: "video/mp4" });

  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Session requise pour publier la vidéo fusionnée.");
  }

  const path = `${session.user.id}/${Date.now()}-merged.mp4`;
  const { error: uploadErr } = await supabase.storage.from("generated-videos").upload(path, blob, {
    contentType: "video/mp4",
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadErr) {
    throw new Error(uploadErr.message || "Upload vidéo fusionnée impossible.");
  }

  const { data: pub } = supabase.storage.from("generated-videos").getPublicUrl(path);

  for (const p of [SOURCE_MP4, VOICE_MP3, MUSIC_MP3, OUTPUT_MP4]) {
    await safeDeleteFile(ffmpeg, p);
  }

  return pub.publicUrl;
}
