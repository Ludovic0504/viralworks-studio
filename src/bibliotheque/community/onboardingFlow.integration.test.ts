import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEP2_CONTENT,
  ONBOARDING_STEP3_CONTENT,
  mergePrivateMessagesWithServer,
} from "@/bibliotheque/community/onboarding";
import {
  applyOnboardingQuickReplyOptimistic,
  findOnboardingSourceMessage,
  isOnboardingFollowUpVisible,
  syncOnboardingFollowUpAfterReply,
} from "@/bibliotheque/community/onboardingQuickReply";
import type { CommunityMessage } from "@/bibliotheque/supabase/communaute";

function message(
  partial: Partial<CommunityMessage> & Pick<CommunityMessage, "id">,
): CommunityMessage {
  return {
    conversationId: "conv-1",
    userId: "support",
    username: "Support officiel",
    content: "Hello",
    createdAt: "2026-07-07T10:00:00.000Z",
    attachment: null,
    isSupport: true,
    ...partial,
  };
}

function fullStep1To2Flow() {
  const step1 = message({
    id: "msg-1",
    onboardingStep: 1,
    content:
      "Salut 👋\n\nMerci d'avoir rejoint ViralWorks Studio.\n\nJe suis le fondateur de la plateforme et je voulais te souhaiter la bienvenue.\n\nPar curiosité, comment t'es tombé(e) sur ViralWorks Studio ?",
    quickReplyOptions: ["Instagram"],
  });

  const afterStep1 = applyOnboardingQuickReplyOptimistic([step1], {
    sourceMessageId: "msg-1",
    label: "Instagram",
    conversationId: "conv-1",
    supportUserId: "support",
  });

  expect(afterStep1?.followUpStep).toBe(2);
  expect(isOnboardingFollowUpVisible(afterStep1?.messages || [], 2)).toBe(true);

  const serverAfterStep1 = [
    message({
      id: "msg-1",
      onboardingStep: 1,
      quickReplySelected: "Instagram",
      content: step1.content,
    }),
    message({
      id: "msg-2-real",
      onboardingStep: 2,
      content: ONBOARDING_STEP2_CONTENT,
      quickReplyOptions: ["Créer des visuels"],
    }),
  ];

  const mergedAfterStep1 = mergePrivateMessagesWithServer(afterStep1!.messages, serverAfterStep1);
  expect(isOnboardingFollowUpVisible(mergedAfterStep1, 2)).toBe(true);

  return mergedAfterStep1;
}

