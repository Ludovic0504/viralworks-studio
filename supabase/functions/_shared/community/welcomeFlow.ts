import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPPORT_EMAIL } from "./helpers.ts";
import {
  ONBOARDING_STEP1_CONTENT,
  ONBOARDING_STEP1_QUICK_REPLIES,
  ONBOARDING_STEP2_CONTENT,
  ONBOARDING_STEP2_QUICK_REPLIES,
  ONBOARDING_STEP3_CONTENT,
  ONBOARDING_ROLLOUT_AT,
} from "./onboarding.ts";

export type WelcomeFlowRow = {
  user_id: string;
  conversation_id: string;
  step1_message_id: string | null;
  step2_message_id: string | null;
  step3_message_id: string | null;
  step1_answer: string | null;
  step2_answer: string | null;
  completed_at: string | null;
};

export type WelcomeStep1Result = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  conversationId?: string;
  messageId?: string;
  supportUserId?: string;
};

export function createAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey =
    Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Configuration serveur incomplète.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getSupportUserId(adminClient: SupabaseClient): Promise<string | null> {
  const { data, error } = await adminClient
    .from("profiles")
    .select("user_id")
    .ilike("email", SUPPORT_EMAIL)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[welcome-flow] support lookup failed:", error);
    return null;
  }
  const userId = String(data?.user_id || "").trim();
  return userId || null;
}

export async function findExistingDirectConversation(
  adminClient: SupabaseClient,
  supportUserId: string,
  otherUserId: string,
): Promise<string | null> {
  const { data: rowAb } = await adminClient
    .from("community_private_conversations")
    .select("id")
    .eq("kind", "direct")
    .eq("user_a", supportUserId)
    .eq("user_b", otherUserId)
    .limit(1)
    .maybeSingle();

  const { data: rowBa } = await adminClient
    .from("community_private_conversations")
    .select("id")
    .eq("kind", "direct")
    .eq("user_a", otherUserId)
    .eq("user_b", supportUserId)
    .limit(1)
    .maybeSingle();

  if (rowAb?.id) return String(rowAb.id);
  if (rowBa?.id) return String(rowBa.id);
  return null;
}

export async function findOrCreateDirectConversation(
  adminClient: SupabaseClient,
  supportUserId: string,
  newUserId: string,
): Promise<string> {
  const existingId = await findExistingDirectConversation(adminClient, supportUserId, newUserId);
  if (existingId) return existingId;

  const now = new Date().toISOString();
  const { data: created, error: createErr } = await adminClient
    .from("community_private_conversations")
    .insert({ kind: "direct", user_a: supportUserId, user_b: newUserId, updated_at: now })
    .select("id")
    .single();
  if (createErr) throw new Error(createErr.message);

  const conversationId = String(created.id);
  const { error: partErr } = await adminClient.from("community_private_participants").insert([
    { conversation_id: conversationId, user_id: supportUserId },
    { conversation_id: conversationId, user_id: newUserId },
  ]);
  if (partErr) throw new Error(partErr.message);

  return conversationId;
}

type InsertSystemMessageInput = {
  conversationId: string;
  supportUserId: string;
  content: string;
  onboardingStep: 1 | 2 | 3;
  quickReplyOptions?: readonly string[] | null;
};

