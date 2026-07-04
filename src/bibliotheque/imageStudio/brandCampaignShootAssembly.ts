import type { TemplateSlotValues } from "./promptTemplateEngine";
import {
  BRAND_CAMPAIGN_PLACEHOLDERS,
  BRAND_CAMPAIGN_TEMPLATE_BODY,
  type BrandCampaignAmbianceId,
  type BrandCampaignCameraAngleId,
  type BrandCampaignFormatId,
  resolveBrandCampaignGaze,
} from "./brandCampaignShootConfig";
import { drawUgcPresentationPhysicalDefaults } from "./ugcPresentationPhysicalPools";
import {
  getUgcSelfieProfileById,
  getUgcSelfieProfilesForGender,
  type UgcSelfieGender,
  type UgcSelfieProfileId,
} from "./ugcSelfieProfiles";

type RandomFn = () => number;

function pickRandomProfileForGender(
  gender: UgcSelfieGender,
  randomFn: RandomFn = Math.random,
): UgcSelfieProfileId {
  const profiles = getUgcSelfieProfilesForGender(gender);
  const index = Math.floor(randomFn() * profiles.length);
  return profiles[index]?.id ?? profiles[0]?.id ?? "homme-30";
}

export function resolveBrandCampaignRandomPhysique(
  gender: UgcSelfieGender,
  randomFn: RandomFn = Math.random,
): string {
  const profileId = pickRandomProfileForGender(gender, randomFn);
  const profile = getUgcSelfieProfileById(profileId);
  const drawn = drawUgcPresentationPhysicalDefaults(profileId, randomFn);
  if (!profile) return drawn.physique;

  const sexWord = profile.sexEn;
  return `A ${profile.age}-year-old ${sexWord} with ${drawn.physique}`;
}

export type BrandCampaignAssemblyInput = {
  ambiancePrompt: string;
  cameraAngleBlock: string;
  distanceBlock: string;
  physique: string;
  action: string;
  gazeBlock: string;
  product: string;
  environment: string;
  ratio: string;
};

export function assembleBrandCampaignShootPrompt(input: BrandCampaignAssemblyInput): string {
  const product = input.product.trim();
  if (!product) return "";

  return BRAND_CAMPAIGN_TEMPLATE_BODY.replaceAll(
    BRAND_CAMPAIGN_PLACEHOLDERS.ambiance,
    input.ambiancePrompt,
  )
    .replaceAll(BRAND_CAMPAIGN_PLACEHOLDERS.cameraAngle, input.cameraAngleBlock)
    .replaceAll(BRAND_CAMPAIGN_PLACEHOLDERS.distance, input.distanceBlock)
    .replaceAll(BRAND_CAMPAIGN_PLACEHOLDERS.physique, input.physique)
    .replaceAll(BRAND_CAMPAIGN_PLACEHOLDERS.action, input.action)
    .replaceAll(BRAND_CAMPAIGN_PLACEHOLDERS.gaze, input.gazeBlock)
    .replaceAll(BRAND_CAMPAIGN_PLACEHOLDERS.product, product)
    .replaceAll(BRAND_CAMPAIGN_PLACEHOLDERS.environment, input.environment)
    .replaceAll(BRAND_CAMPAIGN_PLACEHOLDERS.ratio, input.ratio)
    .trim();
}

export function assembleBrandCampaignShootPromptFromSlots(slots: TemplateSlotValues): string {
  const product = (slots.productOutfit ?? "").trim();
  if (!product) return "";

  const cameraAngleId = (slots.cameraAngleId ?? "face-a-face") as BrandCampaignCameraAngleId;
  const gazeBlock =
    slots.gazeBlock?.trim() ||
    resolveBrandCampaignGaze(cameraAngleId, slots.gazeId as "vers-camera" | "regard-ailleurs" | null);

  const ratio =
    (slots.outputFormat ?? "feed") === "story" ? "9:16" : (slots.aspectRatio ?? "4:5");

  return assembleBrandCampaignShootPrompt({
    ambiancePrompt: slots.ambiancePrompt ?? "",
    cameraAngleBlock: slots.cameraAngleBlock ?? "",
    distanceBlock: slots.distanceBlock ?? "",
    physique: slots.physique ?? "",
    action: slots.action ?? "",
    gazeBlock,
    product,
    environment: slots.environment ?? "",
    ratio,
  });
}

export function isBrandCampaignShootGuideReady(slots: TemplateSlotValues): boolean {
  const gender = (slots.gender ?? "").trim();
  const ambianceId = (slots.ambianceId ?? "").trim();
  const cameraAngleBlock = (slots.cameraAngleBlock ?? "").trim();
  const distanceBlock = (slots.distanceBlock ?? "").trim();
  const physique = (slots.physique ?? "").trim();
  const action = (slots.action ?? "").trim();
  const gazeBlock = (slots.gazeBlock ?? "").trim();
  const productOutfit = (slots.productOutfit ?? "").trim();
  const environment = (slots.environment ?? "").trim();

  if (!gender || !ambianceId) return false;
  if (!cameraAngleBlock || !distanceBlock) return false;
  if (!physique || !action || !gazeBlock) return false;
  if (productOutfit.length < 2) return false;
  return Boolean(environment);
}

export function drawRandomBrandCampaignProfileId(
  gender: UgcSelfieGender,
  randomFn: RandomFn = Math.random,
): UgcSelfieProfileId {
  return pickRandomProfileForGender(gender, randomFn);
}

export function isBrandCampaignAmbianceId(value: string): value is BrandCampaignAmbianceId {
  return [
    "sportif-luxe",
    "minimaliste-luxe",
    "streetwear-energique",
    "romantique-nostalgique",
    "editorial-haute-couture",
  ].includes(value);
}

export function resolveBrandCampaignFormatRatio(
  formatId: BrandCampaignFormatId | string | null | undefined,
): string {
  return formatId === "story" ? "9:16" : "4:5";
}
