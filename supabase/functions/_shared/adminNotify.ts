import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { WelcomeStep1Result } from "./community/welcomeFlow.ts";
import {
  ONBOARDING_STEP1_CONTENT,
  ONBOARDING_STEP2_CONTENT,
} from "./community/onboarding.ts";

const ONBOARDING_NOTIFY_KIND = "onboarding_step1_delivery";
const ONBOARDING_ANSWERS_NOTIFY_KIND = "onboarding_answers_complete";
const ONBOARDING_FOLLOWUP_NOTIFY_KIND = "onboarding_answer_follow_up";

const ONBOARDING_QUESTION_1 =
  "Comment t'es tombé(e) sur ViralWorks Studio ?";
const ONBOARDING_QUESTION_2 =
  "Tu cherches à faire quoi principalement avec ViralWorks Studio ?";
const ONBOARDING_QUESTION_3 =
  "Message libre après le parcours (réponse au message de remerciement)";

const SKIP_REASON_LABELS: Record<string, string> = {
  already_sent: "Message déjà envoyé précédemment (idempotence)",
  step1_exists: "Message étape 1 déjà présent dans la conversation",
  is_support_account: "Compte support — pas d'onboarding automatique",
  account_before_onboarding_rollout: "Compte créé avant le déploiement de l'onboarding",
  profile_before_onboarding_rollout: "Profil créé avant le déploiement de l'onboarding",
  prior_support_manual_message: "Conversation support manuelle déjà existante",
  prior_user_message: "L'utilisateur a déjà envoyé un message privé",
  support_user_not_found: "Compte support introuvable (jean.limonta06@gmail.com)",
  message_jamais_envoye: "Message jamais envoyé (trigger probablement en échec)",
  onboarding_skipped: "Onboarding marqué comme terminé sans message étape 1",
};

function formatReason(reason: string | undefined): string {
  const key = String(reason || "").trim();
  if (!key) return "Raison inconnue";
  return SKIP_REASON_LABELS[key] || key;
}

export async function sendAdminEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const from = (Deno.env.get("ADMIN_NOTIFY_FROM") ?? "ViralWorks Studio <contact@viralworks-studio.com>").trim();
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY manquante" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `Resend ${res.status}: ${t || res.statusText}` };
  }
  return { ok: true };
}

async function loadUserContext(
  adminClient: SupabaseClient,
  userId: string,
  fallbackEmail?: string | null,
): Promise<{ email: string; displayName: string }> {
  let email = String(fallbackEmail || "").trim();
  let displayName = "";

  const { data: profile } = await adminClient
    .from("profiles")
    .select("email, first_name, last_name, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile) {
    email = email || String(profile.email || "").trim();
    const firstName = String(profile.first_name || "").trim();
    const lastName = String(profile.last_name || "").trim();
    displayName =
      String(profile.full_name || "").trim() || `${firstName} ${lastName}`.trim();
  }

  if (!email) {
    const { data: authData } = await adminClient.auth.admin.getUserById(userId);
    email = String(authData?.user?.email || "").trim();
    const meta = authData?.user?.user_metadata || {};
    const firstName = String(meta.first_name || "").trim();
    const lastName = String(meta.last_name || "").trim();
    if (!displayName) {
      displayName =
        String(meta.full_name || "").trim() || `${firstName} ${lastName}`.trim();
    }
  }

  return { email, displayName };
}

async function hasExistingOnboardingEmail(
  adminClient: SupabaseClient,
  userId: string,
  kind: string,
): Promise<boolean> {
  const { count, error } = await adminClient
    .from("admin_onboarding_email_log")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind);

  if (error) {
    console.error("[admin-notify] onboarding email log check failed:", error);
    return false;
  }
  return (count ?? 0) > 0;
}

