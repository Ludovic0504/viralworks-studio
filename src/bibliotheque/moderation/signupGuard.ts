const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "shieldedpost.net",
  "zkqjdkd.com",
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "grr.la",
  "sharklasers.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "throwaway.email",
  "getnada.com",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
  "trashmail.com",
  "10minutemail.com",
  "fakeinbox.com",
  "mintemail.com",
  "emailondeck.com",
  "spamgourmet.com",
  "mytemp.email",
  "tmpmail.net",
  "tmpmail.org",
  "burnermail.io",
  "inboxkitten.com",
  "mailcatch.com",
  "mohmal.com",
  "dropmail.me",
  "harakirimail.com",
  "mailpoof.com",
  "tmail.io",
  "emlhub.com",
  "emlpro.com",
  "emltmp.com",
  "crazymailing.com",
  "tempr.email",
  "discard.email",
  "spam4.me",
  "getairmail.com",
  "mail.tm",
  "mail.gw",
]);

export function extractEmailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "";
  return email.slice(at + 1).trim().toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export const DISPOSABLE_EMAIL_MESSAGE =
  "Les adresses email temporaires ou jetables ne sont pas acceptées.";

const CJK_OR_JAPANESE_OR_KOREAN =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

function vowelRatio(text: string): number {
  const letters = text.match(/[\p{L}]/gu) || [];
  if (!letters.length) return 0;
  const vowels = letters.filter((ch) => /[aeiouyàâäéèêëïîôùûüæœ]/i.test(ch)).length;
  return vowels / letters.length;
}

export function looksLikeGibberishName(name: string): boolean {
  const raw = name.trim();
  if (!raw) return true;
  if (raw.length < 2) return true;
  if (raw.length > 40) return true;
  if (CJK_OR_JAPANESE_OR_KOREAN.test(raw)) return false;
  if (/\d/.test(raw)) return true;
  if (/[^a-zA-ZÀ-ÿ' -]/.test(raw)) return true;
  const lower = raw.toLowerCase();
  if (/(.)\1{3,}/.test(lower)) return true;
  const lettersOnly = lower.replace(/[^a-zàâäéèêëïîôùûü]/g, "");
  if (lettersOnly.length >= 6 && vowelRatio(lettersOnly) < 0.12) return true;
  if (!raw.includes(" ") && lettersOnly.length >= 8) {
    const ratio = vowelRatio(lettersOnly);
    if (ratio < 0.2 || ratio > 0.85) return true;
  }
  return false;
}

export const GIBBERISH_FIRST_NAME_MESSAGE =
  "Ce prénom ne semble pas valide. Utilise ton vrai prénom.";
export const GIBBERISH_LAST_NAME_MESSAGE =
  "Ce nom ne semble pas valide. Utilise ton vrai nom.";

export function validateSignupFieldsClient(input: {
  email: string;
  firstName: string;
  lastName: string;
}):
  | { ok: true }
  | { ok: false; message: string; field: "firstName" | "lastName" | "both" | "email" } {
  const email = input.email.trim();
  if (isDisposableEmail(email)) {
    return { ok: false, message: DISPOSABLE_EMAIL_MESSAGE, field: "email" };
  }
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    return { ok: false, message: "Le prénom et le nom sont obligatoires.", field: "both" };
  }
  if (looksLikeGibberishName(firstName)) {
    return { ok: false, message: GIBBERISH_FIRST_NAME_MESSAGE, field: "firstName" };
  }
  if (looksLikeGibberishName(lastName)) {
    return { ok: false, message: GIBBERISH_LAST_NAME_MESSAGE, field: "lastName" };
  }
  return { ok: true };
}
