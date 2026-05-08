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
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  createDefaultCampaignGenerationSpec,
  normalizeCampaignGenerationSpec,
  type CampaignGenerationSpec,
} from "./campaignGenerationSpec";
import { getBrowserSupabase } from "./supabase/client-navigateur";
import {
  clearCheckpoint,
  loadCheckpoint,
  upsertCheckpoint,
  type SegmentCheckpoint,
} from "./videoPipeline24Checkpoint";
import {
  createVertexVeoVideoTask,
  getSessionAccessTokenForVertexVeo,
  pollVertexVeoUntilComplete,
  refreshVertexVideoUrlFromId,
} from "./supabase/vertexVeoVideo";
import { extractLastFrame, getFFmpeg, loadVideoBytesForFfmpeg } from "./videoUtils";

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

async function ensureFreshSegmentVideoUrl(
  url: string | undefined,
  meta: { taskId?: string; model?: string },
  signal?: AbortSignal
): Promise<string> {
  const taskId = String(meta.taskId || "").trim();
  const u = String(url || "").trim();
  if (u) {
    try {
      const r = await fetch(u, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        signal,
      });
      if (r.ok || r.status === 206) return u;
    } catch {
      /* refresh via Vertex */
    }
  }
  if (!taskId) {
    throw new Error(
      "Impossible de lire la vidéo du checkpoint (URL expirée). Identifiant de tâche Vertex manquant pour régénérer le lien."
    );
  }
  const accessToken = await getSessionAccessTokenForVertexVeo();
  const refreshed = await refreshVertexVideoUrlFromId(taskId, accessToken, veoClientOpts, meta.model);
  if (refreshed.status !== "success" || !refreshed.videoUrl) {
    throw new Error(refreshed.error || "Impossible de régénérer l’URL vidéo signée.");
  }
  return refreshed.videoUrl;
}

type ConcatThreeMp4Opts = {
  /** Jalons 92 / 96 / 100 % pendant l’assemblage (étape 6 côté UI diagnostic). */
  onConcatProgress?: (info: { percent: number; message: string }) => void;
};

async function concatThreeMp4ToBlobUrl(
  a: string,
  b: string,
  c: string,
  opts?: ConcatThreeMp4Opts
): Promise<string> {
  const onConcatProgress = opts?.onConcatProgress;
  const ffmpeg = await getFFmpeg();

  for (const p of [SEG_A, SEG_B, SEG_C, CONCAT_LIST, CONCAT_OUT]) {
    await safeDelete(ffmpeg, p);
  }

  const [bufA, bufB, bufC] = await Promise.all([
    loadVideoBytesForFfmpeg(a),
    loadVideoBytesForFfmpeg(b),
    loadVideoBytesForFfmpeg(c),
  ]);
  await ffmpeg.writeFile(SEG_A, bufA);
  await ffmpeg.writeFile(SEG_B, bufB);
  await ffmpeg.writeFile(SEG_C, bufC);

  console.log(
    "[concatThreeMp4ToBlobUrl] jalon 92 — téléchargements + writeFile terminés ; onConcatProgress défini ?",
    Boolean(onConcatProgress),
    { bytesA: bufA.byteLength, bytesB: bufB.byteLength, bytesC: bufC.byteLength }
  );
  onConcatProgress?.({ percent: 92, message: "Téléchargements terminés." });

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

  console.log(
    "[concatThreeMp4ToBlobUrl] jalon 96 — ffmpeg.exec concat OK ; onConcatProgress défini ?",
    Boolean(onConcatProgress)
  );
  onConcatProgress?.({ percent: 96, message: "Concaténation FFmpeg terminée." });

  const raw = await ffmpeg.readFile(CONCAT_OUT);
  if (!(raw instanceof Uint8Array)) {
    throw new Error("Sortie concat : binaire attendu");
  }

  for (const p of [SEG_A, SEG_B, SEG_C, CONCAT_LIST, CONCAT_OUT]) {
    await safeDelete(ffmpeg, p);
  }

  const blob = new Blob([raw], { type: "video/mp4" });
  console.log(
    "[concatThreeMp4ToBlobUrl] jalon 100 — blob prêt ; onConcatProgress défini ?",
    Boolean(onConcatProgress),
    { outBytes: raw.byteLength }
  );
  onConcatProgress?.({ percent: 100, message: "Assemblage terminé." });
  return URL.createObjectURL(blob);
}