async function insertSystemMessage(
  adminClient: SupabaseClient,
  input: InsertSystemMessageInput,
): Promise<string> {
  const { data, error } = await adminClient.rpc("insert_system_private_message", {
    p_conversation_id: input.conversationId,
    p_user_id: input.supportUserId,
    p_content: input.content,
    p_onboarding_step: input.onboardingStep,
    p_quick_reply_options: input.quickReplyOptions?.length ? [...input.quickReplyOptions] : null,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

async function closeQuickReplies(
  adminClient: SupabaseClient,
  messageId: string,
): Promise<void> {
  const { error } = await adminClient.rpc("close_message_quick_replies", {
    p_message_id: messageId,
  });
  if (error) throw new Error(error.message);
}

async function setQuickReplySelected(
  adminClient: SupabaseClient,
  userId: string,
  messageId: string,
  label: string,
): Promise<void> {
  const { error } = await adminClient.rpc("set_onboarding_quick_reply_selected", {
    p_message_id: messageId,
    p_user_id: userId,
    p_label: label,
  });
  if (error) throw new Error(error.message);
}

async function loadWelcomeFlow(adminClient: SupabaseClient, userId: string) {
  const { data, error } = await adminClient
    .from("community_welcome_flow")
    .select(
      "user_id, conversation_id, step1_message_id, step2_message_id, step3_message_id, step1_answer, step2_answer, completed_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as WelcomeFlowRow | null;
}

async function sendStep2(
  adminClient: SupabaseClient,
  flow: WelcomeFlowRow,
  supportUserId: string,
): Promise<string | null> {
  if (flow.step2_message_id) return flow.step2_message_id;

  const { data: existingStep2 } = await adminClient
    .from("community_private_messages")
    .select("id")
    .eq("conversation_id", flow.conversation_id)
    .eq("onboarding_step", 2)
    .limit(1)
    .maybeSingle();
  if (existingStep2?.id) {
    const id = String(existingStep2.id);
    await adminClient
      .from("community_welcome_flow")
      .update({ step2_message_id: id })
      .eq("user_id", flow.user_id)
      .is("step2_message_id", null);
    return id;
  }

  const step2MessageId = await insertSystemMessage(adminClient, {
    conversationId: flow.conversation_id,
    supportUserId,
    content: ONBOARDING_STEP2_CONTENT,
    onboardingStep: 2,
    quickReplyOptions: ONBOARDING_STEP2_QUICK_REPLIES,
  });

  await adminClient
    .from("community_welcome_flow")
    .update({ step2_message_id: step2MessageId })
    .eq("user_id", flow.user_id)
    .is("step2_message_id", null);

  return step2MessageId;
}

async function sendStep3(
  adminClient: SupabaseClient,
  flow: WelcomeFlowRow,
  supportUserId: string,
): Promise<string | null> {
  if (flow.step3_message_id) return flow.step3_message_id;

  const { data: existingStep3 } = await adminClient
    .from("community_private_messages")
    .select("id")
    .eq("conversation_id", flow.conversation_id)
    .eq("onboarding_step", 3)
    .limit(1)
    .maybeSingle();
  if (existingStep3?.id) {
    const id = String(existingStep3.id);
    await adminClient
      .from("community_welcome_flow")
      .update({ step3_message_id: id, completed_at: new Date().toISOString() })
      .eq("user_id", flow.user_id);
    return id;
  }

  const step3MessageId = await insertSystemMessage(adminClient, {
    conversationId: flow.conversation_id,
    supportUserId,
    content: ONBOARDING_STEP3_CONTENT,
    onboardingStep: 3,
    quickReplyOptions: null,
  });

  await adminClient
    .from("community_welcome_flow")
    .update({
      step3_message_id: step3MessageId,
      completed_at: new Date().toISOString(),
    })
    .eq("user_id", flow.user_id);

  return step3MessageId;
}

async function markWelcomeOnboardingSkipped(
  adminClient: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<void> {
  const { error } = await adminClient.from("community_welcome_flow").upsert(
    {
      user_id: userId,
      conversation_id: conversationId,
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

async function isAccountEligibleForWelcomeOnboarding(
  adminClient: SupabaseClient,
  userId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(userId);
  if (authError) {
    console.error("[welcome-flow] auth user lookup failed:", authError);
  }

  const authCreatedAt = String(authData?.user?.created_at || "");
  if (authCreatedAt && authCreatedAt.localeCompare(ONBOARDING_ROLLOUT_AT) < 0) {
    return { eligible: false, reason: "account_before_onboarding_rollout" };
  }

  const { data: profile } = await adminClient
    .from("profiles")
    .select("created_at")
    .eq("user_id", userId)
    .maybeSingle();

  const profileCreatedAt = String(profile?.created_at || "");
  if (profileCreatedAt && profileCreatedAt.localeCompare(ONBOARDING_ROLLOUT_AT) < 0) {
    return { eligible: false, reason: "profile_before_onboarding_rollout" };
  }

  return { eligible: true };
}

async function hasPriorManualSupportConversation(
  adminClient: SupabaseClient,
  conversationId: string,
  supportUserId: string,
  userId: string,
): Promise<{ skip: boolean; reason?: string }> {
  const { count: manualSupportCount, error: supportErr } = await adminClient
    .from("community_private_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("user_id", supportUserId)
    .is("onboarding_step", null);

  if (supportErr) throw new Error(supportErr.message);
  if ((manualSupportCount ?? 0) > 0) {
    return { skip: true, reason: "prior_support_manual_message" };
  }

  const { count: userMessageCount, error: userErr } = await adminClient
    .from("community_private_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .is("onboarding_step", null);

  if (userErr) throw new Error(userErr.message);
  if ((userMessageCount ?? 0) > 0) {
    return { skip: true, reason: "prior_user_message" };
  }

  return { skip: false };
}

export async function sendWelcomeOnboardingStep1(
  adminClient: SupabaseClient,
  newUserId: string,
): Promise<WelcomeStep1Result> {
  const userId = String(newUserId || "").trim();
  if (!userId) return { ok: false, reason: "user_id manquant" };

  const { data: existingFlow } = await adminClient
    .from("community_welcome_flow")
    .select("conversation_id, step1_message_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingFlow?.conversation_id) {
    return {
      ok: true,
      skipped: true,
      reason: "already_sent",
      conversationId: String(existingFlow.conversation_id || ""),
      messageId: String(existingFlow.step1_message_id || ""),
      supportUserId: (await getSupportUserId(adminClient)) || undefined,
    };
  }

  const supportUserId = await getSupportUserId(adminClient);
  if (!supportUserId) return { ok: false, reason: "support_user_not_found" };
  if (supportUserId === userId) {
    return { ok: true, skipped: true, reason: "is_support_account" };
  }

  const eligibility = await isAccountEligibleForWelcomeOnboarding(adminClient, userId);
  if (!eligibility.eligible) {
    const existingConversationId = await findExistingDirectConversation(
      adminClient,
      supportUserId,
      userId,
    );
    if (existingConversationId) {
      await markWelcomeOnboardingSkipped(adminClient, userId, existingConversationId);
    }
    return { ok: true, skipped: true, reason: eligibility.reason };
  }

  const conversationId = await findOrCreateDirectConversation(adminClient, supportUserId, userId);

  const priorConversation = await hasPriorManualSupportConversation(
    adminClient,
    conversationId,
    supportUserId,
    userId,
  );
  if (priorConversation.skip) {
    await markWelcomeOnboardingSkipped(adminClient, userId, conversationId);
    return { ok: true, skipped: true, reason: priorConversation.reason };
  }

  const { data: existingStep1 } = await adminClient
    .from("community_private_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("onboarding_step", 1)
    .limit(1)
    .maybeSingle();
  if (existingStep1?.id) {
    await adminClient.from("community_welcome_flow").upsert(
      {
        user_id: userId,
        conversation_id: conversationId,
        step1_message_id: String(existingStep1.id),
      },
      { onConflict: "user_id" },
    );
    return {
      ok: true,
      skipped: true,
      reason: "step1_exists",
      conversationId,
      messageId: String(existingStep1.id),
      supportUserId,
    };
  }

  let step1MessageId: string;
  try {
    step1MessageId = await insertSystemMessage(adminClient, {
      conversationId,
      supportUserId,
      content: ONBOARDING_STEP1_CONTENT,
      onboardingStep: 1,
      quickReplyOptions: ONBOARDING_STEP1_QUICK_REPLIES,
    });
  } catch (error) {
    const { data: racedStep1 } = await adminClient
      .from("community_private_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("onboarding_step", 1)
      .limit(1)
      .maybeSingle();
    if (!racedStep1?.id) throw error;
    step1MessageId = String(racedStep1.id);
  }

  const { error: flowErr } = await adminClient.from("community_welcome_flow").upsert(
    {
      user_id: userId,
      conversation_id: conversationId,
      step1_message_id: step1MessageId,
    },
    { onConflict: "user_id" },
  );
  if (flowErr) {
    console.error("[welcome-flow] insert flow failed:", flowErr);
    return { ok: false, reason: flowErr.message };
  }

  return {
    ok: true,
    conversationId,
    messageId: step1MessageId,
    supportUserId,
  };
}

export async function handleOnboardingQuickReply(
  adminClient: SupabaseClient,
  input: {
    userId: string;
    messageId: string;
    conversationId: string;
    label: string;
  },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const userId = String(input.userId || "").trim();
  const messageId = String(input.messageId || "").trim();
  const conversationId = String(input.conversationId || "").trim();
  const label = String(input.label || "").trim();
  if (!userId || !messageId || !conversationId || !label) {
    return { ok: false, reason: "payload_incomplete" };
  }

  const supportUserId = await getSupportUserId(adminClient);
  if (!supportUserId || userId === supportUserId) {
    return { ok: true, skipped: true, reason: "support_message" };
  }

  const flow = await loadWelcomeFlow(adminClient, userId);
  if (!flow || String(flow.conversation_id) !== conversationId) {
    return { ok: true, skipped: true, reason: "not_welcome_conversation" };
  }

  if (flow.completed_at) {
    return { ok: true, skipped: true, reason: "onboarding_skipped" };
  }

  const { data: message } = await adminClient
    .from("community_private_messages")
    .select("id, onboarding_step, quick_reply_selected")
    .eq("id", messageId)
    .maybeSingle();

  const step = Number(message?.onboarding_step || 0);
  if (!message?.id || (step !== 1 && step !== 2)) {
    return { ok: true, skipped: true, reason: "not_onboarding_message" };
  }

  if (message.quick_reply_selected) {
    return { ok: true, skipped: true, reason: "already_selected" };
  }

  await setQuickReplySelected(adminClient, userId, messageId, label);

  if (step === 1) {
    if (flow.step1_answer) {
      return { ok: true, skipped: true, reason: "step1_already_answered" };
    }
    await adminClient
      .from("community_welcome_flow")
      .update({ step1_answer: label, step1_answer_method: "button" })
      .eq("user_id", userId)
      .is("step1_answer", null);
    await sendStep2(adminClient, flow, supportUserId);
    return { ok: true };
  }

  if (flow.step2_answer) {
    return { ok: true, skipped: true, reason: "step2_already_answered" };
  }

  await adminClient
    .from("community_welcome_flow")
    .update({ step2_answer: label, step2_answer_method: "button" })
    .eq("user_id", userId)
    .is("step2_answer", null);

  await sendStep3(adminClient, { ...flow, step2_answer: label }, supportUserId);
  return { ok: true };
}

export async function handleOnboardingUserReply(
  adminClient: SupabaseClient,
  input: {
    messageId: string;
    conversationId: string;
    userId: string;
    responseMethod?: string | null;
    content?: string | null;
  },
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const messageId = String(input.messageId || "").trim();
  const conversationId = String(input.conversationId || "").trim();
  const userId = String(input.userId || "").trim();
  const content = String(input.content || "").trim();
  if (!messageId || !conversationId || !userId) {
    return { ok: false, reason: "payload_incomplete" };
  }

  const supportUserId = await getSupportUserId(adminClient);
  if (!supportUserId || userId === supportUserId) {
    return { ok: true, skipped: true, reason: "support_message" };
  }

  if (input.responseMethod === "button") {
    return { ok: true, skipped: true, reason: "button_handled_elsewhere" };
  }

  const flow = await loadWelcomeFlow(adminClient, userId);
  if (!flow || String(flow.conversation_id) !== conversationId) {
    return { ok: true, skipped: true, reason: "not_welcome_conversation" };
  }

  if (flow.completed_at) {
    return { ok: true, skipped: true, reason: "onboarding_skipped" };
  }

  const { data: userReply } = await adminClient
    .from("community_private_messages")
    .select("id, created_at, content")
    .eq("id", messageId)
    .maybeSingle();
  const replyContent = content || String(userReply?.content || "").trim();
  const replyAt = String(userReply?.created_at || new Date().toISOString());

  if (!flow.step2_message_id) {
    if (flow.step1_answer) {
      return { ok: true, skipped: true, reason: "step1_already_answered" };
    }

    if (flow.step1_message_id) {
      await closeQuickReplies(adminClient, flow.step1_message_id);
    }

    await adminClient
      .from("community_welcome_flow")
      .update({
        step1_answer: replyContent || null,
        step1_answer_method: "text",
      })
      .eq("user_id", userId)
      .is("step1_answer", null);

    await sendStep2(adminClient, flow, supportUserId);
    return { ok: true };
  }

  const { data: step2Msg } = await adminClient
    .from("community_private_messages")
    .select("id, created_at")
    .eq("id", flow.step2_message_id)
    .maybeSingle();
  const step2At = String(step2Msg?.created_at || "");

  if (!step2At || replyAt.localeCompare(step2At) < 0) {
    return { ok: true, skipped: true, reason: "reply_before_step2" };
  }

  if (flow.step2_answer) {
    return { ok: true, skipped: true, reason: "step2_already_answered" };
  }

  await closeQuickReplies(adminClient, flow.step2_message_id);

  await adminClient
    .from("community_welcome_flow")
    .update({
      step2_answer: replyContent || null,
      step2_answer_method: "text",
    })
    .eq("user_id", userId)
    .is("step2_answer", null);

  await sendStep3(adminClient, { ...flow, step2_answer: replyContent }, supportUserId);
  return { ok: true };
}
