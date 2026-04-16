/**
 * Client « Vidéo virale » — Veo 3 via Vertex AI.
 *
 * Les appels passent par l’Edge Function Supabase `vertex-veo-video` (pas d’appel direct
 * Vertex depuis le navigateur). Aucune clé GCP côté front : uniquement la session utilisateur
 * (Bearer) + VITE_SUPABASE_*.
 *
 * Secrets à configurer dans Supabase (Dashboard → Edge Functions → Secrets), voir `.env.example`.
 */

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

  if (!res.ok) {
    const msg = String((data as { error?: string }).error || `Erreur HTTP ${res.status}`);
    throw new Error(msg);
  }

  return data as VertexVeoCreateResponse | VertexVeoStatusResponse;
}

export type CreateVertexVeoTaskParams = {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: "9:16" | "16:9";
  model?: string;
  initialImageUrl?: string;
  generationMode?: "text_to_video" | "image_to_video";
};

/**
 * Lance une génération longue (retourne le nom d’opération Vertex / task_id).
 */
export async function createVertexVeoVideoTask(
  params: CreateVertexVeoTaskParams,
  accessToken: string | undefined | null,
  clientOptions?: VertexVeoClientOptions,
): Promise<{ taskId: string; model?: string }> {
  const data = (await invokeVertexVeoVideo(
    {
      action: "create",
      prompt: params.prompt,
      duration: params.durationSeconds,
      aspect_ratio: params.aspectRatio,
      model: params.model,
      initial_image_url: params.initialImageUrl,
      generation_mode: params.generationMode,
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
    return "Le service vidéo est temporairement saturé (côté fournisseur). Réessaie dans quelques minutes. Tes crédits ne sont pas débités tant que tu n’as pas validé et enregistré la vidéo.";
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
