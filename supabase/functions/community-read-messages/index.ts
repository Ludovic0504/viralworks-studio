import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { censorMessageText } from "../_shared/name-moderation/censorMessage.ts";
import {
  COMMUNITY_CORS_HEADERS,
  getAuthedClients,
  jsonResponse,
  loadProfilesMap,
  mapMessageRow,
  type MessageRow,
} from "../_shared/community/helpers.ts";
import {
  buildOnboardingRecap,
  enrichPrivateMessagesForSupportInbox,
  getViewerSupportProfile,
  isSupportProfile,
  loadWelcomeFlowsByConversations,
  resolveConversationMemberId,
} from "../_shared/community/supportInbox.ts";
import { sortActivePrivateConversations } from "../_shared/community/conversationSort.ts";

type RequestBody = (
  | { action: "listPublic"; limit?: number }
  | { action: "listPrivate"; conversationId: string }
  | { action: "listConversations" }
) & { accessToken?: string };

async function assertPrivateParticipant(
  adminClient: ReturnType<typeof getAuthedClients> extends Promise<infer T> ? T["adminClient"] : never,
  userId: string,
  conversationId: string,
) {
  const { data: conv } = await adminClient
    .from("community_private_conversations")
    .select("id, user_a, user_b")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv?.id) {
    return jsonResponse({ error: "Conversation introuvable." }, 404);
  }

  const isMember =
    String(conv.user_a || "") === userId ||
    String(conv.user_b || "") === userId;

  if (!isMember) {
    const { data: part } = await adminClient
      .from("community_private_participants")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!part?.id) {
      return jsonResponse({ error: "Accès refusé." }, 403);
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: COMMUNITY_CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    let body: RequestBody;

    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse({ error: "Corps JSON invalide." }, 400);
    }

    const { userId, adminClient } = await getAuthedClients(req, body.accessToken);
    const viewerProfile = await getViewerSupportProfile(adminClient, userId);
    const viewerIsSupport = viewerProfile?.isSupport === true;

    if (body.action === "listPublic") {
      const limit = Math.min(Math.max(Number(body.limit) || 300, 1), 500);
      const { data, error } = await adminClient
        .from("community_public_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) return jsonResponse({ error: error.message }, 500);

      const rows = (data || []) as MessageRow[];
      const userIds = [
        ...new Set(
          rows
            .map((m) => (m.user_id != null ? String(m.user_id) : ""))
            .filter(Boolean),
        ),
      ];
      const profiles = await loadProfilesMap(adminClient, userIds);

      const messages = rows.map((row) =>
        mapMessageRow(row, profiles, censorMessageText(String(row.content || "")))
      );

      return jsonResponse({ messages });
    }

    if (body.action === "listPrivate") {
      const conversationId = String(body.conversationId || "").trim();
      if (!conversationId) {
        return jsonResponse({ error: "conversationId requis." }, 400);
      }

      const accessError = await assertPrivateParticipant(adminClient, userId, conversationId);
      if (accessError) return accessError;

      const { data: conv } = await adminClient
        .from("community_private_conversations")
        .select("id, user_a, user_b")
        .eq("id", conversationId)
        .maybeSingle();

      const { data, error } = await adminClient
        .from("community_private_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) return jsonResponse({ error: error.message }, 500);

      const rows = (data || []) as MessageRow[];
      const participantIds = [
        String(conv?.user_a || ""),
        String(conv?.user_b || ""),
        ...rows.map((m) => String(m.user_id || "")),
      ].filter(Boolean);
      const profiles = await loadProfilesMap(adminClient, [...new Set(participantIds)]);

      let messages = rows.map((row) =>
        mapMessageRow(row, profiles, censorMessageText(String(row.content || "")))
      );

      if (viewerIsSupport && conv?.id) {
        const memberUserId = resolveConversationMemberId(
          userId,
          String(conv.user_a || ""),
          String(conv.user_b || ""),
          profiles,
        );
        const flows = await loadWelcomeFlowsByConversations(adminClient, [conversationId]);
        messages = enrichPrivateMessagesForSupportInbox(rows, messages, {
          flow: flows.get(conversationId) ?? null,
          memberUserId,
          memberProfile: profiles.get(memberUserId),
        });
      }

      return jsonResponse({ messages });
    }

    if (body.action === "listConversations") {
      const { data: hiddenRows } = await adminClient
        .from("community_private_hidden")
        .select("conversation_id")
        .eq("user_id", userId);

      const hidden = new Set((hiddenRows || []).map((r) => String(r.conversation_id)));

      const { data: convRows, error: convErr } = await adminClient
        .from("community_private_conversations")
        .select("id, kind, updated_at, user_a, user_b")
        .or(`user_a.eq.${userId},user_b.eq.${userId}`)
        .order("updated_at", { ascending: false });

      if (convErr) return jsonResponse({ error: convErr.message }, 500);

      const visibleConvs = (convRows || []).filter((c) => !hidden.has(String(c.id)));
      const ids = visibleConvs.map((c) => String(c.id));
      if (!ids.length) return jsonResponse({ conversations: [] });

      const userIds = [
        ...new Set(
          visibleConvs
            .flatMap((c) => [String(c.user_a || ""), String(c.user_b || "")])
            .filter(Boolean),
        ),
      ];
      const profiles = await loadProfilesMap(adminClient, userIds);
      const welcomeFlows = await loadWelcomeFlowsByConversations(adminClient, ids);

      const { data: msgRows, error: msgErr } = await adminClient.rpc(
        "community_last_private_messages_by_conversations",
        { p_ids: ids },
      );

      if (msgErr) return jsonResponse({ error: msgErr.message }, 500);

      const { data: activityRows, error: activityErr } = await adminClient.rpc(
        "community_private_conversation_activity_meta",
        { p_ids: ids },
      );

      if (activityErr) return jsonResponse({ error: activityErr.message }, 500);

      const activityByConv = new Map<
        string,
        { lastOutgoingAt: string | null; hasIncomingFromSupport: boolean }
      >();
      for (const row of activityRows || []) {
        const id = String(row.conversation_id || "");
        if (!id) continue;
        activityByConv.set(id, {
          lastOutgoingAt: row.last_outgoing_at ? String(row.last_outgoing_at) : null,
          hasIncomingFromSupport: row.has_incoming_from_support === true,
        });
      }

      const lastByConv = new Map<string, { content: string; createdAt: string }>();
      for (const row of msgRows || []) {
        const id = String(row.conversation_id);
        const createdAt = String(row.created_at || "");
        const existing = lastByConv.get(id);
        if (!existing || createdAt.localeCompare(existing.createdAt) > 0) {
          lastByConv.set(id, {
            content: censorMessageText(String(row.content || "")),
            createdAt,
          });
        }
      }

      const viewerIsSupport = isSupportProfile(profiles.get(userId));

      const rows = visibleConvs
        .map((conv) => {
          const convId = String(conv.id);
          const userA = String(conv.user_a || "");
          const userB = String(conv.user_b || "");
          const otherId = resolveConversationMemberId(userId, userA, userB, profiles);
          const other = profiles.get(otherId);
          if (!otherId || otherId === userId) {
            return null;
          }

          const isSupport = isSupportProfile(other);
          if (isSupport && viewerIsSupport) {
            return null;
          }

          const flow = welcomeFlows.get(convId);
          const recap = buildOnboardingRecap(flow);
          const last = lastByConv.get(convId);
          const activity = activityByConv.get(convId);
          const lastMessage = recap
            ? `Réponses : ${recap}`
            : last?.content || "";
          const lastMessageAt = last?.createdAt || String(conv.updated_at || "");

          return {
            id: convId,
            otherUserId: otherId,
            otherUsername: isSupport
              ? "Support officiel"
              : other?.username || "Utilisateur",
            updatedAt: String(conv.updated_at || ""),
            lastMessage,
            lastMessageAt,
            isSupport,
            hasOnboardingAnswers: Boolean(recap),
            lastOutgoingAt: activity?.lastOutgoingAt ?? null,
            hasIncomingFromSupport: activity?.hasIncomingFromSupport ?? false,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

      const dedupByOther = new Map<string, typeof rows[number]>();
      for (const row of rows) {
        const key = String(row.otherUserId || "");
        const existing = dedupByOther.get(key);
        if (!existing) {
          dedupByOther.set(key, row);
          continue;
        }
        const existingOutgoing = String(existing.lastOutgoingAt || "");
        const rowOutgoing = String(row.lastOutgoingAt || "");
        if (rowOutgoing.localeCompare(existingOutgoing) > 0) {
          dedupByOther.set(key, row);
        }
      }

      const conversations = sortActivePrivateConversations([...dedupByOther.values()]);

      return jsonResponse({ conversations });
    }

    return jsonResponse({ error: "Action invalide." }, 400);
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return jsonResponse({ error: message }, 500);
  }
});