export type Generate24SecVideoOptions = {
  /** Appelé pour les 5 jalons pipeline (affichage 2/6 … 6/6 après l’étape « découpage » côté UI). */
  onProgress?: (info: { step: 1 | 2 | 3 | 4 | 5; message: string }) => void;
  /** Sous-jalons pendant concat FFmpeg : 92 / 96 / 100 %. */
  onAssemblyProgress?: (info: { percent: number; message: string }) => void;
  signal?: AbortSignal;
  /** Hooks optionnels fournis par le studio (une image par segment). */
  hookImages?: {
    seg1?: string | null;
    seg2?: string | null;
    seg3?: string | null;
  };
  checkpoint?: {
    enabled: boolean;
    resume: boolean;
    promptHash: string;
  };
};

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const err = new Error("Annulé");
    err.name = "AbortError";
    throw err;
  }
}

export type GenerateVeo3EightSecondsAndLastFrameOptions = {
  signal?: AbortSignal;
  /** 1 = génération, 2 = extraction frame */
  onProgress?: (info: { step: 1 | 2; message: string }) => void;
  onPollTick?: (attemptIndex: number, maxAttempts: number) => void;
};

/**
 * Un seul clip 8 s (9:16) Veo + extraction de la dernière frame (PNG data URL).
 * Utilisé par le chemin « 24 s » diagnostic de l’onglet vidéo virale.
 */
export async function generateVeo3EightSecondsAndLastFrame(
  prompt: string,
  hookImageUrl: string | null | undefined,
  options: GenerateVeo3EightSecondsAndLastFrameOptions = {}
): Promise<{
  taskId: string;
  model: string | undefined;
  videoUrl: string;
  lastFrameDataUrl: string;
}> {
  const { signal, onProgress, onPollTick } = options;
  assertNotAborted(signal);
  const hook1 = String(hookImageUrl || "").trim();
  const seg1Mode = hook1 ? "image_to_video" : "text_to_video";
  const spec = buildSpecForStep({ generationMode: seg1Mode, hookImageUrl: hook1 });
  const accessToken = await getSessionAccessTokenForVertexVeo();
  if (!accessToken) {
    throw new Error("Session requise pour la génération Veo.");
  }

  onProgress?.({ step: 1, message: "Génération Veo 8 s…" });
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
    onTick: onPollTick,
  });

  assertNotAborted(signal);
  onProgress?.({ step: 2, message: "Extraction de la dernière image…" });
  const lastFrameDataUrl = await extractLastFrame(videoUrl);

  return {
    taskId: String(taskId || "").trim(),
    model,
    videoUrl,
    lastFrameDataUrl,
  };
}

export type GenerateVeo3DiagnosticSegment1And2Options = {
  signal?: AbortSignal;
  /**
   * Diagnostic ViralWorks : 1 = génération clip 1, 2 = frame fin clip 1, 3 = génération clip 2, 4 = frame fin clip 2.
   */
  onProgress?: (info: { step: 1 | 2 | 3 | 4; message: string }) => void;
  onPollTick?: (attemptIndex: number, maxAttempts: number) => void;
};

export type DiagnosticSegment1And2Result = {
  segment1: {
    taskId: string;
    model: string | undefined;
    videoUrl: string;
    lastFrameDataUrl: string;
  };
  segment2: {
    taskId: string;
    model: string | undefined;
    videoUrl: string;
    lastFrameDataUrl: string;
  };
};

/**
 * Diagnostic 24 s : clip 1 (8 s) + frame → image initiale clip 2 + clip 2 (8 s) + frame.
 * Réutilise {@link generateVeo3EightSecondsAndLastFrame} pour le segment 1.
 */