describe("onboarding flow integration", () => {
  it("step 1 quick reply shows step 2 after server merge", () => {
    const merged = fullStep1To2Flow();
    expect(merged.some((row) => row.onboardingStep === 2)).toBe(true);
  });

  it("step 2 quick reply shows step 3 optimistically", () => {
    const mergedAfterStep1 = fullStep1To2Flow();
    const step2 = mergedAfterStep1.find((row) => row.onboardingStep === 2);
    expect(step2?.id).toBeTruthy();

    const afterStep2 = applyOnboardingQuickReplyOptimistic(mergedAfterStep1, {
      sourceMessageId: step2!.id,
      label: "Créer des visuels",
      conversationId: "conv-1",
      supportUserId: "support",
    });

    expect(afterStep2?.followUpStep).toBe(3);
    expect(isOnboardingFollowUpVisible(afterStep2?.messages || [], 3)).toBe(true);
    expect(afterStep2?.messages.some((row) => row.content === ONBOARDING_STEP3_CONTENT)).toBe(true);
  });

  it("step 3 stays visible after merge with server still on step 2 only", () => {
    const mergedAfterStep1 = fullStep1To2Flow();
    const step2 = mergedAfterStep1.find((row) => row.onboardingStep === 2)!;

    const afterStep2 = applyOnboardingQuickReplyOptimistic(mergedAfterStep1, {
      sourceMessageId: step2.id,
      label: "Créer des visuels",
      conversationId: "conv-1",
      supportUserId: "support",
    })!;

    const serverStillWaiting = [
      message({
        id: "msg-1",
        onboardingStep: 1,
        quickReplySelected: "Instagram",
        content: mergedAfterStep1[0]?.content,
      }),
      message({
        id: "msg-2-real",
        onboardingStep: 2,
        quickReplySelected: "Créer des visuels",
        content: ONBOARDING_STEP2_CONTENT,
      }),
    ];

    const merged = mergePrivateMessagesWithServer(afterStep2.messages, serverStillWaiting);
    expect(isOnboardingFollowUpVisible(merged, 3)).toBe(true);
    expect(merged.filter((row) => row.onboardingStep === 3)).toHaveLength(1);
  });

  it("step 3 stays visible when server has ghost step 3 without content", () => {
    const mergedAfterStep1 = fullStep1To2Flow();
    const step2 = mergedAfterStep1.find((row) => row.onboardingStep === 2)!;

    const afterStep2 = applyOnboardingQuickReplyOptimistic(mergedAfterStep1, {
      sourceMessageId: step2.id,
      label: "Créer des visuels",
      conversationId: "conv-1",
      supportUserId: "support",
    })!;

    const serverWithGhostStep3 = [
      message({ id: "msg-1", onboardingStep: 1 }),
      message({
        id: "msg-2-real",
        onboardingStep: 2,
        quickReplySelected: "Créer des visuels",
        content: ONBOARDING_STEP2_CONTENT,
      }),
      message({ id: "ghost-3", onboardingStep: 3, content: "" }),
    ];

    const merged = mergePrivateMessagesWithServer(afterStep2.messages, serverWithGhostStep3);
    expect(isOnboardingFollowUpVisible(merged, 3)).toBe(true);
  });

  it("does not block step 3 when ghost step 3 exists before apply", () => {
    const mergedAfterStep1 = fullStep1To2Flow();
    const step2 = mergedAfterStep1.find((row) => row.onboardingStep === 2)!;

    const withGhost = [
      ...mergedAfterStep1,
      message({ id: "ghost-3", onboardingStep: 3, content: "" }),
    ];

    const afterStep2 = applyOnboardingQuickReplyOptimistic(withGhost, {
      sourceMessageId: step2.id,
      label: "Créer des visuels",
      conversationId: "conv-1",
      supportUserId: "support",
    });

    expect(isOnboardingFollowUpVisible(afterStep2?.messages || [], 3)).toBe(true);
  });

  it("sync keeps step 3 visible when optimistic already present", async () => {
    const mergedAfterStep1 = fullStep1To2Flow();
    const step2 = mergedAfterStep1.find((row) => row.onboardingStep === 2)!;

    const afterStep2 = applyOnboardingQuickReplyOptimistic(mergedAfterStep1, {
      sourceMessageId: step2.id,
      label: "Créer des visuels",
      conversationId: "conv-1",
      supportUserId: "support",
    })!;

    let state = afterStep2.messages;
    const synced = await syncOnboardingFollowUpAfterReply(
      async () => [
        message({ id: "msg-1", onboardingStep: 1 }),
        message({
          id: "msg-2-real",
          onboardingStep: 2,
          quickReplySelected: "Créer des visuels",
          content: ONBOARDING_STEP2_CONTENT,
        }),
      ],
      () => state,
      3,
      {
        answeredStep: 2,
        conversationId: "conv-1",
        supportUserId: "support",
      },
      (merged) => {
        state = merged;
      },
    );

    expect(isOnboardingFollowUpVisible(synced, 3)).toBe(true);
  });

  it("resolves step 2 by onboarding step when source id is stale", () => {
    const mergedAfterStep1 = fullStep1To2Flow();
    const step2 = mergedAfterStep1.find((row) => row.onboardingStep === 2)!;

    const afterStep2 = applyOnboardingQuickReplyOptimistic(mergedAfterStep1, {
      sourceMessageId: "temp-onboarding-step-2-stale",
      sourceOnboardingStep: 2,
      label: "Créer des visuels",
      conversationId: "conv-1",
      supportUserId: "support",
    });

    expect(afterStep2?.followUpStep).toBe(3);
    expect(afterStep2?.sourceMessageId).toBe(step2.id);
    expect(isOnboardingFollowUpVisible(afterStep2?.messages || [], 3)).toBe(true);
  });

  it("prefers persisted step 2 id when stale optimistic id is provided", () => {
    const mergedAfterStep1 = fullStep1To2Flow();
    const step2 = mergedAfterStep1.find((row) => row.onboardingStep === 2)!;

    const withDuplicateStep2 = [
      ...mergedAfterStep1.filter((row) => row.onboardingStep !== 2),
      message({
        id: "temp-onboarding-step-2-stale",
        onboardingStep: 2,
        content: ONBOARDING_STEP2_CONTENT,
        quickReplyOptions: ["Créer des visuels"],
      }),
      step2,
    ];

    const resolved = findOnboardingSourceMessage(withDuplicateStep2, "temp-onboarding-step-2-stale", 2);
    expect(resolved?.id).toBe(step2.id);
  });

  it("can answer step 2 while step 2 is still optimistic if persisted copy exists in list", () => {
    const mergedAfterStep1 = fullStep1To2Flow();
    const step2 = mergedAfterStep1.find((row) => row.onboardingStep === 2)!;

    const afterStep2 = applyOnboardingQuickReplyOptimistic(mergedAfterStep1, {
      sourceMessageId: "temp-onboarding-step-2-stale",
      sourceOnboardingStep: 2,
      label: "Créer des visuels",
      conversationId: "conv-1",
      supportUserId: "support",
    });

    expect(afterStep2?.sourceMessageId).toBe(step2.id);
    expect(isOnboardingFollowUpVisible(afterStep2?.messages || [], 3)).toBe(true);
  });
});
