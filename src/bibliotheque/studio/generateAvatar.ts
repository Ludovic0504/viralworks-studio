import type { AvatarConfig } from "@/bibliotheque/studio/avatarOptions";
import { AVATAR_ENVIRONMENT, DEFAULT_AVATAR_CONFIG } from "@/bibliotheque/studio/avatarOptions";
import { persistGeneratedAvatar } from "@/bibliotheque/studio/studioAvatars";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

export interface GenerateAvatarRequest {
  config: Partial<AvatarConfig>;
}

export interface GenerateAvatarResponse {
  avatarUrl: string;
  format: "character_sheet";
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
  avatarUrl?: string;
  jobId?: string;
  format?: "character_sheet";
  creditsUsed?: number;
  provider?: string;
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

function buildCharacterSheetPrompt(config: AvatarConfig): string {
  const promptPayload = {
    prompt_parameters: {
      subject: {
        gender: config.genre,
        age: config.age,
        skin_tone: config.carnation,
        morphology: config.morphologie,
      },
      wardrobe: {
        style: config.styleTenue,
        dominant_color: config.couleurDominante,
        profession_accessories: config.accessoires,
      },
      profession: config.metier,
      layout_requirements: {
        format:
          "professional studio photography reference sheet, real photograph, not 3D, not illustrated, not cartoon, not CGI, photorealistic human being, 3 views of the same real person on white background",
        full_body_angles: ["front profile", "side profile", "back profile"],
        facial_portraits: ["front face", "3/4 view", "side profile"],
      },
      environment: {
        background_color: "pure white",
        backdrop_type: "seamless studio backdrop",
        shadows: "none",
      },
      technical_specifications: {
        style: "ultra-realistic photography",
        lighting: "crisp studio lighting",
        focus: "sharp focus",
        details: "highly detailed skin texture",
        resolution: "high",
        render_quality: "cinematic and photorealistic",
        rendering:
          "real photography only, film camera, no 3D rendering, no illustration, no digital art",
      },
    },
  };

  return JSON.stringify(promptPayload);
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

export async function generateAvatar(
  payload: GenerateAvatarRequest
): Promise<GenerateAvatarResponse> {
  const config = { ...DEFAULT_AVATAR_CONFIG, ...payload.config } as AvatarConfig;
  const prompt = buildCharacterSheetPrompt(config);

  if (import.meta.env.DEV) {
    console.log("[studio/avatar] character_sheet payload:", prompt);
  }

  const auth = await getStudioApiAuth();

  const create = await callStudioAvatarApi<CreateResponse>(auth, {
    action: "create",
    prompt,
    config: { ...config, environment: AVATAR_ENVIRONMENT },
  });

  if (create.status !== "completed" || !create.avatarUrl) {
    throw new Error(create.error || "Impossible de générer l'avatar.");
  }

  const persistedUrl = await persistGeneratedAvatar(create.avatarUrl, config);

  return {
    avatarUrl: persistedUrl,
    format: "character_sheet",
    jobId: create.jobId || `sync-${Date.now()}`,
    creditsUsed: create.creditsUsed ?? 4,
  };
}
