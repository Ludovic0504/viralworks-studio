import { describe, expect, it } from "vitest";
import {
  applyOnboardingQuickReplyOptimistic,
  ensureOnboardingFollowUpMessage,
  isOnboardingFollowUpVisible,
  syncOnboardingFollowUpAfterReply,
} from "@/bibliotheque/community/onboardingQuickReply";
import type { CommunityMessage } from "@/bibliotheque/supabase/communaute";
import { ONBOARDING_STEP3_CONTENT } from "@/bibliotheque/community/onboarding";

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
    isSupport: true,
    ...partial,
  };
}

describe("onboardingQuickReply", () => {
  it("adds step 3 optimistically after answering step 2", () => {
    const step2 = message({
      id: "msg-2",
      onboardingStep: 2,
      content: "Et toi, tu cherches à faire quoi principalement avec ViralWorks Studio ?",
      quickReplyOptions: ["Créer des visuels"],
    });

    const result = applyOnboardingQuickReplyOptimistic([step2], {
      sourceMessageId: "msg-2",
      label: "Créer des visuels",
      conversationId: "conv-1",
      supportUserId: "support",
    });

    expect(result?.followUpStep).toBe(3);
    expect(isOnboardingFollowUpVisible(result?.messages || [], 3)).toBe(true);
    expect(result?.messages.some((row) => row.onboardingStep === 3)).toBe(true);
  });

  it("ensures step 3 appears when the server is slow", async () => {
    const step2 = message({
      id: "msg-2",
      onboardingStep: 2,
      quickReplySelected: "Créer des visuels",
      content: "Et toi, tu cherches à faire quoi principalement avec ViralWorks Studio ?",
    });

    let calls = 0;
    const synced = await syncOnboardingFollowUpAfterReply(
      async () => {
        calls += 1;
        return [step2];
      },
      () => [step2],
      3,
      {
        answeredStep: 2,
        conversationId: "conv-1",
        supportUserId: "support",
      },
    );

    expect(calls).toBeGreaterThan(0);
    expect(isOnboardingFollowUpVisible(synced, 3)).toBe(true);
    expect(synced.some((row) => row.content === ONBOARDING_STEP3_CONTENT)).toBe(true);
  }, 10000);

  it("keeps an existing step 3 follow-up", () => {
    const messages = [
      message({ id: "msg-2", onboardingStep: 2 }),
      message({
        id: "msg-3",
        onboardingStep: 3,
        content: ONBOARDING_STEP3_CONTENT,
      }),
    ];

    const ensured = ensureOnboardingFollowUpMessage(messages, {
      answeredStep: 2,
      conversationId: "conv-1",
      supportUserId: "support",
    });

    expect(ensured).toHaveLength(2);
  });
});
