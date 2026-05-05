/**
 * Pipeline 24 s : 3 × 8 s Veo (Vertex via Edge `vertex-veo-video`) + dernière frame + concat FFmpeg WASM.
 *
 * Même pattern que l’onglet « Vidéo virale » : `createVertexVeoVideoTask` + `pollVertexVeoUntilComplete`
 * (voir [Video.jsx](src/pages/Video.jsx)), sans `buildVeo3Prompt` ici (prompts bruts passés tels quels).
 *
 * Les frames PNG (data URL) sont uploadées sur Supabase Storage (`generated-images`) pour obtenir une URL
 * HTTPS lisible par l’Edge (comme `selectedHookImageUrl` côté vidéo virale).
 *
 * Retour : **blob URL** MP4 ; appeler `URL.revokeObjectURL` après usage.
 */
import { fetchFile } from "@ffmpeg/util";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  createDefaultCampaignGenerationSpec,
  normalizeCampaignGenerationSpec,
  type CampaignGenerationSpec,
} from "./campaignGenerationSpec";
import { getBrowserSupabase } from "./supabase/client-navigateur";
import {
  createVertexVeoVideoTask,
  getSessionAccessTokenForVertexVeo,
  pollVertexVeoUntilComplete,
} from "./supabase/vertexVeoVideo";
import { extractLastFrame, getFFmpeg } from "./videoUtils";

const SEG_A = "pipeline_seg0.mp4";
const SEG_B = "pipeline_seg1.mp4";
const SEG_C = "pipeline_seg2.mp4";
const CONCAT_LIST = "pipeline_concat.txt";
const CONCAT_OUT = "pipeline_out.mp4";

function buildSpecForStep(params: {
  generationMode: "text_to_video" | "image_to_video";
  hookImageUrl: string;
}): CampaignGenerationSpec {
  const base = createDefaultCampaignGenerationSpec();
  const hookUrl = String(params.hookImageUrl || "").trim();
  return normalizeCampaignGenerationSpec({
    ...base,
    creative: {
      ...base.creative,
      hook_visual: {
        ...base.creative.hook_visual,
        selected_image_url: hookUrl,
        prompt_text: "",
      },
    },
    rendering: {
      ...base.rendering,
      aspect_ratio: "9:16",
      duration_seconds: 8,
      generation_mode: params.generationMode,
    },
    provider_overrides: {
      ...base.provider_overrides,
      veo3: {
        ...base.provider_overrides.veo3,
        aspect_ratio: "9:16",
        generation_mode: params.generationMode,
        initial_image_url: hookUrl || null,
        prompt: "",
      },
    },
  });
}

const veoClientOpts = { getAccessToken: getSessionAccessTokenForVertexVeo };

async function safeDelete(ffmpeg: FFmpeg, path: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(path);
  } catch {
    /* ignore */
  }
}

/**
 * Data URL PNG → bytes (pour upload bucket, comme les URLs réelles du flux Vidéo virale).
 */
function pngDataUrlToBytes(dataUrl: string): Uint8Array {
  const m = /^data:image\/png;base64,(.+)$/s.exec(String(dataUrl).trim());
  if (!m) {
    throw new Error("Frame attendue au format data:image/png;base64,...");
  }
  const b64 = m[1].replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Publie une frame PNG sur `generated-images` et retourne l’URL publique (consommable par `vertex-veo-video`).
 *
 * Utilise le singleton {@link getBrowserSupabase} : les requêtes Storage partent avec le **JWT de session**
 * (`Authorization: Bearer <access_token>`), ce qui satisfait les politiques `storage.objects` pour le rôle
 * `authenticated` (voir migration `storage_generated_images_bucket`).
 */
async function uploadPngDataUrlForVeoInitialFrame(pngDataUrl: string): Promise<string> {
  const bytes = pngDataUrlToBytes(pngDataUrl);
  const supabase = getBrowserSupabase();
  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (sessionErr || !session || !user) {
    throw new Error("Session requise : connecte-toi pour enchaîner les clips (upload image initiale Veo).");
  }
  const path = `${user.id}/veo-pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.png`;
  const { error: upErr } = await supabase.storage.from("generated-images").upload(path, bytes, {
    contentType: "image/png",
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) {
    throw new Error(
      upErr.message ||
        "Upload image vers Supabase Storage impossible (bucket generated-images / droits).",
    );
  }
  const { data: pub } = supabase.storage.from("generated-images").getPublicUrl(path);
  return pub.publicUrl;
}

/**
 * Un rendu Veo 8 s — aligné sur Video.jsx : task → poll jusqu’à URL MP4.
 */
async function runVertexVeoEightSeconds(
  prompt: string,
  spec: CampaignGenerationSpec,
  signal?: AbortSignal
): Promise<string> {
  const accessToken = await getSessionAccessTokenForVertexVeo();
  const { taskId, model } = await createVertexVeoVideoTask(
    spec,
    String(prompt).trim(),
    accessToken,
    veoClientOpts
  );
  const { videoUrl } = await pollVertexVeoUntilComplete(taskId, accessToken, {
    maxAttempts: 90,
    intervalMs: 4000,
    model: model || undefined,
    getAccessToken: getSessionAccessTokenForVertexVeo,
    signal,
  });
  return videoUrl;
}

async function concatThreeMp4ToBlobUrl(a: string, b: string, c: string): Promise<string> {
  const ffmpeg = await getFFmpeg();

  for (const p of [SEG_A, SEG_B, SEG_C, CONCAT_LIST, CONCAT_OUT]) {
    await safeDelete(ffmpeg, p);
  }

  const urls = [a, b, c];
  const names = [SEG_A, SEG_B, SEG_C];
  for (let i = 0; i < 3; i++) {
    const data = await fetchFile(urls[i]);
    await ffmpeg.writeFile(names[i], data);
  }

  const listText = [`file '${SEG_A}'`, `file '${SEG_B}'`, `file '${SEG_C}'`].join("\n");
  await ffmpeg.writeFile(CONCAT_LIST, new TextEncoder().encode(listText));

  const code = await ffmpeg.exec([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    CONCAT_LIST,
    "-c",
    "copy",
    CONCAT_OUT,
  ]);

  if (code !== 0) {
    for (const p of [SEG_A, SEG_B, SEG_C, CONCAT_LIST, CONCAT_OUT]) {
      await safeDelete(ffmpeg, p);
    }
    throw new Error(`Concaténation FFmpeg échouée (code ${code})`);
  }

  const raw = await ffmpeg.readFile(CONCAT_OUT);
  if (!(raw instanceof Uint8Array)) {
    throw new Error("Sortie concat : binaire attendu");
  }

  for (const p of [SEG_A, SEG_B, SEG_C, CONCAT_LIST, CONCAT_OUT]) {
    await safeDelete(ffmpeg, p);
  }

  const blob = new Blob([raw], { type: "video/mp4" });
  return URL.createObjectURL(blob);
}

export type Generate24SecVideoOptions = {
  /** Appelé pour les 5 jalons pipeline (affichage 2/6 … 6/6 après l’étape « découpage » côté UI). */
  onProgress?: (info: { step: 1 | 2 | 3 | 4 | 5; message: string }) => void;
  signal?: AbortSignal;
};

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const err = new Error("Annulé");
    err.name = "AbortError";
    throw err;
  }
}

