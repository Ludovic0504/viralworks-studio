/** Domaines jetables / relay connus — liste conservative, extensible. */
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
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

export function isDisposableEmailDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(normalized)) return true;
  // Sous-domaines de services jetables connus
  for (const blocked of DISPOSABLE_EMAIL_DOMAINS) {
    if (normalized.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

export function isDisposableEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  return isDisposableEmailDomain(domain);
}
