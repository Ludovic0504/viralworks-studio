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

/**
 * Spec créatif + trace alignés sur le script (scenes[], script_bundle, prompt_refinement).
 * @param {import("@/bibliotheque/campaignGenerationSpec").CampaignGenerationSpec} canonicalSpec
 * @param {string} ideaSnapshot — texte idée au moment de la génération (trace)
 */
export function buildCanonicalScriptSpec(canonicalSpec, ideaSnapshot, { scenes, combined, mode, refineResult }) {
  const normalizedBase = normalizeCampaignGenerationSpec(canonicalSpec);
  const safeScenes = getSafeScenes(normalizedBase);
  const nextScenes = [0, 1, 2].map((idx) => ({
    ...safeScenes[idx],
    script_text: String(scenes?.[idx] ?? ""),
  }));
  return normalizeCampaignGenerationSpec({
    ...normalizedBase,
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

  let refineResult;
  try {
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
