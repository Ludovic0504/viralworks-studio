/**
 * Client Claude via Edge Supabase `anthropic-messages` (clé Anthropic côté serveur uniquement).
 */
import { getBrowserSupabase } from "../supabase/client-navigateur";

function getEdgeFunctionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("VITE_SUPABASE_URL non configurée");
  return `${String(supabaseUrl).trim()}/functions/v1/anthropic-messages`;
}

export type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AnthropicMessagesOptions = {
  system?: string;
  messages: AnthropicMessage[];
  model?: string;
  max_tokens?: number;
};

/**
 * Retourne le texte assistant (premier bloc texte de la réponse Claude).
 */
export async function anthropicMessages(options: AnthropicMessagesOptions): Promise<string> {
  const supabase = getBrowserSupabase();
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Vous devez être connecté pour utiliser Claude");
  }

  const edgeFunctionUrl = getEdgeFunctionUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  let response: Response;
  try {
    response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({
        system: options.system,
        messages: options.messages,
        model: options.model,
        max_tokens: options.max_tokens ?? 1024,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  let data: { content?: string; error?: string } = {};
  try {
    data = text ? (JSON.parse(text) as { content?: string; error?: string }) : {};
  } catch {
    data = { error: text || `Erreur HTTP ${response.status}` };
  }

  if (!response.ok) {
    throw new Error(data.error || `Erreur ${response.status}`);
  }

  return String(data.content ?? "").trim();
}
