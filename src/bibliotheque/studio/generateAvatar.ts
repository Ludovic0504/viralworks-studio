import type { AvatarConfig, OutputFormat } from "@/bibliotheque/studio/avatarOptions";
import { AVATAR_ENVIRONMENT, DEFAULT_AVATAR_CONFIG } from "@/bibliotheque/studio/avatarOptions";
import { buildPromptFace, buildPromptTriptyque } from "@/bibliotheque/studio/buildAvatarPrompt";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

export interface GenerateAvatarRequest {
  config: Partial<AvatarConfig>;
  format: OutputFormat;
  referenceImageUrl?: string;
}

export interface GenerateAvatarResponse {
  avatarUrl: string;
  format: OutputFormat;
  jobId: string;
  creditsUsed: number;
}

type StudioApiAuth = {
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type CreateResponse = {
  status?: string;
  taskId?: string;
  avatarUrl?: string;
  jobId?: string;
  format?: OutputFormat;
  creditsUsed?: number;
  provider?: string;
  error?: string;
};

type PollResponse = {
  status: "pending" | "completed" | "failed";
  avatarUrl?: string;
  error?: string;
};

async function getStudioApiAuth(): Promise<StudioApiAuth> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configuration Supabase manquante");
  }

  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("Veuillez vous connecter pour générer un avatar.");
  }

  return { accessToken, supabaseUrl, supabaseAnonKey };
}

function getFunctionUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/studio-generate-avatar`;
}

function buildPromptForFormat(config: AvatarConfig, format: OutputFormat): string {
  if (format === "face") {
    return buildPromptFace(config);
  }
  return buildPromptTriptyque(config);
}

async function callStudioAvatarApi<T>(
  auth: StudioApiAuth,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(getFunctionUrl(auth.supabaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.accessToken}`,
      apikey: auth.supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: T & { error?: string };
  try {
    data = JSON.parse(text) as T & { error?: string };
  } catch {
    throw new Error(
      res.ok ? "Réponse serveur invalide" : `Erreur génération (${res.status})`
    );
  }

  if (!res.ok) {
    throw new Error(
      (data as { error?: string })?.error || `Erreur génération (${res.status})`
    );
  }

  return data;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntilCompleted(
  auth: StudioApiAuth,
  taskId: string
): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const poll = await callStudioAvatarApi<PollResponse>(auth, {
      action: "poll",
      taskId,
    });

    if (poll.status === "completed" && poll.avatarUrl) {
      return poll.avatarUrl;
    }

    if (poll.status === "failed") {
      throw new Error(poll.error || "La génération a échoué.");
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    "Délai dépassé (120 s). La génération prend plus de temps que prévu — réessayez."
  );
}

export async function generateAvatar(
  payload: GenerateAvatarRequest
): Promise<GenerateAvatarResponse> {
  const config = { ...DEFAULT_AVATAR_CONFIG, ...payload.config } as AvatarConfig;
  const format = payload.format;
  const prompt = buildPromptForFormat(config, format);

  if (import.meta.env.DEV) {
    if (format === "face") {
      console.log("[studio/avatar] prompt face:", prompt);
    } else {
      console.log("[studio/avatar] prompt triptyque:", prompt);
    }
  }

  const auth = await getStudioApiAuth();

  const create = await callStudioAvatarApi<CreateResponse>(auth, {
    action: "create",
    prompt,
    format,
    referenceImageUrl: payload.referenceImageUrl,
    ratio: format === "triptyque" ? "16:9" : "9:16",
    config: { ...config, environment: AVATAR_ENVIRONMENT },
  });

  if (create.status === "completed" && create.avatarUrl) {
    return {
      avatarUrl: create.avatarUrl,
      format,
      jobId: create.jobId || `sync-${Date.now()}`,
      creditsUsed: create.creditsUsed ?? (format === "triptyque" ? 4 : 2),
    };
  }

  if (!create.taskId) {
    throw new Error(create.error || "Impossible de démarrer la génération.");
  }

  const avatarUrl = await pollUntilCompleted(auth, create.taskId);

  return {
    avatarUrl,
    format,
    jobId: create.taskId,
    creditsUsed: create.creditsUsed ?? (format === "triptyque" ? 4 : 2),
  };
}
