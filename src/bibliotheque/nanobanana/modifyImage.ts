/**
 * Édition d’image (Visuel d’accroche) — Edge Function Supabase `gemini-image-edit`.
 * Côté serveur : en priorité **Kie AI** (Nano Banana Pro) si le secret `KIE_AI_API_KEY` est défini,
 * sinon repli sur **Gemini** direct si une clé Google est configurée.
 */

export const IMAGE_EDIT_BUSY_MESSAGE =
  "Les serveurs sont saturés, réessaye dans quelques instants.";

const KIE_CREDITS_HINT_FR =
  "Crédits Kie AI insuffisants sur ton compte Kie (kie.ai). Recharge ton solde puis réessaie.";

export type GeminiImageEditAuth = {
  accessToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type ErrorBody = {
  url?: string;
  error?: string;
  userMessage?: string;
  code?: string;
  details?: unknown;
  provider?: string;
  model?: string;
  taskId?: string;
};

function looksLikeKieCreditsMessage(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /credits?\s+insufficient|insufficient\s+credit|not\s+enough\s+to\s+run|your\s+current\s+balance|top\s*up\s+to\s+continue/.test(
      t,
    )
  );
}

function pickUserFacingMessage(
  response: Response,
  data: ErrorBody | null,
  rawText: string
): string {
  const st = response.status;
  const code = data?.code ?? "";

  /**
   * Les erreurs 402 remontent parfois sans JSON (ou avec un body vide) depuis
   * l’Edge Function. Dans ce cas on doit guider vers le rechargement Kie,
   * et permettre au client de déclencher un fallback automatique.
   */
  if (st === 402) {
    return KIE_CREDITS_HINT_FR;
  }

  if (
    looksLikeKieCreditsMessage(rawText) ||
    code === "KIE_CREDITS" ||
    looksLikeKieCreditsMessage(data?.error ?? "")
  ) {
    return KIE_CREDITS_HINT_FR;
  }

  /** Avant le fallback « saturation », laisser passer config / validation explicites. */
  if (code === "NO_EDIT_PROVIDER" || code === "BAD_IMAGE_INPUT") {
    return data?.userMessage || data?.error || IMAGE_EDIT_BUSY_MESSAGE;
  }

  if (data?.userMessage) return data.userMessage;

  if (st === 504 || st === 503 || st === 502 || st === 429 || st === 408) {
    return IMAGE_EDIT_BUSY_MESSAGE;
  }

  if (data?.error) {
    if (
      code.startsWith("KIE_") ||
      code.startsWith("GEMINI_") ||
      code === "INTERNAL_ERROR"
    ) {
      return data.error;
    }
    /* Anciennes réponses 500 sans `code` (ex. secrets manquants) : message long = explicite */
    if (st === 500 && data.error.length > 100) {
      return data.error;
    }
    if (st >= 500) return IMAGE_EDIT_BUSY_MESSAGE;
    return data.error;
  }

  if (st >= 500) return IMAGE_EDIT_BUSY_MESSAGE;
  return rawText.trim().slice(0, 280) || IMAGE_EDIT_BUSY_MESSAGE;
}

export async function modifyImageWithNanoBanana(
  imageUrl: string,
  userMessage: string,
  auth: GeminiImageEditAuth
): Promise<string | null> {
  const { accessToken, supabaseUrl, supabaseAnonKey } = auth;
  if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
    throw new Error("Connexion ou configuration Supabase manquante pour l’édition d’image.");
  }

  const functionUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/gemini-image-edit`;

  let response: Response;
  try {
    response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        imageUrl,
        instruction: userMessage,
      }),
    });
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(IMAGE_EDIT_BUSY_MESSAGE);
    }
    throw e;
  }

  const text = await response.text();
  let data: ErrorBody;
  try {
    data = JSON.parse(text) as ErrorBody;
  } catch {
    if (!response.ok && response.status === 402) {
      throw new Error(KIE_CREDITS_HINT_FR);
    }
    if (!response.ok && (response.status === 504 || response.status >= 502)) {
      throw new Error(IMAGE_EDIT_BUSY_MESSAGE);
    }
    throw new Error(
      response.ok
        ? "Réponse serveur invalide"
        : pickUserFacingMessage(response, null, text)
    );
  }

  if (!response.ok) {
    throw new Error(pickUserFacingMessage(response, data, text));
  }

  if (import.meta.env.DEV && data.provider) {
    console.info(
      "[Visuel d’accroche · édition]",
      `fournisseur=${data.provider}`,
      data.model ? `modèle=${data.model}` : "",
      data.taskId ? `taskId=${data.taskId}` : ""
    );
  }

  const url = typeof data.url === "string" && data.url.length > 0 ? data.url : null;
  return url;
}
