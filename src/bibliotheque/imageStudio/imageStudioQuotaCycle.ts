/** Jours avant la fin du mois où l'avis de renouvellement s'affiche. */
export const IMAGE_STUDIO_RENEWAL_NOTICE_DAYS = 4;

export function getCurrentMonthStart(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function getNextImageStudioQuotaResetDate(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

export function formatImageStudioQuotaResetDate(
  date: Date,
  locale = "fr-FR",
): string {
  return date.toLocaleDateString(locale, { day: "numeric", month: "long" });
}

export function getDaysUntilImageStudioQuotaReset(date = new Date()): number {
  const reset = getNextImageStudioQuotaResetDate(date);
  const ms = reset.getTime() - date.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function isImageStudioQuotaRenewalNoticePeriod(
  daysBeforeEnd = IMAGE_STUDIO_RENEWAL_NOTICE_DAYS,
  date = new Date(),
): boolean {
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() > lastDayOfMonth - daysBeforeEnd;
}

export function imageStudioRenewalNoticeStorageKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `vw_image_studio_renewal_notice_${y}-${m}`;
}

export function wasImageStudioRenewalNoticeDismissed(date = new Date()): boolean {
  try {
    return sessionStorage.getItem(imageStudioRenewalNoticeStorageKey(date)) === "1";
  } catch {
    return false;
  }
}

export function dismissImageStudioRenewalNotice(date = new Date()): void {
  try {
    sessionStorage.setItem(imageStudioRenewalNoticeStorageKey(date), "1");
  } catch {
    // no-op
  }
}
