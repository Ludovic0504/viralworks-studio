import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import { listHistory, updateHistoryMetadata } from "@/bibliotheque/supabase/historique";
import { uploadImagesFromUrls, getUserImagesFromStorage, ensureGeneratedImagesBucketAvailable } from "@/bibliotheque/supabase/storage";
import PageTitle from "../composants/interface/TitrePage";
import { useT } from "@/contexte/FournisseurLocale";
import {
  Image as ImageIcon,
  Video,
  Download,
  Share2,
  Mail,
  Link as LinkIcon,
  Copy,
  X,
  Check,
  Search,
  Filter,
  Grid3x3,
  List,
  Calendar,
  FileText,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const LS_HISTORY = "history_v2";

function loadLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
  } catch {
    return [];
  }
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function compactText(value, max = 120) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function isSupabaseImageUrl(url) {
  const s = String(url || "").toLowerCase();
  return s.includes("supabase.co") || s.includes("/storage/v1/object/public/generated-images/");
}

function getVideoImageUrl(item) {
  const candidates = [
    item?.metadata?.hookImageUrl,
    item?.metadata?.image_url,
    item?.metadata?.imageUrl,
    item?.hookImageUrl,
    item?.metadata?.url,
  ];
  const found = candidates.find((v) => isHttpUrl(v));
  return found ? String(found).trim().replace(/^http:\/\//i, "https://") : "";
}

export default function Galerie() {
  const t = useT();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [viewMode, setViewMode] = useState("grid"); // "grid" ou "list"
  const [filterType, setFilterType] = useState("all"); // "all", "image", "video"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [downloadFormat, setDownloadFormat] = useState("png");
  const [expandedPrompts, setExpandedPrompts] = useState(new Set());
  const [expandedImagePrompt, setExpandedImagePrompt] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      let data = [];
      try {
        data = await listHistory({ limit: 1000 });
      } catch {
        data = [];
      }
      if (!Array.isArray(data) || data.length === 0) {
        data = loadLocalHistory();
      }

      if (session?.user?.id && Array.isArray(data) && data.length > 0) {
        const bucketAvailable = await ensureGeneratedImagesBucketAvailable();
        if (!bucketAvailable) {
          setHistory((data || []).map((h) => ({
            ...h,
            created_at: h.created_at || h.createdAt || null,
            input: h.input ?? h.prompt ?? "",
            output: h.output ?? "",
            metadata: h.metadata ?? {},
          })));
          return;
        }

        const repairCandidates = data
          .filter((item) => item?.kind === "image")
          .map((item) => {
            const rawUrls = Array.isArray(item?.metadata?.urls)
              ? item.metadata.urls
              : Array.isArray(item?.urls)
                ? item.urls
                : [];
            const cleaned = rawUrls
              .map((u) => String(u || "").trim().replace(/^http:\/\//i, "https://"))
              .filter(Boolean);
            const hasSupabase = cleaned.some((u) => isSupabaseImageUrl(u));
            return { item, cleaned, hasSupabase };
          })
          .filter(({ cleaned, hasSupabase }) => cleaned.length > 0 && !hasSupabase)
          .slice(0, 6);

        if (repairCandidates.length > 0) {
          let storagePool = [];
          let videoHookPool = [];
          try {
            const storageResult = await getUserImagesFromStorage(session.user.id);
            if (storageResult?.success && Array.isArray(storageResult.images)) {
              storagePool = storageResult.images.map((img) => ({
                ...img,
                ts: new Date(img.created_at || 0).getTime(),
              }));
            }
          } catch (err) {
            console.warn("Impossible de lire le storage images:", err);
          }

          try {
            videoHookPool = data
              .filter((row) => row?.kind === "video")
              .map((row) => ({
                url: getVideoImageUrl(row),
                ts: new Date(row?.created_at || row?.createdAt || 0).getTime(),
              }))
              .filter((entry) => isSupabaseImageUrl(entry.url));
          } catch (err) {
            console.warn("Impossible de lire les hooks vidéo:", err);
          }

          const usedStorageUrls = new Set();
          const usedVideoHookUrls = new Set();
          for (const { item, cleaned } of repairCandidates) {
            try {
              const uploaded = await uploadImagesFromUrls(cleaned, session.user.id, item?.input || "");
              const repairedUrls = Array.isArray(uploaded?.urls) ? uploaded.urls : cleaned;
              const hasSupabaseNow = repairedUrls.some((u) => isSupabaseImageUrl(u));
              let finalUrls = repairedUrls;

              if (!hasSupabaseNow && storagePool.length > 0) {
                const itemTs = new Date(item?.created_at || item?.createdAt || 0).getTime();
                const nearest = storagePool
                  .filter((img) => !usedStorageUrls.has(img.url))
                  .sort((a, b) => Math.abs((a.ts || 0) - itemTs) - Math.abs((b.ts || 0) - itemTs))[0];
                if (nearest?.url) {
                  finalUrls = [nearest.url];
                  usedStorageUrls.add(nearest.url);
                }
              }

              if (!finalUrls.some((u) => isSupabaseImageUrl(u)) && videoHookPool.length > 0) {
                const itemTs = new Date(item?.created_at || item?.createdAt || 0).getTime();
                const nearestHook = videoHookPool
                  .filter((entry) => !usedVideoHookUrls.has(entry.url))
                  .sort((a, b) => Math.abs((a.ts || 0) - itemTs) - Math.abs((b.ts || 0) - itemTs))[0];
                if (nearestHook?.url) {
                  finalUrls = [nearestHook.url];
                  usedVideoHookUrls.add(nearestHook.url);
                }
              }

              const hasRecoverable = finalUrls.some((u) => isSupabaseImageUrl(u));
              if (hasRecoverable) {
                const nextMetadata = { ...(item?.metadata || {}), urls: finalUrls };
                const result = await updateHistoryMetadata(item.id, nextMetadata);
                if (!result?.success) continue;

                data = data.map((row) =>
                  row.id === item.id ? { ...row, metadata: nextMetadata } : row
                );
              }
            } catch (repairErr) {
              console.warn("Réparation auto image ignorée:", repairErr);
            }
          }
        }
      }

      setHistory((data || []).map((h) => ({
        ...h,
        created_at: h.created_at || h.createdAt || null,
        input: h.input ?? h.prompt ?? "",
        output: h.output ?? "",
        metadata: h.metadata ?? {},
      })));
    } catch (err) {
      console.error("Erreur chargement historique:", err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const refresh = () => loadHistory();
    window.addEventListener("onetool:history:changed", refresh);
    return () => window.removeEventListener("onetool:history:changed", refresh);
  }, [loadHistory]);

  const getProxyUrl = useCallback((imageUrl) => {
    if (!imageUrl) return null;
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    if (!supabaseUrl) return imageUrl;
    
    const isHailuoUrl = imageUrl.includes('hailuo-image') || imageUrl.includes('aliyuncs.com');
    
    if (isHailuoUrl) {
      const encodedUrl = encodeURIComponent(imageUrl);
      return `${supabaseUrl}/functions/v1/image-proxy?url=${encodedUrl}`;
    }
    
    return imageUrl;
  }, []);

  const getImageUrlCandidates = useCallback((item) => {
    const rawCandidates = [
      ...(Array.isArray(item?.metadata?.urls) ? item.metadata.urls : []),
      ...(Array.isArray(item?.urls) ? item.urls : []),
      item?.url,
      item?.metadata?.url,
      item?.metadata?.image_url,
    ]
      .map((u) => String(u || "").trim())
      .filter(Boolean)
      .map((u) => (u.startsWith("http://") ? u.replace("http://", "https://") : u));

    const uniq = [...new Set(rawCandidates)];
    const sorted = uniq.sort((a, b) => {
      const aSupa = isSupabaseImageUrl(a) ? 1 : 0;
      const bSupa = isSupabaseImageUrl(b) ? 1 : 0;
      return bSupa - aSupa;
    });
    return sorted.map((u) => getProxyUrl(u));
  }, [getProxyUrl]);

  const getImageUrl = useCallback((item) => {
    const candidates = getImageUrlCandidates(item);
    return candidates.length > 0 ? candidates[0] : null;
  }, [getImageUrlCandidates]);

  const filteredItems = useMemo(() => {
    let filtered = history;

    if (filterType === "image") {
      filtered = filtered.filter((item) => item.kind === "image" && !!getImageUrl(item));
    } else if (filterType === "video") {
      filtered = filtered.filter((item) => item.kind === "video" && isHttpUrl(item?.output));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.input?.toLowerCase().includes(query) ||
          item.output?.toLowerCase().includes(query) ||
          item.model?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0);
      const dateB = new Date(b.created_at || b.createdAt || 0);
      return dateB - dateA;
    });
  }, [history, filterType, searchQuery, getImageUrl]);

  const images = useMemo(() => {
    const imgs = filteredItems.filter((item) => item.kind === "image" && !!getImageUrl(item));
    console.log("🖼️ Images filtrées:", imgs.length, "sur", filteredItems.length, "éléments");
    if (imgs.length > 0) console.log("🖼️ Exemple d'image:", imgs[0]);
    return imgs;
  }, [filteredItems, getImageUrl]);

  const videos = useMemo(() => {
    const vids = filteredItems
      .filter((item) => item.kind === "video" && isHttpUrl(item?.output))
      .map((item) => ({ ...item, videoImageUrl: getVideoImageUrl(item) }));
    console.log("🎥 Vidéos filtrées:", vids.length);
    return vids;
  }, [filteredItems]);

  const formatDate = (dateString) => {
    if (!dateString) return "Date inconnue";
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownloadImage = async (url, format = "png") => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout lors du chargement de l'image"));
        }, 30000);

        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };

        img.onerror = () => {
          clearTimeout(timeout);
          if (img.crossOrigin) {
            img.crossOrigin = null;
            img.src = url;
          } else {
            reject(new Error("Impossible de charger l'image"));
          }
        };

        img.src = url;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Impossible de créer le contexte canvas");
      }

      ctx.drawImage(img, 0, 0);

      const mimeType = format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";

      const blob = await new Promise((resolve, reject) => {
        if (format === "png") {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Erreur lors de la conversion en PNG"));
              }
            },
            mimeType
          );
        } else {
          const quality = format === "jpg" ? 0.92 : 0.9;
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error(`Erreur lors de la conversion en ${format.toUpperCase()}`));
              }
            },
            mimeType,
            quality
          );
        }
      });

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `image.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn("Erreur conversion canvas (CORS), téléchargement direct:", err);
      
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        
        let extension = format;
        const contentType = blob.type;
        if (contentType.includes("jpeg") || contentType.includes("jpg")) {
          extension = "jpg";
        } else if (contentType.includes("webp")) {
          extension = "webp";
        } else if (contentType.includes("png")) {
          extension = "png";
        } else {
          const urlMatch = url.match(/\.(jpg|jpeg|png|webp)/i);
          if (urlMatch) {
            extension = urlMatch[1].toLowerCase();
          }
        }
        
        link.download = `image.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        
        if (extension !== format) {
          alert(`⚠️ Conversion impossible (CORS). Image téléchargée au format ${extension.toUpperCase()} (format original).`);
        }
      } catch (fetchErr) {
        console.error("Erreur téléchargement direct:", fetchErr);
        alert(`Erreur lors du téléchargement : ${err.message || "Erreur inconnue"}\n\nSi le problème persiste, essayez de télécharger l'image directement depuis son URL.`);
      }
    }
  };

  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("✅ URL copiée dans le presse-papiers !");
    } catch (err) {
      console.error("Erreur copie:", err);
      alert("Impossible de copier l'URL");
    }
  };

  const handleShare = async (url, title, text) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title || "Création générée",
          text: text || "Création générée avec IA",
          url: url,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Erreur partage:", err);
          handleCopyUrl(url);
        }
      }
    } else {
      handleCopyUrl(url);
    }
  };

  const handleSendEmail = (url, title, text) => {
    const subject = encodeURIComponent(title || "Création générée avec IA");
    const body = encodeURIComponent(`${text || "Création générée"}\n\nLien : ${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const openLightbox = useCallback((item, index) => {
    const imageUrl = getImageUrl(item);
    if (!imageUrl) {
      alert("⚠️ Cette image n'a pas d'URL disponible. Seul le prompt texte est disponible.");
      return;
    }
    setSelectedImage(item);
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, [getImageUrl]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setSelectedImage(null);
  }, []);

  const nextImage = useCallback(() => {
    if (images.length > 0) {
      const nextIndex = (lightboxIndex + 1) % images.length;
      setLightboxIndex(nextIndex);
      setSelectedImage(images[nextIndex]);
    }
  }, [images, lightboxIndex]);

  const prevImage = useCallback(() => {
    if (images.length > 0) {
      const prevIndex = (lightboxIndex - 1 + images.length) % images.length;
      setLightboxIndex(prevIndex);
      setSelectedImage(images[prevIndex]);
    }
  }, [images, lightboxIndex]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen, closeLightbox, nextImage, prevImage]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <PageTitle green={t("studio.galleryTitle")} subtitle={t("studio.gallerySubtitle")} />

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
            <span className="text-gray-400">
              {filteredItems.length} création{filteredItems.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="glass-strong rounded-xl p-4 border border-white/10 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t("studio.gallerySearch")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            />
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === "all"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
              }`}
            >
              Tout
            </button>
            <button
              onClick={() => setFilterType("image")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === "image"
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/50"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
              }`}
            >
              <ImageIcon className="w-4 h-4 inline mr-1" />
              Photos
            </button>
            <button
              onClick={() => setFilterType("video")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filterType === "video"
                  ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
              }`}
            >
              <Video className="w-4 h-4 inline mr-1" />
              Vidéos
            </button>
          </div>

          {/* Mode d'affichage */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
              }`}
              title="Vue grille"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-all ${
                viewMode === "list"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
              }`}
              title="Vue liste"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-spin">
            <ImageIcon className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400">Chargement de votre galerie...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="glass-strong rounded-xl p-12 border border-white/10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400 mb-2">Aucune création dans votre historique</p>
          <p className="text-sm text-gray-500">
            Commencez par générer des images ou des vidéos pour qu'elles apparaissent ici
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="glass-strong rounded-xl p-12 border border-white/10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400 mb-2">Aucune création trouvée avec ces filtres</p>
          <p className="text-sm text-gray-500">
            Essayez de modifier vos filtres de recherche ou votre type de filtre
          </p>
          <p className="text-xs text-gray-600 mt-2">
            Total dans l'historique: {history.length} | Filtre: {filterType} | Recherche: "{searchQuery}"
          </p>
        </div>
      ) : (
        <>
          {/* Galerie Photos */}
          {images.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-violet-400" />
                  Photos ({images.length})
                </h2>
              </div>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {images.map((item, index) => {
                    const imageCandidates = getImageUrlCandidates(item);
                    const imageUrl = imageCandidates[0] || null;
                    return (
                      <div
                        key={index}
                        onClick={() => imageUrl && openLightbox(item, index)}
                        className={`group relative aspect-square rounded-lg overflow-hidden border border-white/10 transition-all bg-white/5 ${
                          imageUrl ? "hover:border-violet-500/50 cursor-pointer" : "border-yellow-500/30 cursor-default"
                        }`}
                      >
                        {imageUrl ? (
                          <>
                            <img
                              src={imageUrl}
                              data-fallback-index="0"
                              alt={item.input || "Image"}
                              className="w-full h-full object-cover transition-transform group-hover:scale-110"
                              loading="lazy"
                              onError={(e) => {
                                const current = Number(e.currentTarget.dataset.fallbackIndex || "0");
                                const next = current + 1;
                                if (next < imageCandidates.length) {
                                  e.currentTarget.dataset.fallbackIndex = String(next);
                                  e.currentTarget.src = imageCandidates[next];
                                  return;
                                }
                                console.error("❌ Erreur chargement image:", imageUrl);
                                e.target.style.display = "none";
                                e.target.nextElementSibling.style.display = "flex";
                              }}
                            />
                            <div className="hidden absolute inset-0 items-center justify-center bg-white/5">
                              <div className="text-center p-4">
                                <ImageIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                                <p className="text-xs text-gray-400">Image non disponible</p>
                                <p className="text-[10px] text-gray-500 mt-1">URL expirée</p>
                                <p className="text-[9px] text-gray-600 mt-1">Les URLs Hailuo expirent après quelques jours</p>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                            <div className="text-center p-4">
                              <ImageIcon className="w-8 h-8 text-yellow-500/50 mx-auto mb-2" />
                              <p className="text-xs text-yellow-500/70 font-medium">Image non stockée</p>
                              <p className="text-[10px] text-gray-500 mt-1">Prompt uniquement</p>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-xs text-white line-clamp-2 mb-1">{item.input || "Sans description"}</p>
                            <p className="text-[10px] text-gray-300">{formatDate(item.created_at)}</p>
                          </div>
                        </div>
                        {imageUrl && (
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {images.map((item, index) => {
                    const imageCandidates = getImageUrlCandidates(item);
                    const imageUrl = imageCandidates[0] || null;
                    return (
                      <div
                        key={index}
                        className={`glass-strong rounded-lg border transition-all overflow-hidden ${
                          imageUrl ? "border-white/10 hover:border-violet-500/50" : "border-yellow-500/30"
                        }`}
                      >
                        <div
                          className={`flex items-center gap-4 p-4 ${imageUrl ? "cursor-pointer" : ""}`}
                          onClick={() => imageUrl && openLightbox(item, index)}
                        >
                          <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                data-fallback-index="0"
                                alt={item.input || "Image"}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const current = Number(e.currentTarget.dataset.fallbackIndex || "0");
                                  const next = current + 1;
                                  if (next < imageCandidates.length) {
                                    e.currentTarget.dataset.fallbackIndex = String(next);
                                    e.currentTarget.src = imageCandidates[next];
                                    return;
                                  }
                                  console.error("❌ Erreur chargement image:", imageUrl);
                                  e.target.style.display = "none";
                                  e.target.nextElementSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div className={`${imageUrl ? "hidden" : "flex"} w-full h-full items-center justify-center bg-white/5`}>
                              <div className="text-center">
                                <ImageIcon className="w-6 h-6 text-yellow-500/50 mx-auto mb-1" />
                                <p className="text-[10px] text-yellow-500/70">Non stockée</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">{item.input || "Sans description"}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatDate(item.created_at)}</p>
                            {item.metadata?.ratio && (
                              <span className="inline-block mt-2 px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 text-xs">
                                {item.metadata.ratio}
                              </span>
                            )}
                            {!imageUrl && (
                              <span className="inline-block mt-2 px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 text-xs">
                                Prompt uniquement
                              </span>
                            )}
                          </div>
                          {imageUrl && (
                            <ZoomIn className="w-5 h-5 text-gray-400 hover:text-violet-400 transition-colors flex-shrink-0" />
                          )}
                        </div>
                        
                        {/* Prompt en accordéon pour les images */}
                        {item.input && (
                          <div className="border-t border-white/10">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const newExpanded = new Set(expandedPrompts);
                                const promptKey = `image-${index}`;
                                if (newExpanded.has(promptKey)) {
                                  newExpanded.delete(promptKey);
                                } else {
                                  newExpanded.add(promptKey);
                                }
                                setExpandedPrompts(newExpanded);
                              }}
                              className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-400" />
                                <span className="text-xs font-medium text-gray-400">Prompt utilisé</span>
                                <span className="text-xs text-gray-500">
                                  ({item.input.length} caractères)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await navigator.clipboard.writeText(item.input);
                                      alert("✅ Prompt copié !");
                                    } catch {
                                      alert("Impossible de copier");
                                    }
                                  }}
                                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                  {t("common.copy")}
                                </button>
                                {expandedPrompts.has(`image-${index}`) ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                            </button>
                            {expandedPrompts.has(`image-${index}`) && (
                              <div className="px-4 pb-4 border-t border-white/10 pt-3">
                                <p className="text-sm text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                  {item.input}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Galerie Vidéos */}
          {videos.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-200 mb-4 flex items-center gap-2">
                <Video className="w-5 h-5 text-yellow-400" />
                Vidéos ({videos.length})
              </h2>
              <div className="space-y-4">
                {videos.map((item, index) => (
                  <div
                    key={index}
                    className="glass-strong rounded-xl p-6 border border-white/10 hover:border-yellow-500/50 transition-all"
                  >
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-200 mb-2">
                              {compactText(item.input, 110) || "Vidéo générée"}
                            </h3>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(item.created_at)}
                              </span>
                              {item.model && (
                                <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300">{item.model}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedVideoIndex(selectedVideoIndex === index ? null : index)}
                            className={`p-2 rounded-lg transition-all ${
                              selectedVideoIndex === index
                                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
                                : "bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10"
                            }`}
                          >
                            {selectedVideoIndex === index ? <Check className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                          </button>
                        </div>

                        <div className="mb-4 rounded-lg overflow-hidden border border-white/10 bg-black/60">
                          <video src={item.output} controls className="w-full max-h-[360px] bg-black" />
                        </div>
                        {item.videoImageUrl ? (
                          <div className="mb-4 rounded-lg overflow-hidden border border-white/10 bg-black/30">
                            <img src={item.videoImageUrl} alt="Visuel utilisé" className="w-full max-h-[220px] object-cover" loading="lazy" />
                          </div>
                        ) : null}

                        {/* Panneau d'actions pour vidéo sélectionnée */}
                        {selectedVideoIndex === index && (
                          <div className="mt-4 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/30">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={async () => {
                                  if (item.output) {
                                    try {
                                      await navigator.clipboard.writeText(item.output);
                                      alert("✅ Lien vidéo copié !");
                                    } catch {
                                      alert("Impossible de copier le lien");
                                    }
                                  }
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 text-sm font-medium transition-all"
                              >
                                <Copy className="w-4 h-4" />
                                Copier le lien vidéo
                              </button>
                              <a
                                href={item.output}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 text-sm font-medium transition-all"
                              >
                                <Download className="w-4 h-4" />
                                {t("common.download")}
                              </a>
                              <button
                                onClick={() => {
                                  handleShare(item.output, "Vidéo générée", item.input || "Vidéo générée avec IA");
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm font-medium transition-all"
                              >
                                <Share2 className="w-4 h-4" />
                                {t("common.share")}
                              </button>
                              <button
                                onClick={() => {
                                  handleSendEmail(item.output, "Vidéo générée avec IA", item.input || "Vidéo générée");
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 text-sm font-medium transition-all"
                              >
                                <Mail className="w-4 h-4" />
                                Envoyer par mail
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lightbox pour les images */}
      {lightboxOpen && selectedImage && (() => {
        const imageCandidates = getImageUrlCandidates(selectedImage);
        const imageUrl = imageCandidates[0] || null;
        if (!imageUrl) return null;
        return (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <div className="relative max-w-7xl w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* Image principale */}
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={imageUrl}
                data-fallback-index="0"
                alt={selectedImage.input || "Image"}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={(e) => {
                  const current = Number(e.currentTarget.dataset.fallbackIndex || "0");
                  const next = current + 1;
                  if (next < imageCandidates.length) {
                    e.currentTarget.dataset.fallbackIndex = String(next);
                    e.currentTarget.src = imageCandidates[next];
                    return;
                  }
                  console.error("❌ Erreur chargement image dans lightbox:", imageUrl);
                  alert("⚠️ L'image ne peut pas être chargée. L'URL a peut-être expiré.");
                }}
              />

              {/* Informations et Prompt */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/95 via-black/90 to-transparent">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center gap-4 text-sm text-gray-300 mb-4">
                    <span>{formatDate(selectedImage.created_at)}</span>
                    {selectedImage.metadata?.ratio && (
                      <span className="px-2 py-1 rounded bg-violet-500/20 text-violet-300">{selectedImage.metadata.ratio}</span>
                    )}
                  </div>
                  
                  {/* Prompt en accordéon - toujours affiché si disponible */}
                  {(selectedImage.input || selectedImage.output) && (
                    <div className="rounded-lg bg-black/70 backdrop-blur-md border border-white/30 overflow-hidden shadow-xl">
                      <button
                        onClick={() => setExpandedImagePrompt(!expandedImagePrompt)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-5 h-5 text-violet-300 flex-shrink-0" />
                          <div className="text-left flex-1 min-w-0">
                            <span className="text-sm font-semibold text-white block">Prompt utilisé pour générer cette image</span>
                            {!expandedImagePrompt && (
                              <span className="text-xs text-gray-300 line-clamp-1 mt-1">
                                {(selectedImage.input || selectedImage.output || "").substring(0, 80)}...
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                            ({(selectedImage.input || selectedImage.output || "").length} caractères)
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const prompt = selectedImage.input || selectedImage.output;
                              if (prompt) {
                                try {
                                  await navigator.clipboard.writeText(prompt);
                                  alert("✅ Prompt copié !");
                                } catch {
                                  alert("Impossible de copier");
                                }
                              }
                            }}
                            className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {t("common.copy")}
                          </button>
                          {expandedImagePrompt ? (
                            <ChevronUp className="w-5 h-5 text-gray-300" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-300" />
                          )}
                        </div>
                      </button>
                      {expandedImagePrompt && (
                        <div className="px-4 pb-4 border-t border-white/20 pt-4">
                          <p className="text-sm text-gray-100 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed bg-black/30 p-3 rounded border border-white/10">
                            {selectedImage.input || selectedImage.output}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Panneau d'actions - Desktop en haut à droite, Mobile en bas */}
              <div className="absolute top-4 right-4 hidden md:flex flex-col gap-3 max-w-xs">
                <div className="glass-strong rounded-xl p-4 border border-white/20 backdrop-blur-xl shadow-2xl">
                  <label className="block text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wide">Format de téléchargement</label>
                  <div className="flex gap-2">
                    {["png", "jpg", "webp"].map((format) => (
                      <button
                        key={format}
                        onClick={() => setDownloadFormat(format)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                          downloadFormat === format
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 scale-105"
                            : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-300 border border-white/10"
                        }`}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="glass-strong rounded-xl p-4 border border-white/20 backdrop-blur-xl shadow-2xl space-y-2">
                  <button
                    onClick={() => handleDownloadImage(imageUrl, downloadFormat)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-semibold text-sm transition-all btn-vws-primary"
                  >
                    <Download className="w-5 h-5" />
                    {t("common.download")} ({downloadFormat.toUpperCase()})
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleCopyUrl(imageUrl)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-xs font-medium transition-all hover:scale-105"
                    >
                      <Copy className="w-4 h-4" />
                      URL
                    </button>
                    <button
                      onClick={() => {
                        handleShare(imageUrl, "Image générée", selectedImage.input || "Image générée avec IA");
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-xs font-medium transition-all hover:scale-105"
                    >
                      <Share2 className="w-4 h-4" />
                      {t("common.share")}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        handleSendEmail(imageUrl, "Image générée avec IA", selectedImage.input || "Image générée");
                      }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 text-xs font-medium transition-all hover:scale-105"
                    >
                      <Mail className="w-4 h-4" />
                      Mail
                    </button>
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 text-gray-300 text-xs font-medium transition-all hover:scale-105"
                    >
                      <LinkIcon className="w-4 h-4" />
                      Ouvrir
                    </a>
                  </div>
                </div>
              </div>

              {/* Panneau d'actions Mobile - En bas */}
              <div className="absolute bottom-0 left-0 right-0 md:hidden">
                <div className="bg-gradient-to-t from-black/98 via-black/95 to-black/90 backdrop-blur-xl border-t border-white/20 p-4 space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Format</label>
                    <span className="text-xs text-emerald-400 font-semibold">{downloadFormat.toUpperCase()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {["png", "jpg", "webp"].map((format) => (
                      <button
                        key={format}
                        onClick={() => setDownloadFormat(format)}
                        className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                          downloadFormat === format
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                            : "bg-white/10 text-gray-400 hover:bg-white/20 border border-white/10"
                        }`}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleDownloadImage(imageUrl, downloadFormat)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg text-white font-semibold text-sm transition-all btn-vws-primary"
                  >
                    <Download className="w-5 h-5" />
                    {t("common.download")} ({downloadFormat.toUpperCase()})
                  </button>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      onClick={() => handleCopyUrl(imageUrl)}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 transition-all active:scale-95"
                      title={t("common.copy")}
                    >
                      <Copy className="w-4 h-4" />
                      <span className="text-[10px] font-medium">URL</span>
                    </button>
                    <button
                      onClick={() => {
                        handleShare(imageUrl, "Image générée", selectedImage.input || "Image générée avec IA");
                      }}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 transition-all active:scale-95"
                      title={t("common.share")}
                    >
                      <Share2 className="w-4 h-4" />
                      <span className="text-[10px] font-medium">{t("common.share")}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleSendEmail(imageUrl, "Image générée avec IA", selectedImage.input || "Image générée");
                      }}
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 transition-all active:scale-95"
                      title="Envoyer par mail"
                    >
                      <Mail className="w-4 h-4" />
                      <span className="text-[10px] font-medium">Mail</span>
                    </button>
                    <a
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 text-gray-300 transition-all active:scale-95"
                      title="Ouvrir dans un nouvel onglet"
                    >
                      <LinkIcon className="w-4 h-4" />
                      <span className="text-[10px] font-medium">Ouvrir</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 flex items-center justify-center text-white transition-all"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 flex items-center justify-center text-white transition-all"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm">
                  {lightboxIndex + 1} / {images.length}
                </div>
              </>
            )}

            {/* Bouton fermer */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 flex items-center justify-center text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
