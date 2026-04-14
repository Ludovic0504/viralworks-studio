import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  RefreshCw,
  Play,
  BookOpen,
  X,
  History,
} from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { listHistory } from "@/bibliotheque/supabase/historique";

const LS_HISTORY = "history_v2";

/** Accent maquette (teal / cyan) */
const accent = {
  text: "text-cyan-300",
  textMuted: "text-cyan-400/90",
  icon: "text-cyan-400",
  border: "border-cyan-500/35",
  borderSoft: "border-cyan-400/20",
  glow: "shadow-[0_0_28px_rgba(34,211,238,0.12)]",
  tabActive: "bg-cyan-500/20 text-cyan-100 border-cyan-400/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  tabIdle: "text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/[0.06]",
  btnPrimary:
    "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-950/40 hover:from-cyan-400 hover:to-teal-400",
  btnOutline: "border border-cyan-400/45 text-cyan-200 bg-cyan-500/[0.08] hover:bg-cyan-500/15 hover:border-cyan-300/50",
};

function loadLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_HISTORY) || "[]");
  } catch {
    return [];
  }
}

function sortHistoryDesc(items) {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAt || b.created_at || 0).getTime() -
      new Date(a.createdAt || a.created_at || 0).getTime()
  );
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

async function downloadUrlFile(url, fileName) {
  const href = String(url || "").trim();
  if (!href) return;
  try {
    const res = await fetch(href);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }
}

function getVwsPayload() {
  try {
    const raw = localStorage.getItem("vws_brain_v2_last");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { input: parsed.input, brain: parsed.brain };
  } catch {
    return null;
  }
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "à l’instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  return `il y a ${days} j`;
}

function CardShell({ children, className = "" }) {
  return (
    <div className={`studio-panel p-5 sm:p-6 ${accent.glow} ${className}`}>
      {children}
    </div>
  );
}