/**
 * Génère trois clips 8 s (9:16) via Vertex/Veo et les assemble en une vidéo ~24 s.
 * @returns Blob URL `blob:...` ; libérer avec `URL.revokeObjectURL` après usage.
 */
export async function generate24SecVideo(
  prompt1: string,
  prompt2: string,
  prompt3: string,
  options: Generate24SecVideoOptions = {}
): Promise<string> {
  const { onProgress, signal } = options;

  assertNotAborted(signal);
  onProgress?.({
    step: 1,
    message: "Premier segment (8 s) — génération Vertex…",
  });
  console.log("[videoPipeline] 1/6 — Veo Vertex texte → vidéo (prompt1, sans image)…");
  const spec1 = buildSpecForStep({ generationMode: "text_to_video", hookImageUrl: "" });
  const video1Url = await runVertexVeoEightSeconds(prompt1, spec1, signal);
  console.log("[videoPipeline] Vidéo 1 OK :", video1Url);

  assertNotAborted(signal);
  console.log("[videoPipeline] 2/6 — Dernière frame vidéo 1 (PNG data URL)…");
  const lastFrame1DataUrl = await extractLastFrame(video1Url);
  console.log("[videoPipeline] Frame 1 extraite ; upload Supabase pour image initiale clip 2…");
  const hookUrlForVideo2 = await uploadPngDataUrlForVeoInitialFrame(lastFrame1DataUrl);
  console.log("[videoPipeline] URL image clip 2 :", hookUrlForVideo2);

  onProgress?.({
    step: 2,
    message: "Deuxième segment (8 s) — image → vidéo…",
  });
  assertNotAborted(signal);
  console.log("[videoPipeline] 3/6 — Veo Vertex image → vidéo (prompt2)…");
  const spec2 = buildSpecForStep({ generationMode: "image_to_video", hookImageUrl: hookUrlForVideo2 });
  const video2Url = await runVertexVeoEightSeconds(prompt2, spec2, signal);
  console.log("[videoPipeline] Vidéo 2 OK :", video2Url);

  assertNotAborted(signal);
  console.log("[videoPipeline] 4/6 — Dernière frame vidéo 2…");
  const lastFrame2DataUrl = await extractLastFrame(video2Url);
  console.log("[videoPipeline] Upload frame pour clip 3…");
  const hookUrlForVideo3 = await uploadPngDataUrlForVeoInitialFrame(lastFrame2DataUrl);
  console.log("[videoPipeline] URL image clip 3 :", hookUrlForVideo3);

  onProgress?.({
    step: 3,
    message: "Troisième segment (8 s) — image → vidéo…",
  });
  assertNotAborted(signal);
  console.log("[videoPipeline] 5/6 — Veo Vertex image → vidéo (prompt3)…");
  const spec3 = buildSpecForStep({ generationMode: "image_to_video", hookImageUrl: hookUrlForVideo3 });
  const video3Url = await runVertexVeoEightSeconds(prompt3, spec3, signal);
  console.log("[videoPipeline] Vidéo 3 OK :", video3Url);

  onProgress?.({
    step: 4,
    message: "Assemblage des trois clips (FFmpeg)…",
  });
  assertNotAborted(signal);
  console.log("[videoPipeline] 6/6 — Concat FFmpeg (3 MP4)…");
  const outBlobUrl = await concatThreeMp4ToBlobUrl(video1Url, video2Url, video3Url);
  console.log("[videoPipeline] Terminé. Blob URL :", outBlobUrl);

  onProgress?.({
    step: 5,
    message: "Vidéo 24 s prête (locale).",
  });

  return outBlobUrl;
}
