const EMAIL_JUST_CONFIRMED_KEY = "vw_email_just_confirmed";

export const EMAIL_CONFIRMED_EVENT = "vw:email-confirmed";

export function markEmailJustConfirmed(): void {
  try {
    sessionStorage.setItem(EMAIL_JUST_CONFIRMED_KEY, "1");
  } catch {
    // no-op
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EMAIL_CONFIRMED_EVENT));
  }
}

export function hasEmailJustConfirmed(): boolean {
  try {
    return sessionStorage.getItem(EMAIL_JUST_CONFIRMED_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearEmailJustConfirmed(): void {
  try {
    sessionStorage.removeItem(EMAIL_JUST_CONFIRMED_KEY);
  } catch {
    // no-op
  }
}

/** Bloque la modale promo sur les flux auth, sauf après confirmation email réussie. */
export function isPromoModalSuppressed(
  pathname: string,
  emailConfirmed = hasEmailJustConfirmed(),
): boolean {
  if (pathname === "/auth/callback" || pathname === "/reset-password") {
    return true;
  }
  if (pathname === "/auth/confirm") {
    return !emailConfirmed;
  }
  return false;
}
