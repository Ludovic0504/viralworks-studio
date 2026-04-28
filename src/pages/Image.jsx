import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { saveHistory as saveHistorySupabase } from "@/bibliotheque/supabase/historique";
import { hasEnoughCredits, getUserCredits } from "@/bibliotheque/supabase/credits";
import { uploadImagesFromUrls } from "@/bibliotheque/supabase/storage";
import { getUserSubscription } from "@/bibliotheque/supabase/stripe";
import {
  canUseImageGeneration,
  canUseImageModification,
  consumeImageGeneration,
  consumeImageModification,
  getWorkflowUsage,
  resetWorkflowUsage,
} from "@/bibliotheque/workflowQuota";
import {
  LS_VIRAL_STUDIO_DRAFT,
  SS_CAMPAIGN_IDEA_LIVE_KEY,
} from "@/bibliotheque/viralWorksStudioStorage";
import {
  createDefaultCampaignGenerationSpec,
  getSafeIntentProfile,
  getSafeScenes,
  normalizeCampaignGenerationSpec,
} from "@/bibliotheque/campaignGenerationSpec";
import PageTitle from "../composants/interface/TitrePage";
import {
  modifyImageWithNanoBanana,
  IMAGE_EDIT_BUSY_MESSAGE,
} from "@/bibliotheque/nanobanana/modifyImage";
import { buildHookImageApiPrompt } from "@/bibliotheque/vwsPromptEngine";
import {
  Sparkles,
  X,
  Check,
  BookOpen,
  Settings2,
  ChevronRight,
  History,
} from "lucide-react";

const IMAGE_GENERATION_COST = 1;
const VIDEO_QUOTA_EXHAUSTED_MESSAGE =
  "limite vidéo atteint pour ce mois, veuillez attendre la fin du mois pour le renouvellement des vidéos ou acheter des packs vidéos pour continuer a créer";
const NON_SUBSCRIBER_BLOCKED_MESSAGE =
  "Prenez un abonnement pour profiter de ViralWorks Studio et lancer vos générations.";

function QuotaBlockedModal({ open, title, message, actionLabel, onClose, onGoToShop }) {
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
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={onGoToShop}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-semibold hover:from-cyan-400 hover:to-teal-400 transition-all"
            >
              {actionLabel || "Aller vers Packs vidéos"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function userKey(uid) {
  return uid ? `u:${uid}` : "guest";
}

const LS_HISTORY = "history_v2";
function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Impossible de charger l'historique local image:", err);
    return [];
  }
}
function saveHistory(items) {
  try {
    localStorage.setItem(LS_HISTORY, JSON.stringify(items));
  } catch (err) {
    console.warn("Impossible de sauvegarder l'historique local image:", err);
  }
}
function addImageHistory({ uid, prompt, urls, meta }) {
  const id = crypto.randomUUID?.() || String(Date.now());
  const createdAt = new Date().toISOString();
  const entry = {
    id,
    kind: "image",
    prompt,
    output: null,
    urls,
    meta,
    createdAt,
    pinned: false,
    owner: userKey(uid),
  };
  const items = loadHistory();
  saveHistory([entry, ...items]);
  window.dispatchEvent(new Event("onetool:history:changed"));
}
const DEFAULT_IMAGE_STEP = {
  campaignIdeaPrompt: "",
  prompt: "",
  ratio: "9:16",
  quantity: 4,
  refCharDataUrl: null,
  lastGeneratedImages: null,
  lastGeneratedPrompt: "",
  selectedImageIndex: 0,
  modifyInstruction: "",
  pairedCampaignIdea: null,
};

function formatVisualSnapshotLabel(t) {
  try {
    return new Date(t).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Session";
  }
}

