import {
  useMemo,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  saveHistory as saveHistorySupabase,
  listHistory,
  deleteHistory,
} from "@/bibliotheque/supabase/historique";
import { hasEnoughCredits, debitCredits, getUserCredits, isAdmin } from "@/bibliotheque/supabase/credits";
import { usePremiumAccess } from "@/hooks/usePremiumAccess";
import {
  capturePostHog,
  classifyErrorType,
  parseVideoDurationSeconds,
  trackPostHogError,
} from "@/bibliotheque/posthog/client";
import {
  canUseVideoAttempt,
  consumeVideoAttempt,
  markVideoWorkflowCreditConsumed,
  shouldDebitVideoCredit,
} from "@/bibliotheque/workflowQuota";
import { SS_BRAIN_V2_LAST_KEY } from "@/bibliotheque/viralWorksStudioStorage";
import {
  appendVeo3VisualContinuityRules,
  createVertexVeoVideoTask,
  getSessionAccessTokenForVertexVeo,
  pollVertexVeoUntilComplete,
  refreshVertexVideoUrlFromId,
} from "@/bibliotheque/supabase/vertexVeoVideo";
import {
  createDefaultCampaignGenerationSpec,
  getSafeScenes,
  normalizeCampaignGenerationSpec,
} from "@/bibliotheque/campaignGenerationSpec";
import { buildVeo3Prompt } from "@/bibliotheque/video-translators/veo3";
import {
  isHttpUrl,
  isBlobUrl,
  isVideoPlayerUrl,
  downloadUrlFile,
} from "@/bibliotheque/downloadRemoteAsset";
import {
  generateVeo3EightSecondsAndLastFrame,
  generateVeo3DiagnosticSegment1Through3AndConcat,
} from "@/bibliotheque/videoPipeline";
import { mergeClientSideAudioVideo } from "@/bibliotheque/video/clientAudioMerge";
import { splitCampaignPromptIntoThreeVideoSegments } from "@/bibliotheque/splitVideoPromptThreeSegments";
import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";
import PageTitle from "../composants/interface/TitrePage";
import VideoViraleExplicationSheet from "../composants/video/VideoViraleExplicationSheet";
import {
  validateIdeaLength,
} from "@/bibliotheque/promptGenerationLimits";
import {
  Video as VideoIcon,
  Sparkles,
  Copy,
  Trash2,
  Search,
  X,
  History,
  Zap,
  Wand2,
  RefreshCw,
  Check,
  BookOpen,
  User,
  Image as ImageIcon,
  Settings2,
  ChevronDown,
  Upload,
  Download,
} from "lucide-react";

const VIDEO_GENERATION_COST = 1;

/** Dismissal de la pulsation « Aide » étape vidéo (session) — indépendant de `aide_seen_video` (localStorage). */
const VIDEO_AIDE_PULSE_SESSION_KEY = "vws_aide_video_pulse_dismissed";

const VEO3_FORMAT_OPTIONS = [
  { value: "16:9", label: "YouTube (16:9)", icon: "▭" },
  { value: "9:16", label: "TikTok (9:16)", icon: "▯" },
];

const DURATION_OPTIONS = {
  veo3: ["4s", "6s", "8s", "24s"],
  hailuo: ["6s", "10s"],
};

/** Étapes affichées pendant la génération « 24 s » (diagnostic : 1 clip + frame). */
const PIPELINE_24_STEP_LABELS_SINGLE = ["Génération Veo (8 s)", "Extraction dernière image"];

/** Diagnostic studio (3 moments) : chaîne clip 1 → frame → clip 2 → frame → clip 3 → concat 24 s. */
const PIPELINE_24_STEP_LABELS_CHAIN = [
  "Clip 1 (8 s)",
  "Frame fin clip 1",
  "Clip 2 (8 s)",
  "Frame fin clip 2",
  "Clip 3 — Résultat (8 s)",
  "Assemblage 24 s (FFmpeg)",
];

/** Script campagne complet pour le mode « 24 s » (diagnostic : un prompt combiné → clip 8 s). */
function buildCombinedStudioScriptFor24s({
  studioScriptPrompt,
  scripts,
  canonicalScenes,
  sceneCount,
}) {
  const sp =
    studioScriptPrompt && typeof studioScriptPrompt === "object" && !Array.isArray(studioScriptPrompt)
      ? studioScriptPrompt
      : null;
  const combined = String(sp?.combined ?? "").trim();
  const combinedFromStudio = combined.length >= 8;

  if (import.meta.env.DEV) {
    const n = Math.max(1, Math.min(3, Number(sceneCount) || 1));
    const s0 = String(scripts?.[0] ?? "").trim();
    const s1 = String(scripts?.[1] ?? "").trim();
    const s2 = String(scripts?.[2] ?? "").trim();
    const c0 = String(canonicalScenes?.[0]?.script_text ?? "").trim();
    const c1 = String(canonicalScenes?.[1]?.script_text ?? "").trim();
    const c2 = String(canonicalScenes?.[2]?.script_text ?? "").trim();
    console.debug("[24s diag] buildCombinedStudioScriptFor24s", {
      combinedFromStudio,
      combinedLen: combined.length,
      sceneCount: n,
      scriptsLens: [s0.length, s1.length, s2.length],
      canonicalLens: [c0.length, c1.length, c2.length],
      scriptsEq01: s0 === s1,
      scriptsEq12: s1 === s2,
      canonicalEq01: c0 === c1,
      canonicalEq12: c1 === c2,
      scriptsSnippets: [
        { head: s0.slice(0, 120), tail: s0.length > 120 ? s0.slice(-80) : "" },
        { head: s1.slice(0, 120), tail: s1.length > 120 ? s1.slice(-80) : "" },
        { head: s2.slice(0, 120), tail: s2.length > 120 ? s2.slice(-80) : "" },
      ],
    });
  }

  if (combinedFromStudio) {
    if (import.meta.env.DEV) {
      console.debug("[24s diag] buildCombined branch: studio combined only", {
        fullLength: combined.length,
        fullText: combined,
      });
    }
    return combined;
  }
  const parts = [];
  const n = Math.max(1, Math.min(3, Number(sceneCount) || 1));
  for (let i = 0; i < n; i++) {
    const fromEditor = String(scripts?.[i] ?? "").trim();
    const fromSpec = String(canonicalScenes?.[i]?.script_text ?? "").trim();
    const block = fromEditor || fromSpec;
    if (import.meta.env.DEV) {
      console.debug(`[24s diag] buildCombined scene ${i}`, {
        usedEditor: Boolean(fromEditor),
        blockLen: block.length,
        blockHead: block.slice(0, 160),
      });
    }
    if (block) parts.push(block);
  }
  const joined = parts.join("\n\n---\n\n").trim();
  if (import.meta.env.DEV) {
    console.debug("[24s diag] buildCombined branch: concat scenes", {
      partsCount: parts.length,
      joinedLength: joined.length,
      joinedFullText: joined,
    });
  }
  return joined;
}

