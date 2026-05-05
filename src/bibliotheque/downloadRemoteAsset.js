import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

export function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

/** Prévisualisation locale après concat FFmpeg (pipeline 24 s). */
export function isBlobUrl(value) {
  return String(value || "").trim().toLowerCase().startsWith("blob:");
}

export function isVideoPlayerUrl(value) {
  return isHttpUrl(value) || isBlobUrl(value);
}

/**
 * Télécharge une ressource HTTP via le proxy Supabase (auth + CORS).
 * @param {string} url
 * @param {string} fileName
 */
export async function downloadUrlFile(url, fileName) {
  const href = String(url || "").trim();
  if (!href) return;
  try {
    const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
    const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Configuration Supabase manquante");
    }
    const supabase = getBrowserSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const proxied = `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(
      href
    )}&download=1&filename=${encodeURIComponent(fileName)}`;
    const response = await fetch(proxied, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Proxy HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Téléchargement impossible:", err);
    alert(
      "Impossible de lancer un téléchargement direct pour cette vidéo. Vérifie la validité du lien puis réessaie."
    );
  }
}
