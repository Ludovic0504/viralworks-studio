import { describe, expect, it } from "vitest";
import {
  isDisposableEmail,
  looksLikeGibberishName,
  validateSignupFieldsClient,
} from "@/bibliotheque/moderation/signupGuard";

describe("signupGuard", () => {
  it("blocks disposable email domains", () => {
    expect(isDisposableEmail("bot@shieldedpost.net")).toBe(true);
    expect(isDisposableEmail("x@zkqjdkd.com")).toBe(true);
    expect(isDisposableEmail("real@gmail.com")).toBe(false);
  });

  it("detects gibberish names", () => {
    expect(looksLikeGibberishName("wfo9fnwqpy")).toBe(true);
    expect(looksLikeGibberishName("Jean")).toBe(false);
    expect(looksLikeGibberishName("欧克瑟")).toBe(false);
  });

  it("validates signup fields together", () => {
    expect(
      validateSignupFieldsClient({
        email: "a@shieldedpost.net",
        firstName: "Jean",
        lastName: "Dupont",
      }).ok,
    ).toBe(false);

    expect(
      validateSignupFieldsClient({
        email: "jean@gmail.com",
        firstName: "liu",
        lastName: "wfo9fnwqpy",
      }).ok,
    ).toBe(false);
  });
});