async function uploadBlobMp4ToGeneratedImagesBucket(blobUrl) {
  const supabase = getBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new Error("Session requise pour publier la vidéo.");
  }
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  const path = `${session.user.id}/studio-video-24s-${Date.now()}.mp4`;
  const { error } = await supabase.storage.from("generated-images").upload(path, blob, {
    contentType: "video/mp4",
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(error.message || "Upload vidéo impossible.");
  const { data: pub } = supabase.storage.from("generated-images").getPublicUrl(path);
  return pub.publicUrl;
}

const VIDEO_QUOTA_EXHAUSTED_MESSAGE =
  "limite vidéo atteint pour ce mois, veuillez attendre la fin du mois pour le renouvellement des vidéos ou acheter des packs vidéos pour continuer a créer";
const NON_SUBSCRIBER_BLOCKED_MESSAGE =
  "Prenez un abonnement pour profiter de ViralWorks Studio et lancer vos générations.";

function isAcceptedImageFile(file) {
  return Boolean(file && typeof file.type === "string" && file.type.startsWith("image/"));
}

function QuotaExhaustedNotice({ open, title, message, actionLabel, onClose, onGoToPacks }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="studio-panel max-w-xl w-full overflow-hidden border border-amber-500/35 bg-[#131920]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-base font-semibold text-gray-200">{title || "Quota mensuel épuisé"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
            <p className="text-sm text-amber-100">{message || VIDEO_QUOTA_EXHAUSTED_MESSAGE}</p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg btn-vws-secondary"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={onGoToPacks}
              className="px-4 py-2 rounded-lg btn-vws-primary font-semibold"
            >
              {actionLabel || "Aller vers Packs vidéos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Libellés d’onglets (1 ou 3 scènes) — plus lisible que « Scène n ». */
function veo3SceneTabLabels(sceneCount) {
  if (sceneCount <= 1) return ["Ta vidéo"];
  return ["Début", "Transformation", "Résultat"];
}

/** Texte normalisé uniquement pour détecter l’intention (mots-clés), pas pour réécrire le script. */
function veo3NormalizeIntentText(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function veo3DetectSubjectKey(n) {
  if (/\bcuisine\b|\bkitchen\b/.test(n)) return "cuisine";
  if (/\bsalle de bain\b|\bbathroom\b|\bdouche\b|\bbaignoire\b|\bwc\b|\btoilettes\b/.test(n)) {
    return "salle_de_bain";
  }
  if (/\batelier\b|\bworkshop\b/.test(n) && /\bbois\b|\bwood\b|\bmenuiserie\b|\bcharpente\b/.test(n)) {
    return "atelier_bois";
  }
  if (/\batelier\b|\bworkshop\b|\bgarage\b/.test(n)) return "atelier";
  if (/\bsalon\b|\bsejour\b|\bliving room\b|\bliving\b/.test(n)) return "salon";
  if (/\bchambre\b|\bbedroom\b/.test(n)) return "chambre";
  if (/\bjardin\b|\bterrasse\b|\bbalcon\b|\bgarden\b|\bexterieur\b/.test(n)) return "jardin";
  if (/\bbureau\b|\boffice\b/.test(n)) return "bureau";
  if (/\bmagasin\b|\bboutique\b|\bcommerce\b|\bstore\b|\brestaurant\b|\bcafe\b/.test(n)) {
    return "commerce";
  }
  if (/\brecette\b|\bcooking\b|\bfood\b|\bplat\b|\brepas\b/.test(n)) return "cuisine_recette";
  if (/\bmaquillage\b|\bbeaute\b|\bmakeup\b|\broutine\b/.test(n)) return "beaute";
  return "piece";
}

function veo3DetectActivityKey(n) {
  if (/\bdemonstration\b|\bdemo\b|\btutoriel\b|\btutorial\b|\bhow to\b|\bcomment faire\b|\bmontre\b|\bpresente\b/.test(n)) {
    return "demo";
  }
  if (/\bconstruction\b|\bconstruire\b|\bbatir\b|\bchantier neuf\b|\bneuf construction\b/.test(n)) {
    return "construction";
  }
  if (/\brenovation\b|\brenover\b|\btravaux\b|\brefaire\b|\brénover\b|\brestaurer\b/.test(n)) {
    return "renovation";
  }
  if (/\btransformation\b|\bmakeover\b|\bavant apres\b|\bavant-apres\b|\bbefore after\b/.test(n)) {
    return "transformation";
  }
  return "renovation";
}

/** Phase : en parcours 3 scènes, alignée sur l’onglet ; en 1 scène, déduite des intentions. */
function veo3DetectPhase(sceneIndex, sceneCount, n) {
  if (sceneCount >= 3) {
    if (sceneIndex <= 0) return "debut";
    if (sceneIndex === 1) return "milieu";
    return "fin";
  }
  const hasFin =
    /\bresultat\b|\bfinal\b|\btermine\b|\bfini\b|\bacheve\b|\bapres travaux\b|\brevele\b|\bfinale\b|\bfinished\b|\bcomplete\b|\bafter\b/.test(
      n,
    );
  const hasDebut =
    /\bavant\b|\bancien\b|\bancienne\b|\babime\b|\bdegrade\b|\bsale\b|\bvieux\b|\bvieille\b|\binitial\b|\bbefore\b|\bstart\b|\bdepart\b/.test(
      n,
    );
  if (hasFin && !hasDebut) return "fin";
  if (hasDebut && !hasFin) return "debut";
  return "milieu";
}

/**
 * Phrase d’aperçu utilisateur : générée à partir de l’intention (mots-clés + phase),
 * sans réutiliser ni filtrer le texte du prompt.
 */
function veo3ScenePlainDescription(raw, sceneIndex = 0, sceneCount = 1) {
  const n = veo3NormalizeIntentText(raw);
  if (!n) {
    return "Ajoute un script dans les options avancées pour décrire ce moment.";
  }

  const subject = veo3DetectSubjectKey(n);
  const activity = veo3DetectActivityKey(n);
  const phase = veo3DetectPhase(sceneIndex, sceneCount, n);

  if (activity === "demo") {
    if (phase === "debut") return "Introduction claire du sujet, contexte immédiatement visible.";
    if (phase === "fin") return "Résultat montré nettement, conclusion facile à comprendre.";
    return "Démonstration en cours, gestes et détails bien mis en avant.";
  }

  if (activity === "construction") {
    if (phase === "debut") return "Projet qui démarre, structure et base déjà visibles.";
    if (phase === "fin") return "Ouvrage terminé, rendu final propre et lisible.";
    return "Chantier actif, le travail avance clairement à l’écran.";
  }

  if (subject === "beaute") {
    if (phase === "debut") return "Visage ou produits présentés avant la mise en beauté.";
    if (phase === "fin") return "Look final harmonieux, changement visible en un coup d’œil.";
    return "Étapes de la routine, le rendu se construit progressivement.";
  }

  if (subject === "cuisine_recette") {
    if (phase === "debut") return "Ingrédients et préparation visibles, cuisine avant l’action.";
    if (phase === "fin") return "Plat prêt à déguster, présentation soignée et appétissante.";
    return "Cuisson ou assemblage en cours, textures et couleurs bien visibles.";
  }

  const T = {
    cuisine: {
      debut: "Cuisine ancienne et abîmée, début de transformation visible.",
      milieu: "Rénovation de cuisine en cours, travaux et matériaux visibles.",
      fin: "Cuisine refaite, espace propre, lumineux et accueillant.",
    },
    salle_de_bain: {
      debut: "Salle de bain datée, besoin de modernisation bien visible.",
      milieu: "Rénovation active, équipements et finitions en cours d’installation.",
      fin: "Salle de bain neuve, ambiance claire et confortable.",
    },
    atelier_bois: {
      debut: "Atelier et bois avant travaux, espace à réorganiser.",
      milieu: "Atelier bois en cours de rénovation, matériaux en place.",
      fin: "Atelier rangé et refait, prêt pour travailler sereinement.",
    },
    atelier: {
      debut: "Atelier brut avant aménagement, potentiel encore à exploiter.",
      milieu: "Aménagement en cours, l’espace de travail se transforme.",
      fin: "Atelier finalisé, outillage et circulation bien pensés.",
    },
    salon: {
      debut: "Salon à rafraîchir, ambiance et volumes avant changement.",
      milieu: "Rénovation du salon en cours, mobilier et finitions évolutifs.",
      fin: "Salon rénové, convivialité et lumière au rendez-vous.",
    },
    chambre: {
      debut: "Chambre avant relooking, confort et style à améliorer.",
      milieu: "Chambre en travaux, couleurs et agencement qui prennent forme.",
      fin: "Chambre reposante, finitions soignées et atmosphère douce.",
    },
    jardin: {
      debut: "Extérieur avant aménagement, terrain ou végétation à structurer.",
      milieu: "Aménagement extérieur en cours, plantation ou structure visible.",
      fin: "Jardin ou terrasse finis, espace vert agréable à vivre.",
    },
    bureau: {
      debut: "Bureau encombré ou daté, besoin de clarté évident.",
      milieu: "Réaménagement du bureau, rangement et ergonomie en progrès.",
      fin: "Bureau réorganisé, cadre de travail net et fonctionnel.",
    },
    commerce: {
      debut: "Lieu commercial avant refonte, image à renouveler visiblement.",
      milieu: "Rénovation du point de vente, agencement et vitrine en évolution.",
      fin: "Commerce rafraîchi, accueil client clair et attractif.",
    },
    piece: {
      debut: "Pièce à rénover, défauts visibles avant intervention.",
      milieu: "Travaux en cours, la pièce se transforme progressivement.",
      fin: "Pièce entièrement rénovée, rendu propre et lumineux.",
    },
  };

  return T[subject]?.[phase] ?? T.piece[phase];
}

const LS_KEY = "history_v2";
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch (err) {
    console.warn("Impossible de charger l'historique local video:", err);
    return [];
  }
}
function saveHistory(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Impossible de sauvegarder l'historique local video:", err);
  }
}
function addHistoryEntry(entry) {
  const items = loadHistory();
  saveHistory([{ ...entry, pinned: false }, ...items]);
  window.dispatchEvent(new Event("onetool:history:changed"));
}

function getVwsBrain() {
  try {
    const raw = sessionStorage.getItem(SS_BRAIN_V2_LAST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.brain || null;
  } catch (err) {
    console.warn("Impossible de charger le contexte VWS:", err);
    return null;
  }
}

/** Max scènes VEO3 dans le tunnel (vidéo longue). */
const VEO3_SCENE_COUNT = 3;

function ensureSceneScripts(arr, count) {
  const c = Math.max(1, Math.min(VEO3_SCENE_COUNT, Math.floor(Number(count)) || 1));
  const src = Array.isArray(arr) ? arr.map((s) => String(s ?? "")) : [];
  const next = src.slice(0, c);
  while (next.length < c) next.push("");
  return next;
}

function ensureVeo3SceneScripts(arr) {
  return ensureSceneScripts(arr, VEO3_SCENE_COUNT);
}

function resolveSequenceType(studioSequenceType) {
  if (studioSequenceType === "three_x_8s" || studioSequenceType === "single_8s") {
    return studioSequenceType;
  }
  const brainInput = getVwsBrain()?.input?.sequenceType;
  return brainInput === "three_x_8s" ? "three_x_8s" : "single_8s";
}

function sceneCountFromSequence(seq) {
  return seq === "three_x_8s" ? 3 : 1;
}

/**
 * Répartit le texte du Script gagnant sur 1 ou 3 scènes (séparateurs ---, ***, titres Scène n, blocs, sinon découpage).
 */
function splitStudioScriptAcrossScenes(raw, sceneCount) {
  const t = String(raw ?? "").trim();
  if (sceneCount <= 1) return [t];
  if (!t) return ensureSceneScripts([], sceneCount);

  const tryDelimited = (text) => {
    for (const sep of [/\n\s*-{3,}\s*\n/, /\n\s*\*{3,}\s*\n/]) {
      const parts = text.split(sep).map((s) => s.trim()).filter(Boolean);
      if (parts.length >= sceneCount) return parts.slice(0, sceneCount);
    }
    const labeled = text
      .split(/\n(?=(?:(?:#{1,3})\s*)?(?:Scène|Scene|Partie)\s*[123])/gi)
      .map((s) => s.trim())
      .filter(Boolean);
    if (labeled.length >= sceneCount) return labeled.slice(0, sceneCount);
    return null;
  };

  const delimited = tryDelimited(t);
  if (delimited) return delimited;

  const blocks = t.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (blocks.length >= sceneCount) {
    const head = blocks.slice(0, sceneCount - 1);
    const tail = blocks.slice(sceneCount - 1).join("\n\n");
    return ensureSceneScripts([...head, tail], sceneCount);
  }
  if (blocks.length === 2 && sceneCount === 3) {
    return ensureSceneScripts([blocks[0], blocks[1], ""], sceneCount);
  }

  const n = t.length;
  const step = Math.max(1, Math.ceil(n / sceneCount));
  const out = [];
  for (let i = 0; i < sceneCount; i++) {
    const start = i * step;
    const end = i === sceneCount - 1 ? n : Math.min(n, (i + 1) * step);
    out.push(t.slice(start, end).trim());
  }
  return ensureSceneScripts(out, sceneCount);
}

function buildVeo3ScriptsFromSources(studioScriptPrompt, sceneCount) {
  if (studioScriptPrompt && typeof studioScriptPrompt === "object" && !Array.isArray(studioScriptPrompt)) {
    const scenes = Array.isArray(studioScriptPrompt.scenes)
      ? studioScriptPrompt.scenes.map((s) => String(s ?? ""))
      : [];
    if (scenes.some((s) => s.trim())) {
      return ensureSceneScripts(scenes, sceneCount);
    }
    const combined = String(studioScriptPrompt.combined ?? "").trim();
    if (combined) {
      return ensureSceneScripts(splitStudioScriptAcrossScenes(combined, sceneCount), sceneCount);
    }
  }
  const brain = getVwsBrain();
  const trimmed = String(studioScriptPrompt ?? "").trim();
  if (trimmed) {
    return ensureSceneScripts(splitStudioScriptAcrossScenes(trimmed, sceneCount), sceneCount);
  }
  if (brain?.videoPrompts?.length) {
    return ensureSceneScripts(brain.videoPrompts, sceneCount);
  }
  return ensureSceneScripts([], sceneCount);
}
function getHookImageFromStudioStep(studioImageStep) {
  if (!studioImageStep || typeof studioImageStep !== "object") return null;
  const urls = Array.isArray(studioImageStep.lastGeneratedImages)
    ? studioImageStep.lastGeneratedImages.filter((u) => typeof u === "string" && u.trim())
    : [];
  if (urls.length === 0) return null;
  const rawIndex = Number(studioImageStep.selectedImageIndex);
  const selectedIndex = Number.isFinite(rawIndex)
    ? Math.max(0, Math.min(Math.floor(rawIndex), urls.length - 1))
    : 0;
  return {
    url: urls[selectedIndex] ?? urls[0],
    urls,
    prompt: String(studioImageStep.lastGeneratedPrompt || studioImageStep.prompt || "").trim(),
  };
}
function getVideoHistory() {
  return loadHistory().filter((i) => i.kind === "video");
}

function userHistoryKey(uid) {
  return uid ? `u:${uid}` : "guest";
}

/** Dernière image validée (étape visuel) : même historique que Image.jsx */
function getLatestValidatedHookImage(uid) {
  const me = userHistoryKey(uid);
  const images = loadHistory()
    .filter((i) => i.kind === "image" && i.owner === me && Array.isArray(i.urls) && i.urls.length > 0)
    .sort((a, b) => {
      const ta = new Date(a.createdAt || a.created_at || 0).getTime();
      const tb = new Date(b.createdAt || b.created_at || 0).getTime();
      return tb - ta;
    });
  const latest = images[0];
  if (!latest) return null;
  return {
    url: latest.urls[0],
    urls: latest.urls,
    prompt: latest.prompt || "",
  };
}

async function getLatestValidatedHookImageForSession(session) {
  if (session?.user?.id) {
    try {
      const rows = await listHistory({ kind: "image", limit: 50 });
      const withUrls = rows
        .map((item) => {
          const urls = Array.isArray(item?.metadata?.urls)
            ? item.metadata.urls
            : Array.isArray(item?.urls)
              ? item.urls
              : [];
          return { item, urls };
        })
        .filter(({ urls }) => urls.length > 0);
      if (withUrls.length > 0) {
        const latest = withUrls[0];
        return {
          url: latest.urls[0],
          urls: latest.urls,
          prompt: latest.item?.input || latest.item?.prompt || "",
        };
      }
    } catch (err) {
      console.warn("Fallback image hook locale:", err);
    }
  }
  return getLatestValidatedHookImage(session?.user?.id);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callHailuoVideoApi(payload, accessToken) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configuration Supabase manquante pour la vidéo Hailuo.");
  }
  if (!accessToken) {
    throw new Error("Session expirée, reconnecte-toi puis réessaie.");
  }
  const endpoint = `${supabaseUrl}/functions/v1/hailuo-video`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || `Erreur HTTP ${res.status}` };
  }
  if (!res.ok) {
    const msg = data?.error || `Erreur HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function callVideoPostprocessApi(payload, accessToken) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Configuration Supabase manquante pour le post-traitement audio.");
  }
  if (!accessToken) {
    throw new Error("Session expirée, reconnecte-toi puis réessaie.");
  }
  const endpoint = `${supabaseUrl}/functions/v1/video-postprocess`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || `Erreur HTTP ${res.status}` };
  }
  if (!res.ok) {
    const msg = data?.error || `Erreur HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Libellé UI après appel réussi à video-postprocess (HTTP 200, y compris dégradations). */
function audioPostprocessStatusLabel(postData) {
  if (!postData || typeof postData !== "object") {
    return "Post-traitement audio : réponse inattendue.";
  }
  const status = String(postData.status || "").trim();
  if (status === "ready") {
    if (postData.voice_url || postData.music_url) {
      return postData.merge_client_side
        ? "Pistes audio prêtes."
        : "Audio ajouté automatiquement.";
    }
    return "Vidéo prête (sans couche audio).";
  }
  if (status === "ready_without_external_pipeline") {
    return "Vidéo prête : aucun pipeline audio distant (secret VIDEO_AUDIO_PIPELINE_URL).";
  }
  if (status === "pipeline_unreachable") {
    return String(
      postData.message ||
        "Pipeline audio injoignable depuis Supabase ; vidéo d’origine affichée."
    );
  }
  if (status === "pipeline_error") {
    return String(
      postData.message || "Erreur du pipeline audio ; vidéo d’origine affichée."
    );
  }
  if (postData.audio_applied) {
    return "Audio ajouté automatiquement.";
  }
  return "Vidéo prête ; couche audio optionnelle non appliquée.";
}

async function applyAudioPostprocessResult({
  postData,
  fallbackVideoUrl,
  setProgressMessage,
  setAudioStatus,
}) {
  const fallback = String(
    fallbackVideoUrl || postData?.source_video_url || ""
  ).trim();

  if (
    postData?.merge_client_side &&
    (postData?.voice_url || postData?.music_url)
  ) {
    try {
      setProgressMessage("Ajout de la voix en cours…");
      const mergedUrl = await mergeClientSideAudioVideo(postData, {
        onProgress: (msg) => setProgressMessage(msg),
      });
      setAudioStatus("Audio ajouté automatiquement.");
      return mergedUrl || fallback;
    } catch (mergeErr) {
      console.warn("Fusion audio côté client échouée:", mergeErr);
      setAudioStatus("Fusion audio impossible ; vidéo d'origine affichée.");
      return fallback;
    }
  }

  const resolvedUrl = String(
    postData?.video_url || postData?.source_video_url || fallback
  ).trim();
  setAudioStatus(audioPostprocessStatusLabel(postData));
  return resolvedUrl || fallback;
}

const Video = forwardRef(function Video(
  {
    studioSequenceType,
    studioScriptPrompt,
    studioImageStep,
    studioCampaignData,
    /** Spec canonique campagne (prioritaire sur legacy `studioCampaignData`). */
    studioCampaignGenerationSpec = null,
    dialogueEnabled = true,
    /** false quand l’étape Vidéo studio n’est pas visible (autre route ou autre onglet) — évite effets inutiles. */
    studioStepActive = true,
    /** Reset complet du flux ViralWorks (équivalent ancien Récap « Faire une autre vidéo »). */
    studioOnStartNewCampaign,
    /** Reset du visuel d’accroche (étape Image) depuis l’étape Vidéo. */
    studioOnResetImageStep,
    onWorkflowVideoStateChange,
    initialWorkflowVideoState,
    /** Incrémenté par ViralWorks si l’idée change au « Préparer » — réinitialise l’aperçu VEO3 sans l’historique local. */
    studioWorkflowSoftResetKey = 0,
  } = {},
  ref
) {
  const [tab, setTab] = useState("veo3");
  const isStudioPage = Boolean(studioCampaignData || studioCampaignGenerationSpec);
  const { session } = useAuth();
  const [showSystemVideo, setShowSystemVideo] = useState(false);
  const [showVideoAidePulse, setShowVideoAidePulse] = useState(() => {
    try {
      if (typeof window === "undefined") return true;
      return !window.sessionStorage.getItem(VIDEO_AIDE_PULSE_SESSION_KEY);
    } catch {
      return true;
    }
  });
  const openVideoAide = useCallback(() => {
    try {
      window.sessionStorage.setItem(VIDEO_AIDE_PULSE_SESSION_KEY, "1");
      window.localStorage.setItem("aide_seen_video", "1");
    } catch {
      /* quota / mode privé */
    }
    setShowVideoAidePulse(false);
    setShowSystemVideo(true);
  }, []);

  useLayoutEffect(() => {
    try {
      setShowVideoAidePulse(!window.sessionStorage.getItem(VIDEO_AIDE_PULSE_SESSION_KEY));
    } catch {
      setShowVideoAidePulse(true);
    }
  }, []);

  useEffect(() => {
    if (session) {
      loadCredits();
    }
  }, [session]);

  const loadCredits = async () => {
    try {
      await getUserCredits();
    } catch (err) {
      console.error("Erreur chargement crédits:", err);
    }
  };

  return (
    <div className="w-full min-w-0">
      {isStudioPage ? (
        <div className="mb-6 space-y-3 md:mb-8">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-200 sm:text-base">
            <Sparkles className="h-4 w-4 shrink-0 text-cyan-400" />
            <span className="truncate">Étape 3 – Votre vidéo virale</span>
          </h2>
          <div className="relative grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 overflow-visible min-[640px]:inline-flex min-[640px]:w-auto min-[640px]:max-w-full min-[640px]:grid-cols-none min-[640px]:flex-row min-[640px]:flex-nowrap min-[640px]:items-center min-[640px]:justify-start min-[640px]:gap-1 min-[640px]:overflow-visible">
            <button
              type="button"
              onClick={openVideoAide}
              className="vws-campagne-aide-btn box-border flex min-h-[44px] min-w-0 w-full max-w-full flex-row flex-nowrap items-center justify-start gap-1.5 overflow-visible px-2 py-2 text-left text-[11px] font-semibold leading-tight max-[639px]:max-w-full min-[640px]:h-auto min-[640px]:w-auto min-[640px]:min-h-0 min-[640px]:shrink-0 min-[640px]:gap-2 min-[640px]:px-3 min-[640px]:py-1.5 min-[640px]:text-sm sm:min-h-0"
            >
              <BookOpen className="vws-campagne-aide-btn__icon shrink-0 max-[639px]:h-3.5 max-[639px]:w-3.5" />
              {showVideoAidePulse ? <span className="pulse-dot shrink-0" aria-hidden="true" /> : null}
              <span className="min-w-0 whitespace-nowrap">Aide pour commencer</span>
            </button>
            <button
              type="button"
              onClick={() => ref?.current?.openHistory?.()}
              className="studio-toolbar-btn box-border inline-flex min-h-[44px] shrink-0 flex-row items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium leading-tight text-gray-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-400 min-[640px]:min-h-0 min-[640px]:gap-1.5 min-[640px]:px-2.5 min-[640px]:py-1.5 min-[640px]:text-sm"
            >
              <History className="h-3.5 w-3.5 shrink-0 text-cyan-500/90" />
              <span className="whitespace-nowrap">Historique</span>
            </button>
          </div>
        </div>
      ) : null}
      {!isStudioPage ? (
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageTitle
            green="Vidéos"
            white="Génération"
            subtitle="Crée des vidéos avec l'intelligence artificielle."
          />

          <div className="w-full space-y-3 sm:w-[340px]">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-300">Étape 3 sur 3 · Vidéo finale</span>
              </div>
              <div className="w-full studio-step-rail">
                <div className="h-full w-full studio-step-rail-fill" />
              </div>
            </div>
            <div className="flex flex-col items-stretch justify-end gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openVideoAide}
                className="vws-campagne-aide-btn w-full text-sm sm:w-auto"
              >
                <BookOpen className="vws-campagne-aide-btn__icon shrink-0" />
                {showVideoAidePulse ? <span className="pulse-dot" aria-hidden="true" /> : null}
                Aide pour commencer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {tab === "veo3" ? (
            <VEO3VideoForm
              ref={ref}
              onCreditsUpdate={loadCredits}
              studioSequenceType={studioSequenceType}
              studioScriptPrompt={studioScriptPrompt}
              studioImageStep={studioImageStep}
              studioCampaignData={studioCampaignData}
              studioCampaignGenerationSpec={studioCampaignGenerationSpec}
              dialogueEnabled={dialogueEnabled}
              studioStepActive={studioStepActive}
              studioOnStartNewCampaign={studioOnStartNewCampaign}
              studioOnResetImageStep={studioOnResetImageStep}
              onWorkflowVideoStateChange={onWorkflowVideoStateChange}
              initialWorkflowVideoState={initialWorkflowVideoState}
              studioWorkflowSoftResetKey={studioWorkflowSoftResetKey}
            />
          ) : (
            <HailuoVideoForm
              onCreditsUpdate={loadCredits}
              studioImageStep={studioImageStep}
              studioScriptPrompt={studioScriptPrompt}
              studioCampaignGenerationSpec={studioCampaignGenerationSpec}
              dialogueEnabled={dialogueEnabled}
              studioOnResetImageStep={studioOnResetImageStep}
              onWorkflowVideoStateChange={onWorkflowVideoStateChange}
              initialWorkflowVideoState={initialWorkflowVideoState}
            />
          )}
        </div>

        <div className={`lg:col-span-1 ${isStudioPage ? "max-[640px]:hidden" : ""}`}>
          <RightPanel model={tab} />
        </div>
      </div>

      <details
        className={`mt-8 rounded-xl card-vws px-4 py-3 sm:px-5 open:border-white/15 transition-colors ${
          isStudioPage ? "max-[640px]:hidden" : ""
        }`}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-gray-500 hover:text-gray-400 select-none [&::-webkit-details-marker]:hidden">
          <Settings2 className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
          <span>
            Réglages avancés — moteur de génération{" "}
            <span className="text-gray-600">(VEO3 / Kling, optionnel)</span>
          </span>
        </summary>
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <p className="mb-3 max-w-2xl text-[11px] leading-relaxed text-gray-500">
            Le mode par défaut convient à la majorité des parcours. Ouvre cette section seulement si tu veux
            explicitement basculer entre deux moteurs techniques.
          </p>
          <div className="studio-panel inline-flex rounded-xl overflow-hidden p-1">
            <TabButton active={tab === "veo3"} onClick={() => setTab("veo3")}>
              <Zap className="w-3.5 h-3.5" />
              <span>VEO3</span>
            </TabButton>
            <TabButton disabled>
              <Wand2 className="w-3.5 h-3.5" />
              <span>Kling</span>
              <span className="ml-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                Bientôt
              </span>
            </TabButton>
          </div>
        </div>
      </details>

      <VideoViraleExplicationSheet open={showSystemVideo} onClose={() => setShowSystemVideo(false)} />
    </div>
  );
});

export default Video;

function TabButton({ active, onClick, disabled, children }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={`px-4 py-2 text-sm font-medium transition-all duration-150 flex items-center gap-2 rounded-lg ${
        disabled
          ? "text-gray-500 cursor-not-allowed opacity-60 border border-transparent"
          : active
          ? "card-vws-active text-emerald-100"
          : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] border border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

function initialVeo3Scripts() {
  const brain = getVwsBrain();
  if (brain?.videoPrompts?.length) {
    return ensureVeo3SceneScripts(brain.videoPrompts);
  }
  return ensureVeo3SceneScripts([]);
}

function initialVeo3HookVisual() {
  const brain = getVwsBrain();
  return brain?.coverPrompt ? String(brain.coverPrompt) : "";
}

function useVideoModelHistory(model) {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const refresh = async () => {
      if (session?.user?.id) {
        try {
          const rows = await listHistory({ kind: "video", limit: 120 });
          setItems(
            rows.filter(
              (i) => (i.model || "").toLowerCase() === model && isHttpUrl(i?.output)
            )
          );
          return;
        } catch (err) {
          console.warn("Fallback historique vidéo local:", err);
        }
      }
      const all = getVideoHistory();
      setItems(
        all.filter((i) => (i.model || "").toLowerCase() === model && isHttpUrl(i?.output))
      );
    };
    refresh();
    window.addEventListener("onetool:history:changed", refresh);
    return () => window.removeEventListener("onetool:history:changed", refresh);
  }, [model, session]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const t = q.toLowerCase();
    return items.filter(
      (i) =>
        (i.input || "").toLowerCase().includes(t) ||
        (i.output || "").toLowerCase().includes(t)
    );
  }, [items, q]);

  const removeOne = async (id) => {
    const item = items.find((i) => i.id === id);
    if (session?.user?.id && item?.user_id) {
      const result = await deleteHistory(id);
      if (!result.success) {
        alert("Erreur lors de la suppression");
        return;
      }
    } else {
      const all = loadHistory();
      saveHistory(all.filter((i) => i.id !== id));
    }
    if (session?.user?.id) {
      const rows = await listHistory({ kind: "video", limit: 120 });
      setItems(
        rows.filter((i) => (i.model || "").toLowerCase() === model && isHttpUrl(i?.output))
      );
    } else {
      setItems(
        getVideoHistory().filter(
          (i) => (i.model || "").toLowerCase() === model && isHttpUrl(i?.output)
        )
      );
    }
  };

  const loadIntoEditor = useCallback((item) => {
    window.dispatchEvent(
      new CustomEvent("onetool:video:load", {
        detail: { input: item.input, output: item.output },
      })
    );
  }, []);

  return { items, filtered, q, setQ, removeOne, loadIntoEditor };
}

const VEO3VideoForm = forwardRef(function VEO3VideoForm(
  {
    onCreditsUpdate,
    studioSequenceType,
    studioScriptPrompt,
    studioImageStep,
    studioCampaignData,
    studioCampaignGenerationSpec = null,
    dialogueEnabled = true,
    studioStepActive = true,
    studioOnStartNewCampaign,
    studioOnResetImageStep,
    onWorkflowVideoStateChange,
    initialWorkflowVideoState,
    studioWorkflowSoftResetKey = 0,
  },
  ref
) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const sceneCount = useMemo(
    () => sceneCountFromSequence(resolveSequenceType(studioSequenceType)),
    [studioSequenceType]
  );
  const [scripts, setScripts] = useState(() =>
    buildVeo3ScriptsFromSources(studioScriptPrompt, sceneCountFromSequence(resolveSequenceType(studioSequenceType)))
  );
  const [activeTab, setActiveTab] = useState(0);
  const [hookVisual, setHookVisual] = useState(initialVeo3HookVisual);
  const [output, setOutput] = useState("");
  /** Format vidéo déduit du visuel d’accroche (9:16 si portrait ou pas d’image, 16:9 si paysage). */
  const [derivedFormat, setDerivedFormat] = useState("9:16");
  const [duration, setDuration] = useState("8s");
  const [audioEnabled] = useState(true);
  const [musicStyle, setMusicStyle] = useState("cinematic");
  const [audioStatus, setAudioStatus] = useState("");
  const [dialogueAuto, setDialogueAuto] = useState(true);
  const [dialogueGlobal, setDialogueGlobal] = useState("");
  const [dialoguePerScene, setDialoguePerScene] = useState(false);
  const [dialogueByScene, setDialogueByScene] = useState(() => ["", "", ""]);
  /** Prompts techniques Veo éditables (studio 24 s, 3 moments) — synchronisés depuis l’aperçu calculé. */
  const [technicalVeoPromptDrafts, setTechnicalVeoPromptDrafts] = useState(() => ["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  /** 1–2 (mode simple) ou 1–6 (chaîne studio) pendant chargement 24 s ; null sinon. */
  const [pipeline24Step, setPipeline24Step] = useState(null);
  /** Dernière frame PNG (data URL) après génération « 24 s » diagnostic. */
  const [viral24LastFrameDataUrl, setViral24LastFrameDataUrl] = useState(null);
  /** Chaîne diagnostic studio : vidéo segment 2 + dernière frame segment 2. */
  const [viral24Segment2VideoUrl, setViral24Segment2VideoUrl] = useState(null);
  const [viral24Segment2LastFrameDataUrl, setViral24Segment2LastFrameDataUrl] = useState(null);
  const [viral24Segment3VideoUrl, setViral24Segment3VideoUrl] = useState(null);
  /** Blob URL après concat FFmpeg — révoquer au reset. */
  const [viral24Assembled24sBlobUrl, setViral24Assembled24sBlobUrl] = useState(null);
  /** Téléchargements directs par clip (24 s) réservés aux admins. */
  const [isAdminVideoUser, setIsAdminVideoUser] = useState(false);
  /** Message d’erreur métier (jamais confondu avec l’URL vidéo affichée dans <video>). */
  const [generationError, setGenerationError] = useState("");
  const [lastVideoTaskId, setLastVideoTaskId] = useState(null);
  const [videoCreatedAt, setVideoCreatedAt] = useState(null);
  const [needsReloadFromCache, setNeedsReloadFromCache] = useState(false);
  const [showQuotaNotice, setShowQuotaNotice] = useState(false);
  const [quotaNoticeMessage, setQuotaNoticeMessage] = useState(VIDEO_QUOTA_EXHAUSTED_MESSAGE);
  const { hasAccess } = usePremiumAccess();
  const [validatedHookImage, setValidatedHookImage] = useState(null);
  const [customHookImage, setCustomHookImage] = useState(null);
  const studioHookImage = useMemo(() => getHookImageFromStudioStep(studioImageStep), [studioImageStep]);
  const hookImageInputRef = useRef(null);
  const studioScriptPromptRef = useRef(studioScriptPrompt);
  studioScriptPromptRef.current = studioScriptPrompt;
  const sceneCountRef = useRef(sceneCount);
  sceneCountRef.current = sceneCount;
  const prevStudioSyncKey = useRef(null);
  const prevHookSyncKey = useRef(null);
  /** 1 = poll segment 1, 2 = poll segment 2 (diagnostic chaîne 24 s). */
  const chainPollPhaseRef = useRef(1);

  const sceneTabLabels = useMemo(() => veo3SceneTabLabels(sceneCount), [sceneCount]);
  const canonicalSpec = useMemo(
    () =>
      normalizeCampaignGenerationSpec(
        studioCampaignGenerationSpec ??
          studioCampaignData?.campaignGenerationSpec ??
          studioCampaignData ??
          createDefaultCampaignGenerationSpec()
      ),
    [studioCampaignData, studioCampaignGenerationSpec]
  );
  const canonicalScenes = useMemo(() => getSafeScenes(canonicalSpec), [canonicalSpec]);
  const isStudio = Boolean(studioCampaignData || studioCampaignGenerationSpec);

  /** Évite les appels IA en boucle pour le découpage auto 24 s (studio). */
  const autoSplit24sGuardRef = useRef(null);
  const autoSplit24sFailedRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!isStudio || !studioStepActive || duration !== "24s" || sceneCount < 3) {
        return;
      }
      const combined = buildCombinedStudioScriptFor24s({
        studioScriptPrompt,
        scripts,
        canonicalScenes,
        sceneCount,
      }).trim();
      if (combined.length < 8) return;

      const s0 = String(scripts[0] ?? "").trim();
      const s1 = String(scripts[1] ?? "").trim();
      const s2 = String(scripts[2] ?? "").trim();
      const tripleIdentical = s0.length > 0 && s0 === s1 && s1 === s2;

      if (!tripleIdentical) {
        autoSplit24sFailedRef.current = null;
        return;
      }

      const guardKey = `${combined.length}|${combined}`;
      if (autoSplit24sFailedRef.current === guardKey) return;
      if (autoSplit24sGuardRef.current === guardKey) return;

      try {
        const [p1, p2, p3] = await splitCampaignPromptIntoThreeVideoSegments(combined);
        if (cancelled) return;
        setScripts(ensureSceneScripts([p1, p2, p3], sceneCount));
        autoSplit24sGuardRef.current = guardKey;
        autoSplit24sFailedRef.current = null;
      } catch (e) {
        console.warn("[Video] auto-split 24s:", e);
        autoSplit24sFailedRef.current = guardKey;
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    isStudio,
    studioStepActive,
    duration,
    sceneCount,
    studioScriptPrompt,
    scripts,
    canonicalScenes,
  ]);

  useEffect(() => {
    const resolved = resolveSequenceType(studioSequenceType);
    if (resolved === "three_x_8s" && duration !== "24s") {
      setDuration("24s");
    }
    if (resolved === "single_8s" && duration === "24s") {
      setDuration("8s");
    }
  }, [studioSequenceType]);

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const historyVm = useVideoModelHistory("veo3");

  useEffect(() => {
    if (typeof onWorkflowVideoStateChange !== "function") return;
    const status = loading ? "generating" : generationError ? "error" : output ? "done" : "idle";
    onWorkflowVideoStateChange({
      status,
      videoId: lastVideoTaskId || null,
      lastError: generationError || "",
      provider: "veo3",
      createdAt: videoCreatedAt || null,
    });
  }, [onWorkflowVideoStateChange, loading, generationError, output, lastVideoTaskId, videoCreatedAt]);

  useEffect(() => {
    if (studioStepActive === false) return;
    const url = validatedHookImage?.url ? String(validatedHookImage.url).trim() : "";
    if (!url) {
      setDerivedFormat("9:16");
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) {
        setDerivedFormat("9:16");
        return;
      }
      setDerivedFormat(h >= w ? "9:16" : "16:9");
    };
    img.onerror = () => setDerivedFormat("9:16");
    img.src = url;
  }, [validatedHookImage?.url, studioStepActive]);

  const restoreVideoFromCachedId = useCallback(async () => {
    const cachedId = String(initialWorkflowVideoState?.videoId || "").trim();
    if (!cachedId || !session?.access_token || loading) return;
    try {
      const res = await refreshVertexVideoUrlFromId(
        cachedId,
        session?.access_token,
        { getAccessToken: getSessionAccessTokenForVertexVeo },
        undefined
      );
      if (res.status === "success" && String(res.videoUrl || "").trim()) {
        setOutput(String(res.videoUrl).trim());
        setViral24LastFrameDataUrl(null);
        setViral24Segment2VideoUrl(null);
        setViral24Segment2LastFrameDataUrl(null);
        setViral24Segment3VideoUrl(null);
        setViral24Assembled24sBlobUrl((prev) => {
          if (prev && isBlobUrl(prev)) {
            try {
              URL.revokeObjectURL(prev);
            } catch {
              /* ignore */
            }
          }
          return null;
        });
        setGenerationError("");
        setLastVideoTaskId(cachedId);
        setVideoCreatedAt(initialWorkflowVideoState?.createdAt || new Date().toISOString());
        setNeedsReloadFromCache(false);
        return;
      }
      setNeedsReloadFromCache(true);
      setGenerationError("Vidéo précédemment générée — cliquez pour recharger.");
    } catch (e) {
      setNeedsReloadFromCache(true);
      const detail =
        e instanceof Error && String(e.message || "").trim()
          ? e.message
          : "Impossible de récupérer la vidéo (réseau ou serveur).";
      setGenerationError(detail);
    }
  }, [initialWorkflowVideoState?.videoId, initialWorkflowVideoState?.createdAt, loading, session?.access_token]);

  useEffect(() => {
    if (!initialWorkflowVideoState?.videoId) return;
    if (initialWorkflowVideoState?.provider && initialWorkflowVideoState.provider !== "veo3") return;
    if (output || loading) return;
    void restoreVideoFromCachedId();
  }, [
    initialWorkflowVideoState?.videoId,
    initialWorkflowVideoState?.provider,
    output,
    loading,
    restoreVideoFromCachedId,
  ]);

  useEffect(() => {
    const payloadKey =
      studioScriptPrompt && typeof studioScriptPrompt === "object" && !Array.isArray(studioScriptPrompt)
        ? JSON.stringify({
            mode: studioScriptPrompt.mode ?? "",
            combined: studioScriptPrompt.combined ?? "",
            scenes: Array.isArray(studioScriptPrompt.scenes) ? studioScriptPrompt.scenes : [],
          })
        : String(studioScriptPrompt ?? "");
    const key = `${sceneCount}|${payloadKey}`;
    if (prevStudioSyncKey.current === key) return;
    prevStudioSyncKey.current = key;
    setScripts(buildVeo3ScriptsFromSources(studioScriptPrompt, sceneCount));
    setActiveTab((t) => (t >= sceneCount ? 0 : t));
  }, [sceneCount, studioScriptPrompt]);

  const sceneIndexForGeneration = activeTab;
  const scriptForGeneration = scripts[sceneIndexForGeneration] ?? "";
  /** Le visuel d’accroche n’est jamais requis ; on n’utilise ceci que pour l’apparence du bouton. */
  const sessionReady = Boolean(session?.access_token);
  const abortRef = useRef(null);

  useEffect(() => {
    if (session) {
      loadCredits();
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) {
      setIsAdminVideoUser(false);
      return () => {
        cancelled = true;
      };
    }
    void isAdmin().then((ok) => {
      if (!cancelled) setIsAdminVideoUser(Boolean(ok));
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const loadCredits = async () => {
    try {
      const userCredits = await getUserCredits();
      void userCredits;
    } catch (err) {
      console.error("Erreur chargement crédits:", err);
    }
  };

  useEffect(() => {
    let active = true;
    const syncHookImage = async () => {
      if (customHookImage) {
        setValidatedHookImage(customHookImage);
        return;
      }
      if (studioImageStep != null && typeof studioImageStep === "object") {
        setValidatedHookImage(studioHookImage);
        return;
      }
      const latest = await getLatestValidatedHookImageForSession(session);
      if (active) setValidatedHookImage(latest);
    };
    syncHookImage();
    if (studioImageStep == null) {
      window.addEventListener("onetool:history:changed", syncHookImage);
    }
    return () => {
      active = false;
      if (studioImageStep == null) {
        window.removeEventListener("onetool:history:changed", syncHookImage);
      }
    };
  }, [session, studioHookImage, studioImageStep, customHookImage]);

  useEffect(() => {
    return () => {
      if (customHookImage?.isObjectUrl && customHookImage.url) {
        URL.revokeObjectURL(customHookImage.url);
      }
    };
  }, [customHookImage]);

  useEffect(() => {
    const key = `${validatedHookImage?.url || ""}|${validatedHookImage?.prompt || ""}`;
    if (prevHookSyncKey.current === key) return;
    prevHookSyncKey.current = key;
    setHookVisual(String(validatedHookImage?.prompt || "").trim());
  }, [validatedHookImage?.url, validatedHookImage?.prompt]);

  const openOwnImagePicker = () => {
    hookImageInputRef.current?.click();
  };

  const handleOwnImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isAcceptedImageFile(file)) {
      alert("Choisis uniquement une image (jpg, png, webp, etc.).");
      event.target.value = "";
      return;
    }

    if (customHookImage?.isObjectUrl && customHookImage.url) {
      URL.revokeObjectURL(customHookImage.url);
    }

    const url = URL.createObjectURL(file);
    const nextImage = {
      url,
      prompt: "",
      source: "upload",
      fileName: file.name,
      isObjectUrl: true,
    };
    setCustomHookImage(nextImage);
    setValidatedHookImage(nextImage);
    event.target.value = "";
  };

  const clearHookImageSelection = () => {
    if (customHookImage?.isObjectUrl && customHookImage.url) {
      URL.revokeObjectURL(customHookImage.url);
    }
    setCustomHookImage(null);
    setValidatedHookImage({ url: "", prompt: "" });
    setHookVisual("");
    if (hookImageInputRef.current) {
      hookImageInputRef.current.value = "";
    }
  };

  const generate = async () => {
    console.log("[Video.jsx] generate() clicked", {
      duration,
      isStudio,
      loading,
      hasSession: Boolean(session?.access_token),
    });
    if (loading) return;

    if (!session?.access_token) {
      console.warn("[Video.jsx] generate() blocked: no session access_token");
      alert("Connecte-toi pour lancer la génération vidéo.");
      return;
    }

    const canonicalScriptTrim = String(canonicalScenes?.[sceneIndexForGeneration]?.script_text || "").trim();
    const scriptTrim = canonicalScriptTrim || String(scriptForGeneration || "").trim();

    const combinedFor24s = buildCombinedStudioScriptFor24s({
      studioScriptPrompt,
      scripts,
      canonicalScenes,
      sceneCount,
    }).trim();

    const studioChain24 = duration === "24s" && isStudio && sceneCount >= 3;
    const promptSeg1 =
      studioChain24 ? String(technicalVeoPromptDrafts[0] ?? "").trim() || combinedFor24s : "";
    const promptSeg2 =
      studioChain24 ? String(technicalVeoPromptDrafts[1] ?? "").trim() || combinedFor24s : "";
    const promptSeg3 =
      studioChain24 ? String(technicalVeoPromptDrafts[2] ?? "").trim() || combinedFor24s : "";

    const effectivePrompt24s =
      duration === "24s" && !studioChain24
        ? String(technicalVeoPromptDrafts[activeTab] ?? "").trim() || combinedFor24s
        : combinedFor24s;

    if (duration === "24s") {
      if (studioChain24) {
        if (promptSeg1.length < 8 || promptSeg2.length < 8 || promptSeg3.length < 8) {
          console.warn("[Video.jsx] generate() blocked: prompts seg1/2/3 too short", {
            promptSeg1Len: promptSeg1.length,
            promptSeg2Len: promptSeg2.length,
            promptSeg3Len: promptSeg3.length,
          });
          alert(
            "Pour enchaîner trois clips 8 s, les prompts techniques Veo « Début », « Transformation » et « Résultat » doivent faire au moins 8 caractères chacun (options avancées)."
          );
          return;
        }
      } else if (effectivePrompt24s.length < 8) {
        console.warn("[Video.jsx] generate() blocked: effectivePrompt24s too short", {
          effectivePrompt24sLen: effectivePrompt24s.length,
        });
        alert(
          isStudio
            ? "Pour une vidéo 24 s, le prompt technique Veo du moment actif (ou le script campagne combiné) doit faire au moins 8 caractères. Complète les options avancées puis réessaie."
            : "Pour une vidéo 24 s, le script campagne (réuni dans les options avancées ou issu du tunnel) doit faire au moins 8 caractères. Complète le texte des scènes puis réessaie."
        );
        return;
      }
    } else if (scriptTrim.length < 8) {
      console.warn("[Video.jsx] generate() blocked: scriptTrim too short", {
        scriptTrimLen: scriptTrim.length,
        activeTab,
      });
      alert(
        `Le script du moment « ${sceneTabLabels[activeTab] ?? `Partie ${activeTab + 1}`} » est trop court (minimum 8 caractères). Ouvre « Options avancées » pour compléter le texte. Aucun visuel d’accroche n’est nécessaire pour générer.`
      );
      return;
    }

    let manualDialogueLine = "";
    if (dialogueEnabled && !dialogueAuto) {
      if (sceneCount > 1 && dialoguePerScene) {
        manualDialogueLine = String(dialogueByScene[sceneIndexForGeneration] ?? "").trim();
      } else {
        manualDialogueLine = dialogueGlobal.trim();
      }
    }
    const hookPromptForValidation =
      String(hookVisual || "").trim() ||
      String(validatedHookImage?.prompt || "").trim();
    const validateOne = (label, text) => {
      const base = String(text || "").trim();
      // On garde les ajouts "visuel + dialogue" uniquement sur le segment 1 (contexte global de la vidéo).
      const decorated =
        label.startsWith("Segment 1")
          ? [
              base,
              hookPromptForValidation && sceneIndexForGeneration === 0
                ? `Visuel d'accroche :\n${hookPromptForValidation}`
                : "",
              manualDialogueLine ? `À dire à l’écran : ${manualDialogueLine}` : "",
            ]
              .filter(Boolean)
              .join("\n\n")
          : base;
      const check = validateIdeaLength(decorated);
      if (check.ok) return true;
      const msg = String(check.message || "").toLowerCase().includes("texte trop long")
        ? `${label} trop long — ${check.message}`
        : `${label} invalide — ${check.message}`;
      console.warn("[Video.jsx] generate() blocked: validateIdeaLength failed", {
        label,
        message: msg,
      });
      setGenerationError(msg);
      return false;
    };

    if (duration === "24s" && studioChain24) {
      // Validation individuelle par segment (pas de concat des 3 prompts).
      if (!validateOne("Segment 1 (Début)", promptSeg1)) return;
      if (!validateOne("Segment 2 (Transformation)", promptSeg2)) return;
      if (!validateOne("Segment 3 (Résultat)", promptSeg3)) return;
    } else {
      const textToValidate =
        duration === "24s"
          ? effectivePrompt24s
          : scriptTrim;
      if (!validateOne("Script", textToValidate)) return;
    }

    if (!canUseVideoAttempt()) {
      const bypass =
        Boolean(session) && (await hasEnoughCredits(VIDEO_GENERATION_COST));
      if (!bypass) {
        console.warn("[Video.jsx] generate() blocked: workflow video attempt limit reached");
        alert(
          "Tu as atteint la limite de générations vidéo pour ce parcours (incluant la variante). Valide et enregistre ta vidéo, ou lance un nouveau projet depuis le récap (« Faire une autre vidéo ») ou en réinitialisant la campagne."
        );
        return;
      }
    }
    const shouldReserveCredit = shouldDebitVideoCredit();

    if (session && shouldReserveCredit) {
      const hasCredits = await hasEnoughCredits(VIDEO_GENERATION_COST);
      if (!hasCredits) {
        console.warn("[Video.jsx] generate() blocked: insufficient server credits");
        setQuotaNoticeMessage(
          hasAccess ? VIDEO_QUOTA_EXHAUSTED_MESSAGE : NON_SUBSCRIBER_BLOCKED_MESSAGE
        );
        setShowQuotaNotice(true);
        capturePostHog("quota_limit_reached", { step: "video" });
        return;
      }
    }

    const hadOutput = Boolean(String(output || "").trim());
    const durationSeconds = parseVideoDurationSeconds(duration);
    if (hadOutput) {
      capturePostHog("video_regenerated", { duration_seconds: durationSeconds });
    } else {
      capturePostHog("video_generation_started", { duration_seconds: durationSeconds });
    }

    setLoading(true);
    setShowQuotaNotice(false);
    setOutput("");
    setViral24LastFrameDataUrl(null);
    setViral24Segment2VideoUrl(null);
    setViral24Segment2LastFrameDataUrl(null);
    setViral24Segment3VideoUrl(null);
    setViral24Assembled24sBlobUrl((prev) => {
      if (prev && isBlobUrl(prev)) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
    setGenerationError("");
    setLastVideoTaskId(null);
    setVideoCreatedAt(null);
    setNeedsReloadFromCache(false);
    setCopied(false);
    setProgress(0);
    setProgressMessage("Initialisation...");
    setAudioStatus("");

    abortRef.current?.abort?.();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      setProgress(10);
      setProgressMessage(
        shouldReserveCredit ? "Vérification du quota vidéo…" : "Préparation de la variante…"
      );
      consumeVideoAttempt({ debitedCredit: false });

      if (duration === "24s") {
        const hookArr = Array.isArray(studioImageStep?.sceneHookImages) ? studioImageStep.sceneHookImages : [];
        const hook1Studio = typeof hookArr[0] === "string" ? hookArr[0] : "";
        const hook1 =
          hook1Studio.trim() || String(validatedHookImage?.url || "").trim() || "";

        if (studioChain24) {
          setPipeline24Step(1);
          setProgress(12);
          setProgressMessage("1/6 — Démarrage…");
          chainPollPhaseRef.current = 1;
          const out = await generateVeo3DiagnosticSegment1Through3AndConcat(
            promptSeg1,
            promptSeg2,
            promptSeg3,
            hook1 || null,
            {
              signal: ctrl.signal,
              onProgress: ({ step, message }) => {
                chainPollPhaseRef.current = step <= 2 ? 1 : step <= 4 ? 2 : step <= 5 ? 3 : 3;
                setPipeline24Step(step);
                const pct =
                  step === 1
                    ? 12
                    : step === 2
                      ? 24
                      : step === 3
                        ? 38
                        : step === 4
                          ? 50
                          : step === 5
                            ? 68
                            : 88;
                setProgress(pct);
                setProgressMessage(`${step}/6 — ${message}`);
              },
              onPollTick: (i, max) => {
                const phase = chainPollPhaseRef.current;
                const base = phase === 1 ? 12 : phase === 2 ? 36 : 58;
                const span = phase === 1 ? 14 : phase === 2 ? 16 : 22;
                const p = base + Math.floor((span * (i + 1)) / Math.max(1, max));
                setProgress(Math.min(base + span, p));
                const phaseLabel = phase === 1 ? "1" : phase === 2 ? "3" : "5";
                setProgressMessage(
                  `${phaseLabel}/6 — Génération Veo… (${i + 1}/${max})`
                );
              },
              onAssemblyProgress: ({ percent, message }) => {
                console.log("[Video.jsx studioChain24 onAssemblyProgress]", {
                  percent,
                  message,
                });
                setProgress(percent);
                setProgressMessage(`6/6 — ${message}`);
              },
            }
          );
          setLastVideoTaskId(String(out.segment3.taskId || "").trim() || null);
          setVideoCreatedAt(new Date().toISOString());
          setProgress(100);
          setProgressMessage("6/6 — Terminé");
          setPipeline24Step(6);
          setGenerationError("");
          setAudioStatus(
            "Mode 24 s (diagnostic) : trois clips 8 s + deux images fin de clip + assemblage ~24 s ; post-traitement audio studio non appliqué."
          );
          setViral24LastFrameDataUrl(out.segment1.lastFrameDataUrl);
          setViral24Segment2VideoUrl(out.segment2.videoUrl);
          setViral24Segment2LastFrameDataUrl(out.segment2.lastFrameDataUrl);
          setViral24Segment3VideoUrl(out.segment3.videoUrl);
          setViral24Assembled24sBlobUrl(out.assembled24sBlobUrl);
          setOutput(out.segment1.videoUrl);
        } else {
          setPipeline24Step(1);
          setProgress(12);
          setProgressMessage("1/2 — Génération Veo 8 s…");
          const { taskId, videoUrl, lastFrameDataUrl } = await generateVeo3EightSecondsAndLastFrame(
            effectivePrompt24s,
            hook1 || null,
            {
              signal: ctrl.signal,
              onProgress: ({ step, message }) => {
                setPipeline24Step(step);
                setProgress(step === 1 ? 55 : 90);
                setProgressMessage(`${step}/2 — ${message}`);
              },
              onPollTick: (i, max) => {
                const p = 12 + Math.min(52, Math.floor(((i + 1) / max) * 52));
                setProgress(p);
                setProgressMessage(`1/2 — Génération Veo 8 s… (${i + 1}/${max})`);
              },
            }
          );
          setLastVideoTaskId(String(taskId || "").trim() || null);
          setVideoCreatedAt(new Date().toISOString());
          setProgress(100);
          setProgressMessage("2/2 — Terminé");
          setPipeline24Step(2);
          setGenerationError("");
          setAudioStatus(
            "Mode 24 s (diagnostic) : un clip 8 s + dernière image ; post-traitement audio studio non appliqué."
          );
          setViral24LastFrameDataUrl(lastFrameDataUrl);
          setOutput(videoUrl);
        }
      } else {
        setProgress(25);
        setProgressMessage("Création de la tâche vidéo...");

        const durationSec =
          duration === "4s" ? 4 : duration === "6s" ? 6 : 8;

        const selectedHookImageUrl = String(validatedHookImage?.url || "").trim();
        const selectedHookPrompt = String(validatedHookImage?.prompt || "").trim();
        const hookPromptLive =
          String(hookVisual || "").trim() ||
          selectedHookPrompt ||
          canonicalSpec.creative.hook_visual.prompt_text ||
          "";
        const finalAspectRatio = selectedHookImageUrl
          ? (derivedFormat === "16:9" ? "16:9" : "9:16")
          : "9:16";
        const finalGenerationMode = selectedHookImageUrl ? "image_to_video" : "text_to_video";
        const baseScenes = getSafeScenes(canonicalSpec);
        const dialogueForActiveScene =
          dialogueEnabled && !dialogueAuto ? manualDialogueLine : "";
        const mergedScenes = [0, 1, 2].map((i) => ({
          ...baseScenes[i],
          ...(i === sceneIndexForGeneration ? { dialogue_text: dialogueForActiveScene } : {}),
        }));
        const generationOwnedSpec = normalizeCampaignGenerationSpec({
          ...canonicalSpec,
          creative: {
            ...canonicalSpec.creative,
            scenes: mergedScenes,
            hook_visual: {
              ...canonicalSpec.creative.hook_visual,
              // Owner final at generation time: Video.jsx
              selected_image_url: selectedHookImageUrl,
              prompt_text: hookPromptLive,
            },
          },
          rendering: {
            ...canonicalSpec.rendering,
            // Owner final unique: Video.jsx
            aspect_ratio: finalAspectRatio,
            generation_mode: finalGenerationMode,
            duration_seconds: durationSec,
            audio: {
              ...canonicalSpec.rendering.audio,
              dialogue_enabled: dialogueEnabled,
              music_style: audioEnabled ? musicStyle : "none",
            },
          },
          provider_overrides: {
            ...canonicalSpec.provider_overrides,
            veo3: {
              ...canonicalSpec.provider_overrides.veo3,
              aspect_ratio: finalAspectRatio,
              generation_mode: finalGenerationMode,
              initial_image_url: selectedHookImageUrl || null,
              prompt: "",
              // Intentionally DO NOT set `model` here (owner: vertexVeoVideo.ts)
              // Intentionally DO NOT set task_id here (owner: vertexVeoVideo.ts)
            },
          },
        });

        const { prompt: fullPrompt, dialogueText } = buildVeo3Prompt(
          generationOwnedSpec,
          sceneIndexForGeneration
        );
        console.log('[DEBUG dialogueText]', dialogueText);
        console.log("[DEBUG fullPrompt]", fullPrompt);
        const veoClientOpts = { getAccessToken: getSessionAccessTokenForVertexVeo };

        const { taskId, model: veoModel } = await createVertexVeoVideoTask(
          generationOwnedSpec,
          fullPrompt,
          session?.access_token,
          veoClientOpts
        );
        setLastVideoTaskId(String(taskId || "").trim() || null);
        setVideoCreatedAt(new Date().toISOString());
        setVideoCreatedAt(new Date().toISOString());

        const maxPoll = 90;
        const pollModelCandidate = String(
          veoModel || canonicalSpec.provider_overrides?.veo3?.status_poll?.model || ""
        ).trim();
        const { videoUrl } = await pollVertexVeoUntilComplete(taskId, session?.access_token, {
          maxAttempts: maxPoll,
          intervalMs: 4000,
          signal: ctrl.signal,
          // Guard: if model absent before first create return, fallback poll without explicit model.
          model: pollModelCandidate || undefined,
          getAccessToken: getSessionAccessTokenForVertexVeo,
          onTick: (i, max) => {
            // (i+1)/max : avance même au premier tick ; plafond 82 % tant que le poll n’a pas fini.
            const p = 30 + Math.min(52, Math.floor(((i + 1) / max) * 52));
            setProgress(p);
            setProgressMessage(`Génération vidéo en cours… (${i + 1}/${max})`);
          },
        });

        setProgress(85);
        setProgressMessage("Vidéo générée");

        let finalVideoUrl = videoUrl;
        if (audioEnabled && session?.access_token) {
          setProgress(90);
          setProgressMessage("Finalisation de la piste sonore…");
          try {
            const postToken =
              (await getSessionAccessTokenForVertexVeo()) || session.access_token;
            const postData = await callVideoPostprocessApi(
              {
                video_url: videoUrl,
                voice_text: "",
                voice_context: {
                  profession: generationOwnedSpec?.campaign?.profession || "",
                  scene_idea:
                    generationOwnedSpec?.campaign?.core_idea ||
                    scripts[sceneIndexForGeneration] ||
                    "",
                },
                music_style: musicStyle,
                enable_tts: dialogueEnabled,
                enable_music: true,
                model: "veo3",
              },
              postToken
            );
            finalVideoUrl = await applyAudioPostprocessResult({
              postData,
              fallbackVideoUrl: videoUrl,
              setProgressMessage,
              setAudioStatus,
            });
          } catch (postErr) {
            console.warn("Post-traitement audio non appliqué:", postErr);
            setAudioStatus(
              "Échec de l’appel au service de post-traitement ; vérifie la session et la console réseau."
            );
          }
        }

        setProgress(100);
        setProgressMessage("Vidéo prête");
        setGenerationError("");
        setOutput(finalVideoUrl);
        capturePostHog("video_generation_completed", {
          duration_seconds: parseVideoDurationSeconds(duration),
          success: true,
        });
      }

    } catch (e) {
      if (e.name === "AbortError") {
        setGenerationError("Génération annulée.");
        setOutput("");
        setViral24LastFrameDataUrl(null);
        return;
      }
      const errorMessage = e?.message || "Erreur lors de la génération";
      setOutput("");
      setViral24LastFrameDataUrl(null);
      setGenerationError(errorMessage);
      capturePostHog("video_generation_failed", {
        error_type: classifyErrorType(e, "generation"),
        error_message: errorMessage,
      });
      trackPostHogError(errorMessage, "/viralworks", "generation");
      console.error("Erreur génération vidéo VEO3:", e);
      if (session) {
        await loadCredits();
        if (onCreditsUpdate) onCreditsUpdate();
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      setPipeline24Step(null);
      setTimeout(() => {
        setProgress(0);
        setProgressMessage("");
      }, 500);
    }
  };

  const generateRef = useRef(generate);
  generateRef.current = generate;
  /** Référence vers `downloadVideoFileExport` (déclaré plus bas) — utilisée par l’imperative handle pour exposer le téléchargement à la barre CTA mobile (ViralWorks). */
  const downloadVideoRef = useRef(null);
  const openHistoryDrawer = useCallback(() => {
    setHistoryDrawerOpen(true);
    setSelectedHistoryId(null);
  }, []);
  useImperativeHandle(
    ref,
    () => ({
      generate: () => {
        void generateRef.current?.();
      },
      openHistory: openHistoryDrawer,
      downloadVideo: () => {
        void downloadVideoRef.current?.();
      },
    }),
    [openHistoryDrawer]
  );

  useEffect(() => {
    const onVideoLoad = (e) => {
      const input = e?.detail?.input;
      if (typeof input !== "string") return;
      setScripts((prev) => {
        const next = [...ensureSceneScripts(prev, sceneCount)];
        const idx = activeTab;
        if (idx >= 0 && idx < next.length) next[idx] = input;
        return next;
      });
    };
    window.addEventListener("onetool:video:load", onVideoLoad);
    return () => window.removeEventListener("onetool:video:load", onVideoLoad);
  }, [activeTab, sceneCount]);

  const goToVideoPacks = () => {
    navigate(
      hasAccess ? "/boutique?section=packs-videos" : "/boutique?section=subscription"
    );
  };

  const recapInputForHistory = () =>
    scripts
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join("\n\n---\n\n");

  const reset = () => {
    abortRef.current?.abort?.();
    try {
      studioOnResetImageStep?.();
    } catch {
      /* ignore */
    }
    const brain = getVwsBrain();
    setScripts(buildVeo3ScriptsFromSources(studioScriptPromptRef.current, sceneCountRef.current));
    setCustomHookImage(null);
    setValidatedHookImage(studioImageStep ? studioHookImage : { url: "", prompt: "" });
    setHookVisual(
      studioImageStep
        ? String(studioHookImage?.prompt || "").trim()
        : brain?.coverPrompt
        ? String(brain.coverPrompt)
        : ""
    );
    setActiveTab(0);
    setOutput("");
    setViral24LastFrameDataUrl(null);
    setGenerationError("");
    setLoading(false);
    setProgress(0);
    setProgressMessage("");
    setPipeline24Step(null);
    setDuration("8s");
    setMusicStyle("cinematic");
    setAudioStatus("");
    setDialogueAuto(true);
    setDialogueGlobal("");
    setDialoguePerScene(false);
    setDialogueByScene(["", "", ""]);
    setCopied(false);
    setLastVideoTaskId(null);
    setVideoCreatedAt(null);
    setNeedsReloadFromCache(false);
    setTechnicalVeoPromptDrafts(["", "", ""]);
    setViral24Segment2VideoUrl(null);
    setViral24Segment2LastFrameDataUrl(null);
    setViral24Segment3VideoUrl(null);
    setViral24Assembled24sBlobUrl((prev) => {
      if (prev && isBlobUrl(prev)) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
  };

  const prepareAnotherVideoVersion = () => {
    if (output && isBlobUrl(output)) {
      try {
        URL.revokeObjectURL(output);
      } catch {
        /* ignore */
      }
    }
    if (viral24Segment2VideoUrl && isBlobUrl(viral24Segment2VideoUrl)) {
      try {
        URL.revokeObjectURL(viral24Segment2VideoUrl);
      } catch {
        /* ignore */
      }
    }
    if (viral24Segment3VideoUrl && isBlobUrl(viral24Segment3VideoUrl)) {
      try {
        URL.revokeObjectURL(viral24Segment3VideoUrl);
      } catch {
        /* ignore */
      }
    }
    if (viral24Assembled24sBlobUrl && isBlobUrl(viral24Assembled24sBlobUrl)) {
      try {
        URL.revokeObjectURL(viral24Assembled24sBlobUrl);
      } catch {
        /* ignore */
      }
    }
    setOutput("");
    setViral24LastFrameDataUrl(null);
    setViral24Segment2VideoUrl(null);
    setViral24Segment2LastFrameDataUrl(null);
    setViral24Segment3VideoUrl(null);
    setViral24Assembled24sBlobUrl(null);
    setGenerationError("");
    setLastVideoTaskId(null);
    setVideoCreatedAt(null);
    setNeedsReloadFromCache(false);
    setCopied(false);
  };

  const prevStudioSoftResetRef = useRef(null);
  useEffect(() => {
    if (!isStudio) return;
    const k = Number(studioWorkflowSoftResetKey) || 0;
    if (prevStudioSoftResetRef.current === null) {
      prevStudioSoftResetRef.current = k;
      return;
    }
    if (k === prevStudioSoftResetRef.current) return;
    prevStudioSoftResetRef.current = k;
    if (k === 0) return;
    try {
      abortRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    prepareAnotherVideoVersion();
    setLoading(false);
    setProgress(0);
    setProgressMessage("");
    setPipeline24Step(null);
    setNeedsReloadFromCache(false);
  }, [isStudio, studioWorkflowSoftResetKey]);

  const downloadPromptVideoExport = () => {
    const text = recapInputForHistory().trim();
    if (!text) {
      alert(
        "Aucun prompt vidéo enregistré à télécharger. Passe par l’étape Vidéo virale d’abord."
      );
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

  const downloadHookImageExport = async () => {
    const hookImageUrl = String(validatedHookImage?.url || "").trim();
    if (!hookImageUrl) {
      alert("Aucune image validée à télécharger.");
      return;
    }
    await downloadUrlFile(
      hookImageUrl,
      `viralworks-image-${new Date().toISOString().slice(0, 10)}.png`
    );
  };

  const downloadViral24LastFrameExport = () => {
    const dataUrl = String(viral24LastFrameDataUrl || "").trim();
    if (!dataUrl.startsWith("data:image/")) {
      alert("Aucune dernière image à télécharger pour le moment.");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `viralworks-derniere-frame-clip1-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadViral24Segment2LastFrameExport = () => {
    const dataUrl = String(viral24Segment2LastFrameDataUrl || "").trim();
    if (!dataUrl.startsWith("data:image/")) {
      alert("Aucune dernière image du clip 2 à télécharger pour le moment.");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `viralworks-derniere-frame-clip2-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  /** Téléchargement direct d’un clip (sans crédit ni historique), admin + 24 s uniquement. */
  const downloadAdmin24sClipFile = async (url, clipIndex) => {
    if (duration !== "24s" || !isAdminVideoUser) return;
    const u = String(url || "").trim();
    if (!isVideoPlayerUrl(u)) {
      alert("Aucune vidéo téléchargeable pour ce clip.");
      return;
    }
    const fn = `viralworks-24s-clip${clipIndex}-${new Date().toISOString().slice(0, 10)}.mp4`;
    if (isBlobUrl(u)) {
      try {
        const a = document.createElement("a");
        a.href = u;
        a.download = fn;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        console.error(e);
        alert("Téléchargement impossible pour cette prévisualisation locale.");
      }
      return;
    }
    await downloadUrlFile(u, fn);
  };

  const downloadAdmin24sAssembledFile = async () => {
    if (duration !== "24s" || !isAdminVideoUser) return;
    const u = String(viral24Assembled24sBlobUrl || "").trim();
    if (!isVideoPlayerUrl(u)) {
      alert("Aucune vidéo assemblée à télécharger pour le moment.");
      return;
    }
    const fn = `viralworks-24s-assembled-${new Date().toISOString().slice(0, 10)}.mp4`;
    if (isBlobUrl(u)) {
      try {
        const a = document.createElement("a");
        a.href = u;
        a.download = fn;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        console.error(e);
        alert("Téléchargement impossible pour cette vidéo locale.");
      }
      return;
    }
    await downloadUrlFile(u, fn);
  };

  const downloadVideoFileExport = async () => {
    if (!output?.trim() || !isVideoPlayerUrl(output)) {
      alert("Aucune vidéo finale téléchargeable pour le moment.");
      return;
    }

    let outputToPersist = String(output).trim();
    if (isBlobUrl(outputToPersist)) {
      const blobRef = outputToPersist;
      try {
        outputToPersist = await uploadBlobMp4ToGeneratedImagesBucket(outputToPersist);
        setOutput(outputToPersist);
        URL.revokeObjectURL(blobRef);
      } catch (err) {
        alert(
          err instanceof Error
            ? err.message
            : "Impossible de publier la vidéo. Vérifie ta session et le bucket de stockage."
        );
        return;
      }
    }

    const hookImageUrl = String(validatedHookImage?.url || "").trim();
    const hookImagePrompt = String(validatedHookImage?.prompt || "").trim();

    try {
      if (session?.user?.id && shouldDebitVideoCredit()) {
        const hasCredits = await hasEnoughCredits(VIDEO_GENERATION_COST);
        if (!hasCredits) {
          setQuotaNoticeMessage(
            hasAccess ? VIDEO_QUOTA_EXHAUSTED_MESSAGE : NON_SUBSCRIBER_BLOCKED_MESSAGE
          );
          setShowQuotaNotice(true);
          capturePostHog("quota_limit_reached", { step: "video_download" });
          return;
        }
        const debitResult = await debitCredits(
          VIDEO_GENERATION_COST,
          "video_generation",
          { model: "veo3", format: derivedFormat, duration: duration, step: "telecharger_video" }
        );
        if (!debitResult.success) {
          alert(
            debitResult.error ||
              "Impossible de débiter la vidéo sur ton solde. Vérifie tes vidéos disponibles puis réessaie."
          );
          return;
        }
        markVideoWorkflowCreditConsumed();
        await loadCredits();
        if (onCreditsUpdate) onCreditsUpdate();
      }

      if (!session?.user?.id) {
        addHistoryEntry({
          id: crypto.randomUUID?.() || String(Date.now()),
          kind: "video",
          input: recapInputForHistory(),
          output: outputToPersist,
          model: "veo3",
          format: derivedFormat,
          duration: duration,
          hookImageUrl: hookImageUrl || null,
          hookImagePrompt: hookImagePrompt || null,
          audioEnabled: audioEnabled,
          musicStyle: audioEnabled ? musicStyle : null,
          createdAt: new Date().toISOString(),
        });
      }

      if (session?.user?.id) {
        try {
          await saveHistorySupabase({
            kind: "video",
            input: recapInputForHistory(),
            output: outputToPersist,
            model: "veo3",
            metadata: {
              format: derivedFormat,
              duration: duration,
              hookImageUrl: hookImageUrl || null,
              hookImagePrompt: hookImagePrompt || null,
              audioEnabled: audioEnabled,
              musicStyle: audioEnabled ? musicStyle : null,
            },
          });
        } catch (err) {
          console.warn("Erreur sauvegarde Supabase (non bloquant):", err);
        }
      }

      const filename =
        duration === "24s"
          ? `viralworks-video-24s-${new Date().toISOString().slice(0, 10)}.mp4`
          : `viralworks-video-${new Date().toISOString().slice(0, 10)}.mp4`;
      await downloadUrlFile(outputToPersist, filename);

      capturePostHog("video_downloaded", {
        duration_seconds: parseVideoDurationSeconds(duration),
      });

      alert("Vidéo téléchargée et enregistrée dans votre profil avec succès !");

      const brain = getVwsBrain();
      setScripts(buildVeo3ScriptsFromSources(studioScriptPromptRef.current, sceneCountRef.current));
      setHookVisual(brain?.coverPrompt ? String(brain.coverPrompt) : "");
      setActiveTab(0);
      setGenerationError("");
      setDuration("8s");
      setMusicStyle("cinematic");
      setAudioStatus("");
      setDialogueAuto(true);
      setDialogueGlobal("");
      setDialoguePerScene(false);
      setDialogueByScene(["", "", ""]);
      setCopied(false);
      window.dispatchEvent(new Event("onetool:history:changed"));
    } catch (err) {
      console.error("Erreur téléchargement/enregistrement:", err);
      alert("Erreur lors du téléchargement et de l'enregistrement");
    }
  };
  downloadVideoRef.current = downloadVideoFileExport;

  const handleDelete = () => {
    if (confirm("Supprimer cette vidéo ? Elle ne sera pas enregistrée.")) {
      if (output && isBlobUrl(output)) {
        try {
          URL.revokeObjectURL(output);
        } catch {
          /* ignore */
        }
      }
      if (viral24Segment2VideoUrl && isBlobUrl(viral24Segment2VideoUrl)) {
        try {
          URL.revokeObjectURL(viral24Segment2VideoUrl);
        } catch {
          /* ignore */
        }
      }
      if (viral24Segment3VideoUrl && isBlobUrl(viral24Segment3VideoUrl)) {
        try {
          URL.revokeObjectURL(viral24Segment3VideoUrl);
        } catch {
          /* ignore */
        }
      }
      if (viral24Assembled24sBlobUrl && isBlobUrl(viral24Assembled24sBlobUrl)) {
        try {
          URL.revokeObjectURL(viral24Assembled24sBlobUrl);
        } catch {
          /* ignore */
        }
      }
      setOutput("");
      setViral24LastFrameDataUrl(null);
      setViral24Segment2VideoUrl(null);
      setViral24Segment2LastFrameDataUrl(null);
      setViral24Segment3VideoUrl(null);
      setViral24Assembled24sBlobUrl(null);
      setGenerationError("");
      setDuration("8s");
      setMusicStyle("cinematic");
      setAudioStatus("");
      setDialogueAuto(true);
      setDialogueGlobal("");
      setDialoguePerScene(false);
      setDialogueByScene(["", "", ""]);
      setCopied(false);
      setLastVideoTaskId(null);
      setVideoCreatedAt(null);
      setNeedsReloadFromCache(false);
    }
  };

  const copy = async () => {
    if (!output || !isVideoPlayerUrl(output)) return;
    if (isBlobUrl(output)) {
      alert(
        "L’aperçu local (blob) ne fournit pas un lien partageable. Valide et enregistre la vidéo pour obtenir une URL HTTPS."
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Impossible de copier l'URL vidéo:", err);
      alert("Impossible de copier");
    }
  };

  const updateSceneScript = (sceneIndex, value) => {
    setScripts((prev) => {
      const next = [...ensureSceneScripts(prev, sceneCount)];
      next[sceneIndex] = value;
      return next;
    });
  };

  const updateDialogueByScene = (sceneIndex, value) => {
    setDialogueByScene((prev) => {
      const next = [...ensureVeo3SceneScripts(prev)];
      next[sceneIndex] = value;
      return next;
    });
  };

  const sceneScriptForDialoguePrefill = useCallback(
    (sceneIndex) => {
      const fromCanon = String(canonicalScenes[sceneIndex]?.script_text ?? "").trim();
      const fromUi = String(scripts[sceneIndex] ?? "").trim();
      return fromCanon || fromUi || "";
    },
    [canonicalScenes, scripts]
  );

  const handleDialogueAutoChange = useCallback(
    (on) => {
      setDialogueAuto(on);
      if (on) {
        setDialoguePerScene(false);
        return;
      }
      if (dialoguePerScene && sceneCount > 1) {
        setDialogueByScene((prev) => {
          const next = [...ensureVeo3SceneScripts(prev)];
          for (let i = 0; i < sceneCount; i++) {
            if (!String(next[i] ?? "").trim()) {
              next[i] = sceneScriptForDialoguePrefill(i);
            }
          }
          return next;
        });
      } else {
        const prefill = sceneScriptForDialoguePrefill(activeTab);
        setDialogueGlobal((prev) => (String(prev ?? "").trim() ? prev : prefill));
      }
    },
    [activeTab, dialoguePerScene, sceneCount, sceneScriptForDialoguePrefill]
  );

  const ceQueMontreSceneContent = useCallback(
    (sceneIndex) => {
      if (duration === "24s" && isStudio && sceneCount >= 3) {
        const text = String(scripts[sceneIndex] ?? "").trim();
        if (text.length > 0) {
          const s0 = String(scripts[0] ?? "").trim();
          const s1 = String(scripts[1] ?? "").trim();
          const s2 = String(scripts[2] ?? "").trim();
          const triple = s0.length > 0 && s0 === s1 && s1 === s2;
          if (!triple) {
            return (
              <div className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">{text}</div>
            );
          }
        }
      }
      return (
        <div className="text-sm text-gray-100 leading-relaxed">
          {veo3ScenePlainDescription(scripts[sceneIndex] ?? "", sceneIndex, sceneCount)}
        </div>
      );
    },
    [duration, isStudio, sceneCount, scripts]
  );

  const technicalVeoPromptsByScene = useMemo(() => {
    if (!isStudio || duration !== "24s" || sceneCount < 3) return null;
    const durationSec = 8;
    const selectedHookImageUrl = String(validatedHookImage?.url || "").trim();
    const selectedHookPrompt = String(validatedHookImage?.prompt || "").trim();
    const hookPromptLive =
      String(hookVisual || "").trim() ||
      selectedHookPrompt ||
      canonicalSpec.creative.hook_visual.prompt_text ||
      "";
    const finalAspectRatio = selectedHookImageUrl
      ? derivedFormat === "16:9"
        ? "16:9"
        : "9:16"
      : "9:16";
    const finalGenerationMode = selectedHookImageUrl ? "image_to_video" : "text_to_video";
    const baseScenes = getSafeScenes(canonicalSpec);

    const dialogueLineForScene = (idx) => {
      if (!dialogueEnabled || dialogueAuto) return "";
      if (dialoguePerScene) return String(dialogueByScene[idx] ?? "").trim();
      return String(dialogueGlobal ?? "").trim();
    };

    const buildOwnedSpecForSceneIndex = (sceneIdx) => {
      const mergedScenes = [0, 1, 2].map((i) => ({
        ...baseScenes[i],
        script_text: String(scripts[i] ?? "").trim(),
        ...(i === sceneIdx ? { dialogue_text: dialogueLineForScene(sceneIdx) } : {}),
      }));
      return normalizeCampaignGenerationSpec({
        ...canonicalSpec,
        creative: {
          ...canonicalSpec.creative,
          scenes: mergedScenes,
          hook_visual: {
            ...canonicalSpec.creative.hook_visual,
            selected_image_url: selectedHookImageUrl,
            prompt_text: hookPromptLive,
          },
        },
        rendering: {
          ...canonicalSpec.rendering,
          aspect_ratio: finalAspectRatio,
          generation_mode: finalGenerationMode,
          duration_seconds: durationSec,
          audio: {
            ...canonicalSpec.rendering.audio,
            dialogue_enabled: dialogueEnabled,
            music_style: audioEnabled ? musicStyle : "none",
          },
        },
        provider_overrides: {
          ...canonicalSpec.provider_overrides,
          veo3: {
            ...canonicalSpec.provider_overrides.veo3,
            aspect_ratio: finalAspectRatio,
            generation_mode: finalGenerationMode,
            initial_image_url: selectedHookImageUrl || null,
            prompt: "",
          },
        },
      });
    };

    try {
      return [0, 1, 2].map((sceneIdx) => {
        const spec = buildOwnedSpecForSceneIndex(sceneIdx);
        return appendVeo3VisualContinuityRules(buildVeo3Prompt(spec, sceneIdx).prompt);
      });
    } catch (e) {
      console.warn("[Video] aperçu prompt technique Veo:", e);
      return null;
    }
  }, [
    isStudio,
    duration,
    sceneCount,
    canonicalSpec,
    scripts,
    validatedHookImage?.url,
    validatedHookImage?.prompt,
    hookVisual,
    derivedFormat,
    dialogueEnabled,
    dialogueAuto,
    dialoguePerScene,
    dialogueByScene,
    dialogueGlobal,
    audioEnabled,
    musicStyle,
  ]);

  const showStudio24sTechnicalEditors =
    isStudio && duration === "24s" && sceneCount >= 3 && technicalVeoPromptsByScene != null;

  useEffect(() => {
    if (!technicalVeoPromptsByScene || technicalVeoPromptsByScene.length !== 3) return;
    setTechnicalVeoPromptDrafts([
      technicalVeoPromptsByScene[0],
      technicalVeoPromptsByScene[1],
      technicalVeoPromptsByScene[2],
    ]);
  }, [technicalVeoPromptsByScene]);

  const updateTechnicalVeoPromptDraft = useCallback((sceneIndex, value) => {
    setTechnicalVeoPromptDrafts((prev) => {
      const next = [...ensureSceneScripts(prev, sceneCount)];
      if (sceneIndex >= 0 && sceneIndex < next.length) next[sceneIndex] = value;
      return next;
    });
  }, [sceneCount]);

  /** Mode diagnostic 24 s sans chaîne studio : un seul clip Veo ; prompt = onglet actif ou script combiné. */
  const promptForStudio24sDiagnosticGeneration = useMemo(() => {
    const combined = buildCombinedStudioScriptFor24s({
      studioScriptPrompt,
      scripts,
      canonicalScenes,
      sceneCount,
    }).trim();
    if (!(isStudio && sceneCount >= 3)) return combined;
    const draft = String(technicalVeoPromptDrafts[activeTab] ?? "").trim();
    return draft || combined;
  }, [
    isStudio,
    sceneCount,
    technicalVeoPromptDrafts,
    activeTab,
    studioScriptPrompt,
    scripts,
    canonicalScenes,
  ]);

  const scriptReady = useMemo(() => {
    if (duration !== "24s") {
      return (scriptForGeneration || "").trim().length >= 8;
    }
    const combined = buildCombinedStudioScriptFor24s({
      studioScriptPrompt,
      scripts,
      canonicalScenes,
      sceneCount,
    }).trim();
    if (isStudio && sceneCount >= 3) {
      const p1 = String(technicalVeoPromptDrafts[0] ?? "").trim() || combined;
      const p2 = String(technicalVeoPromptDrafts[1] ?? "").trim() || combined;
      const p3 = String(technicalVeoPromptDrafts[2] ?? "").trim() || combined;
      return p1.length >= 8 && p2.length >= 8 && p3.length >= 8;
    }
    return promptForStudio24sDiagnosticGeneration.trim().length >= 8;
  }, [
    duration,
    scriptForGeneration,
    isStudio,
    sceneCount,
    technicalVeoPromptDrafts,
    studioScriptPrompt,
    scripts,
    canonicalScenes,
    promptForStudio24sDiagnosticGeneration,
  ]);

  const pipeline24StepLabels = useMemo(() => {
    if (duration === "24s" && isStudio && sceneCount >= 3) {
      return PIPELINE_24_STEP_LABELS_CHAIN;
    }
    return PIPELINE_24_STEP_LABELS_SINGLE;
  }, [duration, isStudio, sceneCount]);

  /** Lecteur sans blocage « nodownload » + boutons par clip ; réservé admin en mode 24 s. */
  const admin24sRawDownloadEnabled = duration === "24s" && isAdminVideoUser;

  const tabButtonClass = (selected) =>
    `px-3 py-2 rounded-md text-xs font-medium border transition-all duration-150 whitespace-nowrap ${
      selected
        ? "card-vws-active text-emerald-200"
        : "bg-transparent text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/5"
    }`;

  const showScene1Dual = activeTab === 0;

  return (
    <>
      <QuotaExhaustedNotice
        open={showQuotaNotice}
        title={hasAccess ? "Quota mensuel épuisé" : "Accès abonnement requis"}
        message={quotaNoticeMessage}
        actionLabel={hasAccess ? "Aller vers Packs vidéos" : "Voir les abonnements"}
        onClose={() => setShowQuotaNotice(false)}
        onGoToPacks={goToVideoPacks}
      />
      <div className={isStudio ? "max-[640px]:hidden space-y-5" : "space-y-5"}>
      <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-4 sm:p-5 space-y-4 ring-1 ring-white/[0.06]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="text-sm text-gray-200 leading-relaxed">
            Chaque partie du parcours devient un clip vidéo. Les vidéos longues enchaînent plusieurs moments
            (début, transformation, résultat). Le format de la vidéo suit automatiquement ton visuel d’accroche.
          </p>
          <span className="shrink-0 inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-lg badge-vws text-emerald-200/95 whitespace-nowrap self-start">
            {sceneCount === 1 ? "1 moment" : "3 moments"}
          </span>
        </div>

        <div className="studio-panel p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 sm:gap-3">
          <h3 className="text-sm font-medium text-gray-300 shrink-0">Sources de la vidéo</h3>
          {sceneCount > 1 ? (
            <div
              className="flex flex-wrap gap-1 p-1 rounded-xl bg-white/[0.06] border border-white/10"
              role="tablist"
              aria-label="Moments de la vidéo"
            >
              {Array.from({ length: sceneCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  id={`veo3-tab-scene-${i}`}
                  aria-selected={activeTab === i}
                  aria-controls="veo3-panel-main"
                  tabIndex={activeTab === i ? 0 : -1}
                  onClick={() => setActiveTab(i)}
                  className={tabButtonClass(activeTab === i)}
                >
                  {sceneTabLabels[i] ?? `Partie ${i + 1}`}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div role="tabpanel" id="veo3-panel-main">
          {showScene1Dual ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-stretch">
                <div className="flex flex-col min-w-0 min-h-[200px] rounded-xl card-vws p-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                    Ce que montre la scène
                  </label>
                  {ceQueMontreSceneContent(0)}
                  <p className="text-xs text-gray-500 mt-3">
                    Pour le détail exact de la génération, ouvre les options avancées.
                  </p>
                </div>
                <div className="flex flex-col min-w-0 min-h-[200px]">
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    Visuel d’accroche
                  </label>
                  <input
                    ref={hookImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleOwnImageSelected}
                    className="hidden"
                  />
                  <div className="rounded-lg border border-white/10 bg-black/50 overflow-hidden flex-1 min-h-[180px] flex flex-col">
                    {validatedHookImage?.url ? (
                      <div className="flex-1 flex items-center justify-center p-3 min-h-[180px]">
                        <div className="relative">
                          <img
                            src={validatedHookImage.url}
                            alt="Visuel validé à l’étape précédente"
                            className="max-w-full max-h-[280px] w-auto h-auto object-contain rounded-md"
                          />
                          <button
                            type="button"
                            onClick={clearHookImageSelection}
                            className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/70 hover:bg-black/85 border border-white/10 text-white transition-colors"
                            aria-label="Retirer le visuel d’accroche"
                            title="Retirer le visuel d’accroche"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center min-h-[180px] text-gray-500">
                        <button
                          type="button"
                          onClick={openOwnImagePicker}
                          className="w-16 h-16 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                          aria-label="Téléverser une image personnelle"
                        >
                          <Upload className="w-8 h-8 text-gray-600" strokeWidth={1.25} />
                        </button>
                        <button
                          type="button"
                          onClick={openOwnImagePicker}
                          className="text-xs font-medium text-gray-300 hover:text-white transition-colors"
                        >
                          Utiliser ma propre image
                        </button>
                      </div>
                    )}
                  </div>
                  {validatedHookImage?.url ? (
                    <button
                      type="button"
                      onClick={openOwnImagePicker}
                      className="mt-3 self-start text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Utiliser ma propre image
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                La vidéo utilisera ce visuel et le script associé. Sans image validée, le format vertical est utilisé par défaut.
                {sceneCount > 1
                  ? " Passe aux onglets suivants pour voir le résumé des autres moments — sans visuel d’accroche sur ces parties."
                  : ""}
              </p>
            </>
          ) : (
            <div className="flex flex-col min-w-0 space-y-3 rounded-xl card-vws p-4">
              <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Ce que montre la scène — {sceneTabLabels[activeTab] ?? `Partie ${activeTab + 1}`}
              </label>
              <p className="text-xs text-gray-500">
                Pas d’image d’accroche sur ce moment : la vidéo s’appuie sur la description.
              </p>
              {ceQueMontreSceneContent(activeTab)}
              <p className="text-xs text-gray-500">
                Pour le détail exact de la génération, ouvre les options avancées.
              </p>
            </div>
          )}
        </div>
        </div>
      </div>

        <div className="studio-panel p-5 sm:p-6 pt-2 space-y-4">
          <p className={`text-xs text-gray-500 ${isStudio ? "max-[640px]:hidden" : ""}`}>
            Format vidéo :{" "}
            <span className="text-gray-300">
              {derivedFormat === "9:16"
                ? "vertical (comme ton visuel ou par défaut)"
                : "paysage (d’après ton visuel d’accroche)"}
            </span>
            {" · "}
            Durée du clip : <span className="text-gray-300">{duration.replace("s", " s")}</span>
          </p>
          <p className={`text-xs text-gray-500 leading-relaxed ${isStudio ? "max-[640px]:hidden" : ""}`}>
            🎙️ Dialogue : {dialogueEnabled ? "activé" : "désactivé"} (modifiable dans Options avancées)
          </p>
          {!dialogueEnabled ? (
            <p className={`text-xs text-amber-300/90 leading-relaxed ${isStudio ? "max-[640px]:hidden" : ""}`}>
              Dialogue : Désactivé
            </p>
          ) : null}

          <details className="rounded-xl card-vws px-4 py-3 sm:px-5 open:border-white/15 transition-colors">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-gray-400 hover:text-gray-300 select-none [&::-webkit-details-marker]:hidden">
              <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
              <Settings2 className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
              <span>
                Options avancées{" "}
                <span className="text-gray-600">(durée, format, dialogue, script technique)</span>
              </span>
            </summary>
            <div className="mt-4 border-t border-white/[0.06] pt-4 space-y-6">
              <section className="space-y-3" aria-labelledby="veo3-adv-clip-heading">
                <h4
                  id="veo3-adv-clip-heading"
                  className="text-xs font-semibold text-gray-200 tracking-wide"
                >
                  Paramètres du clip
                </h4>
                <div className="space-y-1.5">
                  <label htmlFor="veo3-duration" className="text-xs font-medium text-gray-400">
                    Durée
                  </label>
                  <select
                    id="veo3-duration"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 rounded-lg text-gray-200 text-sm focus:outline-none transition-all input-vws"
                  >
                    {DURATION_OPTIONS.veo3.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#0C1116]">
                        {opt === "24s" ? "24 s (diagnostic studio)" : opt}
                      </option>
                    ))}
                  </select>
                  {duration === "24s" ? (
                    <p className="text-[11px] text-cyan-200/85 leading-relaxed mt-2">
                      {showStudio24sTechnicalEditors
                        ? "Trois clips Vertex 8 s enchaînés, deux PNG fin de clip (1 et 2), puis assemblage ~24 s en local (FFmpeg). Pas de post-traitement audio studio."
                        : "Un clip Vertex 8 s à partir du script campagne combiné, puis extraction de la dernière frame (PNG). Pas de post-traitement audio studio sur cette durée."}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl card-vws px-3 py-2.5 text-xs text-gray-400 leading-relaxed">
                  <span className="font-medium text-gray-300">Format</span> (lecture seule) :{" "}
                  <span className="text-gray-200">
                    {derivedFormat === "9:16" ? "vertical (9:16)" : "paysage (16:9)"}
                  </span>
                  <span className="text-gray-500">
                    {" "}
                    — déduit automatiquement des proportions du visuel d’accroche (sans image : vertical par défaut).
                  </span>
                </div>
              </section>

              <section
                className="space-y-3 pt-1 border-t border-white/[0.06]"
                aria-labelledby="veo3-adv-dialogue-heading"
              >
                <h4
                  id="veo3-adv-dialogue-heading"
                  className="text-xs font-semibold text-gray-200 tracking-wide"
                >
                  Dialogue
                </h4>
                {!dialogueEnabled ? (
                  <p className="text-[11px] text-gray-500">
                    Le dialogue est désactivé depuis la campagne. Ces champs restent visibles mais ne sont pas pris en compte.
                  </p>
                ) : null}
                <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-300">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-white/20 bg-white/5 text-emerald-500 input-vws-check"
                    checked={dialogueAuto}
                    disabled={!dialogueEnabled}
                    onChange={(e) => handleDialogueAutoChange(e.target.checked)}
                  />
                  <span>Dialogue automatique</span>
                </label>
                {!dialogueAuto ? (
                  <div className="space-y-4 pl-0 sm:pl-1">
                    {sceneCount > 1 ? (
                      <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-300">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-white/20 bg-white/5 text-emerald-500 input-vws-check"
                          checked={dialoguePerScene}
                          disabled={!dialogueEnabled}
                          onChange={(e) => setDialoguePerScene(e.target.checked)}
                        />
                        <span>Personnaliser le dialogue par scène</span>
                      </label>
                    ) : null}
                    {!dialoguePerScene || sceneCount === 1 ? (
                      <div className="space-y-1.5">
                        <label htmlFor="veo3-dialogue-global" className="text-xs font-medium text-gray-400">
                          Phrase à dire (une courte phrase, 10 à 12 mots max.)
                        </label>
                        <input
                          id="veo3-dialogue-global"
                          type="text"
                          value={dialogueGlobal}
                          disabled={!dialogueEnabled}
                          onChange={(e) => setDialogueGlobal(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none input-vws"
                          placeholder="Ex. : Regardez la différence avant et après."
                          autoComplete="off"
                        />
                      </div>
                    ) : null}
                    {dialoguePerScene && sceneCount > 1 ? (
                      <div className="space-y-3">
                        {Array.from({ length: sceneCount }, (_, i) => (
                          <div key={i} className="space-y-1.5">
                            <label
                              htmlFor={`veo3-dialogue-scene-${i}`}
                              className="text-xs font-medium text-gray-400"
                            >
                              Scène {i + 1}
                            </label>
                            <input
                              id={`veo3-dialogue-scene-${i}`}
                              type="text"
                              value={dialogueByScene[i] ?? ""}
                              disabled={!dialogueEnabled}
                              onChange={(e) => updateDialogueByScene(i, e.target.value)}
                              className="w-full px-3 py-2 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none input-vws"
                              placeholder="Une courte phrase pour ce moment"
                              autoComplete="off"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section
                className="space-y-3 pt-1 border-t border-white/[0.06]"
                aria-labelledby="veo3-adv-script-heading"
              >
                <h4
                  id="veo3-adv-script-heading"
                  className="text-xs font-semibold text-gray-200 tracking-wide"
                >
                  Script technique (avancé)
                </h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  {showStudio24sTechnicalEditors
                    ? "Prompts techniques Vertex/Veo par moment (alignés sur la campagne). En 24 s studio : trois clips 8 s enchaînés (hooks Début → Transformation → Résultat), extraction des deux dernières images intermédiaires, puis assemblage FFmpeg ~24 s."
                    : "Instructions par scène (éditables) alignées sur la campagne."}
                </p>
                <div className="space-y-3">
                  {showStudio24sTechnicalEditors
                    ? Array.from({ length: sceneCount }, (_, i) => (
                        <div key={i} className="space-y-1.5">
                          <label
                            htmlFor={`veo3-tech-veo-desktop-${i}`}
                            className="text-xs font-medium text-gray-400"
                          >
                            Prompt technique Veo — {sceneTabLabels[i] ?? `Partie ${i + 1}`}
                          </label>
                          <textarea
                            id={`veo3-tech-veo-desktop-${i}`}
                            value={technicalVeoPromptDrafts[i] ?? ""}
                            onChange={(e) => updateTechnicalVeoPromptDraft(i, e.target.value)}
                            rows={8}
                            className="w-full rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none transition-all resize-y input-vws font-mono text-[11px] leading-relaxed"
                            placeholder="Prompt envoyé au moteur pour ce moment."
                          />
                        </div>
                      ))
                    : Array.from({ length: sceneCount }, (_, i) => (
                        <div key={i} className="space-y-1.5">
                          <label className="text-xs font-medium text-gray-400">
                            {sceneTabLabels[i] ?? `Partie ${i + 1}`}
                          </label>
                          <textarea
                            value={scripts[i] ?? ""}
                            onChange={(e) => updateSceneScript(i, e.target.value)}
                            rows={6}
                            className="w-full rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none transition-all resize-y input-vws"
                            placeholder="Instructions détaillées pour la génération (scène par scène)."
                          />
                        </div>
                      ))}
                </div>
              </section>
            </div>
          </details>

          <div className="text-xs text-gray-500">
            Modèle : <span className="text-gray-300 font-medium">VEO3</span>
          </div>
          <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ${isStudio ? "max-[640px]:hidden" : ""}`}>
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className={`flex-1 px-6 py-3.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                loading
                  ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10"
                  : !sessionReady
                    ? "bg-white/10 text-gray-400 border border-white/15 hover:bg-white/[0.14]"
                    : !scriptReady
                      ? "bg-amber-500/15 text-amber-100 border border-amber-500/35 hover:bg-amber-500/25"
                      : "btn-vws-primary"
              }`}
              title={
                loading
                  ? "Génération en cours…"
                  : !sessionReady
                    ? "Connecte-toi pour générer (clic pour rappel)"
                    : !scriptReady
                      ? "Script du moment actif trop court — clic pour message détaillé"
                      : "Générer à partir du script (visuel d’accroche optionnel)"
              }
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Génération en cours…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Générer la vidéo
                </>
              )}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-5 py-3.5 rounded-lg font-medium btn-vws-secondary sm:shrink-0"
            >
              Réinitialiser
            </button>
          </div>
        </div>

      {/* Barre de progression pendant la génération */}
      {loading && (
        <div className="studio-panel p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              Génération en cours
            </label>
            <span className="text-sm text-emerald-400 font-medium">{progress}%</span>
          </div>
          <div className="w-full studio-step-rail mb-2">
            <div
              className="studio-step-rail-fill transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {duration === "24s" && pipeline24Step != null ? (
            <ol
              className="mt-4 grid grid-cols-2 gap-2.5 list-none"
              aria-label="Étapes du mode 24 secondes (diagnostic)"
            >
              {pipeline24StepLabels.map((label, idx) => {
                const stepNum = idx + 1;
                const active = pipeline24Step === stepNum;
                const done = pipeline24Step > stepNum;
                return (
                  <li
                    key={stepNum}
                    className={`flex gap-2 items-start rounded-lg border px-2.5 py-2 text-[11px] leading-snug transition-colors ${
                      active
                        ? "border-emerald-500/45 bg-emerald-500/[0.08]"
                        : done
                          ? "border-white/12 bg-white/[0.04]"
                          : "border-white/[0.06] opacity-55"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        done
                          ? "bg-emerald-500/35 text-emerald-100"
                          : active
                            ? "bg-emerald-500 text-[#0a0f14]"
                            : "bg-white/10 text-gray-500"
                      }`}
                      aria-hidden
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : stepNum}
                    </span>
                    <span className={active ? "text-gray-200" : "text-gray-500"}>{label}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          <p className="text-xs text-gray-400 mt-3" role="status" aria-live="polite">
            {progressMessage}
          </p>
        </div>
      )}

      {!loading && generationError ? (
        <div className="studio-panel p-5 sm:p-6 border border-red-500/35 bg-red-950/20">
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5 rounded-lg bg-red-500/15 p-2 border border-red-500/25">
              <X className="w-4 h-4 text-red-300" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-medium text-red-200">Génération interrompue ou en échec</p>
              <p className="text-xs text-red-200/85 whitespace-pre-wrap break-words">{generationError}</p>
              <button
                type="button"
                onClick={() => setGenerationError("")}
                className="text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
              >
                Fermer
              </button>
              {needsReloadFromCache ? (
                <button
                  type="button"
                  onClick={() => {
                    void restoreVideoFromCachedId();
                  }}
                  className="text-xs font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
                >
                  Recharger la vidéo depuis la session précédente
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {output && !loading && isVideoPlayerUrl(output) ? (
        <>
          <div className="studio-panel p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                {viral24Segment2VideoUrl ? "Clip 1 — Début (VEO3)" : "Vidéo générée (VEO3)"}
              </label>
              <button
                onClick={copy}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  copied
                    ? "card-vws-active text-emerald-300"
                    : "btn-vws-secondary"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <div className="rounded-xl card-vws p-4">
              <video
                key={output}
                src={output}
                controls
                playsInline
                {...(admin24sRawDownloadEnabled
                  ? {}
                  : {
                      controlsList: "nodownload",
                      onContextMenu: (e) => e.preventDefault(),
                    })}
                className={`w-full rounded-lg border border-white/10 bg-black/70 ${
                  derivedFormat === "9:16" ? "max-h-[min(85vh,720px)] mx-auto aspect-[9/16]" : "aspect-video"
                }`}
              />
              {admin24sRawDownloadEnabled ? (
                <button
                  type="button"
                  onClick={() => void downloadAdmin24sClipFile(output, 1)}
                  className="mt-2 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium btn-vws-secondary"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  Télécharger le clip 1 (admin)
                </button>
              ) : null}
              <p className="mt-3 text-[11px] text-gray-500 break-all">
                {isBlobUrl(output)
                  ? "Aperçu local dans le navigateur. « Valider et enregistrer » publie une URL HTTPS et enregistre l’historique."
                  : "URL signée (copie via le bouton) — lien temporaire côté stockage."}
              </p>
            </div>
            {viral24LastFrameDataUrl ? (
              <div className="mt-4 rounded-xl card-vws p-4 border border-cyan-500/25">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Dernière image — fin du clip 1 (8 s)
                  </label>
                  <button
                    type="button"
                    onClick={downloadViral24LastFrameExport}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium btn-vws-secondary shrink-0"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    Télécharger PNG
                  </button>
                </div>
                <img
                  src={viral24LastFrameDataUrl}
                  alt="Dernière frame du clip 1"
                  className={`w-full rounded-lg border border-white/10 bg-black/70 object-contain ${
                    derivedFormat === "9:16" ? "max-h-[min(60vh,520px)] mx-auto aspect-[9/16]" : "max-h-[min(50vh,380px)]"
                  }`}
                />
              </div>
            ) : null}
            {viral24Segment2VideoUrl && isVideoPlayerUrl(viral24Segment2VideoUrl) ? (
              <div className="mt-6 rounded-xl card-vws p-4 border border-emerald-500/20">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Clip 2 — Transformation (VEO3)
                </label>
                <video
                  key={viral24Segment2VideoUrl}
                  src={viral24Segment2VideoUrl}
                  controls
                  playsInline
                  {...(admin24sRawDownloadEnabled
                    ? {}
                    : {
                        controlsList: "nodownload",
                        onContextMenu: (e) => e.preventDefault(),
                      })}
                  className={`w-full rounded-lg border border-white/10 bg-black/70 ${
                    derivedFormat === "9:16" ? "max-h-[min(85vh,720px)] mx-auto aspect-[9/16]" : "aspect-video"
                  }`}
                />
                {admin24sRawDownloadEnabled ? (
                  <button
                    type="button"
                    onClick={() => void downloadAdmin24sClipFile(viral24Segment2VideoUrl, 2)}
                    className="mt-2 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium btn-vws-secondary"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    Télécharger le clip 2 (admin)
                  </button>
                ) : null}
              </div>
            ) : null}
            {viral24Segment2LastFrameDataUrl ? (
              <div className="mt-4 rounded-xl card-vws p-4 border border-cyan-500/25">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Dernière image — fin du clip 2 (8 s)
                  </label>
                  <button
                    type="button"
                    onClick={downloadViral24Segment2LastFrameExport}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium btn-vws-secondary shrink-0"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    Télécharger PNG
                  </button>
                </div>
                <img
                  src={viral24Segment2LastFrameDataUrl}
                  alt="Dernière frame du clip 2"
                  className={`w-full rounded-lg border border-white/10 bg-black/70 object-contain ${
                    derivedFormat === "9:16" ? "max-h-[min(60vh,520px)] mx-auto aspect-[9/16]" : "max-h-[min(50vh,380px)]"
                  }`}
                />
              </div>
            ) : null}
            {viral24Segment3VideoUrl && isVideoPlayerUrl(viral24Segment3VideoUrl) ? (
              <div className="mt-6 rounded-xl card-vws p-4 border border-emerald-500/20">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Clip 3 — Résultat (VEO3)
                </label>
                <video
                  key={viral24Segment3VideoUrl}
                  src={viral24Segment3VideoUrl}
                  controls
                  playsInline
                  {...(admin24sRawDownloadEnabled
                    ? {}
                    : {
                        controlsList: "nodownload",
                        onContextMenu: (e) => e.preventDefault(),
                      })}
                  className={`w-full rounded-lg border border-white/10 bg-black/70 ${
                    derivedFormat === "9:16" ? "max-h-[min(85vh,720px)] mx-auto aspect-[9/16]" : "aspect-video"
                  }`}
                />
                {admin24sRawDownloadEnabled ? (
                  <button
                    type="button"
                    onClick={() => void downloadAdmin24sClipFile(viral24Segment3VideoUrl, 3)}
                    className="mt-2 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium btn-vws-secondary"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    Télécharger le clip 3 (admin)
                  </button>
                ) : null}
              </div>
            ) : null}
            {viral24Assembled24sBlobUrl && isVideoPlayerUrl(viral24Assembled24sBlobUrl) ? (
              <div className="mt-6 rounded-xl card-vws p-4 border border-violet-500/30">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Vidéo finale ~24 s (assemblage FFmpeg)
                </label>
                <video
                  key={viral24Assembled24sBlobUrl}
                  src={viral24Assembled24sBlobUrl}
                  controls
                  playsInline
                  {...(admin24sRawDownloadEnabled
                    ? {}
                    : {
                        controlsList: "nodownload",
                        onContextMenu: (e) => e.preventDefault(),
                      })}
                  className={`w-full rounded-lg border border-white/10 bg-black/70 ${
                    derivedFormat === "9:16" ? "max-h-[min(85vh,720px)] mx-auto aspect-[9/16]" : "aspect-video"
                  }`}
                />
                <p className="mt-2 text-[11px] text-gray-500">
                  Trois clips 8 s concaténés localement (pas de réencodage). « Valider et enregistrer » sur le clip 1
                  publie une URL HTTPS pour l’historique.
                </p>
                {admin24sRawDownloadEnabled ? (
                  <button
                    type="button"
                    onClick={() => void downloadAdmin24sAssembledFile()}
                    className="mt-2 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium btn-vws-secondary"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    Télécharger la vidéo 24 s assemblée (admin)
                  </button>
                ) : null}
              </div>
            ) : null}
            {audioStatus ? (
              <p className="mt-3 text-xs text-gray-400">{audioStatus}</p>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              type="button"
              onClick={prepareAnotherVideoVersion}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all btn-vws-secondary text-gray-200"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              Générer une nouvelle version
            </button>
            {typeof studioOnStartNewCampaign === "function" ? (
              <button
                type="button"
                onClick={() => studioOnStartNewCampaign()}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all btn-vws-secondary text-gray-200"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                Faire une autre vidéo
              </button>
            ) : null}
          </div>

          {/* Message informatif */}
          <div className="mb-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
            <User className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-300 mb-1">Historique et profil</p>
              <p className="text-xs text-blue-400/80">
                En cliquant sur « Télécharger la vidéo », la création est ajoutée à votre historique et disponible dans votre{" "}
                <Link to="/profil" className="underline hover:text-blue-300">profil</Link>, où vous pourrez la retrouver,
                la partager ou la gérer.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={downloadVideoFileExport}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all btn-vws-primary"
            >
              <Download className="w-4 h-4 shrink-0" />
              Télécharger la vidéo
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-medium transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          </div>
        </>
      ) : null}

      {!output && !loading && !generationError ? (
        <div className="studio-panel p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <VideoIcon className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-sm text-gray-400">
            Complète le script et le visuel d’accroche (scène 1), puis génère ta vidéo.
          </p>
        </div>
      ) : null}
      </div>

      {isStudio ? (
        <div className="relative min-h-0 max-[640px]:block min-[641px]:hidden">
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-white/[0.07] to-transparent p-4 shadow-[0_0_24px_rgba(0,212,160,0.08)]">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sources de la vidéo
              </h3>
              {sceneCount > 1 ? (
                <div className="mb-3 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
                  {Array.from({ length: sceneCount }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActiveTab(i)}
                      className={tabButtonClass(activeTab === i)}
                    >
                      {sceneTabLabels[i] ?? `Partie ${i + 1}`}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="grid gap-3">
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase text-gray-500">Scène</p>
                  {ceQueMontreSceneContent(activeTab)}
                </div>
                <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase text-gray-500">Visuel d&apos;accroche</p>
                  {validatedHookImage?.url ? (
                    <img
                      src={validatedHookImage.url}
                      alt=""
                      className="max-h-40 w-full rounded-lg object-contain"
                    />
                  ) : (
                    <p className="text-xs text-gray-500">Aucune image (optionnel)</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] text-gray-200">
                  Format : {derivedFormat === "9:16" ? "9:16" : "16:9"}
                </span>
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[10px] text-gray-200">
                  Durée : {duration}
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-200">
                  Modèle : VEO3
                </span>
              </div>
            </div>

            <div className="studio-panel p-4 sm:p-5 space-y-4">
              <details className="rounded-xl card-vws px-4 py-3 sm:px-5 open:border-white/15 transition-colors">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-gray-400 hover:text-gray-300 select-none [&::-webkit-details-marker]:hidden">
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                  <Settings2 className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                  <span>
                    Options avancées{" "}
                    <span className="text-gray-600">(durée, format, dialogue, script technique)</span>
                  </span>
                </summary>
                <div className="mt-4 border-t border-white/[0.06] pt-4 space-y-6">
                  <section className="space-y-3" aria-labelledby="veo3-adv-clip-heading-m">
                    <h4
                      id="veo3-adv-clip-heading-m"
                      className="text-xs font-semibold text-gray-200 tracking-wide"
                    >
                      Paramètres du clip
                    </h4>
                    <div className="space-y-1.5">
                      <label htmlFor="veo3-duration-m" className="text-xs font-medium text-gray-400">
                        Durée
                      </label>
                      <select
                        id="veo3-duration-m"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full max-w-xs px-3 py-2 rounded-lg text-gray-200 text-sm focus:outline-none transition-all input-vws"
                      >
                        {DURATION_OPTIONS.veo3.map((opt) => (
                          <option key={opt} value={opt} className="bg-[#0C1116]">
                            {opt === "24s" ? "24 s (diagnostic studio)" : opt}
                          </option>
                        ))}
                      </select>
                      {duration === "24s" ? (
                        <p className="text-[11px] text-cyan-200/85 leading-relaxed mt-2">
                          {showStudio24sTechnicalEditors
                            ? "Trois clips Vertex 8 s enchaînés, deux PNG fin de clip (1 et 2), puis assemblage ~24 s en local (FFmpeg). Pas de post-traitement audio studio."
                            : "Un clip Vertex 8 s à partir du script campagne combiné, puis extraction de la dernière frame (PNG). Pas de post-traitement audio studio sur cette durée."}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-xl card-vws px-3 py-2.5 text-xs text-gray-400 leading-relaxed">
                      <span className="font-medium text-gray-300">Format</span> (lecture seule) :{" "}
                      <span className="text-gray-200">
                        {derivedFormat === "9:16" ? "vertical (9:16)" : "paysage (16:9)"}
                      </span>
                    </div>
                  </section>
                  <section className="space-y-3 pt-1 border-t border-white/[0.06]">
                    <h4 className="text-xs font-semibold text-gray-200 tracking-wide">Dialogue</h4>
                    {!dialogueEnabled ? (
                      <p className="text-[11px] text-amber-300/90">Dialogue désactivé depuis la campagne.</p>
                    ) : null}
                    <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-300">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-white/20 bg-white/5 text-emerald-500 input-vws-check"
                        checked={dialogueAuto}
                        disabled={!dialogueEnabled}
                        onChange={(e) => handleDialogueAutoChange(e.target.checked)}
                      />
                      <span>Dialogue automatique</span>
                    </label>
                    {!dialogueAuto ? (
                      <div className="space-y-4 pl-0 sm:pl-1">
                        {sceneCount > 1 ? (
                          <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-300">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded border-white/20 bg-white/5 text-emerald-500 input-vws-check"
                              checked={dialoguePerScene}
                              disabled={!dialogueEnabled}
                              onChange={(e) => setDialoguePerScene(e.target.checked)}
                            />
                            <span>Personnaliser le dialogue par scène</span>
                          </label>
                        ) : null}
                        {!dialoguePerScene || sceneCount === 1 ? (
                          <div className="space-y-1.5">
                            <label htmlFor="veo3-dialogue-global-m" className="text-xs font-medium text-gray-400">
                              Phrase à dire
                            </label>
                            <input
                              id="veo3-dialogue-global-m"
                              type="text"
                              value={dialogueGlobal}
                              disabled={!dialogueEnabled}
                              onChange={(e) => setDialogueGlobal(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none input-vws"
                              autoComplete="off"
                            />
                          </div>
                        ) : null}
                        {dialoguePerScene && sceneCount > 1 ? (
                          <div className="space-y-3">
                            {Array.from({ length: sceneCount }, (_, i) => (
                              <div key={i} className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-400">Scène {i + 1}</label>
                                <input
                                  type="text"
                                  value={dialogueByScene[i] ?? ""}
                                  disabled={!dialogueEnabled}
                                  onChange={(e) => updateDialogueByScene(i, e.target.value)}
                                  className="w-full px-3 py-2 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none input-vws"
                                  autoComplete="off"
                                />
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                  <section className="space-y-3 pt-1 border-t border-white/[0.06]">
                    <h4 className="text-xs font-semibold text-gray-200 tracking-wide">Script technique (avancé)</h4>
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      {showStudio24sTechnicalEditors
                        ? "En 24 s studio : trois prompts (Début, Transformation, Résultat) → trois clips + deux PNG intermédiaires + vidéo ~24 s assemblée."
                        : "Instructions par scène (éditables)."}
                    </p>
                    <div className="space-y-3">
                      {showStudio24sTechnicalEditors
                        ? Array.from({ length: sceneCount }, (_, i) => (
                            <div key={i} className="space-y-1.5">
                              <label
                                htmlFor={`veo3-tech-veo-mobile-${i}`}
                                className="text-xs font-medium text-gray-400"
                              >
                                Prompt technique Veo — {sceneTabLabels[i] ?? `Partie ${i + 1}`}
                              </label>
                              <textarea
                                id={`veo3-tech-veo-mobile-${i}`}
                                value={technicalVeoPromptDrafts[i] ?? ""}
                                onChange={(e) => updateTechnicalVeoPromptDraft(i, e.target.value)}
                                rows={6}
                                className="w-full rounded-lg p-3 text-[10px] text-gray-200 placeholder-gray-500 focus:outline-none transition-all resize-y input-vws font-mono leading-relaxed"
                                placeholder="Prompt pour ce moment."
                              />
                            </div>
                          ))
                        : Array.from({ length: sceneCount }, (_, i) => (
                            <div key={i} className="space-y-1.5">
                              <label className="text-xs font-medium text-gray-400">
                                {sceneTabLabels[i] ?? `Partie ${i + 1}`}
                              </label>
                              <textarea
                                value={scripts[i] ?? ""}
                                onChange={(e) => updateSceneScript(i, e.target.value)}
                                rows={5}
                                className="w-full rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none transition-all resize-y input-vws"
                              />
                            </div>
                          ))}
                    </div>
                  </section>
                </div>
              </details>
            </div>

            {loading && (
              <div className="studio-panel p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-300">Génération</span>
                  <span className="text-emerald-400 text-sm">{progress}%</span>
                </div>
                <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ backgroundColor: "#1e2845" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, backgroundColor: "#00d4a0" }}
                  />
                </div>
                {duration === "24s" && pipeline24Step != null ? (
                  <ol
                    className="grid grid-cols-2 gap-2 list-none"
                    aria-label="Étapes du mode 24 secondes (diagnostic)"
                  >
                    {pipeline24StepLabels.map((label, idx) => {
                      const stepNum = idx + 1;
                      const active = pipeline24Step === stepNum;
                      const done = pipeline24Step > stepNum;
                      return (
                        <li
                          key={stepNum}
                          className={`flex gap-2 items-start rounded-lg border px-2 py-1.5 text-[10px] leading-snug ${
                            active
                              ? "border-emerald-500/45 bg-emerald-500/[0.08]"
                              : done
                                ? "border-white/12 bg-white/[0.04]"
                                : "border-white/[0.06] opacity-55"
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${
                              done
                                ? "bg-emerald-500/35 text-emerald-100"
                                : active
                                  ? "bg-emerald-500 text-[#0a0f14]"
                                  : "bg-white/10 text-gray-500"
                            }`}
                            aria-hidden
                          >
                            {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : stepNum}
                          </span>
                          <span className={active ? "text-gray-200" : "text-gray-500"}>{label}</span>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
                <p className="text-[11px] text-gray-400" role="status" aria-live="polite">
                  {progressMessage}
                </p>
              </div>
            )}
            {generationError ? (
              <div className="rounded-xl border border-red-500/35 bg-red-950/20 p-3 text-xs text-red-200">
                <p>{generationError}</p>
                {needsReloadFromCache ? (
                  <button
                    type="button"
                    onClick={() => {
                      void restoreVideoFromCachedId();
                    }}
                    className="mt-2 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
                  >
                    Recharger la vidéo
                  </button>
                ) : null}
              </div>
            ) : null}
            {output && !loading && isVideoPlayerUrl(output) ? (
              <div className="studio-panel p-4 space-y-3">
                <video
                  key={output}
                  src={output}
                  controls
                  playsInline
                  {...(admin24sRawDownloadEnabled
                    ? {}
                    : {
                        controlsList: "nodownload",
                        onContextMenu: (e) => e.preventDefault(),
                      })}
                  className={`w-full rounded-lg border border-white/10 bg-black/70 ${
                    derivedFormat === "9:16" ? "max-h-[70vh] mx-auto aspect-[9/16]" : "aspect-video"
                  }`}
                />
                {admin24sRawDownloadEnabled ? (
                  <button
                    type="button"
                    onClick={() => void downloadAdmin24sClipFile(output, 1)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium btn-vws-secondary"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    Télécharger le clip 1 (admin)
                  </button>
                ) : null}
                {viral24Segment2VideoUrl && isVideoPlayerUrl(viral24Segment2VideoUrl) ? (
                  <>
                    <p className="text-xs font-medium text-gray-400 pt-1">Clip 2 — Transformation</p>
                    <video
                      key={viral24Segment2VideoUrl}
                      src={viral24Segment2VideoUrl}
                      controls
                      playsInline
                      {...(admin24sRawDownloadEnabled
                        ? {}
                        : {
                            controlsList: "nodownload",
                            onContextMenu: (e) => e.preventDefault(),
                          })}
                      className={`w-full rounded-lg border border-white/10 bg-black/70 ${
                        derivedFormat === "9:16" ? "max-h-[70vh] mx-auto aspect-[9/16]" : "aspect-video"
                      }`}
                    />
                    {admin24sRawDownloadEnabled ? (
                      <button
                        type="button"
                        onClick={() => void downloadAdmin24sClipFile(viral24Segment2VideoUrl, 2)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium btn-vws-secondary"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        Télécharger le clip 2 (admin)
                      </button>
                    ) : null}
                  </>
                ) : null}
                {viral24Segment3VideoUrl && isVideoPlayerUrl(viral24Segment3VideoUrl) ? (
                  <>
                    <p className="text-xs font-medium text-gray-400 pt-1">Clip 3 — Résultat</p>
                    <video
                      key={viral24Segment3VideoUrl}
                      src={viral24Segment3VideoUrl}
                      controls
                      playsInline
                      {...(admin24sRawDownloadEnabled
                        ? {}
                        : {
                            controlsList: "nodownload",
                            onContextMenu: (e) => e.preventDefault(),
                          })}
                      className={`w-full rounded-lg border border-white/10 bg-black/70 ${
                        derivedFormat === "9:16" ? "max-h-[70vh] mx-auto aspect-[9/16]" : "aspect-video"
                      }`}
                    />
                    {admin24sRawDownloadEnabled ? (
                      <button
                        type="button"
                        onClick={() => void downloadAdmin24sClipFile(viral24Segment3VideoUrl, 3)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium btn-vws-secondary"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        Télécharger le clip 3 (admin)
                      </button>
                    ) : null}
                  </>
                ) : null}
                {viral24Assembled24sBlobUrl && isVideoPlayerUrl(viral24Assembled24sBlobUrl) ? (
                  <>
                    <p className="text-xs font-medium text-gray-400 pt-1">Vidéo finale ~24 s (FFmpeg)</p>
                    <video
                      key={viral24Assembled24sBlobUrl}
                      src={viral24Assembled24sBlobUrl}
                      controls
                      playsInline
                      {...(admin24sRawDownloadEnabled
                        ? {}
                        : {
                            controlsList: "nodownload",
                            onContextMenu: (e) => e.preventDefault(),
                          })}
                      className={`w-full rounded-lg border border-white/10 bg-black/70 ${
                        derivedFormat === "9:16" ? "max-h-[70vh] mx-auto aspect-[9/16]" : "aspect-video"
                      }`}
                    />
                    {admin24sRawDownloadEnabled ? (
                      <button
                        type="button"
                        onClick={() => void downloadAdmin24sAssembledFile()}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium btn-vws-secondary"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        Télécharger la vidéo 24 s assemblée (admin)
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {historyDrawerOpen ? (
            <div
              className="absolute inset-0 z-[25] flex min-h-0 flex-col bg-[#0f1420]"
              role="dialog"
              aria-modal="true"
              aria-label="Historique vidéo"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-200">Historique VEO3</h2>
                <button
                  type="button"
                  onClick={() => setHistoryDrawerOpen(false)}
                  className="rounded-lg border border-white/10 p-2 text-gray-400 hover:text-white"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="border-b border-white/10 px-4 py-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    value={historyVm.q}
                    onChange={(e) => historyVm.setQ(e.target.value)}
                    placeholder="Rechercher…"
                    className="w-full rounded-lg border border-white/10 bg-black/30 py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none input-vws"
                  />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {historyVm.filtered.length === 0 ? (
                  <p className="text-center text-sm text-gray-500">Aucune entrée</p>
                ) : (
                  <ul className="space-y-2">
                    {historyVm.filtered.slice(0, 24).map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryId(item.id)}
                          className={`w-full rounded-xl border p-3 text-left transition ${
                            selectedHistoryId === item.id
                              ? "border-[#00d4a0] bg-white/[0.06]"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <span className="line-clamp-2 text-xs text-gray-200">{item.input || "Sans titre"}</span>
                          <span className="mt-1 inline-block rounded badge-vws px-1.5 py-0.5 text-[9px] text-emerald-300">
                            VEO3
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="shrink-0 border-t border-white/10 p-4 safe-padded">
                <button
                  type="button"
                  disabled={!selectedHistoryId}
                  onClick={() => {
                    const item = historyVm.filtered.find((i) => i.id === selectedHistoryId);
                    if (!item) return;
                    historyVm.loadIntoEditor(item);
                    setHistoryDrawerOpen(false);
                  }}
                  className="btn-vws-primary w-full min-h-[48px] rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40"
                >
                  Utiliser ce prompt
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
});

function HailuoVideoForm({
  onCreditsUpdate,
  studioImageStep,
  studioScriptPrompt,
  studioCampaignGenerationSpec: campaignSpec = null,
  dialogueEnabled = true,
  studioOnResetImageStep,
  onWorkflowVideoStateChange,
  initialWorkflowVideoState,
}) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [scripts, setScripts] = useState(initialVeo3Scripts);
  const [activeTab, setActiveTab] = useState(0);
  const [hookVisual, setHookVisual] = useState(initialVeo3HookVisual);
  const [validatedHookImage, setValidatedHookImage] = useState(null);
  const [output, setOutput] = useState("");
  const [format, setFormat] = useState("16:9");
  const [duration, setDuration] = useState("10s");
  const [audioEnabled] = useState(true);
  const [musicStyle, setMusicStyle] = useState("cinematic");
  const [audioStatus, setAudioStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [lastVideoTaskId, setLastVideoTaskId] = useState(null);
  const [videoCreatedAt, setVideoCreatedAt] = useState(null);
  const [needsReloadFromCache, setNeedsReloadFromCache] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [showQuotaNotice, setShowQuotaNotice] = useState(false);
  const [quotaNoticeMessage, setQuotaNoticeMessage] = useState(VIDEO_QUOTA_EXHAUSTED_MESSAGE);
  const { hasAccess } = usePremiumAccess();
  const studioHookImage = useMemo(() => getHookImageFromStudioStep(studioImageStep), [studioImageStep]);
  const [customHookImage, setCustomHookImage] = useState(null);
  const hookImageInputRef = useRef(null);
  const prevHookSyncKey = useRef(null);
  const scriptForGeneration = scripts[activeTab] ?? "";
  const disabled = useMemo(() => {
    if (!session) return true;
    if (scriptForGeneration.trim().length < 8) return true;
    return false;
  }, [scriptForGeneration, session]);
  const abortRef = useRef(null);
  const outputRef = useRef(null);

  useEffect(() => {
    if (typeof onWorkflowVideoStateChange !== "function") return;
    const status = loading ? "generating" : generationError ? "error" : output ? "done" : "idle";
    onWorkflowVideoStateChange({
      status,
      videoId: lastVideoTaskId || null,
      lastError: generationError || "",
      provider: "hailuo",
      createdAt: videoCreatedAt || null,
    });
  }, [onWorkflowVideoStateChange, loading, generationError, output, lastVideoTaskId, videoCreatedAt]);

  useEffect(() => {
    if (session) {
      loadCredits();
    }
  }, [session]);

  const loadCredits = async () => {
    try {
      await getUserCredits();
    } catch (err) {
      console.error("Erreur chargement crédits:", err);
    }
  };

  useEffect(() => {
    let active = true;
    const syncHookImage = async () => {
      if (customHookImage) {
        setValidatedHookImage(customHookImage);
        return;
      }
      if (studioHookImage || studioImageStep) {
        setValidatedHookImage(studioHookImage);
        return;
      }
      const latest = await getLatestValidatedHookImageForSession(session);
      if (active) setValidatedHookImage(latest);
    };
    syncHookImage();
    if (!studioImageStep) {
      window.addEventListener("onetool:history:changed", syncHookImage);
    }
    return () => {
      active = false;
      if (!studioImageStep) {
        window.removeEventListener("onetool:history:changed", syncHookImage);
      }
    };
  }, [session, studioHookImage, studioImageStep, customHookImage]);

  useEffect(() => {
    return () => {
      if (customHookImage?.isObjectUrl && customHookImage.url) {
        URL.revokeObjectURL(customHookImage.url);
      }
    };
  }, [customHookImage]);

  useEffect(() => {
    const key = `${validatedHookImage?.url || ""}|${validatedHookImage?.prompt || ""}`;
    if (prevHookSyncKey.current === key) return;
    prevHookSyncKey.current = key;
    setHookVisual(String(validatedHookImage?.prompt || "").trim());
  }, [validatedHookImage?.url, validatedHookImage?.prompt]);

  const openOwnImagePicker = () => {
    hookImageInputRef.current?.click();
  };

  const handleOwnImageSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isAcceptedImageFile(file)) {
      alert("Choisis uniquement une image (jpg, png, webp, etc.).");
      event.target.value = "";
      return;
    }

    if (customHookImage?.isObjectUrl && customHookImage.url) {
      URL.revokeObjectURL(customHookImage.url);
    }

    const url = URL.createObjectURL(file);
    const nextImage = {
      url,
      prompt: "",
      source: "upload",
      fileName: file.name,
      isObjectUrl: true,
    };
    setCustomHookImage(nextImage);
    setValidatedHookImage(nextImage);
    event.target.value = "";
  };

  const clearHookImageSelection = () => {
    if (customHookImage?.isObjectUrl && customHookImage.url) {
      URL.revokeObjectURL(customHookImage.url);
    }
    setCustomHookImage(null);
    setValidatedHookImage({ url: "", prompt: "" });
    setHookVisual("");
    if (hookImageInputRef.current) {
      hookImageInputRef.current.value = "";
    }
  };

  const updateSceneScript = (sceneIndex, value) => {
    setScripts((prev) => {
      const next = [...ensureVeo3SceneScripts(prev)];
      next[sceneIndex] = value;
      return next;
    });
  };

  const recapInputForHistory = () =>
    scripts
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join("\n\n---\n\n");

  const tabButtonClass = (selected) =>
    `px-3 py-2 rounded-md text-xs font-medium border transition-all duration-150 whitespace-nowrap ${
      selected
        ? "card-vws-active text-emerald-200"
        : "bg-transparent text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/5"
    }`;

  const showScene1Dual = activeTab === 0;

  const generate = async () => {
    if (disabled || loading) return;

    let finalIdea = scriptForGeneration.trim();
    if (activeTab === 0 && hookVisual.trim()) {
      finalIdea = `${finalIdea}\n\nVisuel d'accroche :\n${hookVisual.trim()}`;
    }

    const lenCheck = validateIdeaLength(finalIdea);
    if (!lenCheck.ok) {
      setGenerationError(lenCheck.message);
      return;
    }

    if (!canUseVideoAttempt()) {
      const bypass =
        Boolean(session) && (await hasEnoughCredits(VIDEO_GENERATION_COST));
      if (!bypass) {
        alert(
          "Tu as atteint la limite de générations vidéo pour ce parcours (incluant la variante). Valide et enregistre ta vidéo, ou lance un nouveau projet depuis le récap (« Faire une autre vidéo ») ou en réinitialisant la campagne."
        );
        return;
      }
    }
    const shouldReserveCredit = shouldDebitVideoCredit();

    if (session && shouldReserveCredit) {
      const hasCredits = await hasEnoughCredits(VIDEO_GENERATION_COST);
      if (!hasCredits) {
        setQuotaNoticeMessage(
          hasAccess ? VIDEO_QUOTA_EXHAUSTED_MESSAGE : NON_SUBSCRIBER_BLOCKED_MESSAGE
        );
        setShowQuotaNotice(true);
        capturePostHog("quota_limit_reached", { step: "video" });
        return;
      }
    }

    const hadOutputHailuo = Boolean(String(output || "").trim());
    const durationSecondsHailuo = parseVideoDurationSeconds(duration);
    if (hadOutputHailuo) {
      capturePostHog("video_regenerated", { duration_seconds: durationSecondsHailuo });
    } else {
      capturePostHog("video_generation_started", { duration_seconds: durationSecondsHailuo });
    }

    setLoading(true);
    setShowQuotaNotice(false);
    setOutput("");
    setGenerationError("");
    setLastVideoTaskId(null);
    setVideoCreatedAt(null);
    setNeedsReloadFromCache(false);
    setCopied(false);
    setProgress(0);
    setProgressMessage("Initialisation...");
    setAudioStatus("");

    abortRef.current?.abort?.();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      setProgress(10);
      setProgressMessage(
        shouldReserveCredit ? "Vérification du quota vidéo…" : "Préparation de la variante…"
      );
      consumeVideoAttempt({ debitedCredit: false });

      setProgress(25);
      setProgressMessage("Création de la tâche vidéo...");

      const fullPrompt = [
        `Idée: ${finalIdea}`,
        `Format: ${format}`,
        `Durée: ${duration}`,
      ]
        .filter(Boolean)
        .join("\n");

      const durationSec = duration === "10s" ? 10 : 6;
      const createData = await callHailuoVideoApi(
        {
        action: "create",
        prompt: fullPrompt,
        model: "MiniMax-Hailuo-02",
        duration: durationSec,
        resolution: "768P",
        },
        session?.access_token
      );
      const taskId = String(createData?.task_id || "").trim();
      if (!taskId) {
        throw new Error("Hailuo n'a pas retourné de task_id.");
      }
      setLastVideoTaskId(taskId);
      setVideoCreatedAt(new Date().toISOString());

      let videoUrl = "";
      const maxPoll = 45;
      for (let i = 0; i < maxPoll; i += 1) {
        if (ctrl.signal.aborted) {
          const abortErr = new Error("Annulé");
          abortErr.name = "AbortError";
          throw abortErr;
        }

        setProgress(30 + Math.min(60, Math.floor((i / maxPoll) * 60)));
        setProgressMessage(`Génération vidéo en cours... (${i + 1}/${maxPoll})`);

        const statusData = await callHailuoVideoApi(
          {
            action: "status",
            task_id: taskId,
          },
          session?.access_token
        );

        if (statusData?.status === "success") {
          videoUrl = String(statusData?.video_url || "").trim();
          if (!videoUrl) {
            throw new Error("Vidéo générée mais URL introuvable.");
          }
          break;
        }

        if (statusData?.status === "failed") {
          throw new Error(statusData?.error || "La génération Hailuo a échoué.");
        }

        await sleep(4000);
      }

      if (!videoUrl) {
        throw new Error("Délai dépassé: la vidéo est encore en cours de génération.");
      }

      let finalVideoUrl = videoUrl;
      if (audioEnabled && session?.access_token) {
        setProgress(90);
        setProgressMessage("Ajout audio (voix + ambiance)...");
        try {
          const postData = await callVideoPostprocessApi(
            {
              video_url: videoUrl,
              voice_text: "",
              voice_context: {
                profession:
                  studioScriptPrompt?.profession ||
                  campaignSpec?.campaign?.profession ||
                  "",
                scene_idea: scriptForGeneration?.slice(0, 300) || "",
              },
              music_style: musicStyle,
              enable_tts: dialogueEnabled,
              enable_music: true,
              model: "hailuo",
            },
            session.access_token
          );
          finalVideoUrl = await applyAudioPostprocessResult({
            postData,
            fallbackVideoUrl: videoUrl,
            setProgressMessage,
            setAudioStatus,
          });
        } catch (postErr) {
          console.warn("Post-traitement audio non appliqué:", postErr);
          setAudioStatus(
            "Échec de l’appel au service de post-traitement ; vérifie la session et la console réseau."
          );
        }
      }

      setProgress(100);
      setProgressMessage("Vidéo prête");
      setGenerationError("");
      setOutput(finalVideoUrl);
      capturePostHog("video_generation_completed", {
        duration_seconds: parseVideoDurationSeconds(duration),
        success: true,
      });

    } catch (e) {
      if (e.name === 'AbortError') {
        return; // Requête annulée, ne rien faire
      }
      const errorMessage = e?.message || "Erreur lors de la génération";
      setGenerationError(errorMessage);
      setOutput("⚠️ Erreur : " + errorMessage);
      capturePostHog("video_generation_failed", {
        error_type: classifyErrorType(e, "generation"),
        error_message: errorMessage,
      });
      trackPostHogError(errorMessage, "/viralworks", "generation");
      console.error("Erreur génération vidéo Hailuo:", e);
      if (session) {
        await loadCredits();
        if (onCreditsUpdate) onCreditsUpdate();
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      setTimeout(() => {
        setProgress(0);
        setProgressMessage("");
      }, 500);
    }
  };

  const goToVideoPacks = () => {
    navigate(
      hasAccess ? "/boutique?section=packs-videos" : "/boutique?section=subscription"
    );
  };

  const reset = () => {
    abortRef.current?.abort?.();
    try {
      studioOnResetImageStep?.();
    } catch {
      /* ignore */
    }
    const brain = getVwsBrain();
    setScripts(
      brain?.videoPrompts?.length
        ? ensureVeo3SceneScripts(brain.videoPrompts)
        : ensureVeo3SceneScripts([])
    );
    setCustomHookImage(null);
    setValidatedHookImage(studioImageStep ? studioHookImage : { url: "", prompt: "" });
    setHookVisual(
      studioImageStep
        ? String(studioHookImage?.prompt || "").trim()
        : brain?.coverPrompt
        ? String(brain.coverPrompt)
        : ""
    );
    setActiveTab(0);
    setOutput("");
    setLoading(false);
    setProgress(0);
    setProgressMessage("");
    setFormat("16:9");
    setDuration("10s");
    setMusicStyle("cinematic");
    setAudioStatus("");
    setCopied(false);
    setGenerationError("");
    setLastVideoTaskId(null);
    setVideoCreatedAt(null);
    setNeedsReloadFromCache(false);
  };

  const prepareAnotherVideoVersion = () => {
    setOutput("");
    setCopied(false);
    setGenerationError("");
    setLastVideoTaskId(null);
    setVideoCreatedAt(null);
    setNeedsReloadFromCache(false);
  };

  const hailuoMultiPrompt = scripts.filter((s) => String(s || "").trim()).length > 1;

  const downloadPromptVideoExportHailuo = () => {
    const text = recapInputForHistory().trim();
    if (!text) {
      alert(
        "Aucun prompt vidéo enregistré à télécharger. Passe par l’étape Vidéo virale d’abord."
      );
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

  const downloadHookImageExportHailuo = async () => {
    const hookImageUrl = String(validatedHookImage?.url || "").trim();
    if (!hookImageUrl) {
      alert("Aucune image validée à télécharger.");
      return;
    }
    await downloadUrlFile(
      hookImageUrl,
      `viralworks-image-${new Date().toISOString().slice(0, 10)}.png`
    );
  };

  const downloadVideoFileExportHailuo = async () => {
    if (!output?.trim() || !isHttpUrl(output)) {
      alert("Aucune vidéo finale téléchargeable pour le moment.");
      return;
    }

    const outputToPersist = String(output).trim();
    const hookImageUrl = String(validatedHookImage?.url || "").trim();
    const hookImagePrompt = String(validatedHookImage?.prompt || "").trim();

    try {
      if (session?.user?.id && shouldDebitVideoCredit()) {
        const hasCredits = await hasEnoughCredits(VIDEO_GENERATION_COST);
        if (!hasCredits) {
          setQuotaNoticeMessage(
            hasAccess ? VIDEO_QUOTA_EXHAUSTED_MESSAGE : NON_SUBSCRIBER_BLOCKED_MESSAGE
          );
          setShowQuotaNotice(true);
          capturePostHog("quota_limit_reached", { step: "video_download" });
          return;
        }
        const debitResult = await debitCredits(
          VIDEO_GENERATION_COST,
          "video_generation",
          { model: "hailuo", format: format, duration: duration, step: "telecharger_video" }
        );
        if (!debitResult.success) {
          alert(
            debitResult.error ||
              "Impossible de débiter la vidéo sur ton solde. Vérifie tes vidéos disponibles puis réessaie."
          );
          return;
        }
        markVideoWorkflowCreditConsumed();
        await loadCredits();
        if (onCreditsUpdate) onCreditsUpdate();
      }

      if (!session?.user?.id) {
        addHistoryEntry({
          id: crypto.randomUUID?.() || String(Date.now()),
          kind: "video",
          input: recapInputForHistory(),
          output: outputToPersist,
          model: "hailuo",
          format: format,
          duration: duration,
          hookImageUrl: hookImageUrl || null,
          hookImagePrompt: hookImagePrompt || null,
          audioEnabled: audioEnabled,
          musicStyle: audioEnabled ? musicStyle : null,
          createdAt: new Date().toISOString(),
        });
      }

      if (session?.user?.id) {
        try {
          await saveHistorySupabase({
            kind: "video",
            input: recapInputForHistory(),
            output: outputToPersist,
            model: "hailuo",
            metadata: {
              format: format,
              duration: duration,
              hookImageUrl: hookImageUrl || null,
              hookImagePrompt: hookImagePrompt || null,
              audioEnabled: audioEnabled,
              musicStyle: audioEnabled ? musicStyle : null,
            },
          });
        } catch (err) {
          console.warn("Erreur sauvegarde Supabase (non bloquant):", err);
        }
      }

      await downloadUrlFile(
        outputToPersist,
        `viralworks-video-${new Date().toISOString().slice(0, 10)}.mp4`
      );

      capturePostHog("video_downloaded", {
        duration_seconds: parseVideoDurationSeconds(duration),
      });

      alert("Vidéo téléchargée et enregistrée dans votre profil avec succès !");

      const brain = getVwsBrain();
      setScripts(
        brain?.videoPrompts?.length
          ? ensureVeo3SceneScripts(brain.videoPrompts)
          : ensureVeo3SceneScripts([])
      );
      setHookVisual(brain?.coverPrompt ? String(brain.coverPrompt) : "");
      setActiveTab(0);
      setFormat("16:9");
      setDuration("10s");
      setMusicStyle("cinematic");
      setAudioStatus("");
      setCopied(false);
      window.dispatchEvent(new Event("onetool:history:changed"));
    } catch (err) {
      console.error("Erreur téléchargement/enregistrement:", err);
      alert("Erreur lors du téléchargement et de l'enregistrement");
    }
  };

  const handleDelete = () => {
    if (confirm("Supprimer cette vidéo ? Elle ne sera pas enregistrée.")) {
      setOutput("");
      const brain = getVwsBrain();
      setScripts(
        brain?.videoPrompts?.length
          ? ensureVeo3SceneScripts(brain.videoPrompts)
          : ensureVeo3SceneScripts([])
      );
      setHookVisual(brain?.coverPrompt ? String(brain.coverPrompt) : "");
      setActiveTab(0);
      setFormat("16:9");
      setDuration("10s");
      setMusicStyle("cinematic");
      setAudioStatus("");
      setCopied(false);
    }
  };

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Impossible de copier l'URL vidéo:", err);
      alert("Impossible de copier");
    }
  };

  return (
    <>
      <QuotaExhaustedNotice
        open={showQuotaNotice}
        title={hasAccess ? "Quota mensuel épuisé" : "Accès abonnement requis"}
        message={quotaNoticeMessage}
        actionLabel={hasAccess ? "Aller vers Packs vidéos" : "Voir les abonnements"}
        onClose={() => setShowQuotaNotice(false)}
        onGoToPacks={goToVideoPacks}
      />
      <div className="studio-panel p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 sm:gap-3">
          <h3 className="text-sm font-medium text-gray-300 shrink-0">Sources de la vidéo</h3>
          <div
            className="flex flex-wrap gap-1 p-1 rounded-xl bg-white/[0.06] border border-white/10"
            role="tablist"
            aria-label="Scènes"
          >
            {Array.from({ length: VEO3_SCENE_COUNT }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                id={`hailuo-tab-scene-${i}`}
                aria-selected={activeTab === i}
                aria-controls="hailuo-panel-main"
                tabIndex={activeTab === i ? 0 : -1}
                onClick={() => setActiveTab(i)}
                className={tabButtonClass(activeTab === i)}
              >
                Scène {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div role="tabpanel" id="hailuo-panel-main">
          {showScene1Dual ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-stretch">
                <div className="flex flex-col min-w-0 min-h-[220px]">
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                    Script gagnant
                  </label>
                  <textarea
                    value={scripts[0] ?? ""}
                    onChange={(e) => updateSceneScript(0, e.target.value)}
                    className="w-full flex-1 min-h-[200px] rounded-lg p-4 text-gray-200 placeholder-gray-500 focus:outline-none transition-all resize-none input-vws"
                    placeholder="Texte issu du cerveau VWS pour la scène 1 — tu peux l’ajuster avant génération."
                  />
                </div>
                <div className="flex flex-col min-w-0 min-h-[220px]">
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    Visuel d’accroche
                  </label>
                  <input
                    ref={hookImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleOwnImageSelected}
                    className="hidden"
                  />
                  <div className="rounded-lg border border-white/10 bg-black/50 overflow-hidden flex-1 min-h-[180px] flex flex-col">
                    {validatedHookImage?.url ? (
                      <div className="flex-1 flex items-center justify-center p-3 min-h-[180px]">
                        <div className="relative">
                          <img
                            src={validatedHookImage.url}
                            alt="Visuel validé à l’étape précédente"
                            className="max-w-full max-h-[280px] w-auto h-auto object-contain rounded-md"
                          />
                          <button
                            type="button"
                            onClick={clearHookImageSelection}
                            className="absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/70 hover:bg-black/85 border border-white/10 text-white transition-colors"
                            aria-label="Retirer le visuel d’accroche"
                            title="Retirer le visuel d’accroche"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center min-h-[180px] text-gray-500">
                        <button
                          type="button"
                          onClick={openOwnImagePicker}
                          className="w-16 h-16 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                          aria-label="Téléverser une image personnelle"
                        >
                          <Upload className="w-8 h-8 text-gray-600" strokeWidth={1.25} />
                        </button>
                        <button
                          type="button"
                          onClick={openOwnImagePicker}
                          className="text-xs font-medium text-gray-300 hover:text-white transition-colors"
                        >
                          Utiliser ma propre image
                        </button>
                      </div>
                    )}
                  </div>
                  {validatedHookImage?.url ? (
                    <button
                      type="button"
                      onClick={openOwnImagePicker}
                      className="mt-3 self-start text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Utiliser ma propre image
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                Hailuo générera la vidéo à partir du script et du visuel d’accroche.
              </p>
            </>
          ) : (
            <div className="flex flex-col min-w-0 space-y-2">
              <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Script gagnant (scène {activeTab + 1})
              </label>
              <p className="text-xs text-gray-500">
                Cette scène n’inclut pas de visuel d’accroche — uniquement le script.
              </p>
              <textarea
                value={scripts[activeTab] ?? ""}
                onChange={(e) => updateSceneScript(activeTab, e.target.value)}
                className="w-full rounded-lg p-4 min-h-[220px] text-gray-200 placeholder-gray-500 focus:outline-none transition-all resize-none input-vws"
                placeholder="Texte issu du cerveau VWS pour cette scène — tu peux l’ajuster avant génération."
              />
            </div>
          )}
        </div>
      </div>

      <div className="studio-panel p-5 sm:p-6">
        <h3 className="text-sm font-medium text-gray-300 mb-4">Paramètres</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 tracking-wide uppercase mb-2">Format</p>
            <div className="flex gap-2 flex-wrap">
              {VEO3_FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormat(opt.value)}
                  className={`flex-1 min-w-[120px] px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 border ${
                    format === opt.value
                      ? "card-vws-active text-emerald-300"
                      : "card-vws text-gray-400 hover:text-gray-300"
                  }`}
                >
                  <span className="block text-center">{opt.icon}</span>
                  <span className="text-xs mt-0.5 block text-center">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-gray-400 tracking-wide uppercase mb-2">Durée</p>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-gray-200 focus:outline-none transition-all input-vws"
            >
              {DURATION_OPTIONS.hailuo.map((opt) => (
                <option key={opt} value={opt} className="bg-[#0C1116]">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl card-vws p-3 space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs text-gray-300">
            <span>Audio auto (voix + ambiance)</span>
            <span className="px-2 py-0.5 rounded badge-vws text-emerald-300">Activé</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 uppercase tracking-wide">Ambiance</span>
            <select
              value={musicStyle}
              onChange={(e) => setMusicStyle(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-md text-gray-200 text-xs focus:outline-none input-vws"
            >
              <option value="cinematic">Cinématique</option>
              <option value="corporate">Corporate</option>
              <option value="energetic">Énergique</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Modèle : <span className="text-gray-300 font-medium">Hailuo</span></span>
            <span>{audioEnabled ? "Audio auto activé" : "Audio auto désactivé"}</span>
          </div>
          <div className="flex items-center justify-end text-xs text-gray-400 mt-2">
            <span>
              Vidéos (solde) :{" "}
              <span className="text-emerald-400 font-semibold">déduit à « Valider et enregistrer »</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          onClick={generate}
          disabled={disabled || loading}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            disabled || loading
              ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10"
              : "btn-vws-primary"
          }`}
          title={!session ? "Connectez-vous pour générer" : scriptForGeneration.trim().length < 8 ? "Saisis le script de la scène active (min 8 caractères)" : ""}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Génération en cours…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Générer la vidéo
            </>
          )}
        </button>
        <button
          onClick={reset}
          className="px-4 py-3 rounded-lg font-medium btn-vws-secondary"
        >
          Réinitialiser
        </button>
      </div>

      {/* Barre de progression pendant la génération */}
      {loading && (
        <div className="studio-panel p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              Génération en cours
            </label>
            <span className="text-sm text-emerald-400 font-medium">{progress}%</span>
          </div>
          <div className="w-full studio-step-rail mb-2">
            <div
              className="studio-step-rail-fill transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{progressMessage}</p>
        </div>
      )}

      {output && !loading && isHttpUrl(output) && (
        <>
          <div className="studio-panel p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Vidéo générée (Hailuo)
              </label>
              <button
                onClick={copy}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  copied
                    ? "card-vws-active text-emerald-300"
                    : "btn-vws-secondary"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <div className="rounded-xl card-vws p-4">
              <video
                src={output}
                controls
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                className="w-full rounded-lg border border-white/10 bg-black/70"
              />
              <pre
                ref={outputRef}
                className="mt-3 whitespace-pre-wrap text-gray-400 text-xs font-mono leading-relaxed"
              >
                {output}
              </pre>
            </div>
            {audioStatus ? (
              <p className="mt-3 text-xs text-gray-400">{audioStatus}</p>
            ) : null}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              type="button"
              onClick={prepareAnotherVideoVersion}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all btn-vws-secondary text-gray-200"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              Générer une nouvelle version
            </button>
          </div>

          {/* Message informatif */}
          <div className="mb-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
            <User className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-300 mb-1">Historique et profil</p>
              <p className="text-xs text-blue-400/80">
                En cliquant sur « Télécharger la vidéo », la création est ajoutée à votre historique et disponible dans votre{" "}
                <Link to="/profil" className="underline hover:text-blue-300">profil</Link>, où vous pourrez la retrouver,
                la partager ou la gérer.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onClick={downloadVideoFileExportHailuo}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all btn-vws-primary"
            >
              <Download className="w-4 h-4 shrink-0" />
              Télécharger la vidéo
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-medium transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer
            </button>
          </div>
        </>
      )}

      {output && !loading && !isHttpUrl(output) ? (
        <div className="studio-panel p-5 sm:p-6 border border-amber-500/30 bg-amber-950/20">
          <p className="text-sm text-amber-100 whitespace-pre-wrap break-words">{output}</p>
        </div>
      ) : null}

      {!output && !loading && (
        <div className="studio-panel p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <VideoIcon className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-sm text-gray-400">
            Saisis ta description ci-dessus et génère ta vidéo
          </p>
        </div>
      )}
    </>
  );
}

function RightPanel({ model }) {
  const { items, filtered, q, setQ, removeOne, loadIntoEditor } = useVideoModelHistory(model);

  return (
    <div className="space-y-6 lg:sticky lg:top-24">
      <div className="studio-panel p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" />
          Historique {model.toUpperCase()}
        </h2>
        </div>

      {items.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-10 pr-4 py-2 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none transition-all text-sm input-vws"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <VideoIcon className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-sm text-gray-400">
            {q ? "Aucun résultat trouvé" : "Aucune vidéo générée"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {q ? "" : "Tes vidéos apparaîtront ici"}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
          {filtered.slice(0, 12).map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-xl card-vws p-3 hover:border-[rgba(0,200,150,0.45)]"
            >
              <button
                onClick={() => loadIntoEditor(item)}
                className="w-full text-left"
              >
                <div className="text-xs font-medium text-gray-300 line-clamp-2 mb-2">
                  {item.input || item.output || "Sans titre"}
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>
                    {new Date(item.created_at || item.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  {item.model && (
                    <span className="px-1.5 py-0.5 rounded badge-vws text-emerald-300">
                      {item.model.toUpperCase()}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => removeOne(item.id)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Supprimer"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
