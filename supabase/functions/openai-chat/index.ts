// Edge Function Supabase pour appeler l'API OpenAI de manière sécurisée
// La clé API est stockée dans les variables d'environnement Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Vérifier l'authentification Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token d'authentification manquant" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Créer le client Supabase pour vérifier le JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 3. Vérifier que l'utilisateur est authentifié
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé. Veuillez vous connecter." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Récupérer la clé API OpenAI depuis les variables d'environnement Supabase
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.error("OPENAI_API_KEY non configurée dans Supabase");
      return new Response(
        JSON.stringify({
          error: "Configuration serveur manquante. Contactez l'administrateur.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Parser le corps de la requête
    const body: RequestBody = await req.json();
    const {
      messages,
      model = "gpt-4o-mini",
      temperature = 0.7,
      max_tokens = 1000,
      stream = false,
    } = body;

    /** Plafond complétion — aligné avec promptGenerationLimits (évite dérives longues / coût) */
    const OPENAI_MAX_COMPLETION_TOKENS = 1024;
    const clampedMaxTokens = Math.min(
      Math.max(16, max_tokens ?? 1000),
      OPENAI_MAX_COMPLETION_TOKENS
    );

    const MAX_MESSAGE_CHARS = 24000;
    for (const m of messages) {
      if (m.content && m.content.length > MAX_MESSAGE_CHARS) {
        return new Response(
          JSON.stringify({
            error: `Message trop long (max ${MAX_MESSAGE_CHARS} caractères par message).`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 6. Valider les messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Le champ 'messages' est requis et doit être un tableau non vide" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 7. Appeler l'API OpenAI
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: clampedMaxTokens,
          stream,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("Erreur API OpenAI:", openaiResponse.status, errorText);
      
      let errorMessage = `Erreur API OpenAI: ${openaiResponse.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        {
          status: openaiResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 8. Retourner la réponse
    const data = await openaiResponse.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erreur Edge Function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erreur serveur",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