async function recordOnboardingEmailSent(
  adminClient: SupabaseClient,
  userId: string,
  kind: string,
): Promise<boolean> {
  const { error } = await adminClient.from("admin_onboarding_email_log").upsert(
    { user_id: userId, kind, emailed_at: new Date().toISOString() },
    { onConflict: "user_id,kind" },
  );
  if (error) {
    console.error("[admin-notify] onboarding email log insert failed:", error);
    return false;
  }
  return true;
}

async function hasExistingAdminNotify(
  adminClient: SupabaseClient,
  userId: string,
  kind: string,
): Promise<boolean> {
  return hasExistingOnboardingEmail(adminClient, userId, kind);
}

function formatAnswerMethod(method: string | null | undefined): string {
  return method === "button" ? "bouton" : method === "text" ? "texte libre" : "inconnu";
}

export type OnboardingAnswersFlow = {
  user_id: string;
  conversation_id: string;
  step1_answer: string | null;
  step2_answer: string | null;
  step1_answer_method: string | null;
  step2_answer_method: string | null;
  step3_message_id: string | null;
  completed_at: string | null;
};

export async function loadOptionalOnboardingFollowUpMessage(
  adminClient: SupabaseClient,
  flow: OnboardingAnswersFlow,
  userId: string,
): Promise<string | null> {
  if (!flow.step3_message_id || !flow.conversation_id) return null;

  const { data: step3Message } = await adminClient
    .from("community_private_messages")
    .select("created_at")
    .eq("id", flow.step3_message_id)
    .maybeSingle();

  const step3At = String(step3Message?.created_at || "").trim();
  if (!step3At) return null;

  const { data: followUp } = await adminClient
    .from("community_private_messages")
    .select("content")
    .eq("conversation_id", flow.conversation_id)
    .eq("user_id", userId)
    .is("onboarding_step", null)
    .gt("created_at", step3At)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const content = String(followUp?.content || "").trim();
  return content || null;
}

export function buildOnboardingAnswersEmailBody(input: {
  displayName: string;
  email: string;
  userId: string;
  flow: OnboardingAnswersFlow;
  followUpMessage?: string | null;
  sourceLabel: string;
  signedUpAt?: string | null;
}): { title: string; subject: string; body: string } {
  const step1 = String(input.flow.step1_answer || "").trim();
  const step2 = String(input.flow.step2_answer || "").trim();
  const followUp = String(input.followUpMessage || "").trim();
  const signedUpAt = String(input.signedUpAt || "").trim();

  const title = "Réponses onboarding utilisateur";
  const subject = `[ViralWorks Studio] Réponses onboarding — ${input.displayName || input.email || "Utilisateur"}`;

  const lines = [
    "L'utilisateur a répondu au parcours d'onboarding automatique.",
    "",
    `Nom affiché: ${input.displayName || "(inconnu)"}`,
    `Email: ${input.email || "(inconnu)"}`,
    `User ID: ${input.userId}`,
    signedUpAt ? `Inscription: ${signedUpAt}` : "",
    `Source: ${input.sourceLabel}`,
    "",
    "--- Réponse 1 ---",
    `Question: ${ONBOARDING_QUESTION_1}`,
    `Réponse: ${step1 || "(vide)"}`,
    `Mode: ${formatAnswerMethod(input.flow.step1_answer_method)}`,
    "",
    "--- Réponse 2 ---",
    `Question: ${ONBOARDING_QUESTION_2}`,
    `Réponse: ${step2 || "(vide)"}`,
    `Mode: ${formatAnswerMethod(input.flow.step2_answer_method)}`,
    "",
    "--- Réponse 3 ---",
    `Question: ${ONBOARDING_QUESTION_3}`,
    `Réponse: ${followUp || "(aucun message libre pour l'instant)"}`,
    "",
    `Date: ${new Date().toISOString()}`,
    "",
    "Référence messages support:",
    ONBOARDING_STEP1_CONTENT.split("\n")[0],
    ONBOARDING_STEP2_CONTENT,
  ].filter((line, index, arr) => !(line === "" && arr[index - 1] === ""));

  return { title, subject, body: lines.join("\n") };
}