export default function ImagePage({
  campaignIdea = "",
  campaignJobType = "",
  campaignModifiers = "",
  campaignClarifyMode = null,
  campaignClarifyAnswer = null,
  campaignCameraAerialAngle = null,
  campaignGlobalIntentProfile = null,
  campaignSelfieMode = false,
  scriptScene1Idea = "",
  campaignRevealMode = false,
  campaignMicroAnswer = null,
  visualStepActive = false,
  imageStep,
  campaignGenerationSpec = null,
  patchImageStep,
  resetImageStep,
  onUseImageAndContinue,
  visualSnapshots = [],
  onRestoreVisualSnapshot,
}) {
  const { session, supabase } = useAuth();
  const uid = session?.user?.id;

  const {
    campaignIdeaPrompt,
    prompt,
    ratio,
    quantity,
    refCharDataUrl,
    lastGeneratedImages,
    lastGeneratedPrompt,
    selectedImageIndex,
    modifyInstruction,
  } = imageStep ?? DEFAULT_IMAGE_STEP;

  const canonicalSpec = useMemo(() => {
    const fallback = createDefaultCampaignGenerationSpec();
    const fromIncoming = normalizeCampaignGenerationSpec(campaignGenerationSpec ?? imageStep?.campaignGenerationSpec ?? fallback);
    return normalizeCampaignGenerationSpec({
      ...fromIncoming,
      campaign: {
        ...fromIncoming.campaign,
        profession: String(campaignJobType || fromIncoming.campaign.profession || ""),
        core_idea: String(campaignIdea || fromIncoming.campaign.core_idea || ""),
        style_details: String(campaignModifiers || fromIncoming.campaign.style_details || ""),
        intent_profile: campaignGlobalIntentProfile ?? fromIncoming.campaign.intent_profile,
        clarification: {
          ...fromIncoming.campaign.clarification,
          mode: campaignClarifyMode ?? fromIncoming.campaign.clarification.mode,
          last_user_freeform_answer:
            campaignClarifyAnswer ?? fromIncoming.campaign.clarification.last_user_freeform_answer,
          camera_aerial_angle:
            campaignCameraAerialAngle ?? fromIncoming.campaign.clarification.camera_aerial_angle,
          initial_state: campaignMicroAnswer ?? fromIncoming.campaign.clarification.initial_state,
        },
      },
      creative: {
        ...fromIncoming.creative,
        scenes: [
          {
            ...getSafeScenes(fromIncoming)[0],
            script_text: String(scriptScene1Idea || getSafeScenes(fromIncoming)[0]?.script_text || ""),
          },
          getSafeScenes(fromIncoming)[1],
          getSafeScenes(fromIncoming)[2],
        ],
        hook_visual: {
          ...fromIncoming.creative.hook_visual,
          prompt_text: String(campaignIdeaPrompt || fromIncoming.creative.hook_visual.prompt_text || ""),
          provider_prompt_raw: String(prompt || fromIncoming.creative.hook_visual.provider_prompt_raw || ""),
          image_variants: Array.isArray(lastGeneratedImages) ? [...lastGeneratedImages] : [],
          selected_variant_index: Number.isFinite(Number(selectedImageIndex)) ? Number(selectedImageIndex) : 0,
          selected_image_url:
            (Array.isArray(lastGeneratedImages) && lastGeneratedImages[Number(selectedImageIndex)])
              ? String(lastGeneratedImages[Number(selectedImageIndex)] || "")
              : String(fromIncoming.creative.hook_visual.selected_image_url || ""),
          last_generation_prompt:
            String(lastGeneratedPrompt || fromIncoming.creative.hook_visual.last_generation_prompt || ""),
          modification_instruction:
            String(modifyInstruction || fromIncoming.creative.hook_visual.modification_instruction || ""),
        },
      },
      rendering: {
        ...fromIncoming.rendering,
        camera: {
          ...fromIncoming.rendering.camera,
          reveal_mode: Boolean(campaignRevealMode ?? fromIncoming.rendering.camera.reveal_mode),
          selfie_mode: Boolean(campaignSelfieMode ?? fromIncoming.rendering.camera.selfie_mode),
        },
      },
    });
  }, [
    campaignGenerationSpec,
    imageStep?.campaignGenerationSpec,
    campaignJobType,
    campaignIdea,
    campaignModifiers,
    campaignGlobalIntentProfile,
    campaignClarifyMode,
    campaignClarifyAnswer,
    campaignCameraAerialAngle,
    campaignMicroAnswer,
    scriptScene1Idea,
    campaignIdeaPrompt,
    prompt,
    lastGeneratedImages,
    selectedImageIndex,
    lastGeneratedPrompt,
    modifyInstruction,
    campaignRevealMode,
    campaignSelfieMode,
  ]);

  const writeHookVisualSpec = useCallback(
    (updates) => {
      if (!patchImageStep) return;
      patchImageStep((prev) => {
        const prevAsObject = prev && typeof prev === "object" ? prev : {};
        const baseSpec = normalizeCampaignGenerationSpec(
          prevAsObject.campaignGenerationSpec ?? canonicalSpec
        );
        const next = normalizeCampaignGenerationSpec({
          ...baseSpec,
          creative: {
            ...baseSpec.creative,
            hook_visual: {
              ...baseSpec.creative.hook_visual,
              ...updates,
            },
          },
        });
        return {
          ...prevAsObject,
          campaignGenerationSpec: next,
        };
      });
    },
    [patchImageStep, canonicalSpec]
  );

  const [model] = useState("Image-01");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  const [modifyLoading, setModifyLoading] = useState(false);
  const [modifyError, setModifyError] = useState("");
  const [showSystemVideo, setShowSystemVideo] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaModalMessage, setQuotaModalMessage] = useState(VIDEO_QUOTA_EXHAUSTED_MESSAGE);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const historyPanelRef = useRef(null);
  /** Valeur réelle du champ au clic (évite instruction vide si le state parent n’est pas encore recalé). */
  const bottomFieldInputRef = useRef(null);
  /** ImagePage reste montée sur les autres étapes : ne pas recopier l’idée à chaque frappe (sinon prompt = 1ère lettre bloquée). */
  const wasVisualStepActiveRef = useRef(false);

  useEffect(() => {
    if (!historyOpen) return;
    const onDoc = (e) => {
      if (historyPanelRef.current?.contains(e.target)) return;
      setHistoryOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [historyOpen]);

  useEffect(() => {
    const refresh = async () => {
      if (session) {
        await loadCredits();
      }
    };
    void refresh();
  }, [session, uid]);

  useEffect(() => {
    let active = true;
    const loadSubscriptionState = async () => {
      if (!session?.user?.id) {
        if (active) setHasActiveSubscription(false);
        return;
      }
      try {
        const sub = await getUserSubscription();
        if (active) setHasActiveSubscription(Boolean(sub));
      } catch {
        if (active) setHasActiveSubscription(false);
      }
    };
    loadSubscriptionState();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!patchImageStep) return;
    const justEntered = visualStepActive && !wasVisualStepActiveRef.current;
    wasVisualStepActiveRef.current = visualStepActive;
    if (!justEntered) return;

    patchImageStep((prev) => {
      const next = { ...prev };
      const campaignText = String(campaignIdea || "").trim();
      const scriptText = String(scriptScene1Idea || "").trim();
      if (campaignText) {
        const currentIdea = String(prev.campaignIdeaPrompt || "").trim();
        if (!currentIdea || currentIdea.length <= 2 || campaignText.startsWith(currentIdea)) {
          next.campaignIdeaPrompt = campaignText;
          next.pairedCampaignIdea = campaignText;
        }
      }
      if (scriptText) {
        const currentPrompt = String(prev.prompt || "").trim();
        if (!currentPrompt || currentPrompt.length <= 2) {
          next.prompt = scriptText;
        }
      }
      return next;
    });
  }, [visualStepActive, campaignIdea, scriptScene1Idea, patchImageStep]);

  const loadCredits = async () => {
    try {
      await getUserCredits();
    } catch (err) {
      console.error("Erreur chargement crédits:", err);
    }
  };

  const openQuotaModal = (message) => {
    setQuotaModalMessage(
      message || (hasActiveSubscription ? VIDEO_QUOTA_EXHAUSTED_MESSAGE : NON_SUBSCRIBER_BLOCKED_MESSAGE)
    );
    setShowQuotaModal(true);
  };

  const canGenerate = useMemo(() => {
    if (!session) return false;
    return !!String(campaignIdeaPrompt || "").trim() && !busy;
  }, [campaignIdeaPrompt, busy, session]);

  const fileInputRef = useRef(null);
  const onPickRefImage = () => fileInputRef.current?.click();
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () =>
      patchImageStep({ refCharDataUrl: String(rd.result) });
    rd.readAsDataURL(f);
  };

  async function generate() {
    if (!canGenerate) return;

    let hasServerCredits = true;
    if (session) {
      hasServerCredits = await hasEnoughCredits(1);
      if (!hasServerCredits) {
        openQuotaModal();
        return;
      }
    }

    if (!canUseImageGeneration()) {
      // Le quota local peut être désynchronisé (ex: crédits workflow rajoutés côté admin).
      // Tant que le solde serveur est OK, on laisse générer.
      if (!(session && hasServerCredits)) {
        const usage = getWorkflowUsage();
        if (usage.videoAttemptsUsed >= 1) {
          resetWorkflowUsage();
        } else {
          openQuotaModal("Quota Visuel d'accroche atteint pour ce workflow (3 générations d'images).");
          return;
        }
      }
    }

    const backupUrls =
      lastGeneratedImages?.length > 0 ? [...lastGeneratedImages] : null;

    setBusy(true);
    setProgress(0);
    setProgressMessage("Initialisation...");
    patchImageStep({ lastGeneratedImages: null });

    try {
      setProgress(10);
      setProgressMessage("Vérification du quota...");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Configuration Supabase manquante");
      }

      const functionUrl = `${supabaseUrl}/functions/v1/hailuo-image`;
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("Token d'authentification manquant");
      }

      setProgress(20);
      setProgressMessage("Envoi de la requête...");
      console.log("📡 Appel de la fonction Edge Function:", functionUrl);
      
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          prompt: buildHookImageApiPrompt(
            [
              String(canonicalSpec.creative.hook_visual.prompt_text || "").trim() ||
                String(canonicalSpec.campaign.core_idea || "").trim(),
              canonicalSpec.campaign.profession
                ? `Métier: ${canonicalSpec.campaign.profession}`
                : "",
              canonicalSpec.campaign.style_details
                ? `Style: ${canonicalSpec.campaign.style_details}`
                : "",
              canonicalSpec.campaign.clarification.mode
                ? `Mode de transformation: ${canonicalSpec.campaign.clarification.mode}`
                : "",
              canonicalSpec.campaign.clarification.last_user_freeform_answer
                ? `Précision utilisateur: ${canonicalSpec.campaign.clarification.last_user_freeform_answer}`
                : "",
              canonicalSpec.campaign.clarification.camera_aerial_angle
                ? `Aerial angle: ${canonicalSpec.campaign.clarification.camera_aerial_angle}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
            {
              revealMode: canonicalSpec.rendering.camera.reveal_mode === true,
              initialStateMode:
                canonicalSpec.campaign.clarification.initial_state === "from_nothing"
                  ? "from_nothing"
                  : null,
              jobTypeLabel: canonicalSpec.campaign.profession || "",
              lockedVideoScriptScene0:
                String(getSafeScenes(canonicalSpec)[0]?.script_text || "").trim() || undefined,
              cameraAerialAngle: canonicalSpec.campaign.clarification.camera_aerial_angle,
              // Guard: fallback neutre si intent profile absent/incomplet.
              globalIntent: getSafeIntentProfile(canonicalSpec),
              selfieMode: canonicalSpec.rendering.camera.selfie_mode === true,
            }
          ),
          ratio,
          quantity,
          model,
          refCharacter: refCharDataUrl,
        }),
      });

      setProgress(40);
      setProgressMessage("Génération des images en cours...");

      let responseData;
      const responseText = await response.text();
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        console.error("❌ Impossible de parser la réponse JSON:", responseText);
        throw new Error(`Erreur serveur (${response.status}): ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        console.error("❌ Erreur API:", response.status, responseData);
        console.error("📋 Détails complets de la réponse:", JSON.stringify(responseData, null, 2));
        
        let errorMessage = responseData?.error || `Erreur HTTP ${response.status}`;
        
        if (responseData?.details) {
          console.error("📦 Détails de l'erreur:", responseData.details);
          if (responseData.details.base_resp?.status_msg) {
            errorMessage = responseData.details.base_resp.status_msg;
          } else if (responseData.details.metadata) {
            errorMessage += ` (${JSON.stringify(responseData.details.metadata)})`;
          }
        }
        
        throw new Error(errorMessage);
      }

      setProgress(60);
      setProgressMessage("Traitement de la réponse...");

      let urls = Array.isArray(responseData?.urls) ? responseData.urls : [];

      if (urls.length === 0) {
        throw new Error("Aucune image reçue");
      }

      urls = urls.map(url => {
        if (url && url.startsWith('http://')) {
          const httpsUrl = url.replace('http://', 'https://');
          console.log("🔒 Conversion HTTP → HTTPS:", url.substring(0, 80) + "...", "→", httpsUrl.substring(0, 80) + "...");
          return httpsUrl;
        }
        return url;
      });

      setProgress(80);
      setProgressMessage("Téléchargement vers le stockage...");

      let finalUrls = urls;
      if (uid) {
        try {
          console.log("📤 Téléchargement des images vers Supabase Storage...");
          const uploadResult = await uploadImagesFromUrls(urls, uid, prompt);
          if (uploadResult.success && uploadResult.urls) {
            finalUrls = uploadResult.urls;

            const successCount = uploadResult.urls.filter((url, i) => {
              const isSupabaseUrl = url && (
                url.includes('supabase.co') || 
                url.includes('supabase') ||
                url.includes('/storage/v1/object/public/generated-images/')
              );
              const isDifferent = url !== urls[i];
              return isSupabaseUrl && isDifferent;
            }).length;
            
            console.log(`✅ ${successCount}/${urls.length} image(s) téléchargée(s) vers Supabase Storage`);
            
            if (successCount > 0) {
              console.log("📋 URLs Supabase sauvegardées:", 
                uploadResult.urls.filter(url => url && url.includes('supabase'))
              );
            }
            if (uploadResult.errors && uploadResult.errors.length > 0) {
              console.warn("⚠️ Certaines images n'ont pas pu être téléchargées:", uploadResult.errors);
              if (successCount === 0) {
                const errorMsg = uploadResult.errors[0] || "Erreur inconnue";
                console.error("❌ Aucune image n'a pu être uploadée vers Supabase Storage");
                console.error("📋 Erreur:", errorMsg);

                if (errorMsg.includes("bucket") || errorMsg.includes("n'existe pas")) {
                  alert(
                    "⚠️ Problème de stockage détecté\n\n" +
                    "Le bucket 'generated-images' n'existe pas dans Supabase Storage.\n\n" +
                    "Pour résoudre ce problème:\n" +
                    "1. Allez dans le dashboard Supabase > Storage\n" +
                    "2. Créez un bucket nommé 'generated-images' (public)\n" +
                    "3. Ou exécutez la migration SQL: supabase/migrations/create_generated_images_bucket.sql\n\n" +
                    "Les images seront stockées avec les URLs originales pour l'instant."
                  );
                }
              }
            }
          } else {
            console.error("❌ Échec complet du téléchargement vers Storage");
            console.error("📋 Vérifiez la console pour plus de détails");
          }
        } catch (err) {
          console.error("❌ Erreur lors du téléchargement vers Storage:", err);
          console.error("📋 L'application continuera avec les URLs originales");
        }
      } else {
        console.warn("⚠️ Utilisateur non connecté, images non uploadées vers Supabase Storage");
      }

      setProgress(100);
      setProgressMessage("Terminé !");

      patchImageStep({
        lastGeneratedImages: finalUrls,
        lastGeneratedPrompt: String(campaignIdeaPrompt || "").trim() || prompt,
        pairedCampaignIdea: String(campaignIdea || "").trim() || null,
      });
      writeHookVisualSpec({
        prompt_text:
          String(canonicalSpec.creative.hook_visual.prompt_text || "").trim() ||
          String(canonicalSpec.campaign.core_idea || "").trim(),
        image_variants: Array.isArray(finalUrls) ? finalUrls : [],
        selected_variant_index: 0,
        selected_image_url: Array.isArray(finalUrls) && finalUrls[0] ? String(finalUrls[0]) : "",
        last_generation_prompt: String(campaignIdeaPrompt || "").trim() || String(prompt || "").trim(),
      });
      consumeImageGeneration();
      
    } catch (err) {
      console.error("Erreur génération image:", err);
      const errorMessage = err?.message || "Erreur inconnue";
      alert(`Erreur lors de la génération : ${errorMessage}`);
      if (backupUrls?.length) {
        patchImageStep((prev) => ({ ...prev, lastGeneratedImages: backupUrls }));
      }
      if (session) {
        await loadCredits();
      }
    } finally {
      setBusy(false);
      setTimeout(() => {
        setProgress(0);
        setProgressMessage("");
      }, 500);
    }
  }

  const resetRef = () => patchImageStep({ refCharDataUrl: null });

  const handleValidate = async (opts = {}) => {
    const { quiet = false, onSuccess, preserveLocalVisualState = false } = opts;
    if (!lastGeneratedImages || lastGeneratedImages.length === 0) return;

    const nImg = lastGeneratedImages.length;
    const rawSel = Number(selectedImageIndex);
    const selIdx =
      Number.isFinite(rawSel) ? Math.max(0, Math.min(Math.floor(rawSel), nImg - 1)) : 0;
    const primaryUrl = lastGeneratedImages[selIdx];
    const urlsForHistory = [
      primaryUrl,
      ...lastGeneratedImages.filter((_, i) => i !== selIdx),
    ];

    try {
      let validationNotice = "";

      if (!uid) {
        addImageHistory({
          uid,
          prompt: lastGeneratedPrompt,
          urls: urlsForHistory,
          meta: { ratio, model, quantity, selectedIndex: selIdx },
        });
      }
      
      if (uid) {
        try {
          const isSupabaseStoredImageUrl = (url) =>
            Boolean(url && url.includes("/storage/v1/object/public/generated-images/"));

          const cleanedUrls = urlsForHistory.map((url) => {
            if (!url) return url;
            if (url.startsWith("http://")) {
              url = url.replace("http://", "https://");
            }
            return url;
          });

          let urlsToSave = cleanedUrls;
          let supabaseUrls = urlsToSave.filter(isSupabaseStoredImageUrl);
          console.log("💾 Sauvegarde dans Supabase:", {
            totalUrls: urlsToSave.length,
            supabaseUrls: supabaseUrls.length,
            urls: urlsToSave
          });

          if (supabaseUrls.length === 0) {
            console.warn("⚠️ Aucune URL Supabase détectée, nouvelle tentative d'upload avant sauvegarde.");
            const retryUploadResult = await uploadImagesFromUrls(
              cleanedUrls,
              uid,
              lastGeneratedPrompt || prompt
            );

            if (retryUploadResult.success && retryUploadResult.urls?.length) {
              urlsToSave = retryUploadResult.urls.map((url) => {
                if (!url) return url;
                return url.startsWith("http://") ? url.replace("http://", "https://") : url;
              });
              supabaseUrls = urlsToSave.filter(isSupabaseStoredImageUrl);
              console.log("✅ Deuxième tentative d'upload terminée:", {
                totalUrls: urlsToSave.length,
                supabaseUrls: supabaseUrls.length,
              });
            }

            if (supabaseUrls.length === 0) {
              validationNotice =
                "Avertissement: images non stockées dans le bucket Supabase (liens externes conservés).";
            }
          }
          
          await saveHistorySupabase({
            kind: "image",
            input: lastGeneratedPrompt,
            output: null,
            model: model,
            metadata: {
              urls: urlsToSave,
              ratio: ratio,
              quantity: quantity,
              selectedIndex: selIdx,
            },
          });
          
          console.log("✅ Historique sauvegardé dans Supabase avec", urlsToSave.length, "URL(s)");
        } catch (err) {
          console.error("❌ Erreur sauvegarde Supabase:", err);
          console.warn("⚠️ Les images seront disponibles uniquement dans localStorage");
        }
      }
      
      if (!quiet) {
        alert(
          validationNotice
            ? `✅ Images validées et enregistrées avec succès !\n\n⚠️ ${validationNotice}`
            : "✅ Images validées et enregistrées avec succès !"
        );
      }
      if (!preserveLocalVisualState) {
        patchImageStep({
          lastGeneratedImages: null,
          lastGeneratedPrompt: "",
          prompt: "",
          campaignIdeaPrompt: "",
          refCharDataUrl: null,
          selectedImageIndex: 0,
          modifyInstruction: "",
          pairedCampaignIdea: null,
        });
        writeHookVisualSpec({
          prompt_text: "",
          provider_prompt_raw: "",
          image_variants: [],
          selected_variant_index: 0,
          selected_image_url: "",
          last_generation_prompt: "",
          modification_instruction: "",
        });
      }
      window.dispatchEvent(new Event("onetool:history:changed"));
      onSuccess?.();
    } catch (err) {
      console.error("Erreur validation:", err);
      if (!quiet) alert("Erreur lors de la validation");
    }
  };

  const reloadIdeaFromCampaign = () => {
    const fromCampaign = String(campaignIdea || "").trim();
    const fromScript = String(scriptScene1Idea || "").trim();
    const fromProp = fromCampaign || fromScript;
    const applyReload = (value) => {
      const hadImages = Boolean(lastGeneratedImages?.length);
      if (hadImages) {
        // Conserver les images affichées : on recharge l'idée dans le champ actif
        // sans vider la session visuelle.
        patchImageStep({
          campaignIdeaPrompt: value,
          pairedCampaignIdea: value,
        });
        writeHookVisualSpec({ prompt_text: String(value || "") });
        setModifyError("");
        return;
      }
      patchImageStep({ campaignIdeaPrompt: value, pairedCampaignIdea: value });
      writeHookVisualSpec({ prompt_text: String(value || "") });
    };
    if (fromProp) {
      applyReload(fromProp);
      return;
    }
    try {
      const live = sessionStorage.getItem(SS_CAMPAIGN_IDEA_LIVE_KEY);
      const fromLive = live != null ? String(live).trim() : "";
      if (fromLive) {
        applyReload(fromLive);
        return;
      }
    } catch {
      /* ignore */
    }
  };

  const handleUseThisImage = async () => {
    await handleValidate({
      quiet: Boolean(onUseImageAndContinue),
      onSuccess: onUseImageAndContinue,
      preserveLocalVisualState: Boolean(onUseImageAndContinue),
    });
  };

  const handleModifyImage = async () => {
    const fromDom = bottomFieldInputRef.current?.value;
    const instruction = String(fromDom ?? modifyInstruction ?? "").trim();
    if (!lastGeneratedImages?.length || !instruction || modifyLoading) return;

    if (!canUseImageModification()) {
      // Même logique: ne pas bloquer à tort si le solde serveur permet encore une action.
      const hasServerCredits = session ? await hasEnoughCredits(1) : false;
      if (!(session && hasServerCredits)) {
        const usage = getWorkflowUsage();
        if (usage.videoAttemptsUsed >= 1) {
          resetWorkflowUsage();
        } else {
          openQuotaModal("Quota Visuel d'accroche atteint pour ce workflow (5 modifications d'image).");
          return;
        }
      }
    }

    setModifyError("");

    let accessToken = session?.access_token ?? null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data?.session?.access_token) {
        accessToken = data.session.access_token;
      }
    } catch {
      /* garde session du contexte */
    }

    if (!accessToken) {
      const msg =
        "Tu dois être connecté pour modifier une image. Connecte-toi puis réessaie.";
      setModifyError(msg);
      alert(msg);
      return;
    }

    const imageUrl = String(
      lastGeneratedImages[selectedImageIndex] ?? lastGeneratedImages[0] ?? ""
    ).trim();
    if (!imageUrl) {
      const msg = "Aucune image valide à modifier. Regénère ou sélectionne une variante.";
      setModifyError(msg);
      alert(msg);
      return;
    }

    setModifyLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Configuration Supabase manquante (variables d’environnement).");
      }
      const newUrl = await modifyImageWithNanoBanana(imageUrl, instruction, {
        accessToken,
        supabaseUrl,
        supabaseAnonKey,
      });
        if (newUrl) {
        patchImageStep((prev) => {
          const next = [...(prev.lastGeneratedImages || []), newUrl];
          return {
            ...prev,
            lastGeneratedImages: next,
            selectedImageIndex: next.length - 1,
            modifyInstruction: "",
          };
        });
        writeHookVisualSpec({
          image_variants: [...(canonicalSpec.creative.hook_visual.image_variants || []), newUrl],
          selected_variant_index: (canonicalSpec.creative.hook_visual.image_variants || []).length,
          selected_image_url: String(newUrl || ""),
          modification_instruction: "",
        });
        consumeImageModification();
      } else {
        const msg =
          "L’édition n’a pas renvoyé d’image. Les serveurs peuvent être occupés — réessaie dans quelques instants ou reformule ta consigne.";
        setModifyError(msg);
        alert(msg);
      }
    } catch (err) {
      console.error("Erreur modification image:", err);
      const msg =
        typeof err?.message === "string" && err.message.trim()
          ? err.message
          : IMAGE_EDIT_BUSY_MESSAGE;
      setModifyError(msg);
      alert(msg);
    } finally {
      setModifyLoading(false);
    }
  };

  useEffect(() => {
    const len = lastGeneratedImages?.length ?? 0;
    if (!len) return;
    patchImageStep((prev) => {
      const max = len - 1;
      const next = Math.min(prev.selectedImageIndex, max);
      return next === prev.selectedImageIndex ? prev : { ...prev, selectedImageIndex: next };
    });
    const safeIdx = Math.min(Number(selectedImageIndex) || 0, len - 1);
    const safeUrl = String(lastGeneratedImages?.[safeIdx] || "");
    writeHookVisualSpec({
      image_variants: Array.isArray(lastGeneratedImages) ? [...lastGeneratedImages] : [],
      selected_variant_index: safeIdx,
      selected_image_url: safeUrl,
    });
  }, [lastGeneratedImages, selectedImageIndex, patchImageStep, writeHookVisualSpec]);

  const hasSessionImages = Boolean(lastGeneratedImages?.length);
  const bottomFieldValue = hasSessionImages ? modifyInstruction : campaignIdeaPrompt;
  const setBottomFieldValue = (v) => {
    if (hasSessionImages) {
      patchImageStep({ modifyInstruction: v });
      writeHookVisualSpec({ modification_instruction: String(v || "") });
    } else {
      patchImageStep({ campaignIdeaPrompt: v });
      writeHookVisualSpec({ prompt_text: String(v || "") });
    }
  };
  const canBottomSubmit = hasSessionImages
    ? Boolean((modifyInstruction ?? "").trim()) && !modifyLoading && !busy
    : canGenerate;
  const runBottomSubmit = () => {
    if (hasSessionImages) void handleModifyImage();
    else void generate();
  };
  const ideaReadyBadge = Boolean(String(campaignIdeaPrompt || "").trim()) && !hasSessionImages;

  const ratioOptions = [
    { value: "16:9", label: "YouTube" },
    { value: "9:16", label: "TikTok" },
    { value: "1:1", label: "Carré" },
  ];

  const interactionPanel = (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {hasSessionImages
                ? "Modifier l'image sélectionnée"
                : "Décrire le visuel d'accroche (première image)"}
            </label>
            <button
              type="button"
              onClick={reloadIdeaFromCampaign}
              className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-gray-300 border border-white/10 rounded-md px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              Recharger l’idée de la campagne
            </button>
          </div>
          <div className="relative flex rounded-2xl border border-white/10 bg-white/[0.04] focus-within:ring-2 focus-within:ring-cyan-500/35">
            <textarea
              ref={bottomFieldInputRef}
              rows={2}
              value={bottomFieldValue}
              onChange={(e) => {
                setModifyError("");
                setBottomFieldValue(e.target.value);
              }}
              maxLength={hasSessionImages ? 500 : 1500}
              disabled={busy || modifyLoading}
              placeholder={
                hasSessionImages
                  ? "Ex. : ajoute un détail au premier plan, change l'arrière-plan…"
                  : "Ex. : gros plan sur une personne surprise qui regarde la caméra…"
              }
              className="min-h-[3.5rem] flex-1 resize-none rounded-2xl bg-transparent px-4 py-3 pr-14 text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (canBottomSubmit) runBottomSubmit();
                }
              }}
            />
            <button
              type="button"
              onClick={runBottomSubmit}
              disabled={!canBottomSubmit}
              className="absolute bottom-2 right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-950 shadow-lg transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                hasSessionImages
                  ? !session
                    ? "Appliquer la modification (connexion requise au moment d’envoyer)"
                    : "Appliquer la modification"
                  : "Générer les images"
              }
            >
              {busy || modifyLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-gray-900" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </button>
          </div>
          {hasSessionImages && modifyError ? (
            <p className="mt-1.5 text-xs text-amber-300/90" role="alert">
              {modifyError}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-64">
          <button
            type="button"
            onClick={() => void handleUseThisImage()}
            disabled={!lastGeneratedImages?.length || busy || modifyLoading}
            className={`rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
              lastGeneratedImages?.length && !busy && !modifyLoading
                ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-lg shadow-cyan-950/40 hover:from-cyan-500 hover:to-cyan-400"
                : "cursor-not-allowed border border-white/10 bg-white/5 text-gray-500"
            }`}
          >
            Utiliser cette image
            <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide text-white/70">
              Étape 3 : vidéo →
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!lastGeneratedImages?.length && !prompt.trim() && !modifyInstruction.trim()) return;
              if (!confirm("Repartir de zéro sur cette étape ? Les images non enregistrées seront perdues.")) return;
              resetImageStep();
            }}
            className="text-center text-[10px] uppercase tracking-wider text-gray-600 underline decoration-gray-700 underline-offset-2 hover:text-gray-500"
          >
            Réinitialiser cette étape
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <QuotaBlockedModal
        open={showQuotaModal}
        title={hasActiveSubscription ? "Quota mensuel épuisé" : "Accès abonnement requis"}
        message={quotaModalMessage}
        actionLabel={hasActiveSubscription ? "Aller vers Packs vidéos" : "Voir les abonnements"}
        onClose={() => setShowQuotaModal(false)}
        onGoToShop={() => {
          setShowQuotaModal(false);
          window.location.href = hasActiveSubscription
            ? "/boutique?section=packs-videos"
            : "/boutique?section=subscription";
        }}
      />
      <div className="studio-panel w-full max-w-none p-5 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <PageTitle
            green="Visuel"
            white="d'accroche"
            subtitle="Choisis l'image qui arrête le scroll avant ta vidéo."
          />
          <div className="w-full sm:w-72 space-y-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-300">Étape 2 sur 3 · Visuel d'accroche</span>
            </div>
            <div className="w-full studio-step-rail">
              <div className="h-full w-2/3 studio-step-rail-fill" />
            </div>
            <div className="relative flex flex-col gap-2" ref={historyPanelRef}>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowSystemVideo(true)}
                  className="studio-toolbar-btn flex-1 min-w-0 sm:flex-none"
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  <span className="truncate">Explication du système</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((o) => !o)}
                  disabled={!onRestoreVisualSnapshot || visualSnapshots.length === 0}
                  title={
                    visualSnapshots.length === 0
                      ? "Aucune grille enregistrée dans cette session (génère ou modifie d’abord des images)"
                      : "Restaurer une grille ou un état visuel enregistré"
                  }
                  className="studio-toolbar-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-gray-400 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-gray-400 border border-white/10 bg-white/[0.02]"
                >
                  <History className="h-3.5 w-3.5 text-cyan-500/90" />
                  Historique
                </button>
              </div>
              {historyOpen && visualSnapshots.length > 0 && (
                <div className="absolute right-0 top-full z-30 mt-1 w-[min(100vw-2rem,280px)] rounded-xl border border-white/12 bg-gray-950/95 p-2 shadow-xl shadow-black/50 backdrop-blur-md">
                  <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Sessions visuelles
                  </p>
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {visualSnapshots.map((entry) => {
                      const thumb = entry.step?.lastGeneratedImages?.[0];
                      const n = entry.step?.lastGeneratedImages?.length ?? 0;
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => {
                              onRestoreVisualSnapshot(entry);
                              setHistoryOpen(false);
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.06]"
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-10 w-10 shrink-0 rounded-md border border-white/10 object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-md border border-white/10 bg-white/5" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-gray-200">
                                {formatVisualSnapshotLabel(entry.t)}
                              </span>
                              <span className="block text-[10px] text-gray-500">
                                {n} variante{n > 1 ? "s" : ""}
                                {typeof entry.step?.selectedImageIndex === "number"
                                  ? ` · sélection #${(entry.step.selectedImageIndex ?? 0) + 1}`
                                  : ""}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

      {/* 1. Configuration : format + variantes */}
      <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 sm:gap-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Format</span>
          <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
            {ratioOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => patchImageStep({ ratio: opt.value })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  ratio === opt.value
                    ? "bg-cyan-500/25 text-cyan-100 border border-cyan-400/40"
                    : "text-gray-400 hover:text-gray-200 border border-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
      </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Variantes</span>
          <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1 gap-0.5">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => patchImageStep({ quantity: n })}
                className={`w-9 h-9 rounded-lg text-xs font-semibold transition-all ${
                  quantity === n
                    ? "bg-cyan-500/25 text-cyan-100 border border-cyan-400/40"
                    : "text-gray-400 hover:text-gray-200 border border-transparent"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        </div>

      {/* 2. Introduction (hero) — sans cadre, sur le fond de page */}
      <section className="text-center">
        {ideaReadyBadge && (
          <span className="mb-4 inline-flex rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
            Idée prête à être illustrée
          </span>
        )}
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Crée le visuel qui <span className="border-b-2 border-cyan-400 text-cyan-300">accroche</span>.
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          Décris ce que tu veux voir en premier dans ta vidéo (la toute première image). Ensuite tu pourras affiner
          image par image.
        </p>
      </section>

      {/* 3. Zone images : aperçu principal + variantes à droite */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="relative min-h-[280px] min-w-0 flex-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-black/20">
          {busy && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 px-6">
              <Sparkles className="mb-3 h-8 w-8 animate-pulse text-cyan-400" />
              <p className="text-sm font-medium text-gray-200">{progressMessage || "Génération…"}</p>
              <div className="mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">{progress}%</p>
            </div>
          )}
          {lastGeneratedImages?.length ? (
            <div className="flex h-full min-h-[320px] items-center justify-center p-4 sm:p-6">
              <img
                src={lastGeneratedImages[selectedImageIndex]}
                alt="Visuel sélectionné"
                className="max-h-[min(72vh,680px)] w-full max-w-full object-contain shadow-2xl shadow-black/50"
              />
            </div>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center px-6 py-12">
              <p className="text-center text-sm text-gray-500">Tes visuels générés s’afficheront ici.</p>
            </div>
          )}
      </div>

        {lastGeneratedImages?.length ? (
          <div className="flex w-full flex-row gap-2 overflow-x-auto pb-1 lg:w-44 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-0 lg:max-h-[min(72vh,680px)]">
            {lastGeneratedImages.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => {
                  patchImageStep({ selectedImageIndex: index });
                  writeHookVisualSpec({
                    selected_variant_index: index,
                    selected_image_url: String(url || ""),
                  });
                }}
                className={`relative shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                  selectedImageIndex === index
                    ? "border-cyan-400 ring-2 ring-cyan-400/30"
                    : "border-white/10 opacity-90 hover:border-white/25 hover:opacity-100"
                }`}
              >
                <div className="aspect-[9/16] w-24 sm:w-28 lg:w-full lg:aspect-[9/16]">
                  <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <span
                  className={`absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    selectedImageIndex === index ? "bg-cyan-500 text-gray-950" : "bg-black/60 text-gray-200"
                  }`}
                >
                  V{index + 1}
                </span>
                {selectedImageIndex === index && (
                  <Check className="absolute left-1 top-1 h-4 w-4 text-cyan-400 drop-shadow-md" aria-hidden />
                )}
              </button>
            ))}
          </div>
        ) : null}
        </div>

      {/* 4. Zone d’interaction principale */}
      <div>{interactionPanel}</div>

      {/* 5. Options avancées — en bas, discret */}
      <div className="border-t border-white/[0.06] pt-6">
          <div className="flex justify-center">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-gray-600 hover:text-gray-500 select-none">
              <input
                type="checkbox"
                className="rounded border-white/15 bg-white/[0.04] text-cyan-600 focus:ring-cyan-500/30"
                checked={showAdvancedOptions}
                onChange={(e) => setShowAdvancedOptions(e.target.checked)}
              />
              <Settings2 className="w-3 h-3 opacity-60" />
              Options avancées
            </label>
          </div>

          {showAdvancedOptions && (
            <div className="mt-4 space-y-4 rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4 sm:p-5">
              <p className="text-[11px] text-amber-200/70">
                Réservé aux utilisateurs expérimentés. Le champ principal suffit dans la plupart des cas.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-300">Prompt complet (envoyé pour la génération)</label>
                <textarea
                  value={prompt}
                  onChange={(e) => patchImageStep({ prompt: e.target.value })}
                  maxLength={1500}
                  rows={5}
                  className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                />
              </div>
              <details className="rounded-xl border border-white/10 bg-black/20">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs font-medium text-gray-400 [&::-webkit-details-marker]:hidden">
                  Paramètres techniques (optionnels)
                </summary>
                <div className="space-y-4 border-t border-white/10 px-4 py-4">
                  <p className="text-[11px] leading-relaxed text-amber-200/70">
                    Modifier ces paramètres peut impacter le résultat (nombre de propositions, cadrage, image de référence).
                  </p>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-gray-500">Image de référence</span>
                    <div className="mt-2">
                      {refCharDataUrl ? (
                        <div className="flex items-center gap-3">
                          <img src={refCharDataUrl} alt="" className="h-20 w-20 rounded-lg object-cover border border-white/10" />
                          <button type="button" onClick={resetRef} className="text-xs text-gray-400 underline">
                            Retirer
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={onPickRefImage}
                          className="rounded-lg border border-dashed border-white/20 px-4 py-3 text-xs text-gray-400 hover:border-cyan-500/30"
                        >
                          Ajouter une image de référence
                        </button>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Modèle : <span className="text-gray-300">{model}</span>
                  </div>
                </div>
              </details>
            </div>
          )}
      </div>
      </div>

      {showSystemVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowSystemVideo(false)}
          role="presentation"
        >
          <div
            className="studio-panel max-w-3xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-explication-systeme-title"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 id="image-explication-systeme-title" className="text-base font-semibold text-gray-200">
                  Explication du système
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Cette courte vidéo t’explique à quoi sert l’étape visuel d’accroche, comment formuler une description
                  efficace et à quoi servent le format, la quantité et l’image de référence avant de passer à la vidéo.
                </p>
              </div>
              <button
                type="button"
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
    </>
  );
}
