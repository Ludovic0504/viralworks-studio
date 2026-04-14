// Edge Function Supabase pour proxy d'images (contourne CORS)
// Télécharge les images depuis des URLs externes et les sert avec les bons headers CORS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=31536000, immutable",
};

serve(async (req) => {
  // Gérer les requêtes OPTIONS pour CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Récupérer l'URL de l'image depuis les paramètres de requête
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "Paramètre 'url' manquant" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Décoder l'URL si elle est encodée
    let decodedUrl: string;
    try {
      decodedUrl = decodeURIComponent(imageUrl);
    } catch {
      decodedUrl = imageUrl;
    }

    // Convertir HTTP en HTTPS si nécessaire
    if (decodedUrl.startsWith("http://")) {
      decodedUrl = decodedUrl.replace("http://", "https://");
    }

    // Validation de sécurité : n'autoriser que les URLs Hailuo ou Supabase
    const isHailuoUrl = decodedUrl.includes("hailuo-image") || decodedUrl.includes("aliyuncs.com");
    const isSupabaseUrl = decodedUrl.includes("supabase.co") || decodedUrl.includes("supabase");
    
    if (!isHailuoUrl && !isSupabaseUrl) {
      console.error("❌ URL non autorisée:", decodedUrl);
      return new Response(
        JSON.stringify({ error: "URL non autorisée. Seules les URLs Hailuo et Supabase sont acceptées." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("📥 Proxy image:", decodedUrl);

    // Télécharger l'image depuis l'URL externe
    const imageResponse = await fetch(decodedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://hailuo-image-algeng-data-us.oss-us-east-1.aliyuncs.com/",
      },
    });

    if (!imageResponse.ok) {
      console.error("❌ Erreur téléchargement image:", imageResponse.status, imageResponse.statusText);
      
      // Si c'est une erreur 403 ou 404, l'URL a probablement expiré
      if (imageResponse.status === 403 || imageResponse.status === 404) {
        console.error("⚠️ URL expirée ou non disponible:", decodedUrl);
        
        // Retourner une image SVG d'erreur avec les bons headers
        // Status 200 pour que l'image s'affiche dans la galerie
        const svgError = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#1f2937"/>
  <text x="50%" y="45%" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#9ca3af" font-weight="bold">
    Image expirée
  </text>
  <text x="50%" y="60%" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">
    L'URL Hailuo a expiré
  </text>
  <text x="50%" y="72%" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#4b5563">
    Les nouvelles images sont stockées sur Supabase
  </text>
</svg>`;
        
        return new Response(svgError, {
          status: 200, // Status 200 pour que l'image s'affiche (même si c'est un placeholder)
          headers: {
            ...corsHeaders,
            "Content-Type": "image/svg+xml",
            "Cache-Control": "no-cache",
          },
        });
      }
      
      // Pour les autres erreurs, retourner une image d'erreur aussi
      const svgError = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="300" fill="#1f2937"/>
  <text x="50%" y="50%" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#9ca3af">
    Erreur ${imageResponse.status}: ${imageResponse.statusText}
  </text>
</svg>`;
      
      return new Response(svgError, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/svg+xml",
          "Cache-Control": "no-cache",
        },
      });
    }

    // Récupérer le type de contenu de l'image
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const imageData = await imageResponse.arrayBuffer();

    console.log("✅ Image téléchargée, taille:", imageData.byteLength, "bytes, type:", contentType);

    // Retourner l'image avec les bons headers CORS
    return new Response(imageData, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Length": imageData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("❌ Erreur proxy image:", error);
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
