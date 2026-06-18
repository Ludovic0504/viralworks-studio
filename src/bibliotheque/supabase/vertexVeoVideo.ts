/**
 * Client « Vidéo virale » — Veo 3 via Vertex AI.
 *
 * Les appels passent par l’Edge Function Supabase `vertex-veo-video` (pas d’appel direct
 * Vertex depuis le navigateur). Aucune clé GCP côté front : uniquement la session utilisateur
 * (Bearer) + VITE_SUPABASE_*.
 *
 * Secrets à configurer dans Supabase (Dashboard → Edge Functions → Secrets), voir `.env.example`.
 */

import type { CampaignGenerationSpec } from "../campaignGenerationSpec";
import { CAMPAIGN_GENERATION_SPEC_VERSION } from "../campaignGenerationSpec";
import { getBrowserSupabase } from "./client-navigateur";

const EDGE_FUNCTION = "vertex-veo-video";

export type VertexVeoClientOptions = {
  /** À chaque appel, récupère un jeton frais (recommandé pour les polls longs). */
  getAccessToken?: () => Promise<string | null | undefined>;
};

async function resolveAccessToken(
  fallback: string | null | undefined,
  getAccessToken?: () => Promise<string | null | undefined>,
): Promise<string | null | undefined> {
  if (getAccessToken) {
    try {
      const t = await getAccessToken();
      if (String(t || "").trim()) return t;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

/** Raccourci : session Supabase courante (rafraîchie si besoin). */
export async function getSessionAccessTokenForVertexVeo(): Promise<string | null | undefined> {
  const { data, error } = await getBrowserSupabase().auth.getSession();
  if (error) return undefined;
  return data.session?.access_token;
}

export type VertexVeoAction = "create" | "status";

export type VertexVeoCreatePayload = {
  action: "create";
  /** Contrat attendu par l’Edge Function vertex-veo-video (create uniquement). */
  schema_version: string;
  prompt: string;
  duration?: number;
  aspect_ratio?: "9:16" | "16:9";
  model?: string;
  initial_image_url?: string;
  generation_mode?: "text_to_video" | "image_to_video";
};

export type VertexVeoStatusPayload = {
  action: "status";
  task_id: string;
  /** Doit correspondre au modèle utilisé pour predictLongRunning. */
  model?: string;
};

export type VertexVeoCreateResponse = {
  task_id: string;
  status?: string;
  /** Modèle Vertex réellement utilisé (à renvoyer sur chaque status pour fetchPredictOperation). */
  model?: string;
};

export type VertexVeoStatusResponse = {
  task_id?: string;
  status: "processing" | "success" | "failed";
  video_url?: string;
  gcs_uri?: string;
  error?: string;
};

function getEdgeInvokeConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!String(supabaseUrl || "").trim() || !String(supabaseAnonKey || "").trim()) {
    throw new Error("Configuration Supabase manquante (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }
  return { supabaseUrl: String(supabaseUrl).trim(), supabaseAnonKey: String(supabaseAnonKey).trim() };
}

/**
 * Appel bas niveau à l’Edge Function (create ou status).
 */
export async function invokeVertexVeoVideo(
  body: VertexVeoCreatePayload | VertexVeoStatusPayload,
  accessToken: string | undefined | null,
  clientOptions?: VertexVeoClientOptions,
): Promise<VertexVeoCreateResponse | VertexVeoStatusResponse> {
  const { supabaseUrl, supabaseAnonKey } = getEdgeInvokeConfig();
  const token = await resolveAccessToken(accessToken, clientOptions?.getAccessToken);
  if (!String(token || "").trim()) {
    throw new Error("Session expirée, reconnecte-toi puis réessaie.");
  }

  const endpoint = `${supabaseUrl}/functions/v1/${EDGE_FUNCTION}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { error: text || `Erreur HTTP ${res.status}` };
  }

  if (res.status === 404) {
    throw new Error(
      `La Edge Function « ${EDGE_FUNCTION} » est introuvable sur ce projet (404). Déploie-la : npm run supabase:deploy:vertex-veo-video (ou supabase functions deploy ${EDGE_FUNCTION}).`,
    );
  }

  if (!res.ok) {
    const msg = String((data as { error?: string }).error || `Erreur HTTP ${res.status}`);
    throw new Error(msg);
  }

  return data as VertexVeoCreateResponse | VertexVeoStatusResponse;
}

/** Vertex Veo n’accepte que 9:16 et 16:9 ; le spec autorise aussi 1:1 → on retombe sur 9:16. */
function veoAspectRatioFromSpec(
  ar: CampaignGenerationSpec["rendering"]["aspect_ratio"],
): "9:16" | "16:9" {
  if (ar === "16:9") return "16:9";
  return "9:16";
}

function veoDurationSecondsFromSpec(spec: CampaignGenerationSpec): number {
  const n = Math.floor(Number(spec.rendering.duration_seconds));
  if (n === 4 || n === 6 || n === 8) return n;
  return 8;
}

/**
 * Règles de cohérence visuelle — suffixe injecté sur tout prompt Veo3 avant l’appel Edge / Vertex.
 * Point d’injection unique pour l’API : {@link createVertexVeoVideoTask}.
 */
export const VEO3_VISUAL_CONTINUITY_RULES_SUFFIX = `Continuity rules (strictly enforced):
- No object spawning: objects must not appear out of nowhere 
  between frames without a logical narrative action.
- No object duplication: the same object must never appear 
  twice simultaneously in the same frame.
- No sudden appearance or disappearance of people or props 
  without a cut or a narrative justification.
- Maintain consistent character appearance (hair, clothing, 
  face) from first to last frame.
- Human anatomy is fixed: the person has exactly two hands and two arms throughout the entire video. No extra limbs may appear at any frame. Any hand visible on screen belongs to one of these two hands.
- No anatomical duplication: the same hand must never appear twice in the same frame.`;

const VEO3_CONTINUITY_MARKER = "Continuity rules (strictly enforced):";
/** Limite côté client : l’Edge tronque à 8000 (text) ou 7600 + consigne image ; on garde une marge pour le suffixe + ligne image. */
const VEO3_PROMPT_MAX_CHARS_TEXT = 7990;
const VEO3_PROMPT_MAX_CHARS_IMAGE = 7520;

/**
 * Concatène le bloc de cohérence à la fin du prompt (idempotent si déjà présent).
 * Tronque le début du texte utilisateur si besoin pour rester sous `maxTotalChars`.
 */
export function appendVeo3VisualContinuityRules(prompt: string, maxTotalChars = VEO3_PROMPT_MAX_CHARS_TEXT): string {
  const base = String(prompt ?? "").trim();
  const suffix = `\n\n${VEO3_VISUAL_CONTINUITY_RULES_SUFFIX}`;
  if (!base) return VEO3_VISUAL_CONTINUITY_RULES_SUFFIX.trim();
  if (base.includes(VEO3_CONTINUITY_MARKER)) return base.slice(0, maxTotalChars);
  let combined = `${base}${suffix}`;
  if (combined.length <= maxTotalChars) return combined;
  const room = Math.max(0, maxTotalChars - suffix.length);
  return `${base.slice(0, room)}${suffix}`;
}

/**
 * Lance une génération longue (retourne le nom d’opération Vertex / task_id).
 * Lit `rendering`, `creative.hook_visual.selected_image_url` et `provider_overrides.veo3.model` depuis le spec.
 * Ne modifie pas le spec (ex. `trace.video_generation.task_id` : responsabilité de l’appelant).
 *
 * @param prompt Texte final produit par le traducteur Veo3 ; le suffixe de cohérence visuelle y est ajouté avant envoi.
 */
export async function createVertexVeoVideoTask(
  spec: CampaignGenerationSpec,
  prompt: string,
  accessToken: string | undefined | null,
  clientOptions?: VertexVeoClientOptions,
): Promise<{ taskId: string; model?: string }> {
  const rawPrompt = String(prompt ?? "").trim();
  if (!rawPrompt) {
    throw new Error("Prompt vidéo manquant : fournis un prompt non vide pour la génération Veo3.");
  }

  const generationMode = spec.rendering.generation_mode;
  const promptBudget =
    generationMode === "image_to_video" ? VEO3_PROMPT_MAX_CHARS_IMAGE : VEO3_PROMPT_MAX_CHARS_TEXT;
  const trimmedPrompt = appendVeo3VisualContinuityRules(rawPrompt, promptBudget);

  const hookUrl = String(spec.creative.hook_visual.selected_image_url ?? "").trim();

  if (generationMode === "image_to_video" && !hookUrl) {
    throw new Error(
      "Mode image vers vidéo : une image d’accroche (URL) est requise dans le spec. Sélectionne ou valide un visuel d’accroche puis réessaie.",
    );
  }

  const aspectRatio = veoAspectRatioFromSpec(spec.rendering.aspect_ratio);
  const duration = veoDurationSecondsFromSpec(spec);
  const modelTrim = String(spec.provider_overrides.veo3.model ?? "").trim();

  const data = (await invokeVertexVeoVideo(
    {
      action: "create",
      schema_version: CAMPAIGN_GENERATION_SPEC_VERSION,
      prompt: trimmedPrompt,
      duration,
      aspect_ratio: aspectRatio,
      ...(modelTrim ? { model: modelTrim } : {}),
      ...(hookUrl ? { initial_image_url: hookUrl } : {}),
      generation_mode: generationMode,
    },
    accessToken,
    clientOptions,
  )) as VertexVeoCreateResponse;

  const taskId = String(data?.task_id || "").trim();
  if (!taskId) {
    throw new Error("Le moteur vidéo n'a pas retourné de task_id.");
  }
  const model = String(data?.model || "").trim() || undefined;
  return { taskId, model };
}

export async function fetchVertexVeoVideoStatus(
  taskId: string,
  accessToken: string | undefined | null,
  clientOptions?: VertexVeoClientOptions,
  model?: string,
): Promise<VertexVeoStatusResponse> {
  const m = String(model || "").trim();
  return (await invokeVertexVeoVideo(
    {
      action: "status",
      task_id: taskId,
      ...(m ? { model: m } : {}),
    },
    accessToken,
    clientOptions,
  )) as VertexVeoStatusResponse;
}

/**
 * Récupère une URL vidéo fraîche depuis un `task_id` déjà connu.
 * N'effectue pas de nouvelle génération : simple appel status.
 */
export async function refreshVertexVideoUrlFromId(
  taskId: string,
  accessToken: string | undefined | null,
  clientOptions?: VertexVeoClientOptions,
  model?: string,
): Promise<{ status: "processing" | "success" | "failed"; videoUrl?: string; gcsUri?: string; error?: string }> {
  const statusData = await fetchVertexVeoVideoStatus(taskId, accessToken, clientOptions, model);
  if (statusData.status === "success") {
    const videoUrl = String(statusData.video_url || "").trim();
    return {
      status: "success",
      videoUrl: videoUrl || undefined,
      gcsUri: statusData.gcs_uri ? String(statusData.gcs_uri) : undefined,
    };
  }
  if (statusData.status === "failed") {
    return {
      status: "failed",
      error: String(statusData.error || "La vidéo n'est plus disponible."),
    };
  }
  return { status: "processing" };
}

export type PollVertexVeoOptions = {
  /** Nombre max de requêtes status (défaut : 90 × 4 s, ~6 min — Veo peut être lent). */
  maxAttempts?: number;
  intervalMs?: number;
  signal?: AbortSignal;
  /** Appelé avant chaque requête status (attempt0-based). */
  onTick?: (attemptIndex: number, maxAttempts: number) => void;
  getAccessToken?: () => Promise<string | null | undefined>;
  /** Même modèle que pour create (réponse create ou paramètre explicite). */
  model?: string;
};

/** Message API brut → texte plus lisible (surcharge Vertex / Veo). */
function formatVertexVeoFailureMessage(raw: string | undefined): string {
  const msg = String(raw || "").trim();
  if (!msg) return "La génération vidéo a échoué.";
  const lower = msg.toLowerCase();
  if (
    lower.includes("high load") ||
    lower.includes("cannot process your request") ||
    lower.includes("try again later")
  ) {
    return "Le service vidéo est temporairement saturé (côté fournisseur). Réessaie dans quelques minutes. Ton solde vidéo n’est pas débité tant que tu n’as pas validé et enregistré la vidéo.";
  }
  return msg;
}

/**
 * Attend la fin de l’opération (success / failed / timeout).
 */
export async function pollVertexVeoUntilComplete(
  taskId: string,
  accessToken: string | undefined | null,
  options: PollVertexVeoOptions = {},
): Promise<{ videoUrl: string; gcsUri?: string }> {
  const maxAttempts = options.maxAttempts ?? 90;
  const intervalMs = options.intervalMs ?? 4000;
  const signal = options.signal;
  const onTick = options.onTick;
  const pollModel = String(options.model || "").trim();
  const clientOpts: VertexVeoClientOptions | undefined = options.getAccessToken
    ? { getAccessToken: options.getAccessToken }
    : undefined;

  for (let i = 0; i < maxAttempts; i += 1) {
    if (signal?.aborted) {
      const err = new Error("Annulé");
      err.name = "AbortError";
      throw err;
    }

    onTick?.(i, maxAttempts);

    const statusData = await fetchVertexVeoVideoStatus(
      taskId,
      accessToken,
      clientOpts,
      pollModel || undefined,
    );

    if (statusData.status === "success") {
      const videoUrl = String(statusData.video_url || "").trim();
      if (!videoUrl) {
        throw new Error("Vidéo générée mais URL introuvable.");
      }
      return {
        videoUrl,
        gcsUri: statusData.gcs_uri ? String(statusData.gcs_uri) : undefined,
      };
    }

    if (statusData.status === "failed") {
      throw new Error(formatVertexVeoFailureMessage(statusData.error));
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Délai dépassé: la vidéo est encore en cours de génération.");
}
