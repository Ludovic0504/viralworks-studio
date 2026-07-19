/**
 * Client pour appeler l'API ChatGPT via Supabase Edge Function
 * 
 * ARCHITECTURE :
 * Frontend → Supabase Edge Function → API OpenAI
 *           (JWT vérifié)          (clé sécurisée)
 * 
 * La clé API OpenAI est stockée dans Supabase (variables d'environnement)
 * et n'est JAMAIS exposée au client.
 */

import { getBrowserSupabase } from "../supabase/client-navigateur";

/** Partie de contenu multimodal (texte + image) pour Vision. */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

// Types pour les messages ChatGPT (texte seul ou multimodal)
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      role: "system" | "user" | "assistant";
      content: string | ChatContentPart[] | null;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function messageContentToText(content: string | ChatContentPart[] | null | undefined): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  return content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

export { messageContentToText };

/**
 * Récupère l'URL de la Edge Function Supabase
 */
function getEdgeFunctionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("VITE_SUPABASE_URL non configurée");
  }
  // Les Edge Functions sont accessibles via : https://[project-ref].supabase.co/functions/v1/[function-name]
  return `${supabaseUrl}/functions/v1/openai-chat`;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatCompletionResponse> {
  console.log("🚀 [chatCompletion] Début de l'appel à Supabase Edge Function");
  
  const supabase = getBrowserSupabase();
  
  // Récupérer le token d'authentification
  console.log("🔐 [chatCompletion] Vérification de la session...");
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error("❌ [chatCompletion] Erreur d'authentification:", sessionError);
    throw new Error("Vous devez être connecté pour utiliser ChatGPT");
  }
  console.log("✅ [chatCompletion] Session valide");

  const edgeFunctionUrl = getEdgeFunctionUrl();
  console.log("🌐 [chatCompletion] URL de la fonction:", edgeFunctionUrl);
  const {
    model = "gpt-4o-mini",
    temperature = 0.7,
    max_tokens = 480,
    stream = false,
  } = options;

  let response: Response;
  try {
    console.log("📡 [chatCompletion] Envoi de la requête à Supabase...");
    // Timeout de 60 secondes pour laisser le temps à OpenAI de répondre
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    try {
      response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          messages,
          model,
          temperature,
          max_tokens,
          stream,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      console.log("✅ [chatCompletion] Réponse reçue, status:", response.status);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error("❌ [chatCompletion] Erreur lors du fetch:", fetchError);
      // Si c'est une erreur d'abort (timeout), on relance une erreur spécifique
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        throw new Error("TIMEOUT_SUPABASE");
      }
      throw fetchError;
    }
  } catch (fetchError) {
    // Erreur réseau (CORS, réseau, URL incorrecte, timeout, etc.)
    console.error("❌ [chatCompletion] Erreur réseau lors de l'appel à la Edge Function:", fetchError);
    console.error("📍 [chatCompletion] URL appelée:", edgeFunctionUrl);
    console.error("🔧 [chatCompletion] Variables d'environnement:", {
      hasUrl: !!import.meta.env.VITE_SUPABASE_URL,
      hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      url: import.meta.env.VITE_SUPABASE_URL,
    });
    // Relancer l'erreur pour que le fallback puisse la gérer
    throw fetchError;
  }

  if (!response.ok) {
    console.error("❌ [chatCompletion] Réponse non-OK, status:", response.status, response.statusText);
    const errorText = await response.text().catch(() => "");
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: errorText || `Erreur HTTP ${response.status}` };
    }
    console.error("Erreur réponse Edge Function:", {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
      url: edgeFunctionUrl,
    });
    throw new Error(errorData.error || `Erreur ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Génère une réponse simple à partir d'un prompt utilisateur
 * Utilise Supabase Edge Function en priorité, avec fallback vers Netlify si nécessaire
 */
export async function generateResponse(
  userPrompt: string,
  systemPrompt?: string,
  options?: ChatCompletionOptions
): Promise<string> {
  console.log("🎯 [generateResponse] Début de la génération");
  console.log("📝 [generateResponse] Prompt utilisateur:", userPrompt.substring(0, 100) + "...");
  
  const messages: ChatMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({ role: "user", content: userPrompt });

  try {
    // Essayer d'abord avec Supabase Edge Function
    console.log("🔄 [generateResponse] Appel de chatCompletion...");
    const response = await chatCompletion(messages, options);
    console.log("✅ [generateResponse] Réponse reçue de Supabase");
    return messageContentToText(response.choices[0]?.message?.content);
  } catch (supabaseError) {
    console.error("❌ [generateResponse] Erreur capturée:", supabaseError);
    // Si Supabase échoue, essayer avec Netlify Function (fallback)
    const errorMessage = supabaseError instanceof Error ? supabaseError.message : String(supabaseError);
    
    // Ne pas faire de fallback si c'est une erreur d'authentification (utilisateur non connecté)
    if (errorMessage.includes("connecté") || errorMessage.includes("session") || errorMessage.includes("401")) {
      throw supabaseError; // Relancer l'erreur d'authentification
    }
    
    // Log détaillé de l'erreur Supabase
    console.error("❌ Supabase Edge Function a échoué:", {
      error: supabaseError,
      message: errorMessage,
      url: getEdgeFunctionUrl(),
      hasEnvUrl: !!import.meta.env.VITE_SUPABASE_URL,
      hasEnvKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
    });
    
    // Désactiver temporairement le fallback Netlify pour voir l'erreur Supabase
    // TODO: Réactiver le fallback une fois Supabase fonctionnel
    console.error("🚫 Fallback Netlify désactivé pour déboguer Supabase");
    throw new Error(`Erreur Supabase: ${errorMessage}. Vérifiez la console pour plus de détails.`);
    
    // NOTE: Le fallback Netlify est temporairement désactivé pour déboguer Supabase
    // Pour le réactiver, décommentez le code ci-dessous dans le fichier source
  }
}

/**
 * Teste la connexion à l'API via Supabase
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await generateResponse("test", undefined, { max_tokens: 5 });
    return { success: !!result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur de connexion",
    };
  }
}


