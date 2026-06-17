import { IMAGE_STUDIO_MONTHLY_LIMIT } from "@/bibliotheque/supabase/imageStudioQuota";

/** Popup d'alerte consommation : 80 % du quota utilisé (= 20 % restants). */
export const IMAGE_STUDIO_WARNING_USED_PERCENT = 80;
export const IMAGE_STUDIO_WARNING_REMAINING_PERCENT = 20;

export type ImageStudioQuotaLevel = "ok" | "warning" | "exhausted";

export type ImageStudioQuotaState = {
  used: number;
  remaining: number;
  limit: number;
  usedPercent: number;
  remainingPercent: number;
  level: ImageStudioQuotaLevel;
};

export function getImageStudioQuotaState(
  count: number,
  limit: number = IMAGE_STUDIO_MONTHLY_LIMIT,
): ImageStudioQuotaState {
  const safeLimit = Math.max(1, limit);
  const used = Math.min(Math.max(0, count), safeLimit);
  const remaining = Math.max(0, safeLimit - used);
  const usedPercent = Math.round((used / safeLimit) * 100);
  const remainingPercent = Math.round((remaining / safeLimit) * 100);

  let level: ImageStudioQuotaLevel = "ok";
  if (used >= safeLimit) level = "exhausted";
  else if (remainingPercent <= IMAGE_STUDIO_WARNING_REMAINING_PERCENT) level = "warning";

  return { used, remaining, limit: safeLimit, usedPercent, remainingPercent, level };
}

export function getImageStudioWarningUsedThreshold(limit: number): number {
  const safeLimit = Math.max(1, limit);
  return Math.ceil((safeLimit * IMAGE_STUDIO_WARNING_USED_PERCENT) / 100);
}

export function shouldShowImageStudioLowQuotaWarning(
  count: number,
  limit: number,
): boolean {
  const safeLimit = Math.max(1, limit);
  const used = Math.min(Math.max(0, count), safeLimit);
  if (used >= safeLimit) return false;
  return used >= getImageStudioWarningUsedThreshold(safeLimit);
}

export function imageStudioAlertStorageKey(
  kind: "warning" | "exhausted",
  resetAt: string | null,
): string {
  const cycle = resetAt ? resetAt.slice(0, 10) : "unknown";
  return `vw_image_studio_alert_${kind}_${cycle}`;
}

export function wasImageStudioAlertDismissed(
  kind: "warning" | "exhausted",
  resetAt: string | null,
): boolean {
  try {
    return sessionStorage.getItem(imageStudioAlertStorageKey(kind, resetAt)) === "1";
  } catch {
    return false;
  }
}

export function dismissImageStudioAlert(
  kind: "warning" | "exhausted",
  resetAt: string | null,
): void {
  try {
    sessionStorage.setItem(imageStudioAlertStorageKey(kind, resetAt), "1");
  } catch {
    // no-op
  }
}