export async function notifyOnboardingAnswersComplete(
  adminClient: SupabaseClient,
  input: {
    userId: string;
    userEmail?: string | null;
    source: "realtime" | "backfill";
    signedUpAt?: string | null;
    waitForFollowUp?: boolean;
  },
): Promise<{ notified: boolean; emailed: boolean; skipped?: string; error?: string }> {
  const userId = String(input.userId || "").trim();
  if (!userId) return { notified: false, emailed: false, error: "user_id manquant" };

  if (await hasExistingAdminNotify(adminClient, userId, ONBOARDING_ANSWERS_NOTIFY_KIND)) {
    return { notified: false, emailed: false, skipped: "already_notified" };
  }

  const { data: flow, error: flowError } = await adminClient
    .from("community_welcome_flow")
    .select(
      "user_id, conversation_id, step1_answer, step2_answer, step1_answer_method, step2_answer_method, step3_message_id, completed_at",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (flowError) {
    return { notified: false, emailed: false, error: flowError.message };
  }

  const typedFlow = flow as OnboardingAnswersFlow | null;
  if (!typedFlow?.step1_answer?.trim() || !typedFlow?.step2_answer?.trim()) {
    return { notified: false, emailed: false, skipped: "answers_incomplete" };
  }

  if (!typedFlow.step3_message_id) {
    return { notified: false, emailed: false, skipped: "step3_missing" };
  }

  const followUpMessage = await loadOptionalOnboardingFollowUpMessage(
    adminClient,
    typedFlow,
    userId,
  );

  if (input.waitForFollowUp && !followUpMessage) {
    return { notified: false, emailed: false, skipped: "waiting_follow_up" };
  }

  const { email, displayName } = await loadUserContext(adminClient, userId, input.userEmail);
  const adminEmail = (Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "jean.limonta06@gmail.com").trim();
  const sourceLabel =
    input.source === "realtime"
      ? "Réponses reçues (temps réel)"
      : "Rattrapage historique (réponses depuis déploiement onboarding)";

  const { subject, body } = buildOnboardingAnswersEmailBody({
    displayName,
    email,
    userId,
    flow: typedFlow,
    followUpMessage,
    sourceLabel,
    signedUpAt: input.signedUpAt,
  });

  const emailResult = await sendAdminEmail({
    to: adminEmail,
    subject,
    text: body,
  });

  if (!emailResult.ok) {
    console.error("[admin-notify] send onboarding answers email failed:", emailResult.error);
    return { notified: false, emailed: false, error: emailResult.error };
  }

  const logged = await recordOnboardingEmailSent(adminClient, userId, ONBOARDING_ANSWERS_NOTIFY_KIND);

  return {
    notified: logged,
    emailed: true,
    error: emailResult.error,
  };
}

export async function notifyOnboardingFollowUpMessage(
  adminClient: SupabaseClient,
  input: {
    userId: string;
    messageContent: string;
  },
): Promise<{ notified: boolean; emailed: boolean; skipped?: string; error?: string }> {
  const userId = String(input.userId || "").trim();
  const messageContent = String(input.messageContent || "").trim();
  if (!userId || !messageContent) {
    return { notified: false, emailed: false, skipped: "payload_incomplete" };
  }

  const hasMainAnswersEmail = await hasExistingOnboardingEmail(
    adminClient,
    userId,
    ONBOARDING_ANSWERS_NOTIFY_KIND,
  );
  if (!hasMainAnswersEmail) {
    return { notified: false, emailed: false, skipped: "answers_email_missing" };
  }

  if (await hasExistingAdminNotify(adminClient, userId, ONBOARDING_FOLLOWUP_NOTIFY_KIND)) {
    return { notified: false, emailed: false, skipped: "already_notified" };
  }

  const { email, displayName } = await loadUserContext(adminClient, userId);
  const adminEmail = (Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "jean.limonta06@gmail.com").trim();

  const subject = `[ViralWorks Studio] Réponse onboarding (3) — ${displayName || email || "Utilisateur"}`;
  const body = [
    "L'utilisateur a envoyé un message libre après le parcours d'onboarding.",
    "",
    `Nom affiché: ${displayName || "(inconnu)"}`,
    `Email: ${email || "(inconnu)"}`,
    `User ID: ${userId}`,
    "",
    "--- Réponse 3 ---",
    `Question: ${ONBOARDING_QUESTION_3}`,
    `Réponse: ${messageContent}`,
    "",
    `Date: ${new Date().toISOString()}`,
  ].join("\n");

  const emailResult = await sendAdminEmail({ to: adminEmail, subject, text: body });
  if (!emailResult.ok) {
    console.error("[admin-notify] send onboarding follow-up email failed:", emailResult.error);
    return { notified: false, emailed: false, error: emailResult.error };
  }

  const logged = await recordOnboardingEmailSent(adminClient, userId, ONBOARDING_FOLLOWUP_NOTIFY_KIND);

  return {
    notified: logged,
    emailed: true,
    error: emailResult.error,
  };
}

async function hasExistingOnboardingNotify(
  adminClient: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return hasExistingAdminNotify(adminClient, userId, ONBOARDING_NOTIFY_KIND);
}

export async function notifyOnboardingStep1Delivery(
  adminClient: SupabaseClient,
  input: {
    userId: string;
    userEmail?: string | null;
    result: WelcomeStep1Result;
    source: "signup_hook" | "client_fallback" | "backfill";
    signedUpAt?: string | null;
  },
): Promise<{ notified: boolean; emailed: boolean; error?: string }> {
  const userId = String(input.userId || "").trim();
  if (!userId) return { notified: false, emailed: false, error: "user_id manquant" };

  if (await hasExistingOnboardingNotify(adminClient, userId)) {
    return { notified: false, emailed: false };
  }

  const { email, displayName } = await loadUserContext(adminClient, userId, input.userEmail);
  const adminEmail = (Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "jean.limonta06@gmail.com").trim();
  const result = input.result;
  const sourceLabel =
    input.source === "signup_hook"
      ? "Trigger inscription (DB)"
      : input.source === "client_fallback"
        ? "Fallback connexion client"
        : "Rattrapage historique (inscriptions depuis déploiement onboarding)";
  const signedUpAt = String(input.signedUpAt || "").trim();

  let title: string;
  let subject: string;
  const lines: string[] = [];

  if (result.ok && !result.skipped) {
    title = "Message onboarding envoyé";
    subject = `[ViralWorks Studio] Message onboarding envoyé`;
    lines.push(
      "Le message automatique d'onboarding (étape 1) a bien été envoyé au nouvel utilisateur.",
      "",
      `Nom affiché: ${displayName || "(inconnu)"}`,
      `Email: ${email || "(inconnu)"}`,
      `User ID: ${userId}`,
      signedUpAt ? `Inscription: ${signedUpAt}` : "",
      `Conversation ID: ${result.conversationId || "(inconnu)"}`,
      `Message ID: ${result.messageId || "(inconnu)"}`,
      `Source: ${sourceLabel}`,
      `Date: ${new Date().toISOString()}`,
    );
  } else if (!result.ok) {
    title = "Échec message onboarding";
    subject = `[ViralWorks Studio] Échec message onboarding`;
    lines.push(
      "Le message automatique d'onboarding (étape 1) n'a PAS pu être envoyé.",
      "",
      `Problème: ${formatReason(result.reason)}`,
      "",
      `Nom affiché: ${displayName || "(inconnu)"}`,
      `Email: ${email || "(inconnu)"}`,
      `User ID: ${userId}`,
      signedUpAt ? `Inscription: ${signedUpAt}` : "",
      `Source: ${sourceLabel}`,
      `Date: ${new Date().toISOString()}`,
    );
  } else {
    title = "Message onboarding non envoyé";
    subject = `[ViralWorks Studio] Message onboarding non envoyé`;
    lines.push(
      "Le message automatique d'onboarding (étape 1) n'a pas été envoyé (cas attendu ou ignoré).",
      "",
      `Raison: ${formatReason(result.reason)}`,
      "",
      `Nom affiché: ${displayName || "(inconnu)"}`,
      `Email: ${email || "(inconnu)"}`,
      `User ID: ${userId}`,
      signedUpAt ? `Inscription: ${signedUpAt}` : "",
      `Source: ${sourceLabel}`,
      `Date: ${new Date().toISOString()}`,
    );
  }

  const body = lines.join("\n");

  const emailResult = await sendAdminEmail({
    to: adminEmail,
    subject,
    text: body,
  });

  if (!emailResult.ok) {
    console.error("[admin-notify] send email failed:", emailResult.error);
    return { notified: false, emailed: false, error: emailResult.error };
  }

  await recordOnboardingEmailSent(adminClient, userId, ONBOARDING_NOTIFY_KIND);

  return {
    notified: true,
    emailed: true,
    error: emailResult.error,
  };
}

const SUBSCRIPTION_PLAN_LABELS: Record<string, string> = {
  image_9: "ViralWorks Image",
  pro_59: "ViralWorks Pro",
  premium_129: "ViralWorks Studio",
  monthly: "ViralWorks Studio",
  yearly: "Abonnement Annuel",
};

function subscriptionPlanLabel(planKey: string | null | undefined): string {
  const key = String(planKey || "").trim();
  if (!key) return "Abonnement";
  return SUBSCRIPTION_PLAN_LABELS[key] ?? key;
}

export async function notifySubscriptionCancelled(
  adminClient: SupabaseClient,
  input: {
    userId: string;
    planKey?: string | null;
    planName?: string | null;
    reason: string;
    reasonDetail?: string | null;
    isTrialing?: boolean;
    periodEnd?: string | null;
  },
): Promise<{ emailed: boolean; error?: string }> {
  const userId = String(input.userId || "").trim();
  const reason = String(input.reason || "").trim();
  if (!userId || !reason) {
    return { emailed: false, error: "payload_incomplete" };
  }

  const { email, displayName } = await loadUserContext(adminClient, userId);
  const adminEmail = (Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "jean.limonta06@gmail.com").trim();
  const planName =
    String(input.planName || "").trim() ||
    subscriptionPlanLabel(input.planKey) ||
    "Abonnement";
  const reasonDetail = String(input.reasonDetail || "").trim();
  const periodEnd = String(input.periodEnd || "").trim();

  const subject = `[ViralWorks Studio] Annulation abonnement — ${displayName || email || "Utilisateur"}`;
  const body = [
    "Un utilisateur a demandé l'arrêt de son abonnement.",
    "",
    `Nom affiché: ${displayName || "(inconnu)"}`,
    `Email: ${email || "(inconnu)"}`,
    `User ID: ${userId}`,
    `Abonnement: ${planName}`,
    input.isTrialing ? "Statut: essai gratuit" : "",
    periodEnd ? `Fin d'accès prévue: ${periodEnd}` : "",
    "",
    "--- Raison d'annulation ---",
    `Motif: ${reason}`,
    reasonDetail ? `Détail: ${reasonDetail}` : "Détail: (aucun)",
    "",
    `Date: ${new Date().toISOString()}`,
  ]
    .filter((line, index, arr) => !(line === "" && arr[index - 1] === ""))
    .join("\n");

  const emailResult = await sendAdminEmail({
    to: adminEmail,
    subject,
    text: body,
  });

  if (!emailResult.ok) {
    console.error("[admin-notify] send subscription cancellation email failed:", emailResult.error);
    return { emailed: false, error: emailResult.error };
  }

  return { emailed: true };
}
