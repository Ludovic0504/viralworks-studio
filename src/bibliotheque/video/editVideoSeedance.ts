import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import { uploadImageFromUrl } from "@/bibliotheque/supabase/storage";

export interface EditVideoCallParams {
  prompt: string;
  videoBlob: Blob;
  avatarUrls: (string | null)[];
  refImageDataUrl: string | null;
  dialogueEnabled: boolean;
  resolution: "480p" | "720p";
  durationSec: number;
  aspectRatio: string;
}

export interface EditVideoSeedanceResult {
  taskId: string;
}

export type PollKieTaskResult = {
  status: "done" | "failed" | "pending";
  videoUrl?: string;
  error?: string;
};

type StudioApiAuth = {
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type SeedanceResponse = {
  status?: string;
  videoUrl?: string;
  taskId?: string;
  provider?: string;
  model?: string;
  error?: string;
  userMessage?: string;
  code?: string;
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
    throw new Error("Veuillez vous connecter pour générer la vidéo.");
  }

  return { accessToken, supabaseUrl, supabaseAnonKey };
}

function getEditVideoSeedanceUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/edit-video-seedance`;
}

function getPollKieTaskUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/poll-kie-task`;
}

async function uploadEditVideoBlob(
  videoBlob: Blob,
  userId: string,
): Promise<string> {
  const supabase = getBrowserSupabase();
  const path = `${userId}/edit-video/${Date.now()}.mp4`;

  console.log("[edit-video] blob size:", (videoBlob.size / 1024 / 1024).toFixed(2), "MB");

  const { error } = await supabase.storage.from("generated-images").upload(path, videoBlob, {
    contentType: "video/mp4",
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Upload vidéo impossible.");
  }

  const { data: pub } = supabase.storage.from("generated-images").getPublicUrl(path);
  const publicUrl = pub.publicUrl.startsWith("http://")
    ? pub.publicUrl.replace("http://", "https://")
    : pub.publicUrl;

  return publicUrl;
}

async function resolveRefImagePublicUrl(
  refImageDataUrl: string | null,
  userId: string,
): Promise<string | null> {
  if (!refImageDataUrl || !refImageDataUrl.trim()) return null;

  const trimmed = refImageDataUrl.trim();
  if (trimmed.startsWith("https://")) {
    return trimmed;
  }

  const upload = await uploadImageFromUrl(trimmed, userId);
  if (!upload.success || !upload.url) {
    throw new Error(upload.error || "Impossible de publier l'image de référence.");
  }

  return upload.url.startsWith("http://")
    ? upload.url.replace("http://", "https://")
    : upload.url;
}

type PollKieTaskResponse = {
  status?: string;
  videoUrl?: string;
  error?: string;
  userMessage?: string;
};

async function callEditVideoSeedanceApi(
  auth: StudioApiAuth,
  body: Record<string, unknown>,
): Promise<SeedanceResponse> {
  const res = await fetch(getEditVideoSeedanceUrl(auth.supabaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.accessToken}`,
      apikey: auth.supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const rawText = await res.clone().text();
  console.error("[edit-video-seedance] réponse brute :", res.status, rawText);

  const text = await res.text();
  let data: SeedanceResponse;
  try {
    data = JSON.parse(text) as SeedanceResponse;
  } catch {
    throw new Error(
      res.ok ? "Réponse serveur invalide" : `Erreur génération (${res.status})`,
    );
  }

  if (!res.ok) {
    throw new Error(data.error ?? data.userMessage ?? "Erreur serveur");
  }

  return data;
}

export async function pollKieTask(taskId: string): Promise<PollKieTaskResult> {
  const trimmed = typeof taskId === "string" ? taskId.trim() : "";
  if (!trimmed) {
    throw new Error("taskId manquant.");
  }

  const auth = await getStudioApiAuth();
  const res = await fetch(getPollKieTaskUrl(auth.supabaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.accessToken}`,
      apikey: auth.supabaseAnonKey,
    },
    body: JSON.stringify({ taskId: trimmed }),
  });

  const text = await res.text();
  let data: PollKieTaskResponse;
  try {
    data = JSON.parse(text) as PollKieTaskResponse;
  } catch {
    throw new Error(
      res.ok ? "Réponse serveur invalide" : `Erreur poll (${res.status})`,
    );
  }

  if (!res.ok) {
    throw new Error(data.error ?? data.userMessage ?? "Erreur serveur");
  }

  if (data.status === "done") {
    return { status: "done", videoUrl: data.videoUrl };
  }
  if (data.status === "failed") {
    return { status: "failed", error: data.error ?? "La génération a échoué." };
  }
  return { status: "pending" };
}

export async function editVideoSeedance(
  params: EditVideoCallParams,
): Promise<EditVideoSeedanceResult> {
  const prompt = typeof params.prompt === "string" ? params.prompt.trim() : "";
  if (!prompt) {
    throw new Error("Le prompt est requis.");
  }

  if (!(params.videoBlob instanceof Blob) || params.videoBlob.size === 0) {
    throw new Error("Extrait vidéo manquant.");
  }

  const auth = await getStudioApiAuth();

  const supabase = getBrowserSupabase();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    throw new Error("Veuillez vous connecter pour générer la vidéo.");
  }

  const videoUrl = await uploadEditVideoBlob(params.videoBlob, user.id);
  const refImageUrl = await resolveRefImagePublicUrl(
    params.refImageDataUrl,
    user.id,
  );

  const avatarUrls = Array.isArray(params.avatarUrls)
    ? params.avatarUrls.slice(0, 3).map((u) => (typeof u === "string" && u.trim() ? u.trim() : null))
    : [null, null, null];

  const resolution = params.resolution === "720p" ? "720p" : "480p";

  const result = await callEditVideoSeedanceApi(auth, {
    prompt,
    videoUrl,
    avatarUrls,
    refImageUrl,
    dialogueEnabled: params.dialogueEnabled === true,
    resolution,
    duration: Math.round(params.durationSec),
    aspectRatio: params.aspectRatio,
  });

  if (result.status !== "pending" || !result.taskId) {
    throw new Error(result.error ?? result.userMessage ?? "Impossible de lancer la génération.");
  }

  return { taskId: result.taskId };
}
