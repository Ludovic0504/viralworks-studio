import { describe, expect, it } from "vitest";
import {
  conversationHasReferenceImage,
  messageImpliesReferenceImage,
  shouldAskForMissingReferenceImage,
} from "./detectMissingReferenceImage";

describe("detectMissingReferenceImage", () => {
  it("detects demonstrative product references", () => {
    expect(messageImpliesReferenceImage("je veux que ce produit soit porté par un mannequin")).toBe(
      true,
    );
    expect(messageImpliesReferenceImage("packshot fond blanc")).toBe(false);
  });

  it("detects photo or image references", () => {
    expect(messageImpliesReferenceImage("reproduire la photo jointe en studio")).toBe(true);
    expect(messageImpliesReferenceImage("selfie ugc naturel")).toBe(false);
  });

  it("asks for image when reference is implied but conversation has none", () => {
    const messages = [
      { role: "assistant" as const, content: "Bonjour" },
      {
        role: "user" as const,
        content: "je veux que ce produit soit porté par un mannequin",
      },
    ];

    expect(shouldAskForMissingReferenceImage(messages[1].content, messages)).toBe(true);
  });

  it("does not ask when an image was already shared in the thread", () => {
    const messages = [
      {
        role: "user" as const,
        content: "veste",
        imageUrl: "data:image/png;base64,abc",
      },
      {
        role: "user" as const,
        content: "je veux que ce produit soit porté par un mannequin",
      },
    ];

    expect(conversationHasReferenceImage(messages)).toBe(true);
    expect(shouldAskForMissingReferenceImage(messages[1].content, messages)).toBe(false);
  });

  it("does not ask when the current message already has an image", () => {
    const messages = [
      {
        role: "user" as const,
        content: "je veux que ce produit soit porté par un mannequin",
        imageUrl: "data:image/png;base64,abc",
      },
    ];

    expect(
      shouldAskForMissingReferenceImage(messages[0].content, messages, {
        currentMessageHasImage: true,
      }),
    ).toBe(false);
  });
});
