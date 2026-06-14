import type { UserPlan } from "./premiumAccess";

export const IMAGE_STUDIO_MONTHLY_QUOTA = 200;
export const SEEDANCE_MONTHLY_QUOTA = 15;
export const AVATAR_STUDIO_MONTHLY_QUOTA = 5;
export const FULL_VIDEO_MONTHLY_QUOTA = 30;

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
  image_9: { nbPro: 200, seedance: 0, avatars: 0, fullVideo: 0 },
  pro_59: { nbPro: 200, seedance: 15, avatars: 5, fullVideo: 0 },
  premium_129: { nbPro: 200, seedance: 15, avatars: 5, fullVideo: 30 },
};
