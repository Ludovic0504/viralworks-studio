import {
  formatVideoFormatParamsPromptAppendix,
  getVideoFormatConfigForCatalogId,
} from "@/config/videoFormats";
import { getRefinePromptFormatFamilyInstruction } from "@/bibliotheque/refinePromptFormatFamilies";
import { generateResponse } from "@/bibliotheque/openai/chatgpt-client";
import { getFormatById } from "@/bibliotheque/vwsVideoFormatsCatalog";
import { refinePrompt } from "@/bibliotheque/vwsPromptEngine";
import { clampGeneratedPrompt, validateIdeaLength } from "@/bibliotheque/promptGenerationLimits";
import { hasEnoughCredits } from "@/bibliotheque/supabase/credits";
import { saveHistory as saveHistorySupabase } from "@/bibliotheque/supabase/historique";
import {
  canProceedWithScriptGeneration,
  consumeScriptAttempt,
} from "@/bibliotheque/workflowQuota";
import {
  createDefaultCampaignGenerationSpec,
  getSafeScenes,
  normalizeCampaignGenerationSpec,
} from "@/bibliotheque/campaignGenerationSpec";
import { splitCampaignPromptIntoThreeVideoSegments } from "@/bibliotheque/splitVideoPromptThreeSegments";

const PACKAGING_BOX_APPEARANCE_FALLBACK =
  "white rigid square box, clean minimalist design, brand logo centered";
const PACKAGING_OPENING_GESTURE_FALLBACK =
  "one hand holds the base, other hand lifts the lid straight upward slowly";