export async function generateVeo3DiagnosticSegment1And2(
  promptSegment1: string,
  promptSegment2: string,
  hookSegment1Url: string | null | undefined,
  options: GenerateVeo3DiagnosticSegment1And2Options = {}
): Promise<DiagnosticSegment1And2Result> {
  const { signal, onProgress, onPollTick } = options;

  const seg1 = await generateVeo3EightSecondsAndLastFrame(promptSegment1, hookSegment1Url, {
    signal,
    onProgress: ({ step, message }) => {
      if (step === 1) onProgress?.({ step: 1, message });
      else onProgress?.({ step: 2, message });
    },
    onPollTick,
  });

  assertNotAborted(signal);

  onProgress?.({ step: 3, message: "Préparation image initiale (segment 2)…" });
  const hookUrlSeg2 = await uploadPngDataUrlForVeoInitialFrame(seg1.lastFrameDataUrl);
  assertNotAborted(signal);

  const spec2 = buildSpecForStep({ generationMode: "image_to_video", hookImageUrl: hookUrlSeg2 });
  const accessToken = await getSessionAccessTokenForVertexVeo();
  if (!accessToken) {
    throw new Error("Session requise pour la génération Veo.");
  }

  onProgress?.({ step: 3, message: "Génération Veo 8 s (segment 2)…" });
  const { taskId, model } = await createVertexVeoVideoTask(
    spec2,
    String(promptSegment2).trim(),
    accessToken,
    veoClientOpts
  );

  const { videoUrl } = await pollVertexVeoUntilComplete(taskId, accessToken, {
    maxAttempts: 90,
    intervalMs: 4000,
    model: model || undefined,
    getAccessToken: getSessionAccessTokenForVertexVeo,
    signal,
    onTick: onPollTick,
  });

  assertNotAborted(signal);
  onProgress?.({ step: 4, message: "Extraction de la dernière image (segment 2)…" });
  const lastFrameDataUrlSeg2 = await extractLastFrame(videoUrl);

  return {
    segment1: {
      taskId: seg1.taskId,
      model: seg1.model,
      videoUrl: seg1.videoUrl,
      lastFrameDataUrl: seg1.lastFrameDataUrl,
    },
    segment2: {
      taskId: String(taskId || "").trim(),
      model,
      videoUrl,
      lastFrameDataUrl: lastFrameDataUrlSeg2,
    },
  };
}

export type GenerateVeo3DiagnosticSegment1Through3AndConcatOptions = {
  signal?: AbortSignal;
  /**
   * Diagnostic studio complet : 1–4 = comme {@link generateVeo3DiagnosticSegment1And2},
   * 5 = clip 3 (préparation hook + génération Veo), 6 = concat FFmpeg trois MP4.
   */
  onProgress?: (info: { step: 1 | 2 | 3 | 4 | 5 | 6; message: string }) => void;
  /** Pendant l’étape 6 : 92 % téléchargements, 96 % FFmpeg, 100 % blob final (88 % = premier onProgress step 6). */
  onAssemblyProgress?: (info: { percent: number; message: string }) => void;
  onPollTick?: (attemptIndex: number, maxAttempts: number) => void;
};

export type DiagnosticSegment1Through3AndConcatResult = {
  segment1: DiagnosticSegment1And2Result["segment1"];
  segment2: DiagnosticSegment1And2Result["segment2"];
  segment3: {
    taskId: string;
    model: string | undefined;
    videoUrl: string;
  };
  /**
   * Blob URL locale après concat.- libérer avec `URL.revokeObjectURL` quand l’aperçu est abandonné.
   */
  assembled24sBlobUrl: string;
};

/**
 * Diagnostic studio : seg1 + seg2 (+ frames) comme {@link generateVeo3DiagnosticSegment1And2},
 * puis clip 3 (prompt « Résultat », hook = frame fin seg2, sans extraction de frame),
 * puis assemblage seg1 → seg2 → seg3 via FFmpeg WASM (`concatThreeMp4ToBlobUrl`).
 */