export default function RecapVWS({ campaignData = {}, onGoToVideoStep }) {
  const { session } = useAuth();
  const [activeScene, setActiveScene] = useState(0);
  const [showExplain, setShowExplain] = useState(false);
  const [hist, setHist] = useState(() => sortHistoryDesc(loadLocalHistory()));

  const payload = getVwsPayload();
  const brain = payload?.brain;
  const profession = (campaignData?.profession || payload?.input?.profession || "").trim();

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (!session?.user?.id) {
        if (active) setHist(sortHistoryDesc(loadLocalHistory()));
        return;
      }
      try {
        const remote = await listHistory({ limit: 250 });
        if (active) setHist(sortHistoryDesc(remote));
      } catch {
        if (active) setHist([]);
      }
    };
    refresh();
    window.addEventListener("onetool:history:changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("onetool:history:changed", refresh);
    };
  }, [session?.user?.id]);

  const latestPrompt = hist.find((i) => i.kind === "prompt");
  const latestImage = hist.find((i) => i.kind === "image");

  const videoItems = useMemo(() => {
    return hist
      .filter((i) => i.kind === "video")
      .sort(
        (a, b) =>
          new Date(b.createdAt || b.created_at || 0).getTime() -
          new Date(a.createdAt || a.created_at || 0).getTime()
      );
  }, [hist]);

  const latestVideo = videoItems[0];
  const latestImageUrls = Array.isArray(latestImage?.urls)
    ? latestImage.urls
    : Array.isArray(latestImage?.metadata?.urls)
      ? latestImage.metadata.urls
      : [];
  const hookImageUrl = latestImageUrls[0] || null;
  const latestVideoOutput = String(latestVideo?.output || "").trim();
  const latestVideoUrl = isHttpUrl(latestVideoOutput) ? latestVideoOutput : "";

  const scripts = useMemo(() => {
    if (brain?.videoPrompts?.length) {
      return brain.videoPrompts.map((s) => String(s));
    }
    const fromPrompt =
      (latestPrompt?.output && String(latestPrompt.output).trim()) ||
      (brain?.scriptSeed && String(brain.scriptSeed).trim()) ||
      "";
    return fromPrompt ? [fromPrompt] : [""];
  }, [brain, latestPrompt]);

  const sceneCount = Math.max(scripts.length, 1);
  const scriptDisplay = scripts[Math.min(activeScene, scripts.length - 1)] || "";

  const visuelCaption =
    (brain?.coverPrompt && String(brain.coverPrompt).trim()) ||
    (latestImage?.prompt && String(latestImage.prompt).trim()) ||
    (latestImage?.input && String(latestImage.input).trim()) ||
    "";

  const downloadPrompt = () => {
    const text = latestVideoOutput && !latestVideoUrl ? latestVideoOutput : scripts.join("\n\n---\n\n").trim();
    if (!text) {
      alert("Aucun prompt vidéo enregistré à télécharger. Passe par l’étape Vidéo virale d’abord.");
      return;
    }
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `viralworks-prompt-video-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadImage = async () => {
    if (!hookImageUrl) {
      alert("Aucune image validée à télécharger.");
      return;
    }
    await downloadUrlFile(hookImageUrl, `viralworks-image-${new Date().toISOString().slice(0, 10)}.png`);
  };

  const downloadVideo = async () => {
    if (!latestVideoUrl) {
      alert("Aucune vidéo finale téléchargeable pour le moment.");
      return;
    }
    await downloadUrlFile(latestVideoUrl, `viralworks-video-${new Date().toISOString().slice(0, 10)}.mp4`);
  };

  return (
    <div className="w-full max-w-[1360px] mx-auto space-y-8 pb-4">
      {/* En-tête centré */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-center sm:text-left">
        <div className="space-y-1 sm:max-w-xl">
          <p className="text-sm text-gray-300 leading-relaxed">
            Vue d’ensemble de ta campagne : script par scène, visuel d’accroche et export du prompt vidéo.
          </p>
          <p className="text-xs text-gray-500">Tout est regroupé pour une relecture claire avant publication.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowExplain(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/12 text-xs font-medium text-gray-200 bg-white/[0.05] hover:bg-white/[0.09] hover:border-cyan-500/25 transition-all shrink-0 mx-auto sm:mx-0"
        >
          <BookOpen className={`w-4 h-4 ${accent.icon}`} />
          Explication du système
        </button>
      </div>

      {/* Grille 3 colonnes — alignée et aérée */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-stretch">
        {/* Gauche : sources + cartes empilées */}
        <div className="lg:col-span-3 flex flex-col gap-6 min-w-0">
          <div className="text-center lg:text-left px-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Sources</p>
            <h2 className="text-sm font-semibold text-gray-100 mt-1">Script &amp; visuel</h2>
            {profession ? (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{profession}</p>
            ) : null}
          </div>

          <CardShell className="flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2.5 mb-4">
              <span className={`p-2 rounded-xl bg-cyan-500/10 border ${accent.borderSoft}`}>
                <FileText className={`w-4 h-4 ${accent.icon}`} />
              </span>
              Script gagnant
              {sceneCount > 1 ? (
                <span className="text-xs font-normal text-gray-500">· scène {activeScene + 1}</span>
              ) : null}
            </h3>
            <div className="rounded-xl border border-white/[0.07] bg-[#0b0f14] p-4 flex-1 min-h-[200px] max-h-[min(52vh,420px)] overflow-y-auto">
              {scriptDisplay ? (
                <pre className="text-[13px] text-gray-300/95 whitespace-pre-wrap font-sans leading-[1.65]">
                  {scriptDisplay}
                </pre>
              ) : (
                <p className="text-sm text-gray-500 italic text-center py-12">Aucun script pour cette scène.</p>
              )}
            </div>
          </CardShell>

          <CardShell>
            <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2.5 mb-4">
              <span className={`p-2 rounded-xl bg-cyan-500/10 border ${accent.borderSoft}`}>
                <ImageIcon className={`w-4 h-4 ${accent.icon}`} />
              </span>
              Visuel d’accroche
            </h3>
            <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-[#0b0f14] aspect-video flex items-center justify-center ring-1 ring-white/[0.04]">
              {hookImageUrl ? (
                <img
                  src={hookImageUrl}
                  alt="Visuel d’accroche"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 p-8 text-center text-gray-500 text-sm">
                  <div className="w-16 h-16 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 opacity-35" />
                  </div>
                  <span className="text-xs max-w-[200px] leading-relaxed">
                    Miniature après validation à l’étape visuel
                  </span>
                </div>
              )}
            </div>
            {visuelCaption ? (
              <p className="text-xs text-gray-500 mt-3 leading-relaxed line-clamp-3">{visuelCaption}</p>
            ) : null}
          </CardShell>
        </div>

        {/* Centre : vidéo finale */}
        <div className="lg:col-span-6 flex min-w-0">
          <CardShell className="w-full flex flex-col">
            <div className="flex items-center gap-2.5 mb-5">
              <span className={`p-2 rounded-xl bg-cyan-500/10 border ${accent.borderSoft}`}>
                <Video className={`w-4 h-4 ${accent.icon}`} />
              </span>
              <h3 className="text-base font-semibold text-gray-100 tracking-tight">Vidéo finale</h3>
            </div>

            {/* Onglets scènes — au-dessus du lecteur (maquette) */}
            {sceneCount > 1 ? (
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 p-1.5 rounded-xl bg-[#0b0f14] border border-white/[0.06] mb-5">
                {scripts.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveScene(i)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      activeScene === i ? accent.tabActive : accent.tabIdle
                    }`}
                  >
                    Scène {i + 1}
                  </button>
                ))}
              </div>
            ) : null}

            <div className={`relative rounded-2xl border ${accent.border} bg-black/70 aspect-video overflow-hidden ring-1 ring-cyan-500/10`}>
              {latestVideoUrl ? (
                <video
                  src={latestVideoUrl}
                  controls
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : hookImageUrl ? (
                <img
                  src={hookImageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-95"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#0d1820] to-black" />
              )}
              {!latestVideoUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <button
                    type="button"
                    className="w-16 h-16 rounded-full bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-md hover:bg-white/20 transition-all hover:scale-105"
                    aria-label="Lecture (aperçu)"
                  >
                    <Play className="w-8 h-8 text-white ml-1" fill="currentColor" />
                  </button>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 pt-10 bg-gradient-to-t from-black via-black/70 to-transparent">
                <div className="h-1 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full w-1/4 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400" />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-[11px] font-mono text-gray-400">
                    {latestVideoOutput ? "0:15" : "0:00"}
                    <span className="text-gray-600"> / </span>
                    <span className="text-gray-500">{latestVideoOutput ? "1:00" : "—"}</span>
                  </p>
                  <p className="text-[10px] text-gray-500 truncate max-w-[55%] text-right">
                    {latestVideoUrl ? "Vidéo prête" : latestVideoOutput ? "Prompt prêt" : "En attente de génération"}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed mt-5 text-center sm:text-left">
              {latestVideoUrl
                ? "Vidéo finale détectée et lisible directement ici."
                : "Aperçu visuel depuis ton image validée. Tu peux exporter le prompt associé en attendant la vidéo finale."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                type="button"
                onClick={downloadPrompt}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all ${accent.btnPrimary}`}
              >
                <Download className="w-4 h-4 shrink-0" />
                {sceneCount > 1 ? "Télécharger les prompts vidéo" : "Télécharger le prompt vidéo"}
              </button>
              <button
                type="button"
                onClick={downloadImage}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all ${accent.btnOutline}`}
              >
                <Download className="w-4 h-4 shrink-0" />
                Télécharger l’image
              </button>
              <button
                type="button"
                onClick={downloadVideo}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all ${latestVideoUrl ? accent.btnPrimary : accent.btnOutline}`}
              >
                <Download className="w-4 h-4 shrink-0" />
                Télécharger la vidéo
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <button
                type="button"
                onClick={() => onGoToVideoStep?.()}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-semibold text-sm transition-all ${accent.btnOutline}`}
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                Générer une nouvelle version
              </button>
            </div>
          </CardShell>
        </div>

        {/* Droite : historique */}
        <div className="lg:col-span-3 flex min-w-0">
          <CardShell className="w-full flex flex-col min-h-[360px] lg:min-h-full">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2.5">
                <span className={`p-2 rounded-xl bg-cyan-500/10 border ${accent.borderSoft}`}>
                  <History className={`w-4 h-4 ${accent.icon}`} />
                </span>
                Historique des générations
              </h3>
              <button
                type="button"
                className="p-2 rounded-xl text-gray-400 hover:text-cyan-300 hover:bg-white/[0.06] border border-transparent hover:border-cyan-500/20 transition-all"
                title="Rafraîchir"
                onClick={() => window.dispatchEvent(new Event("onetool:history:changed"))}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {videoItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl border border-dashed border-white/10 bg-[#0b0f14]/50">
                <Video className={`w-12 h-12 mb-3 opacity-25 ${accent.icon}`} />
                <p className="text-sm text-gray-500 leading-relaxed">Aucune version enregistrée pour l’instant.</p>
              </div>
            ) : (
              <ul className="space-y-3 flex-1 overflow-y-auto max-h-[min(52vh,480px)] pr-1 -mr-1">
                {videoItems.map((item, idx) => {
                  const versionNum = videoItems.length - idx;
                  const thumb = hookImageUrl;
                  return (
                    <li
                      key={item.id || idx}
                      className="flex gap-3.5 p-3.5 rounded-xl border border-white/[0.07] bg-[#0b0f14]/60 hover:border-cyan-500/25 hover:bg-[#0b0f14] transition-all"
                    >
                      <div className="w-[72px] h-[52px] rounded-lg overflow-hidden bg-black/60 shrink-0 border border-white/[0.08] ring-1 ring-white/[0.04]">
                        {thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="text-sm font-semibold text-gray-100">Version {versionNum}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(item.createdAt || item.created_at)}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate mt-2 leading-snug">
                          {(item.model || "veo3").toUpperCase()}
                          {(item.input || "").length ? " · " : ""}
                          {(item.input || "").slice(0, 48)}
                          {(item.input || "").length > 48 ? "…" : ""}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardShell>
        </div>
      </div>

      {showExplain && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={() => setShowExplain(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#131920] shadow-2xl shadow-cyan-950/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recap-explain-title"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 id="recap-explain-title" className="text-base font-semibold text-gray-100">
                Explication du système
              </h2>
              <button
                type="button"
                onClick={() => setShowExplain(false)}
                className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 text-sm text-gray-300 space-y-3 leading-relaxed">
              <p>
                Cette page résume ton parcours : le <strong className="text-gray-100">script</strong> (les onglets
                Scène 1 à 3 au centre changent le texte affiché à gauche), le{" "}
                <strong className="text-gray-100">visuel d’accroche</strong>, et le dernier{" "}
                <strong className="text-gray-100">résultat vidéo</strong>.
              </p>
              <p className="text-xs text-gray-500">
                Tu peux télécharger directement le prompt, l’image d’accroche et la vidéo finale (si disponible), ou
                relancer une nouvelle version depuis l’étape « Vidéo virale ».
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
