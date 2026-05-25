// Edge Function Supabase pour la génération d'images via l'API MiniMax Image-01 (Hailuo)
// La clé API est stockée dans les variables d'environnement Supabase

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  prompt: string;
  ratio?: string;
  quantity?: number;
  model?: string;
  refCharacter?: string; // Base64 data URL de l'image de référence
  /** Références ordonnées (ex. avatar puis produit) — prioritaire sur refCharacter si non vide */
  subjectReferences?: string[];
}

async function resolveReferenceImageUrl(
  refInput: string,
  userId: string,
  supabaseAdmin: ReturnType<typeof createClient> | null
): Promise<string | null> {
  const refCharacter = String(refInput || "").trim();
  if (!refCharacter) return null;

  try {
    if (refCharacter.startsWith("http://") || refCharacter.startsWith("https://")) {
      return refCharacter.startsWith("http://")
        ? refCharacter.replace("http://", "https://")
        : refCharacter;
    }

    if (!supabaseAdmin) {
      console.warn("SERVICE_ROLE_KEY non configurée, impossible d'uploader l'image de référence");
      return null;
    }

    let base64Data = refCharacter;
    let mimeType = "image/png";

    if (refCharacter.startsWith("data:")) {
      const mimeMatch = refCharacter.match(/data:([^;]+);base64,(.+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
        base64Data = mimeMatch[2];
      }
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const ext = mimeType.includes("jpeg") || mimeType.includes("jpg")
      ? "jpg"
      : mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
      ? "webp"
      : "png";

    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

    console.log(`Upload de l'image de référence vers Storage: ${fileName}`);
    const { error: uploadError } = await supabaseAdmin.storage
      .from("image-references")
      .upload(fileName, bytes, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Erreur upload image de référence:", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("image-references")
      .getPublicUrl(fileName);

    console.log(`Image de référence uploadée avec succès: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error("Erreur lors du traitement de l'image de référence:", err);
    return null;
  }
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

    // 4. Créer le client admin pour uploader vers Storage (si nécessaire)
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");
    const supabaseAdmin = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      : null;

    // 5. Récupérer la clé API MiniMax depuis les variables d'environnement Supabase
    // Essayer plusieurs noms possibles pour la clé API (avec et sans caractères spéciaux)
    const env = Deno.env.toObject();
    console.log("🔍 Recherche de la clé API dans les variables d'environnement...");
    console.log("📋 Toutes les variables d'environnement:", Object.keys(env));
    
    let minimaxApiKey = env["CléAPI_Hailuo_Image"] 
      || env["CleAPI_Hailuo_Image"]  // Sans accent
      || env["MINIMAX_API_KEY"] 
      || env["HAILUO_API_KEY"]
      || env["HAILUO_IMAGE_API_KEY"]
      || Deno.env.get("CléAPI_Hailuo_Image")
      || Deno.env.get("MINIMAX_API_KEY")
      || Deno.env.get("HAILUO_API_KEY");
    
    // Nettoyer la clé (enlever les espaces avant/après)
    if (minimaxApiKey) {
      minimaxApiKey = minimaxApiKey.trim();
    }
    
    // Log pour debug (sans afficher la clé complète pour la sécurité)
    if (minimaxApiKey) {
      console.log("✅ Clé API MiniMax trouvée:", minimaxApiKey.substring(0, 10) + "...", "Longueur:", minimaxApiKey.length);
    } else {
      console.error("❌ Clé API non configurée dans Supabase");
      const allEnvKeys = Object.keys(env);
      console.error("Variables d'environnement disponibles (filtre API/HAILUO/MINIMAX/Image):", allEnvKeys.filter(k => 
        k.toUpperCase().includes("API") || 
        k.toUpperCase().includes("HAILUO") || 
        k.toUpperCase().includes("MINIMAX") || 
        k.toUpperCase().includes("IMAGE") ||
        k.includes("Clé") ||
        k.includes("Cle")
      ));
    }
    
    if (!minimaxApiKey || minimaxApiKey.length === 0) {
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

    // 6. Parser le corps de la requête
    let body: RequestBody;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("Erreur parsing JSON:", parseError);
      return new Response(
        JSON.stringify({ error: "Corps de requête invalide (JSON attendu)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const {
      prompt,
      ratio = "16:9",
      quantity = 1,
      model = "image-01",
      refCharacter,
      subjectReferences,
    } = body;

    // 7. Valider le prompt
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: "Le prompt est requis et doit être une chaîne non vide.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 7.1. Limiter le prompt à 1500 caractères maximum (limite de l'API MiniMax)
    const trimmedPrompt = prompt.trim();
    const MAX_PROMPT_LENGTH = 1500;
    let finalPrompt = trimmedPrompt;
    if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
      finalPrompt = trimmedPrompt.substring(0, MAX_PROMPT_LENGTH);
      console.log(`⚠️ Prompt tronqué de ${trimmedPrompt.length} à ${MAX_PROMPT_LENGTH} caractères`);
    }

    // 8. Limiter la quantité à 9 images maximum (limite de l'API MiniMax)
    const numImages = Math.min(Math.max(1, parseInt(String(quantity)) || 1), 9);

    // 9. Mapper les ratios aux formats supportés par MiniMax
    // MiniMax supporte: "1:1", "16:9", "4:3", "3:2", "2:3", "3:4", "9:16", "21:9"
    const ratioMap: Record<string, string> = {
      "16:9": "16:9",
      "1:1": "1:1",
      "9:16": "9:16",
      "4:5": "4:3", // Approximation pour 4:5
      "4:3": "4:3",
      "3:2": "3:2",
      "2:3": "2:3",
      "3:4": "3:4",
      "21:9": "21:9",
    };
    const aspectRatio = ratioMap[ratio] || "16:9";

    // 10. Préparer le body de la requête MiniMax
    const requestBody: any = {
      model: model === "Image-01" ? "image-01" : model,
      prompt: finalPrompt,
      aspect_ratio: aspectRatio,
      response_format: "url",
      n: numImages,
      prompt_optimizer: true, // Optimisation automatique du prompt
    };

    // 11. Gérer les images de référence (tableau ordonné ou refCharacter legacy)
    const subjectRefInputs = Array.isArray(subjectReferences)
      ? subjectReferences.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : [];

    if (subjectRefInputs.length > 0) {
      const primaryRefInput = subjectRefInputs[0];
      const referenceImageUrl = await resolveReferenceImageUrl(
        primaryRefInput,
        user.id,
        supabaseAdmin
      );
      if (referenceImageUrl) {
        requestBody.subject_reference = [
          {
            type: "character",
            image_file: referenceImageUrl,
          },
        ];
        console.log("Image de référence ajoutée à la requête MiniMax");
      }
    } else if (refCharacter) {
      const referenceImageUrl = await resolveReferenceImageUrl(
        refCharacter,
        user.id,
        supabaseAdmin
      );
      if (referenceImageUrl) {
        requestBody.subject_reference = [
          {
            type: "character",
            image_file: referenceImageUrl,
          },
        ];
        console.log("Image de référence ajoutée à la requête MiniMax");
      }
    }

    // 12. Appeler l'API MiniMax
    console.log("Appel API MiniMax avec:", {
      model: requestBody.model,
      aspect_ratio: requestBody.aspect_ratio,
      n: requestBody.n,
      hasApiKey: !!minimaxApiKey,
      apiKeyPrefix: minimaxApiKey ? minimaxApiKey.substring(0, 10) + "..." : "N/A",
    });

    let minimaxResponse: Response;
    try {
      // Vérifier que la clé est bien présente avant l'appel
      if (!minimaxApiKey || minimaxApiKey.trim().length === 0) {
        throw new Error("Clé API MiniMax vide ou non définie");
      }
      
      const authHeader = `Bearer ${minimaxApiKey.trim()}`;
      const headers = {
        "Content-Type": "application/json",
        Authorization: authHeader,
      };
      
      console.log("📤 Headers envoyés à MiniMax:", {
        "Content-Type": headers["Content-Type"],
        "Authorization": `Bearer ${minimaxApiKey.substring(0, 10)}... (longueur: ${minimaxApiKey.length})`,
        "URL": "https://api.minimax.io/v1/image_generation",
      });
      
      minimaxResponse = await fetch(
        "https://api.minimax.io/v1/image_generation",
        {
          method: "POST",
          headers: headers,
          body: JSON.stringify(requestBody),
        }
      );
    } catch (fetchError) {
      console.error("Erreur réseau lors de l'appel à MiniMax:", fetchError);
      return new Response(
        JSON.stringify({
          error: "Erreur de connexion à l'API MiniMax. Veuillez réessayer.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!minimaxResponse.ok) {
      let errorText = "";
      try {
        errorText = await minimaxResponse.text();
      } catch (textError) {
        console.error("Erreur lors de la lecture de la réponse d'erreur:", textError);
        errorText = `Erreur HTTP ${minimaxResponse.status}`;
      }

      console.error("Erreur API MiniMax:", minimaxResponse.status, errorText);

      let errorMessage = `Erreur API MiniMax: ${minimaxResponse.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage =
          errorData.base_resp?.status_msg ||
          errorData.error?.message ||
          errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: minimaxResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 13. Parser la réponse MiniMax
    let minimaxData: any;
    try {
      minimaxData = await minimaxResponse.json();
      console.log("✅ Réponse complète MiniMax:", JSON.stringify(minimaxData, null, 2));
    } catch (jsonError) {
      console.error("Erreur lors du parsing de la réponse MiniMax:", jsonError);
      return new Response(
        JSON.stringify({
          error: "Réponse invalide de l'API MiniMax",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Vérifier si MiniMax a retourné une erreur dans base_resp (même avec status 200)
    if (minimaxData.base_resp) {
      const statusCode = minimaxData.base_resp.status_code;
      const statusMsg = minimaxData.base_resp.status_msg;
      
      if (statusCode !== 0 && statusCode !== undefined) {
        console.error("❌ Erreur MiniMax dans base_resp:", statusCode, statusMsg);
        return new Response(
          JSON.stringify({
            error: statusMsg || `Erreur API MiniMax (code: ${statusCode})`,
            details: minimaxData,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // 14. Extraire les URLs des images
    const imageUrls: string[] = [];
    
    // Vérifier différents formats de réponse possibles
    if (minimaxData.data?.image_urls && Array.isArray(minimaxData.data.image_urls)) {
      imageUrls.push(...minimaxData.data.image_urls);
    } else if (minimaxData.image_urls && Array.isArray(minimaxData.image_urls)) {
      imageUrls.push(...minimaxData.image_urls);
    } else if (minimaxData.data && Array.isArray(minimaxData.data)) {
      // Format alternatif où data est directement un tableau
      minimaxData.data.forEach((item: any) => {
        if (item.url) imageUrls.push(item.url);
        if (item.image_url) imageUrls.push(item.image_url);
      });
    }
    
    console.log("📸 URLs d'images extraites:", imageUrls);

    if (imageUrls.length === 0) {
      console.error("❌ Aucune URL d'image trouvée dans la réponse. Structure complète:", JSON.stringify(minimaxData, null, 2));
      
      // Vérifier s'il y a un message d'erreur dans metadata
      const errorMsg = minimaxData.metadata?.failed_count 
        ? `Génération échouée (${minimaxData.metadata.failed_count} échec(s))`
        : "Aucune image retournée par l'API MiniMax";
      
      return new Response(
        JSON.stringify({
          error: errorMsg,
          details: minimaxData,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 15. Retourner la réponse au format attendu par le frontend
    return new Response(
      JSON.stringify({
        urls: imageUrls,
        count: imageUrls.length,
        model: model,
        ratio: ratio,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erreur Edge Function:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Erreur serveur",
        details: process.env.NODE_ENV === "development" ? String(error) : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
