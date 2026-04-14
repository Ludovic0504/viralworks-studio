import { useMemo, useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexte/FournisseurAuth";
import {
  saveHistory as saveHistorySupabase,
  listHistory,
  deleteHistory,
} from "@/bibliotheque/supabase/historique";
import { hasEnoughCredits, debitCredits, getUserCredits } from "@/bibliotheque/supabase/credits";
import {
  createVertexVeoVideoTask,
  getSessionAccessTokenForVertexVeo,
  pollVertexVeoUntilComplete,
} from "@/bibliotheque/supabase/vertexVeoVideo";
import PageTitle from "../composants/interface/TitrePage";
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
  Check,
  BookOpen,
  User,
  Image as ImageIcon,
  Settings2,
  ChevronDown,
} from "lucide-react";

const VIDEO_GENERATION_COST = 1;

const VEO3_FORMAT_OPTIONS = [
  { value: "16:9", label: "YouTube (16:9)", icon: "▭" },
  { value: "9:16", label: "TikTok (9:16)", icon: "▯" },
];

const DURATION_OPTIONS = {
  veo3: ["4s", "6s", "8s"],
  hailuo: ["6s", "10s"],
};

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
    const raw = localStorage.getItem("vws_brain_v2_last");
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

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
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

export default function Video({ studioSequenceType, studioScriptPrompt, studioImageStep, dialogueEnabled = true } = {}) {
  const [tab, setTab] = useState("veo3");
  const { session } = useAuth();
  const [showSystemVideo, setShowSystemVideo] = useState(false);

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <PageTitle
          green="Vidéos"
          white="Génération"
          subtitle="Crée des vidéos avec l'intelligence artificielle."
        />
        
        <div className="w-full sm:w-[340px] space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-300">Étape 3 sur 3 · Vidéo finale</span>
            </div>
            <div className="w-full studio-step-rail">
              <div className="h-full w-full studio-step-rail-fill" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowSystemVideo(true)}
              className="studio-toolbar-btn"
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              Explication du système
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {tab === "veo3" ? (
            <VEO3VideoForm
              onCreditsUpdate={loadCredits}
              studioSequenceType={studioSequenceType}
              studioScriptPrompt={studioScriptPrompt}
              studioImageStep={studioImageStep}
              dialogueEnabled={dialogueEnabled}
            />
          ) : (
            <HailuoVideoForm onCreditsUpdate={loadCredits} studioImageStep={studioImageStep} dialogueEnabled={dialogueEnabled} />
          )}
        </div>

        <div className="lg:col-span-1">
          <RightPanel model={tab} />
        </div>
      </div>

      <details className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:px-5 open:border-white/10 open:bg-white/[0.03] transition-colors">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs text-gray-500 hover:text-gray-400 select-none [&::-webkit-details-marker]:hidden">
          <Settings2 className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
          <span>
            Réglages avancés — moteur de génération{" "}
            <span className="text-gray-600">(VEO3 / Hailuo, optionnel)</span>
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
            <TabButton active={tab === "hailuo"} onClick={() => setTab("hailuo")}>
              <Wand2 className="w-3.5 h-3.5" />
              <span>Hailuo</span>
            </TabButton>
          </div>
        </div>
      </details>

      {/* Pop-up explication du système */}
      {showSystemVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowSystemVideo(false)}
        >
          <div
            className="studio-panel max-w-3xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-gray-200">Explication du système</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Cette courte vidéo t’explique comment utiliser la vidéo générée et quelles actions simples peuvent
                  améliorer ses performances une fois publiée.
                </p>
              </div>
              <button
                onClick={() => setShowSystemVideo(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="aspect-video w-full rounded-xl border border-white/10 bg-black/60 flex items-center justify-center text-xs text-gray-400">
                Vidéo explicative à intégrer ici
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 rounded-lg ${
        active
          ? "bg-cyan-500/20 text-cyan-100 border border-cyan-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
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

function VEO3VideoForm({
  onCreditsUpdate,
  studioSequenceType,
  studioScriptPrompt,
  studioImageStep,
  dialogueEnabled = true,
}) {
  const { session } = useAuth();
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
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  /** Message d’erreur métier (jamais confondu avec l’URL vidéo affichée dans <video>). */
  const [generationError, setGenerationError] = useState("");
  const [validatedHookImage, setValidatedHookImage] = useState(null);
  const studioHookImage = useMemo(() => getHookImageFromStudioStep(studioImageStep), [studioImageStep]);
  const studioScriptPromptRef = useRef(studioScriptPrompt);
  studioScriptPromptRef.current = studioScriptPrompt;
  const sceneCountRef = useRef(sceneCount);
  sceneCountRef.current = sceneCount;
  const prevStudioSyncKey = useRef(null);
  const prevHookSyncKey = useRef(null);

  const sceneTabLabels = useMemo(() => veo3SceneTabLabels(sceneCount), [sceneCount]);

  useEffect(() => {
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
  }, [validatedHookImage?.url]);

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
  const scriptReady = (scriptForGeneration || "").trim().length >= 8;
  const abortRef = useRef(null);

  useEffect(() => {
    if (session) {
      loadCredits();
    }
  }, [session]);

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
  }, [session, studioHookImage, studioImageStep]);

  useEffect(() => {
    const key = `${validatedHookImage?.url || ""}|${validatedHookImage?.prompt || ""}`;
    if (prevHookSyncKey.current === key) return;
    prevHookSyncKey.current = key;
    setHookVisual(String(validatedHookImage?.prompt || "").trim());
  }, [validatedHookImage?.url, validatedHookImage?.prompt]);

  const generate = async () => {
    if (loading) return;

    if (!session?.access_token) {
      alert("Connecte-toi pour lancer la génération vidéo.");
      return;
    }

    const scriptTrim = (scriptForGeneration || "").trim();
    if (scriptTrim.length < 8) {
      alert(
        `Le script du moment « ${sceneTabLabels[activeTab] ?? `Partie ${activeTab + 1}`} » est trop court (minimum 8 caractères). Ouvre « Options avancées » pour compléter le texte. Aucun visuel d’accroche n’est nécessaire pour générer.`
      );
      return;
    }

    let finalIdea = scriptTrim;
    if (sceneIndexForGeneration === 0 && hookVisual.trim()) {
      finalIdea = `${finalIdea}\n\nVisuel d'accroche :\n${hookVisual.trim()}`;
    }
    let manualDialogueLine = "";
    if (dialogueEnabled && !dialogueAuto) {
      if (sceneCount > 1 && dialoguePerScene) {
        manualDialogueLine = String(dialogueByScene[sceneIndexForGeneration] ?? "").trim();
      } else {
        manualDialogueLine = dialogueGlobal.trim();
      }
      if (manualDialogueLine) {
        finalIdea = `${finalIdea}\n\nÀ dire à l’écran : ${manualDialogueLine}`;
      }
    }
    const lenCheck = validateIdeaLength(finalIdea);
    if (!lenCheck.ok) {
      alert(lenCheck.message);
      return;
    }

    if (session) {
      const hasCredits = await hasEnoughCredits(VIDEO_GENERATION_COST);
      if (!hasCredits) {
        alert("Ton quota actuel ne permet pas de lancer cette génération de vidéo. Mets à jour ton pack ou ton abonnement dans la Boutique.");
        return;
      }
    }

    setLoading(true);
    setOutput("");
    setGenerationError("");
    setCopied(false);
    setProgress(0);
    setProgressMessage("Initialisation...");
    setAudioStatus("");

    abortRef.current?.abort?.();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      if (session) {
        setProgress(10);
        setProgressMessage("Vérification des crédits...");
        console.log("💳 [Video VEO3] Début du débit des crédits...");
        const debitResult = await debitCredits(
          VIDEO_GENERATION_COST,
          "video_generation",
          { model: "veo3", format: derivedFormat, duration: duration }
        );
        
        console.log("💳 [Video VEO3] Résultat du débit:", debitResult);
        
        if (!debitResult.success) {
          const errorMsg = debitResult.error || "Erreur lors du débit des crédits";
          console.error("❌ [Video VEO3] Échec du débit:", errorMsg);
          alert("Une erreur est survenue lors de l’activation de cette génération. Réessaie dans quelques instants ou contacte le support si le problème persiste.");
          throw new Error(errorMsg);
        }
        
        if (debitResult.remainingCredits !== undefined) {
          if (onCreditsUpdate) onCreditsUpdate();
          console.log("✅ [Video VEO3] Crédits mis à jour:", debitResult.remainingCredits);
        }
      }

      setProgress(25);
      setProgressMessage("Création de la tâche vidéo...");

      const fullPrompt = [
        `Idée: ${finalIdea}`,
        `Format: ${derivedFormat} (aligné sur le visuel d’accroche)`,
        `Durée: ${duration}`,
        validatedHookImage?.url
          ? "Start from the exact selected hook image as the first frame and keep identity, composition and environment continuity from that initial state."
          : "",
        `audio_mode: ${dialogueEnabled ? "dialogue" : "silent"}`,
        !dialogueEnabled
          ? "Silent constraints: no dialogue, no speech, no voice over, no talking, no lip sync, no TTS, visual-only sequence."
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      const durationSec =
        duration === "4s" ? 4 : duration === "6s" ? 6 : 8;
      const veoClientOpts = { getAccessToken: getSessionAccessTokenForVertexVeo };

      const { taskId, model: veoModel } = await createVertexVeoVideoTask(
        {
          prompt: fullPrompt,
          durationSeconds: durationSec,
          aspectRatio: derivedFormat === "9:16" ? "9:16" : "16:9",
          initialImageUrl: String(validatedHookImage?.url || "").trim() || undefined,
          generationMode: validatedHookImage?.url ? "image_to_video" : "text_to_video",
        },
        session?.access_token,
        veoClientOpts
      );

      const maxPoll = 90;
      const { videoUrl } = await pollVertexVeoUntilComplete(taskId, session?.access_token, {
        maxAttempts: maxPoll,
        intervalMs: 4000,
        signal: ctrl.signal,
        model: veoModel,
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
          const voiceText =
            dialogueAuto
              ? scriptForGeneration.trim()
              : (manualDialogueLine || scriptForGeneration.trim());
          const postToken =
            (await getSessionAccessTokenForVertexVeo()) || session.access_token;
          const postData = await callVideoPostprocessApi(
            {
              video_url: videoUrl,
              voice_text: dialogueEnabled ? voiceText : "",
              music_style: musicStyle,
              enable_tts: dialogueEnabled,
              enable_music: true,
              model: "veo3",
            },
            postToken
          );
          const processedUrl = String(postData?.video_url || "").trim();
          if (processedUrl) finalVideoUrl = processedUrl;
          setAudioStatus(audioPostprocessStatusLabel(postData));
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

    } catch (e) {
      if (e.name === "AbortError") {
        setGenerationError("Génération annulée.");
        setOutput("");
        return;
      }
      const errorMessage = e?.message || "Erreur lors de la génération";
      setOutput("");
      setGenerationError(errorMessage);
      console.error("Erreur génération vidéo VEO3:", e);
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

  const recapInputForHistory = () =>
    scripts
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join("\n\n---\n\n");

  const reset = () => {
    abortRef.current?.abort?.();
    const brain = getVwsBrain();
    setScripts(buildVeo3ScriptsFromSources(studioScriptPromptRef.current, sceneCountRef.current));
    setHookVisual(
      studioImageStep
        ? String(studioHookImage?.prompt || "").trim()
        : brain?.coverPrompt
        ? String(brain.coverPrompt)
        : ""
    );
    setActiveTab(0);
    setOutput("");
    setGenerationError("");
    setDuration("8s");
    setMusicStyle("cinematic");
    setAudioStatus("");
    setDialogueAuto(true);
    setDialogueGlobal("");
    setDialoguePerScene(false);
    setDialogueByScene(["", "", ""]);
    setCopied(false);
  };

  const handleValidate = async () => {
    if (!output?.trim() || !isHttpUrl(output)) return;
    const hookImageUrl = String(validatedHookImage?.url || "").trim();
    const hookImagePrompt = String(validatedHookImage?.prompt || "").trim();
    
    try {
      if (!session?.user?.id) {
        addHistoryEntry({
          id: crypto.randomUUID?.() || String(Date.now()),
          kind: "video",
          input: recapInputForHistory(),
          output: output,
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
            output: output,
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
      
      alert("✅ Vidéo validée et enregistrée avec succès !");
      const brain = getVwsBrain();
      setScripts(buildVeo3ScriptsFromSources(studioScriptPromptRef.current, sceneCountRef.current));
      setHookVisual(brain?.coverPrompt ? String(brain.coverPrompt) : "");
      setActiveTab(0);
      setOutput("");
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
      console.error("Erreur validation:", err);
      alert("Erreur lors de la validation");
    }
  };

  const handleDelete = () => {
    if (confirm("Supprimer cette vidéo ? Elle ne sera pas enregistrée.")) {
      setOutput("");
      setGenerationError("");
      setDuration("8s");
      setMusicStyle("cinematic");
      setAudioStatus("");
      setDialogueAuto(true);
      setDialogueGlobal("");
      setDialoguePerScene(false);
      setDialogueByScene(["", "", ""]);
      setCopied(false);
    }
  };

  const copy = async () => {
    if (!output || !isHttpUrl(output)) return;
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

  const clampDialoguePhrase = (s) => {
    const w = String(s).trim().split(/\s+/).filter(Boolean);
    if (w.length <= 12) return w.join(" ");
    return w.slice(0, 12).join(" ");
  };

  const updateDialogueByScene = (sceneIndex, value) => {
    const v = clampDialoguePhrase(value);
    setDialogueByScene((prev) => {
      const next = [...ensureVeo3SceneScripts(prev)];
      next[sceneIndex] = v;
      return next;
    });
  };

  const tabButtonClass = (selected) =>
    `px-3 py-2 rounded-md text-xs font-medium border transition-all whitespace-nowrap ${
      selected
        ? "bg-emerald-500/25 text-emerald-200 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
        : "bg-transparent text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/5"
    }`;

  const showScene1Dual = activeTab === 0;

  return (
    <>
      <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-4 sm:p-5 space-y-4 ring-1 ring-white/[0.06]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="text-sm text-gray-200 leading-relaxed">
            Chaque partie du parcours devient un clip vidéo. Les vidéos longues enchaînent plusieurs moments
            (début, transformation, résultat). Le format de la vidéo suit automatiquement ton visuel d’accroche.
          </p>
          <span className="shrink-0 inline-flex items-center text-xs font-medium px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-emerald-200/95 whitespace-nowrap self-start">
            {sceneCount === 1 ? "1 moment" : "3 moments"}
          </span>
        </div>

        <div className="studio-panel p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 sm:gap-3">
          <h3 className="text-sm font-medium text-gray-300 shrink-0">Sources de la vidéo</h3>
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
        </div>

        <div role="tabpanel" id="veo3-panel-main">
          {showScene1Dual ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-stretch">
                <div className="flex flex-col min-w-0 min-h-[200px] rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                    Ce que montre ce moment
                  </label>
                  <p className="text-sm text-gray-100 leading-relaxed">
                    {veo3ScenePlainDescription(scripts[0] ?? "", 0, sceneCount)}
                  </p>
                  <p className="text-xs text-gray-500 mt-3">
                    Pour le détail exact de la génération, ouvre les options avancées.
                  </p>
                </div>
                <div className="flex flex-col min-w-0 min-h-[200px]">
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    Visuel d’accroche
                  </label>
                  <div className="rounded-lg border border-white/10 bg-black/50 overflow-hidden flex-1 min-h-[180px] flex flex-col">
                    {validatedHookImage?.url ? (
                      <div className="flex-1 flex items-center justify-center p-3 min-h-[180px]">
                        <img
                          src={validatedHookImage.url}
                          alt="Visuel validé à l’étape précédente"
                          className="max-w-full max-h-[280px] w-auto h-auto object-contain rounded-md"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center min-h-[180px] text-gray-500">
                        <div className="w-16 h-16 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-600" strokeWidth={1.25} />
                        </div>
                        <p className="text-xs max-w-[200px]">
                          Valide une image à l’étape « Visuel d’accroche » pour l’afficher ici.
                        </p>
                      </div>
                    )}
                  </div>
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
            <div className="flex flex-col min-w-0 space-y-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Ce que montre ce moment — {sceneTabLabels[activeTab] ?? `Partie ${activeTab + 1}`}
              </label>
              <p className="text-xs text-gray-500">
                Pas d’image d’accroche sur ce moment : la vidéo s’appuie sur la description.
              </p>
              <p className="text-sm text-gray-100 leading-relaxed">
                {veo3ScenePlainDescription(scripts[activeTab] ?? "", activeTab, sceneCount)}
              </p>
              <p className="text-xs text-gray-500">
                Pour le détail exact de la génération, ouvre les options avancées.
              </p>
            </div>
          )}
        </div>
        </div>
      </div>

        <div className="studio-panel p-5 sm:p-6 pt-2 space-y-4">
          <p className="text-xs text-gray-500">
            Format vidéo :{" "}
            <span className="text-gray-300">
              {derivedFormat === "9:16"
                ? "vertical (comme ton visuel ou par défaut)"
                : "paysage (d’après ton visuel d’accroche)"}
            </span>
            {" · "}
            Durée du clip : <span className="text-gray-300">{duration.replace("s", " s")}</span>
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            🎙️ Dialogue : {dialogueEnabled ? "activé" : "désactivé"} (modifiable dans Vidéo virale)
          </p>
          {!dialogueEnabled ? (
            <p className="text-xs text-amber-300/90 leading-relaxed">Dialogue : Désactivé</p>
          ) : null}

          <details className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 sm:px-5 open:border-white/12 open:bg-white/[0.03] transition-colors">
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
                    className="w-full max-w-xs px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                  >
                    {DURATION_OPTIONS.veo3.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#0C1116]">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs text-gray-400 leading-relaxed">
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
                    className="mt-0.5 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/40"
                    checked={dialogueAuto}
                    disabled={!dialogueEnabled}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setDialogueAuto(on);
                      if (on) setDialoguePerScene(false);
                    }}
                  />
                  <span>Dialogue automatique</span>
                </label>
                {!dialogueAuto ? (
                  <div className="space-y-4 pl-0 sm:pl-1">
                    {sceneCount > 1 ? (
                      <label className="flex items-start gap-2.5 cursor-pointer text-sm text-gray-300">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/40"
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
                          onChange={(e) => setDialogueGlobal(clampDialoguePhrase(e.target.value))}
                          maxLength={96}
                          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
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
                              maxLength={96}
                              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
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
                  Texte détaillé envoyé au moteur vidéo. Tu peux l’éditer si tu maîtrises le vocabulaire
                  technique ; sinon laisse le texte issu du tunnel.
                </p>
                <div className="space-y-3">
                  {Array.from({ length: sceneCount }, (_, i) => (
                    <div key={i} className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-400">
                        {sceneTabLabels[i] ?? `Partie ${i + 1}`}
                      </label>
                      <textarea
                        value={scripts[i] ?? ""}
                        onChange={(e) => updateSceneScript(i, e.target.value)}
                        rows={6}
                        className="w-full rounded-lg border border-white/10 p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-y bg-white/5"
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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
                      : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white hover:from-emerald-400 hover:to-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-[0.99]"
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
              className="px-5 py-3.5 rounded-lg font-medium bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-all sm:shrink-0"
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
          <p className="text-xs text-gray-400">{progressMessage}</p>
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
            </div>
          </div>
        </div>
      ) : null}

      {output && !loading && isHttpUrl(output) ? (
        <>
          <div className="studio-panel p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Vidéo générée (VEO3)
              </label>
              <button
                onClick={copy}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
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
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <video
                key={output}
                src={output}
                controls
                playsInline
                className={`w-full rounded-lg border border-white/10 bg-black/70 ${
                  derivedFormat === "9:16" ? "max-h-[min(85vh,720px)] mx-auto aspect-[9/16]" : "aspect-video"
                }`}
              />
              <p className="mt-3 text-[11px] text-gray-500 break-all">
                URL signée (copie via le bouton) — lien temporaire côté stockage.
              </p>
            </div>
            {audioStatus ? (
              <p className="mt-3 text-xs text-gray-400">{audioStatus}</p>
            ) : null}
          </div>

          {/* Message informatif */}
          <div className="mb-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
            <User className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-300 mb-1">Vos vidéos sont enregistrées</p>
              <p className="text-xs text-blue-400/80">
                Une fois validées, vos vidéos seront disponibles dans votre <Link to="/profil" className="underline hover:text-blue-300">profil</Link> où vous pourrez les télécharger, partager ou les gérer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleValidate}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-medium transition-all"
            >
              <Check className="w-4 h-4" />
              Valider et enregistrer
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
    </>
  );
}

function HailuoVideoForm({ onCreditsUpdate, studioImageStep, dialogueEnabled = true }) {
  const { session } = useAuth();
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
  const [copied, setCopied] = useState(false);
  const [credits, setCredits] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const studioHookImage = useMemo(() => getHookImageFromStudioStep(studioImageStep), [studioImageStep]);
  const prevHookSyncKey = useRef(null);
  const scriptForGeneration = scripts[activeTab] ?? "";
  const disabled = useMemo(() => {
    if (!session) return true;
    if (scriptForGeneration.trim().length < 8) return true;
    if (credits === null || credits < VIDEO_GENERATION_COST) return true;
    return false;
  }, [scriptForGeneration, credits, session]);
  const abortRef = useRef(null);
  const outputRef = useRef(null);

  useEffect(() => {
    if (session) {
      loadCredits();
    }
  }, [session]);

  const loadCredits = async () => {
    try {
      const userCredits = await getUserCredits();
      setCredits(userCredits);
    } catch (err) {
      console.error("Erreur chargement crédits:", err);
    }
  };

  useEffect(() => {
    let active = true;
    const syncHookImage = async () => {
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
  }, [session, studioHookImage, studioImageStep]);

  useEffect(() => {
    const key = `${validatedHookImage?.url || ""}|${validatedHookImage?.prompt || ""}`;
    if (prevHookSyncKey.current === key) return;
    prevHookSyncKey.current = key;
    setHookVisual(String(validatedHookImage?.prompt || "").trim());
  }, [validatedHookImage?.url, validatedHookImage?.prompt]);

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
    `px-3 py-2 rounded-md text-xs font-medium border transition-all whitespace-nowrap ${
      selected
        ? "bg-emerald-500/25 text-emerald-200 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
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
      alert(lenCheck.message);
      return;
    }

    if (session) {
      const hasCredits = await hasEnoughCredits(VIDEO_GENERATION_COST);
      if (!hasCredits) {
        alert(`Crédits insuffisants. Il vous faut ${VIDEO_GENERATION_COST} crédit(s) pour générer une vidéo.`);
        return;
      }
    }

    setLoading(true);
    setOutput("");
    setCopied(false);
    setProgress(0);
    setProgressMessage("Initialisation...");
    setAudioStatus("");

    abortRef.current?.abort?.();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      if (session) {
        setProgress(10);
        setProgressMessage("Vérification des crédits...");
        console.log("💳 [Video Hailuo] Début du débit des crédits...");
        const debitResult = await debitCredits(
          VIDEO_GENERATION_COST,
          "video_generation",
          { model: "hailuo", format: format, duration: duration }
        );
        
        console.log("💳 [Video Hailuo] Résultat du débit:", debitResult);
        
        if (!debitResult.success) {
          const errorMsg = debitResult.error || "Erreur lors du débit des crédits";
          console.error("❌ [Video Hailuo] Échec du débit:", errorMsg);
          alert(`Erreur: ${errorMsg}`);
          throw new Error(errorMsg);
        }
        
        if (debitResult.remainingCredits !== undefined) {
          setCredits(debitResult.remainingCredits);
          if (onCreditsUpdate) onCreditsUpdate();
          console.log("✅ [Video Hailuo] Crédits mis à jour:", debitResult.remainingCredits);
        }
      }

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
              voice_text: dialogueEnabled ? scriptForGeneration.trim() : "",
              music_style: musicStyle,
              enable_tts: dialogueEnabled,
              enable_music: true,
              model: "hailuo",
            },
            session.access_token
          );
          const processedUrl = String(postData?.video_url || "").trim();
          if (processedUrl) finalVideoUrl = processedUrl;
          setAudioStatus(audioPostprocessStatusLabel(postData));
        } catch (postErr) {
          console.warn("Post-traitement audio non appliqué:", postErr);
          setAudioStatus(
            "Échec de l’appel au service de post-traitement ; vérifie la session et la console réseau."
          );
        }
      }

      setProgress(100);
      setProgressMessage("Vidéo prête");
      setOutput(finalVideoUrl);

    } catch (e) {
      if (e.name === 'AbortError') {
        return; // Requête annulée, ne rien faire
      }
      const errorMessage = e?.message || "Erreur lors de la génération";
      setOutput("⚠️ Erreur : " + errorMessage);
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

  const reset = () => {
    abortRef.current?.abort?.();
    const brain = getVwsBrain();
    setScripts(
      brain?.videoPrompts?.length
        ? ensureVeo3SceneScripts(brain.videoPrompts)
        : ensureVeo3SceneScripts([])
    );
    setHookVisual(
      studioImageStep
        ? String(studioHookImage?.prompt || "").trim()
        : brain?.coverPrompt
        ? String(brain.coverPrompt)
        : ""
    );
    setActiveTab(0);
    setOutput("");
    setFormat("16:9");
    setDuration("10s");
    setMusicStyle("cinematic");
    setAudioStatus("");
    setCopied(false);
  };

  const handleValidate = async () => {
    if (!output || !output.trim()) return;
    const hookImageUrl = String(validatedHookImage?.url || "").trim();
    const hookImagePrompt = String(validatedHookImage?.prompt || "").trim();
    
    try {
      if (!session?.user?.id) {
        addHistoryEntry({
          id: crypto.randomUUID?.() || String(Date.now()),
          kind: "video",
          input: recapInputForHistory(),
          output: output,
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
            output: output,
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
      
      alert("✅ Vidéo validée et enregistrée avec succès !");
      const brain = getVwsBrain();
      setScripts(
        brain?.videoPrompts?.length
          ? ensureVeo3SceneScripts(brain.videoPrompts)
          : ensureVeo3SceneScripts([])
      );
      setHookVisual(brain?.coverPrompt ? String(brain.coverPrompt) : "");
      setActiveTab(0);
      setOutput("");
      setFormat("16:9");
      setDuration("10s");
      setMusicStyle("cinematic");
      setAudioStatus("");
      setCopied(false);
      window.dispatchEvent(new Event("onetool:history:changed"));
    } catch (err) {
      console.error("Erreur validation:", err);
      alert("Erreur lors de la validation");
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
                    className="w-full flex-1 min-h-[200px] rounded-lg border border-white/10 p-4 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none bg-white/5"
                    placeholder="Texte issu du cerveau VWS pour la scène 1 — tu peux l’ajuster avant génération."
                  />
                </div>
                <div className="flex flex-col min-w-0 min-h-[220px]">
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    Visuel d’accroche
                  </label>
                  <div className="rounded-lg border border-white/10 bg-black/50 overflow-hidden flex-1 min-h-[180px] flex flex-col">
                    {validatedHookImage?.url ? (
                      <div className="flex-1 flex items-center justify-center p-3 min-h-[180px]">
                        <img
                          src={validatedHookImage.url}
                          alt="Visuel validé à l’étape précédente"
                          className="max-w-full max-h-[280px] w-auto h-auto object-contain rounded-md"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center min-h-[180px] text-gray-500">
                        <div className="w-16 h-16 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-600" strokeWidth={1.25} />
                        </div>
                        <p className="text-xs max-w-[200px]">
                          Valide une image à l’étape « Visuel d’accroche » pour l’afficher ici.
                        </p>
                      </div>
                    )}
                  </div>
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
                className="w-full rounded-lg border border-white/10 p-4 min-h-[220px] text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none bg-white/5"
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
                  className={`flex-1 min-w-[120px] px-3 py-2.5 rounded-lg text-sm font-medium transition-all border ${
                    format === opt.value
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                      : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300 border-white/10"
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
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            >
              {DURATION_OPTIONS.hailuo.map((opt) => (
                <option key={opt} value={opt} className="bg-[#0C1116]">
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs text-gray-300">
            <span>Audio auto (voix + ambiance)</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Activé</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 uppercase tracking-wide">Ambiance</span>
            <select
              value={musicStyle}
              onChange={(e) => setMusicStyle(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
            <span>Coût : <span className="text-emerald-400 font-semibold">{VIDEO_GENERATION_COST} crédit{VIDEO_GENERATION_COST > 1 ? "s" : ""}</span></span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={generate}
          disabled={disabled || loading || (session && (credits === null || credits < VIDEO_GENERATION_COST))}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            disabled || loading || (session && (credits === null || credits < VIDEO_GENERATION_COST))
              ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10"
              : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white hover:from-emerald-400 hover:to-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95"
          }`}
          title={!session ? "Connectez-vous pour générer" : credits !== null && credits < VIDEO_GENERATION_COST ? "Crédits insuffisants" : scriptForGeneration.trim().length < 8 ? "Saisis le script de la scène active (min 8 caractères)" : ""}
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Génération en cours…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Générer la vidéo {session && `(${VIDEO_GENERATION_COST} crédit)`}
            </>
          )}
        </button>
        <button
          onClick={reset}
          className="px-4 py-3 rounded-lg font-medium bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-all active:scale-95"
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

      {output && !loading && (
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
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
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
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <video
                src={output}
                controls
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

          {/* Message informatif */}
          <div className="mb-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
            <User className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-300 mb-1">Vos vidéos sont enregistrées</p>
              <p className="text-xs text-blue-400/80">
                Une fois validées, vos vidéos seront disponibles dans votre <Link to="/profil" className="underline hover:text-blue-300">profil</Link> où vous pourrez les télécharger, partager ou les gérer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleValidate}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 font-medium transition-all"
            >
              <Check className="w-4 h-4" />
              Valider et enregistrer
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

  const loadIntoEditor = (item) => {
    window.dispatchEvent(
      new CustomEvent("onetool:video:load", {
        detail: { input: item.input, output: item.output },
      })
    );
  };

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
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
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
              className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-emerald-500/50 transition-all bg-white/5 p-3"
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
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
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
