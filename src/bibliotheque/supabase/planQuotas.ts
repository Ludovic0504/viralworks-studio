import type { UserPlan } from "./premiumAccess";

export const IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT = 200;
export const IMAGE_STUDIO_MONTHLY_QUOTA_IMAGE_9 = 150;
export const SEEDANCE_MONTHLY_QUOTA_PRO = 5;
export const SEEDANCE_MONTHLY_QUOTA_PREMIUM = 15;
/** @deprecated Préférer getSeedanceMonthlyLimit(plan) */
export const SEEDANCE_MONTHLY_QUOTA = SEEDANCE_MONTHLY_QUOTA_PREMIUM;
export const AVATAR_STUDIO_MONTHLY_QUOTA = 5;
export const FULL_VIDEO_MONTHLY_QUOTA = 30;

export function getImageStudioMonthlyLimit(plan: UserPlan): number {
  return PLAN_QUOTAS[plan]?.nbPro ?? 0;
}

export function getSeedanceMonthlyLimit(plan: UserPlan): number {
  return PLAN_QUOTAS[plan]?.seedance ?? 0;
}

export const PLAN_QUOTAS: Record<
  UserPlan,
  {
    nbPro: number;
    seedance: number;
    avatars: number;
    fullVideo: number;
  }
> = {
  free: { nbPro: 0, seedance: 0, avatars: 0, fullVideo: 0 },
  image_9: { nbPro: IMAGE_STUDIO_MONTHLY_QUOTA_IMAGE_9, seedance: 0, avatars: 0, fullVideo: 0 },
  pro_59: {
    nbPro: IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT,
    seedance: SEEDANCE_MONTHLY_QUOTA_PRO,
    avatars: 5,
    fullVideo: 10,
  },
  premium_129: {
    nbPro: IMAGE_STUDIO_MONTHLY_QUOTA_DEFAULT,
    seedance: SEEDANCE_MONTHLY_QUOTA_PREMIUM,
    avatars: 5,
    fullVideo: 30,
  },
};
