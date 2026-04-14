import { getBrowserSupabase } from "./client-navigateur";

let generatedImagesBucketExistsCache: boolean | null = null;
let hasLoggedMissingGeneratedImagesBucket = false;
let hasLoggedUploadCancelledMissingBucket = false;

function isMissingBucketError(message: string): boolean {
  const m = String(message || "").toLowerCase();
  return m.includes("bucket") && (m.includes("not found") || m.includes("n'existe pas"));
}

function isSignedUrlExpired(url: string): boolean {
  try {
    const parsed = new URL(url);
    const expiresRaw = parsed.searchParams.get("Expires");
    if (!expiresRaw) return false;
    const expires = Number(expiresRaw);
    if (!Number.isFinite(expires)) return false;
    return Date.now() >= expires * 1000;
  } catch {
    return false;
  }
}

function buildFetchableImageUrl(imageUrl: string): string {
  const secureImageUrl = imageUrl.startsWith("http://")
    ? imageUrl.replace("http://", "https://")
    : imageUrl;

  const isHailuoUrl =
    secureImageUrl.includes("hailuo-image") || secureImageUrl.includes("aliyuncs.com");
  if (!isHailuoUrl) return secureImageUrl;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) return secureImageUrl;

  const encodedUrl = encodeURIComponent(secureImageUrl);
  return `${supabaseUrl}/functions/v1/image-proxy?url=${encodedUrl}`;
}

export async function uploadImageFromUrl(
  imageUrl: string,
  userId: string,
  prompt?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user || user.id !== userId) {
    console.error("❌ Upload image: Non autorisé", { userErr, userId, user: user?.id });
    return { success: false, error: "Non autorisé" };
  }

  try {
    const secureImageUrl = imageUrl.startsWith("http://")
      ? imageUrl.replace("http://", "https://")
      : imageUrl;
    if (secureImageUrl !== imageUrl) {
      console.log("🔒 Conversion HTTP → HTTPS:", imageUrl, "→", secureImageUrl);
    }

    const fetchUrl = buildFetchableImageUrl(secureImageUrl);

    if (isSignedUrlExpired(secureImageUrl)) {
      const msg = "URL image expirée (signature dépassée)";
      console.warn("⚠️", msg, secureImageUrl);
      return { success: false, error: msg };
    }
    
    console.log("📥 Téléchargement de l'image depuis:", fetchUrl);
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      const errorMsg = `Erreur téléchargement image: ${response.status} ${response.statusText}`;
      console.error("❌", errorMsg);
      return { success: false, error: errorMsg };
    }

    const blob = await response.blob();
    if (blob.type === "image/svg+xml") {
      const msg = "Image source expirée ou indisponible (placeholder SVG)";
      console.warn("⚠️", msg);
      return { success: false, error: msg };
    }
    console.log("✅ Image téléchargée, taille:", blob.size, "bytes, type:", blob.type);
    
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const contentType = blob.type || "image/png";
    const ext = contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
      ? "webp"
      : "png";

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const fileName = `${user.id}/${timestamp}-${random}.${ext}`;
    const filePath = fileName;

    console.log("📤 Upload vers Supabase Storage:", filePath);
    const { error: uploadError, data } = await supabase.storage
      .from("generated-images")
      .upload(filePath, uint8Array, {
        contentType: contentType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      const uploadMsg = uploadError.message || "Erreur lors de l'upload";
      if (isMissingBucketError(uploadMsg)) {
        generatedImagesBucketExistsCache = false;
        if (!hasLoggedMissingGeneratedImagesBucket) {
          hasLoggedMissingGeneratedImagesBucket = true;
          console.warn("⚠️ Le bucket 'generated-images' est introuvable pour l'upload.");
          console.info("📝 Vérifie le projet Supabase ciblé et la migration create_generated_images_bucket.");
        }
      } else {
        console.error("❌ Erreur upload image:", uploadError);
      }
      return { success: false, error: uploadMsg };
    }

    console.log("✅ Image uploadée avec succès:", data?.path);

    const { data: { publicUrl } } = supabase.storage
      .from("generated-images")
      .getPublicUrl(filePath);

    console.log("✅ URL publique générée:", publicUrl);
    return { success: true, url: publicUrl };
  } catch (err) {
    console.error("❌ Erreur upload image depuis URL:", err);
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}

export async function uploadImagesFromUrls(
  imageUrls: string[],
  userId: string,
  prompt?: string
): Promise<{ success: boolean; urls?: string[]; errors?: string[] }> {
  console.log(`📤 Upload de ${imageUrls.length} image(s) vers Supabase Storage...`);

  if (generatedImagesBucketExistsCache === false) {
    const msg = "Le bucket 'generated-images' n'existe pas (ou projet Supabase incorrect).";
    if (!hasLoggedUploadCancelledMissingBucket) {
      hasLoggedUploadCancelledMissingBucket = true;
      console.warn("⚠️ Upload annulé:", msg);
    }
    return {
      success: false,
      urls: [...imageUrls],
      errors: [msg],
    };
  }
  
  const results = await Promise.allSettled(
    imageUrls.map((url, index) => {
      console.log(`📤 Upload image ${index + 1}/${imageUrls.length}...`);
      return uploadImageFromUrl(url, userId, prompt);
    })
  );

  const uploadedUrls: string[] = [];
  const errors: string[] = [];
  let successCount = 0;

  results.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.success && result.value.url) {
      uploadedUrls.push(result.value.url);
      successCount++;
      console.log(`✅ Image ${index + 1} uploadée avec succès`);
    } else {
      const error = result.status === "fulfilled" 
        ? result.value.error || "Erreur inconnue"
        : result.reason?.message || "Erreur inconnue";
      errors.push(`Image ${index + 1}: ${error}`);
      console.error(`❌ Échec upload image ${index + 1}:`, error);
      uploadedUrls.push(imageUrls[index]);
    }
  });

  console.log(`📊 Résultat: ${successCount}/${imageUrls.length} image(s) uploadée(s) avec succès`);
  if (errors.length > 0) {
    console.warn("⚠️ Erreurs:", errors);
  }

  return {
    success: successCount > 0,
    urls: uploadedUrls,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function ensureGeneratedImagesBucketAvailable(): Promise<boolean> {
  return generatedImagesBucketExistsCache !== false;
}

export async function getUserImagesFromStorage(
  userId: string
): Promise<{ success: boolean; images?: Array<{ path: string; url: string; created_at: string }>; error?: string }> {
  const supabase = getBrowserSupabase();

  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user || user.id !== userId) {
    return { success: false, error: "Non autorisé" };
  }

  try {
    const { data: files, error } = await supabase.storage
      .from("generated-images")
      .list(`${user.id}/`, {
        limit: 1000,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("❌ Erreur lors de la récupération des images:", error);
      return { success: false, error: error.message };
    }

    if (!files || files.length === 0) {
      return { success: true, images: [] };
    }

    const images = files.map((file) => {
      const filePath = `${user.id}/${file.name}`;
      const { data: { publicUrl } } = supabase.storage
        .from("generated-images")
        .getPublicUrl(filePath);

      return {
        path: filePath,
        url: publicUrl,
        created_at: file.created_at || new Date().toISOString(),
      };
    });

    return { success: true, images };
  } catch (err) {
    console.error("❌ Erreur lors de la récupération des images:", err);
    return { success: false, error: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}

export async function checkImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD", mode: "no-cors" });
    return true;
  } catch {
    return false;
  }
}
