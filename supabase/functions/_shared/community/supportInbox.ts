import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPPORT_EMAIL, type CommunityMessageDto, type MessageRow, type ProfileInfo } from "./helpers.ts";

export type WelcomeFlowRow = {
  user_id: string;
  conversation_id: string;
  step1_message_id: string | null;
  step2_message_id: string | null;
  step1_answer: string | null;
  step2_answer: string | null;
  step1_answer_method: string | null;
  step2_answer_method: string | null;
  completed_at: string | null;
};

export function isSupportProfile(profile: ProfileInfo | undefined): boolean {
  return profile?.isSupport === true;
}

export async function getViewerSupportProfile(
  adminClient: SupabaseClient,
  userId: string,
): Promise<ProfileInfo | null> {
  const { data } = await adminClient
    .from("profiles")
    .select("user_id, full_name, first_name, last_name, email, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.user_id) return null;
  const email = String(data.email || "").toLowerCase();
  return {
    userId: String(data.user_id),
    username:
      data.full_name ||
      [data.first_name, data.last_name].filter(Boolean).join(" ") ||
      data.first_name ||
      (data.email ? String(data.email).split("@")[0] : "") ||
      "Utilisateur",
    role: data.role ?? null,
    isSupport: email === SUPPORT_EMAIL,
  };
}

export async function loadWelcomeFlowsByConversations(
  adminClient: SupabaseClient,
  conversationIds: string[],
): Promise<Map<string, WelcomeFlowRow>> {
  const map = new Map<string, WelcomeFlowRow>();
  if (!conversationIds.length) return map;

  const { data } = await adminClient
    .from("community_welcome_flow")
    .select(
      "user_id, conversation_id, step1_message_id, step2_message_id, step1_answer, step2_answer, step1_answer_method, step2_answer_method, completed_at",
    )
    .in("conversation_id", conversationIds);

  for (const row of data || []) {
    map.set(String(row.conversation_id), row as WelcomeFlowRow);
  }
  return map;
}

export function buildOnboardingRecap(flow: WelcomeFlowRow | null | undefined): string {
  if (!flow) return "";
  const parts = [flow.step1_answer, flow.step2_answer].map((v) => String(v || "").trim()).filter(Boolean);
  if (!parts.length) return "";
  return parts.join(" · ");
}

function answerForStep(
  flow: WelcomeFlowRow | null | undefined,
  step: number,
  quickReplySelected: string | null | undefined,
): string {
  const fromFlow = step === 1 ? flow?.step1_answer : flow?.step2_answer;
  const selected = String(quickReplySelected || "").trim();
  const stored = String(fromFlow || "").trim();
  return stored || selected;
}

function offsetCreatedAt(baseIso: string, offsetMs: number): string {
  const base = Date.parse(baseIso);
  if (!Number.isFinite(base)) return new Date().toISOString();
  return new Date(base + offsetMs).toISOString();
}

export function enrichPrivateMessagesForSupportInbox(
  rows: MessageRow[],
  mapped: CommunityMessageDto[],
  input: {
    flow: WelcomeFlowRow | null;
    memberUserId: string;
    memberProfile: ProfileInfo | undefined;
  },
): CommunityMessageDto[] {
  const memberUserId = String(input.memberUserId || "").trim();
  if (!memberUserId) return mapped;

  const rowById = new Map(rows.map((row) => [String(row.id), row]));
  const memberName = input.memberProfile?.username || "Utilisateur";
  const out: CommunityMessageDto[] = [];

  for (const message of mapped) {
    out.push(message);

    const step = Number(message.onboardingStep || 0);
    if (step !== 1 && step !== 2) continue;

    const sourceRow = rowById.get(message.id);
    const answer = answerForStep(input.flow, step, sourceRow?.quick_reply_selected);
    if (!answer) continue;

    const alreadyVisible = mapped.some(
      (item) =>
        item.userId === memberUserId &&
        item.content === answer &&
        item.id !== message.id,
    );
    if (alreadyVisible) continue;

    out.push({
      id: `onboarding-answer-${message.id}`,
      conversationId: message.conversationId,
      userId: memberUserId,
      username: memberName,
      content: answer,
      createdAt: offsetCreatedAt(message.createdAt, step === 1 ? 500 : 1500),
      attachment: null,
      isSupport: false,
      isOnboardingAnswer: true,
      onboardingStep: null,
      quickReplyOptions: undefined,
      quickRepliesClosedAt: null,
      quickReplySelected: null,
      responseMethod:
        (step === 1 ? input.flow?.step1_answer_method : input.flow?.step2_answer_method) === "button"
          ? "button"
          : "text",
    });
  }

  return out.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

export function resolveConversationMemberId(
  viewerUserId: string,
  userA: string,
  userB: string,
  profiles: Map<string, ProfileInfo>,
): string {
  const a = String(userA || "");
  const b = String(userB || "");
  if (a === viewerUserId) return b;
  if (b === viewerUserId) return a;
  const nonSupport = [a, b].find((id) => id && !isSupportProfile(profiles.get(id)));
  return nonSupport || b || a;
}