export async function generateVeo3DiagnosticSegment1Through3AndConcat(
  promptSegment1: string,
  promptSegment2: string,
  promptSegment3: string,
  hookSegment1Url: string | null | undefined,
  options: GenerateVeo3DiagnosticSegment1Through3AndConcatOptions = {}
): Promise<DiagnosticSegment1Through3AndConcatResult> {
  const { signal, onProgress, onPollTick, onAssemblyProgress } = options;

  const seg12 = await generateVeo3DiagnosticSegment1And2(promptSegment1, promptSegment2, hookSegment1Url, {
    signal,
    onProgress: ({ step, message }) => {
      onProgress?.({ step, message });
    },
    onPollTick,
  });

  assertNotAborted(signal);

  onProgress?.({ step: 5, message: "Préparation image initiale (segment 3)…" });
  const hookUrlSeg3 = await uploadPngDataUrlForVeoInitialFrame(seg12.segment2.lastFrameDataUrl);
  assertNotAborted(signal);

  const spec3 = buildSpecForStep({ generationMode: "image_to_video", hookImageUrl: hookUrlSeg3 });
  const accessToken = await getSessionAccessTokenForVertexVeo();
  if (!accessToken) {
    throw new Error("Session requise pour la génération Veo.");
  }

  onProgress?.({ step: 5, message: "Génération Veo 8 s (segment 3)…" });
  const { taskId, model } = await createVertexVeoVideoTask(
    spec3,
    String(promptSegment3).trim(),
    accessToken,
    veoClientOpts
  );

  const { videoUrl: videoUrlSeg3 } = await pollVertexVeoUntilComplete(taskId, accessToken, {
    maxAttempts: 90,
    intervalMs: 4000,
    model: model || undefined,
    getAccessToken: getSessionAccessTokenForVertexVeo,
    signal,
    onTick: onPollTick,
  });

  assertNotAborted(signal);

  onProgress?.({ step: 6, message: "Assemblage des trois clips (FFmpeg)…" });
  const assembled24sBlobUrl = await concatThreeMp4ToBlobUrl(
    seg12.segment1.videoUrl,
    seg12.segment2.videoUrl,
    videoUrlSeg3,
    { onConcatProgress: onAssemblyProgress }
  );

  return {
    segment1: seg12.segment1,
    segment2: seg12.segment2,
    segment3: {
      taskId: String(taskId || "").trim(),
      model,
      videoUrl: videoUrlSeg3,
    },
    assembled24sBlobUrl,
  };
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
  const { onProgress, signal, checkpoint: checkpointOpts, hookImages, onAssemblyProgress } = options;
  const ckEnabled = Boolean(checkpointOpts?.enabled && checkpointOpts?.promptHash);
  const promptHash = String(checkpointOpts?.promptHash || "").trim();
  const resume = Boolean(checkpointOpts?.resume);
  const promptsPayload = { p1: prompt1, p2: prompt2, p3: prompt3 };
  const hook1 = String(hookImages?.seg1 || "").trim();
  const hook2External = String(hookImages?.seg2 || "").trim();
  const hook3External = String(hookImages?.seg3 || "").trim();

  if (ckEnabled && promptHash && !resume) {
    await clearCheckpoint(promptHash);
  }

  let cp = ckEnabled && promptHash ? await loadCheckpoint(promptHash) : null;
  if (cp && resume) {
    if (cp.prompts.p1 !== prompt1 || cp.prompts.p2 !== prompt2 || cp.prompts.p3 !== prompt3) {
      cp = null;
    }
  }

  const seg = (i: 0 | 1 | 2): SegmentCheckpoint | undefined => cp?.segments?.[String(i)];

  async function persistSegment(
    key: "0" | "1" | "2",
    patch: SegmentCheckpoint,
    step?: number
  ): Promise<void> {
    if (!ckEnabled || !promptHash) return;
    await upsertCheckpoint({
      prompt_hash: promptHash,
      prompts: promptsPayload,
      segments: { [key]: patch },
      ...(step != null ? { pipeline_step: step } : {}),
    });
  }

  async function runSegment(
    key: "0" | "1" | "2",
    prompt: string,
    spec: CampaignGenerationSpec,
    prev: SegmentCheckpoint | undefined,
    onPollSuccessStep: number
  ): Promise<string> {
    const accessToken = await getSessionAccessTokenForVertexVeo();

    if (prev?.status === "succeeded" && prev.task_id) {
      const url = await ensureFreshSegmentVideoUrl(prev.video_url, { taskId: prev.task_id, model: prev.model }, signal);
      return url;
    }

    if (prev?.status === "processing" && prev.task_id) {
      const { videoUrl, gcsUri } = await pollVertexVeoUntilComplete(prev.task_id, accessToken, {
        maxAttempts: 90,
        intervalMs: 4000,
        model: prev.model || undefined,
        getAccessToken: getSessionAccessTokenForVertexVeo,
        signal,
      });
      await persistSegment(
        key,
        {
          status: "succeeded",
          task_id: prev.task_id,
          model: prev.model,
          video_url: videoUrl,
          gcs_uri: gcsUri,
        },
        onPollSuccessStep
      );
      return videoUrl;
    }

    const { taskId, model } = await createVertexVeoVideoTask(
      spec,
      String(prompt).trim(),
      accessToken,
      veoClientOpts
    );
    await persistSegment(key, { status: "processing", task_id: taskId, model });

    const { videoUrl, gcsUri } = await pollVertexVeoUntilComplete(taskId, accessToken, {
      maxAttempts: 90,
      intervalMs: 4000,
      model: model || undefined,
      getAccessToken: getSessionAccessTokenForVertexVeo,
      signal,
    });
    await persistSegment(
      key,
      {
        status: "succeeded",
        task_id: taskId,
        model,
        video_url: videoUrl,
        gcs_uri: gcsUri,
      },
      onPollSuccessStep
    );
    return videoUrl;
  }

  assertNotAborted(signal);
  onProgress?.({
    step: 1,
    message: "Premier segment (8 s) — génération Vertex…",
  });
  const seg1Mode = hook1 ? "image_to_video" : "text_to_video";
  console.log(
    `[videoPipeline] 1/6 — Veo Vertex ${seg1Mode === "image_to_video" ? "image" : "texte"} → vidéo (prompt1)…`
  );
  const spec1 = buildSpecForStep({ generationMode: seg1Mode, hookImageUrl: hook1 });
  const video1Url = await runSegment("0", prompt1, spec1, seg(0), 2);
  console.log("[videoPipeline] Vidéo 1 OK :", video1Url);

  assertNotAborted(signal);
  let hookUrlForVideo2 = hook2External || String(cp?.frame_hook_after_seg1_url || "").trim();
  if (!hookUrlForVideo2) {
    console.log("[videoPipeline] 2/6 — Dernière frame vidéo 1 (PNG data URL)…");
    const lastFrame1DataUrl = await extractLastFrame(video1Url);
    console.log("[videoPipeline] Frame 1 extraite ; upload Supabase pour image initiale clip 2…");
    hookUrlForVideo2 = await uploadPngDataUrlForVeoInitialFrame(lastFrame1DataUrl);
    console.log("[videoPipeline] URL image clip 2 :", hookUrlForVideo2);
    if (ckEnabled && promptHash) {
      await upsertCheckpoint({
        prompt_hash: promptHash,
        prompts: promptsPayload,
        pipeline_step: 3,
        frame_hook_after_seg1_url: hookUrlForVideo2,
      });
    }
  }

  onProgress?.({
    step: 2,
    message: "Deuxième segment (8 s) — image → vidéo…",
  });
  assertNotAborted(signal);
  console.log("[videoPipeline] 3/6 — Veo Vertex image → vidéo (prompt2)…");
  const spec2 = buildSpecForStep({ generationMode: "image_to_video", hookImageUrl: hookUrlForVideo2 });
  const video2Url = await runSegment("1", prompt2, spec2, seg(1), 4);
  console.log("[videoPipeline] Vidéo 2 OK :", video2Url);

  assertNotAborted(signal);
  let hookUrlForVideo3 = hook3External || String(cp?.frame_hook_after_seg2_url || "").trim();
  if (!hookUrlForVideo3) {
    console.log("[videoPipeline] 4/6 — Dernière frame vidéo 2…");
    const lastFrame2DataUrl = await extractLastFrame(video2Url);
    console.log("[videoPipeline] Upload frame pour clip 3…");
    hookUrlForVideo3 = await uploadPngDataUrlForVeoInitialFrame(lastFrame2DataUrl);
    console.log("[videoPipeline] URL image clip 3 :", hookUrlForVideo3);
    if (ckEnabled && promptHash) {
      await upsertCheckpoint({
        prompt_hash: promptHash,
        prompts: promptsPayload,
        pipeline_step: 5,
        frame_hook_after_seg2_url: hookUrlForVideo3,
      });
    }
  }

  onProgress?.({
    step: 3,
    message: "Troisième segment (8 s) — image → vidéo…",
  });
  assertNotAborted(signal);
  console.log("[videoPipeline] 5/6 — Veo Vertex image → vidéo (prompt3)…");
  const spec3 = buildSpecForStep({ generationMode: "image_to_video", hookImageUrl: hookUrlForVideo3 });
  const video3Url = await runSegment("2", prompt3, spec3, seg(2), 6);
  console.log("[videoPipeline] Vidéo 3 OK :", video3Url);

  onProgress?.({
    step: 4,
    message: "Assemblage des trois clips (FFmpeg)…",
  });
  assertNotAborted(signal);
  console.log("[videoPipeline] 6/6 — Concat FFmpeg (3 MP4)…");
  const outBlobUrl = await concatThreeMp4ToBlobUrl(video1Url, video2Url, video3Url, {
    onConcatProgress: onAssemblyProgress,
  });
  console.log("[videoPipeline] Terminé. Blob URL :", outBlobUrl);

  onProgress?.({
    step: 5,
    message: "Vidéo 24 s prête (locale).",
  });

  if (ckEnabled && promptHash) {
    await clearCheckpoint(promptHash);
  }

  return outBlobUrl;
}
