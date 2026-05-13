import { normalizeCampaignGenerationSpec } from "./campaignGenerationSpec";

function normalizeTempoForPrepareGate(t: unknown): "real_time" | "timelapse" | "slow_motion" {
  return t === "timelapse" || t === "slow_motion" ? t : "real_time";
}

/**
 * Snapshot stable des champs Campagne VWS utilisés pour « Préparer ma vidéo »
 * (signature locale, comparaison de brouillon).
 */
export function serializeCampaignSpecForPrepareGate(spec: unknown): string {
  const normalized = normalizeCampaignGenerationSpec(spec);
  return JSON.stringify({
    schema_version: normalized.meta.schema_version,
    profession: String(normalized.campaign.profession ?? "").trim(),
    lieuTournage: normalized.campaign.location_type ?? "neutre",
    idea: String(normalized.campaign.core_idea ?? "").trim(),
    video_format_id: normalized.campaign.video_format_id ?? null,
    styleDetails: String(normalized.campaign.style_details ?? "").trim(),
    stagingChips: Array.isArray(normalized.campaign.staging_chips)
      ? [...normalized.campaign.staging_chips]
      : [],
    productSceneDecorId: normalized.campaign.product_scene_decor_id ?? null,
    productOpeningHookId: normalized.campaign.product_opening_hook_id ?? null,
    tempo: normalizeTempoForPrepareGate(normalized.rendering.tempo),
    cameraFixed: Boolean(normalized.rendering.camera.fixed),
    revealMode: Boolean(normalized.rendering.camera.reveal_mode),
    cinematicMovement: Boolean(normalized.rendering.camera.cinematic_movement),
    selfieMode: Boolean(normalized.rendering.camera.selfie_mode),
    sequenceType: normalized.creative.sequence_type === "three_x_8s" ? "three_x_8s" : "single_8s",
    dialogueEnabled: normalized.rendering.audio.dialogue_enabled !== false,
    microAnswer: normalized.campaign.clarification.initial_state ?? null,
    cameraViewAngle: normalized.campaign.clarification.camera_view_angle ?? null,
    clarifyAnswer: normalized.campaign.clarification.last_user_freeform_answer ?? null,
    clarifyMode: normalized.campaign.clarification.mode ?? null,
    clarifyDiagnostic: normalized.campaign.clarification.diagnostic ?? null,
    globalIntentProfile: normalized.campaign.intent_profile ?? null,
    proceedAnyway: normalized.campaign.clarification.proceed_anyway === true,
    isClarified: normalized.campaign.clarification.is_resolved === true,
    clarificationHistory: Array.isArray(normalized.campaign.clarification.history)
      ? normalized.campaign.clarification.history
      : [],
    clarifyAxesResolved: {
      modeAgent: normalized.campaign.clarification.resolved_axes.mode_agent === true,
      initialT0: normalized.campaign.clarification.resolved_axes.initial_t0 === true,
      causalAgent: normalized.campaign.clarification.resolved_axes.causal_agent === true,
      cameraAerialAngle: normalized.campaign.clarification.resolved_axes.camera_aerial_angle === true,
    },
  });
}
