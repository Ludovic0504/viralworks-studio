import { describe, expect, it } from "vitest";
import { mergePrivateMessagesWithServer } from "@/bibliotheque/community/onboarding";
import type { CommunityMessage } from "@/bibliotheque/supabase/communaute";

function message(
  partial: Partial<CommunityMessage> & Pick<CommunityMessage, "id">,
): CommunityMessage {
  return {
    conversationId: "conv-1",
    userId: "support",
    username: "Support",
    content: "Hello",
    createdAt: "2026-07-07T10:00:00.000Z",
    attachment: null,
    ...partial,
  };
}

describe("mergePrivateMessagesWithServer", () => {
  it("preserves optimistic quickReplySelected until the server confirms it", () => {
    const current = [
      message({
        id: "msg-1",
        onboardingStep: 1,
        quickReplySelected: "Instagram",
      }),
    ];
    const server = [
      message({
        id: "msg-1",
        onboardingStep: 1,
        quickReplySelected: null,
      }),
    ];

    const merged = mergePrivateMessagesWithServer(current, server);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quickReplySelected).toBe("Instagram");
  });

  it("prefers the server quickReplySelected when it is already set", () => {
    const current = [
      message({
        id: "msg-1",
        onboardingStep: 1,
        quickReplySelected: "Instagram",
      }),
    ];
    const server = [
      message({
        id: "msg-1",
        onboardingStep: 1,
        quickReplySelected: "TikTok",
      }),
    ];

    const merged = mergePrivateMessagesWithServer(current, server);
    expect(merged[0]?.quickReplySelected).toBe("TikTok");
  });

  it("carries quickReplySelected from an optimistic onboarding step to the persisted message", () => {
    const current = [
      message({
        id: "temp-onboarding-step-2-123",
        onboardingStep: 2,
        quickReplySelected: "Créer des pubs",
      }),
    ];
    const server = [
      message({
        id: "msg-2-real",
        onboardingStep: 2,
        quickReplySelected: null,
      }),
    ];

    const merged = mergePrivateMessagesWithServer(current, server);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("msg-2-real");
    expect(merged[0]?.quickReplySelected).toBe("Créer des pubs");
  });

  it("replaces optimistic step 3 with the persisted server message", () => {
    const current = [
      message({
        id: "temp-onboarding-step-3-123",
        onboardingStep: 3,
        content: "Merci pour tes réponses !\n\nBonne découverte",
      }),
    ];
    const server = [
      message({
        id: "msg-3-real",
        onboardingStep: 3,
        content: "Merci pour tes réponses !\n\nBonne découverte",
      }),
    ];

    const merged = mergePrivateMessagesWithServer(current, server);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("msg-3-real");
    expect(merged[0]?.onboardingStep).toBe(3);
  });
});
