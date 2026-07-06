import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPPORT_EMAIL } from "./helpers.ts";
import {
  ONBOARDING_STEP1_CONTENT,
  ONBOARDING_STEP1_QUICK_REPLIES,
  ONBOARDING_STEP2_CONTENT,
  ONBOARDING_STEP2_QUICK_REPLIES,
  ONBOARDING_STEP3_CONTENT,
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

export async function findOrCreateDirectConversation(
  adminClient: SupabaseClient,
  supportUserId: string,
  newUserId: string,
): Promise<string> {
  const { data: rowAb } = await adminClient
    .from("community_private_conversations")
    .select("id")
    .eq("kind", "direct")
    .eq("user_a", supportUserId)
    .eq("user_b", newUserId)
    .limit(1)
    .maybeSingle();

  const { data: rowBa } = await adminClient
    .from("community_private_conversations")
    .select("id")
    .eq("kind", "direct")
    .eq("user_a", newUserId)
    .eq("user_b", supportUserId)
    .limit(1)
    .maybeSingle();

  const existingId = rowAb?.id ? String(rowAb.id) : rowBa?.id ? String(rowBa.id) : null;
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

export async function sendWelcomeOnboardingStep1(
  adminClient: SupabaseClient,
  newUserId: string,
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const userId = String(newUserId || "").trim();
  if (!userId) return { ok: false, reason: "user_id manquant" };

  const { data: existingFlow } = await adminClient
    .from("community_welcome_flow")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingFlow?.user_id) {
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  const supportUserId = await getSupportUserId(adminClient);
  if (!supportUserId) return { ok: false, reason: "support_user_not_found" };
  if (supportUserId === userId) {
    return { ok: true, skipped: true, reason: "is_support_account" };
  }

  const conversationId = await findOrCreateDirectConversation(adminClient, supportUserId, userId);

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
    return { ok: true, skipped: true, reason: "step1_exists" };
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

  return { ok: true };
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

  if (flow.completed_at && flow.step3_message_id) {
    return { ok: true, skipped: true, reason: "already_completed" };
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