function parsePackagingDirectivesJson(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() || text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Infère apparence boîte + geste d'ouverture (un seul appel GPT-4o-mini).
 * @param {string} productName
 * @returns {Promise<{ box_appearance: string, opening_gesture: string }>}
 */
export async function inferPackagingDirectives(productName) {
  const safeName = String(productName ?? "").trim();
  const fallback = {
    box_appearance: PACKAGING_BOX_APPEARANCE_FALLBACK,
    opening_gesture: PACKAGING_OPENING_GESTURE_FALLBACK,
    opening_sound: "extremely quiet continuous whisper of cardboard-on-cardboard friction; barely audible soft hiss as air slowly escapes through the widening gap; intimate ASMR register throughout; no silence gaps, no isolated clicks",
  };
  if (!safeName) {
    console.log("[Packaging] box:", fallback.box_appearance);
    console.log("[Packaging] gesture:", fallback.opening_gesture);
    return fallback;
  }

  const prompt = `You are helping generate a realistic unboxing video prompt for an AI video model.
For this product: "${safeName.slice(0, 200)}"

Return ONLY a JSON object with THREE fields, nothing else:
{
  "box_appearance": "one sentence describing the retail box shape, dimensions, dominant colors, brand logo placement (max 20 words)",
  "opening_gesture": "one sentence describing how the hands open this specific product's box. For vertical lift-off boxes (iPhone, iPad): right hand grips the lid from both sides and lifts it straight up slowly; left hand holds base still. For horizontal sleeve-slide boxes (Apple Watch): left hand holds base still; right hand slides outer sleeve horizontally off. Identify the correct mechanism for this product and describe only the essential hand motion. Max 30 words.",
  "opening_sound": "description of the continuous ambient sound during the opening. MUST be continuous. For sleeve-slide: extremely quiet continuous whisper of cardboard-on-cardboard friction; barely audible soft hiss as air slowly escapes through the widening gap between sleeve and base; intimate ASMR register throughout; ends with a faint soft thud as sleeve is set down. For lift-off: continuous low cardboard friction rising slightly in pitch as lid separates. No silence gaps, no isolated clicks, no discrete events. Max 50 words."
}

Base your answer on the real packaging of this product if known.
If unknown, use a premium sleeve-slide box (outer sleeve over inner tray).`;

  try {
    const raw = await generateResponse(prompt, undefined, {
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 250,
    });
    const parsed = parsePackagingDirectivesJson(raw);
    const box_appearance = String(parsed?.box_appearance ?? "").trim() || fallback.box_appearance;
    const opening_gesture = String(parsed?.opening_gesture ?? "").trim() || fallback.opening_gesture;
    const opening_sound = String(parsed?.opening_sound ?? "").trim() || fallback.opening_sound;
    console.log("[Packaging] box:", box_appearance);
    console.log("[Packaging] gesture:", opening_gesture);
    console.log("[Packaging] sound:", opening_sound);
    return { box_appearance, opening_gesture, opening_sound };
  } catch (err) {
    console.warn("[Packaging] inférence directives échouée, fallback:", err);
    console.log("[Packaging] box:", fallback.box_appearance);
    console.log("[Packaging] gesture:", fallback.opening_gesture);
    return fallback;
  }
}

export const STUDIO_SCRIPT_GENERATION_COST = 1;

const HISTORY_LS_KEY = "history_v2";

function loadLocalHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalHistory(items) {
  try {
    localStorage.setItem(HISTORY_LS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Impossible de sauvegarder l'historique local prompt:", err);
  }
}

function addLocalHistoryEntry(entry) {
  const items = loadLocalHistory();
  saveLocalHistory([{ ...entry, pinned: false }, ...items]);
}

/** Extrait l'angle utilisateur brut depuis un brief produit assemblé (décor / hook / mise en scène). */
function extractProductUserAngleFromIdea(raw) {
  const text = String(raw ?? "").trim();
  if (!text || !/Décor de la scène\s*:/i.test(text)) return text;
  return text
    .replace(/Décor de la scène\s*:[^\n]+/gi, "")
    .replace(/Hook d'accroche[^\n]*/gi, "")
    .replace(/Mise en scène souhaitée\s*:[^\n]+/gi, "")
    .replace(/Environnement \/ décor :[^\n]+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Génère une réplique parlée naturelle pour Veo3 (mode produit).
 * @param {string} angle — promesse / angle utilisateur (pas le script visuel EN)
 * @param {string} profession — nom du produit ou métier
 * @param {string|null} [_openaiKey] — réservé compat API ; le client utilise generateResponse (Edge)
 */
export async function generateVeo3DialogueLine(angle, profession, _openaiKey = null) {
  const safeAngle = String(angle ?? "").trim().slice(0, 200);
  const safeProfession = String(profession ?? "").trim() || "créateur";
  if (!safeAngle) return "";

  const prompt = `Tu es un expert en contenus UGC produit pour les réseaux sociaux.
Génère UNE seule phrase courte en français naturel (10 à 14 mots maximum)
qu'une personne dirait face caméra pour exprimer cette promesse produit :
"${safeAngle}"

Produit : ${safeProfession}

Règles strictes :
- Français de France, ton authentique UGC (créateur spontané, pas publicitaire)
- La phrase doit EXPRIMER le bénéfice ou l'angle, pas répéter mot pour mot le libellé ci-dessus
- Déclaratif uniquement (pas de question, pas d'exclamation)
- Maximum 14 mots
- Pas de guillemets dans ta réponse
- Réponds uniquement avec la phrase, rien d'autre`;

  const raw = await generateResponse(prompt, undefined, {
    model: "gpt-4o-mini",
    temperature: 0.7,
    max_tokens: 60,
  });
  return String(raw ?? "").replace(/^["'«»]+|["'«»]+$/g, "").trim();
}

/**
 * Spec créatif + trace alignés sur le script (scenes[], script_bundle, prompt_refinement).
 * @param {import("@/bibliotheque/campaignGenerationSpec").CampaignGenerationSpec} canonicalSpec
 * @param {string} ideaSnapshot — texte idée au moment de la génération (trace)
 */
export function buildCanonicalScriptSpec(
  canonicalSpec,
  ideaSnapshot,
  { scenes, combined, mode, refineResult, dialogueLines, packagingBoxAppearance, packagingOpeningGesture, packagingOpeningSound }
) {
  const normalizedBase = normalizeCampaignGenerationSpec(canonicalSpec);
  const safeScenes = getSafeScenes(normalizedBase);
  const nextScenes = [0, 1, 2].map((idx) => ({
    ...safeScenes[idx],
    script_text: String(scenes?.[idx] ?? ""),
    dialogue_text:
      dialogueLines && typeof dialogueLines[idx] === "string"
        ? dialogueLines[idx]
        : String(safeScenes[idx]?.dialogue_text ?? ""),
  }));
  const spec = normalizeCampaignGenerationSpec({
    ...normalizedBase,
    campaign: {
      ...normalizedBase.campaign,
      packaging_box_appearance: packagingBoxAppearance || null,
      packaging_opening_gesture: packagingOpeningGesture || null,
      packaging_opening_sound: packagingOpeningSound || null,
    },
    creative: {
      ...normalizedBase.creative,
      sequence_type: mode === "multi" ? "three_x_8s" : "single_8s",
      script_bundle: {
        ...normalizedBase.creative.script_bundle,
        mode,
        combined_text: String(combined ?? ""),
      },
      scenes: nextScenes,
    },
    trace: {
      ...normalizedBase.trace,
      prompt_refinement: {
        ...normalizedBase.trace.prompt_refinement,
        run_id:
          typeof refineResult?.run_id === "string" && refineResult.run_id.trim()
            ? refineResult.run_id
            : null,
        input_snapshot: String(ideaSnapshot ?? ""),
        output_snapshot: String(combined ?? ""),
      },
    },
  });
  console.log("[Spec] packaging_box_appearance:", spec.campaign.packaging_box_appearance);
  return spec;
}

export function normalizeCanonicalSpecFromCampaignData(campaignData) {
  return normalizeCampaignGenerationSpec(
    campaignData?.campaignGenerationSpec ?? campaignData ?? createDefaultCampaignGenerationSpec()
  );
}

/**
 * @typedef {object} StudioScriptSuccessPayload
 * @property {"single"|"multi"} mode
 * @property {string} combined
 * @property {string[]} scenes
 * @property {string} [refinementRunId]
 * @property {object} [scriptResultMeta]
 * @property {object} campaignGenerationSpec
 */

/**
 * @param {object} input
 * @param {string} input.idea
 * @param {object|null} [input.campaignData]
 * @param {object|null} [input.session]
 * @param {boolean} [input.persistHistory=true]
 * @param {boolean} [input.consumeQuota=true]
 * @returns {Promise<{ ok: true, payload: StudioScriptSuccessPayload } | { ok: false, code: string, message?: string }>}
 */
export async function runStudioScriptRefinement({
  idea,
  campaignData = null,
  session = null,
  persistHistory = true,
  consumeQuota = true,
}) {
  console.log("[VWS-DIAG] runStudioScriptRefinement appelé", idea?.slice(0, 40));
  const lenCheck = validateIdeaLength(idea);
  if (!lenCheck.ok) {
    return { ok: false, code: "validation", message: lenCheck.message };
  }

  const hasSession = Boolean(session?.user?.id);
  let serverCreditsOk = !hasSession;
  if (hasSession) {
    const creditsOk = await hasEnoughCredits(STUDIO_SCRIPT_GENERATION_COST);
    if (!creditsOk) {
      return { ok: false, code: "credits" };
    }
    serverCreditsOk = true;
  }

  if (!canProceedWithScriptGeneration(hasSession, serverCreditsOk)) {
    const bypass = hasSession && (await hasEnoughCredits(STUDIO_SCRIPT_GENERATION_COST));
    if (!bypass) {
      return {
        ok: false,
        code: "quota",
        message: "Quota Script gagnant atteint pour ce workflow (1 essai).",
      };
    }
  }

  const canonicalSpec = normalizeCanonicalSpecFromCampaignData(campaignData);
  const canonicalClarificationMode = canonicalSpec.campaign.clarification.mode ?? null;
  const canonicalClarificationDiagnostic = canonicalSpec.campaign.clarification.diagnostic ?? null;
  const isMultiScene = canonicalSpec.creative.sequence_type === "three_x_8s";
  const videoFormatId =
    canonicalSpec?.campaign?.video_format_id ?? campaignData?.videoFormatId ?? null;
  const formatFamilyInstruction = getRefinePromptFormatFamilyInstruction(videoFormatId);
  let enrichedFormatFamilyInstruction = formatFamilyInstruction;
  let packagingBoxAppearance = null;
  let packagingOpeningGesture = null;
  let packagingOpeningSound = null;
  if (videoFormatId === "produit_unboxing") {
    const productName =
      canonicalSpec.campaign.profession ?? campaignData?.profession ?? "";
    const { box_appearance, opening_gesture, opening_sound } = await inferPackagingDirectives(productName);
    packagingBoxAppearance = box_appearance || null;
    packagingOpeningGesture = opening_gesture || null;
    packagingOpeningSound = opening_sound || null;
    const packagingBlock = [
      `Product box appearance: ${box_appearance}`,
      `Box opening gesture: ${opening_gesture}`,
    ].join("\n");
    if (packagingBlock) {
      enrichedFormatFamilyInstruction = formatFamilyInstruction
        ? `${formatFamilyInstruction}\n\n${packagingBlock}`
        : packagingBlock;
    }
  }
  if (videoFormatId === "produit_unboxing") {
    const formatParamsConfig = getVideoFormatConfigForCatalogId(videoFormatId);
    const formatParamsLine = formatParamsConfig
      ? formatVideoFormatParamsPromptAppendix(formatParamsConfig)
      : "";
    if (formatParamsLine) {
      enrichedFormatFamilyInstruction = enrichedFormatFamilyInstruction
        ? `${enrichedFormatFamilyInstruction}\n\n${formatParamsLine}`
        : formatParamsLine;
    }
  }
  const dialogueEnabled = canonicalSpec?.rendering?.audio?.dialogue_enabled !== false;

  const cameraFaceMode = canonicalSpec.campaign.clarification.camera_face_mode ?? null;
  const presetSelfieMode = canonicalSpec.rendering.camera.selfie_mode === true;
  const refineSelfieMode =
    cameraFaceMode === "selfie"
      ? true
      : cameraFaceMode === "fixed"
        ? false
        : presetSelfieMode;

  let refineResult;
  try {
    console.log("[FORMAT FAMILLE]", videoFormatId, "→", enrichedFormatFamilyInstruction?.slice(0, 80));
    refineResult = await refinePrompt({
      jobType: canonicalSpec.campaign.profession ?? campaignData?.profession ?? "",
      mainIdea: idea,
      modifiers: canonicalSpec.campaign.style_details ?? campaignData?.styleDetails ?? "",
      tempoSelection: canonicalSpec.rendering.tempo ?? campaignData?.tempo ?? "real_time",
      revealMode: Boolean(canonicalSpec.rendering.camera.reveal_mode ?? campaignData?.revealMode),
      cameraLocked: Boolean(canonicalSpec.rendering.camera.fixed ?? campaignData?.cameraFixed),
      projectFormat: isMultiScene ? "three_x_8s" : "single_8s",
      clarifyMode: canonicalClarificationMode,
      clarifyAnswer:
        canonicalSpec.campaign.clarification.last_user_freeform_answer ?? campaignData?.clarifyAnswer ?? null,
      proceedAnyway:
        canonicalSpec.campaign.clarification.proceed_anyway === true || campaignData?.proceedAnyway === true,
      causalAgentSelection:
        canonicalSpec.campaign.clarification.causal_agent ?? campaignData?.causalAgentSelection ?? null,
      formatFamilyInstruction: enrichedFormatFamilyInstruction,
      dialogueEnabled,
      selfieMode: refineSelfieMode,
    });
  } catch (err) {
    return {
      ok: false,
      code: "refine",
      message: err?.message || "Erreur lors de la génération",
    };
  }

  const finalized =
    refineResult?.phases?.PROMPT_EXECUTION_PHASE?.steps?.PROMPT_FINALIZATION?.output || "";
  if (!String(finalized).trim()) {
    return { ok: false, code: "refine", message: "Aucun prompt final retourné par refinePrompt." };
  }

  const trimmedRefined = clampGeneratedPrompt(String(finalized).trim());
  const scriptResultMeta = {
    refinementRunId: refineResult?.run_id ?? null,
    clarifyMode: canonicalClarificationMode,
    clarifyDiagnostic: canonicalClarificationDiagnostic,
    clarificationHistory: canonicalSpec.campaign.clarification.history ?? null,
  };

  const formatDef = getFormatById(videoFormatId);
  const isProductMode = formatDef?.categoryId === "produit";
  const dialogueLines = ["", "", ""];
  const staging = String(canonicalSpec.campaign.staging_chips?.[0] ?? "").trim();
  const stagingWantsUgcDialogue =
    staging === "facecam" || staging === "mains_produit";
  if (isProductMode && dialogueEnabled && stagingWantsUgcDialogue) {
    const productProfession =
      String(canonicalSpec.campaign.profession ?? campaignData?.profession ?? "").trim();
    const productAngle =
      extractProductUserAngleFromIdea(idea) ||
      String(campaignData?.idea ?? idea ?? "").trim();
    if (productAngle && productProfession) {
      try {
        const spokenLine = await generateVeo3DialogueLine(productAngle, productProfession);
        if (spokenLine) {
          dialogueLines[0] = spokenLine;
          console.log("[studioScriptRefinement] dialogue Veo3 produit:", spokenLine);
        }
      } catch (err) {
        console.warn("[studioScriptRefinement] génération dialogue Veo3 échouée:", err);
      }
    }
  }

  /** @type {StudioScriptSuccessPayload} */
  let payload;
  let trimmedForHistory = "";

  if (isMultiScene) {
    let nextScenes;
    try {
      const parts = await splitCampaignPromptIntoThreeVideoSegments(trimmedRefined);
      nextScenes = [parts[0], parts[1], parts[2]];
    } catch (err) {
      console.warn("[studioScriptRefinement] Découpe 3 segments impossible, repli triple copie:", err);
      nextScenes = [trimmedRefined, trimmedRefined, trimmedRefined];
    }
    const combined = nextScenes.join("\n\n---\n\n");
    trimmedForHistory = "";
    const nextSpec = buildCanonicalScriptSpec(canonicalSpec, idea, {
      mode: "multi",
      combined,
      scenes: nextScenes,
      refineResult,
      dialogueLines,
      packagingBoxAppearance,
      packagingOpeningGesture,
      packagingOpeningSound,
    });
    payload = {
      mode: "multi",
      combined,
      scenes: nextScenes,
      refinementRunId: typeof refineResult?.run_id === "string" ? refineResult.run_id : undefined,
      scriptResultMeta,
      campaignGenerationSpec: nextSpec,
    };
  } else {
    trimmedForHistory = trimmedRefined;
    const nextSpec = buildCanonicalScriptSpec(canonicalSpec, idea, {
      mode: "single",
      combined: trimmedRefined,
      scenes: [trimmedRefined, "", ""],
      refineResult,
      dialogueLines,
      packagingBoxAppearance,
      packagingOpeningGesture,
      packagingOpeningSound,
    });
    payload = {
      mode: "single",
      combined: trimmedRefined,
      scenes: [trimmedRefined, "", ""],
      refinementRunId: typeof refineResult?.run_id === "string" ? refineResult.run_id : undefined,
      scriptResultMeta,
      campaignGenerationSpec: nextSpec,
    };
  }

  if (consumeQuota) {
    consumeScriptAttempt();
  }

  if (persistHistory) {
    if (session?.user?.id) {
      try {
        await saveHistorySupabase({
          kind: "prompt",
          input: idea,
          output: trimmedForHistory,
          model: "sora2",
        });
      } catch (err) {
        console.warn("Erreur sauvegarde Supabase (non bloquant):", err);
      }
    } else {
      addLocalHistoryEntry({
        id: crypto.randomUUID?.() || String(Date.now()),
        kind: "prompt",
        input: idea,
        output: trimmedForHistory,
        model: "sora2",
        createdAt: new Date().toISOString(),
      });
    }
  }

  return { ok: true, payload };
}
