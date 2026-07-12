import { validateDisplayNames } from "../name-moderation/validate.ts";
import { isDisposableEmail } from "./disposable-domains.ts";
import { looksLikeGibberishName } from "./gibberish-name.ts";
import { signupBlockedMessage, type SignupBlockReason } from "./messages.ts";

export type ValidateSignupInput = {
  email?: string;
  firstName: string;
  lastName: string;
  /** OAuth / Google : prénom-nom parfois absents au hook, email provider fiable. */
  allowMissingNames?: boolean;
};

export type ValidateSignupResult =
  | { ok: true }
  | { ok: false; reason: SignupBlockReason; message: string; field?: "firstName" | "lastName" | "both" };

function isValidEmailShape(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed.includes("@")) return false;
  if (trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function validateSignupInput(input: ValidateSignupInput): ValidateSignupResult {
  const email = String(input.email || "").trim().toLowerCase();
  const firstName = String(input.firstName || "").trim();
  const lastName = String(input.lastName || "").trim();

  if (email) {
    if (!isValidEmailShape(email)) {
      return { ok: false, reason: "invalid_email", message: signupBlockedMessage("invalid_email") };
    }
    if (isDisposableEmail(email)) {
      return {
        ok: false,
        reason: "disposable_email",
        message: signupBlockedMessage("disposable_email"),
      };
    }
  }

  if (!firstName && !lastName) {
    if (input.allowMissingNames) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: "missing_names",
      message: signupBlockedMessage("missing_names"),
      field: "both",
    };
  }

  if (!firstName || !lastName) {
    if (!input.allowMissingNames) {
      return {
        ok: false,
        reason: "missing_names",
        message: signupBlockedMessage("missing_names"),
        field: !firstName ? "firstName" : "lastName",
      };
    }
  }

  if (firstName && looksLikeGibberishName(firstName)) {
    return {
      ok: false,
      reason: "gibberish_first_name",
      message: signupBlockedMessage("gibberish_first_name"),
      field: "firstName",
    };
  }

  if (lastName && looksLikeGibberishName(lastName)) {
    return {
      ok: false,
      reason: "gibberish_last_name",
      message: signupBlockedMessage("gibberish_last_name"),
      field: "lastName",
    };
  }

  const nameModeration = validateDisplayNames(firstName, lastName);
  if (!nameModeration.ok) {
    return {
      ok: false,
      reason: "blocked_name",
      message: signupBlockedMessage("blocked_name", nameModeration.field),
      field: nameModeration.field,
    };
  }

  return { ok: true };
}
