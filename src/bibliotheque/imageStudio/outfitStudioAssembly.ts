import type { TemplateSlotValues } from "./promptTemplateEngine";
import { IMAGE_STUDIO_PRODUCT_MENTION_TOKEN } from "./imageStudioGuideApply";
import {
  PROMPT_OUTFIT_SELFIE,
  PROMPT_OUTFIT_STUDIO,
  inferOutfitPieceTypesFromFilenames,
  resolveEffectiveFramingId,
  resolveOutfitDescriptions,
  resolveOutfitStudioDefaultPoseId,
  resolveOutfitStudioDefaultStudioSub,
  resolveOutfitStudioEnvironment,
  resolveOutfitStudioExpressionDescription,
  resolveOutfitStudioFramingShotType,
  resolveOutfitStudioGenderLabel,
  resolveOutfitStudioHairDescription,
  resolveOutfitStudioLighting,
  resolveOutfitStudioMakeupOrGrooming,
  resolveOutfitStudioPoseDescription,
  resolveOutfitStudioPronouns,
  resolveOutfitStudioRatioText,
  resolveOutfitStudioSceneMood,
  type OutfitStudioFramingId,
  type OutfitStudioGenderId,
  type OutfitStudioPoseId,
  type OutfitStudioRatioId,
  type OutfitStudioSceneTypeId,
} from "./outfitStudioConfig";

type RandomFn = () => number;

export type OutfitStudioAssemblyInput = {
  genderId: OutfitStudioGenderId;
  sceneTypeId: OutfitStudioSceneTypeId;
  subContextId: string | null;
  framingId: OutfitStudioFramingId;
  ratioId: OutfitStudioRatioId;
  poseId: OutfitStudioPoseId | null;
  userNotes: string;
  imageCount: number;
  imageFilenames: string[];
  randomFn?: RandomFn;
};

function replaceAllPlaceholders(
  template: string,
  replacements: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`[${key}]`, value);
  }
  return result.trim();
}

export function assembleOutfitStudioPrompt(input: OutfitStudioAssemblyInput): string {
  const randomFn = input.randomFn ?? Math.random;
  const genderId = input.genderId;
  const sceneTypeId = input.sceneTypeId;
  const userNotes = input.userNotes.trim();
  const effectiveFramingId = resolveEffectiveFramingId(input.framingId, userNotes);
  const poseId = input.poseId ?? resolveOutfitStudioDefaultPoseId(genderId);
  const pronouns = resolveOutfitStudioPronouns(genderId);
  const pieceTypes = inferOutfitPieceTypesFromFilenames(input.imageFilenames);
  const subContextId =
    sceneTypeId === "studio-blanc"
      ? input.subContextId ?? resolveOutfitStudioDefaultStudioSub(randomFn)
      : input.subContextId;

  const outfit = resolveOutfitDescriptions({
    userNotes,
    imageCount: input.imageCount,
    pieceTypes,
    garmentToken: IMAGE_STUDIO_PRODUCT_MENTION_TOKEN,
    sceneTypeId,
    subContextId,
    genderId,
  });

  const environment = resolveOutfitStudioEnvironment(sceneTypeId, subContextId, randomFn);
  const lighting = resolveOutfitStudioLighting(sceneTypeId, subContextId, randomFn);
  const aspectRatio = resolveOutfitStudioRatioText(input.ratioId);

  const sharedReplacements = {
    GENDER: resolveOutfitStudioGenderLabel(genderId),
    PRONOUN_SUBJECT: pronouns.subject,
    PRONOUN_OBJECT: pronouns.object,
    POSE_DESCRIPTION: resolveOutfitStudioPoseDescription(genderId, poseId),
    EXPRESSION_DESCRIPTION: resolveOutfitStudioExpressionDescription(sceneTypeId),
    HAIR_DESCRIPTION: resolveOutfitStudioHairDescription(genderId, randomFn),
    OUTFIT_DESCRIPTION_TOP: outfit.top,
    OUTFIT_DESCRIPTION_BOTTOM: outfit.bottom,
    OUTFIT_DESCRIPTION_FOOTWEAR: outfit.footwear,
    ACCESSORIES_SUFFIX: outfit.accessoriesSuffix,
    MAKEUP_OR_GROOMING_DETAILS: resolveOutfitStudioMakeupOrGrooming(genderId),
    ENVIRONMENT_DESCRIPTION: environment,
    ASPECT_RATIO: aspectRatio,
  };

  if (sceneTypeId === "mirror-selfie") {
    return replaceAllPlaceholders(PROMPT_OUTFIT_SELFIE, {
      ...sharedReplacements,
      LIGHTING_SOURCE: lighting.mirrorSource ?? lighting.sourceAndDirection,
    });
  }

  return replaceAllPlaceholders(PROMPT_OUTFIT_STUDIO, {
    ...sharedReplacements,
    SCENE_MOOD: resolveOutfitStudioSceneMood(sceneTypeId, subContextId),
    FRAMING_SHOT_TYPE: resolveOutfitStudioFramingShotType(effectiveFramingId),
    LIGHTING_SOURCE_AND_DIRECTION: lighting.sourceAndDirection,
    LIGHTING_QUALITY: lighting.quality,
    COLOR_TEMPERATURE: lighting.colorTemperature,
  });
}

export function assembleOutfitStudioPromptFromSlots(
  slots: TemplateSlotValues,
  randomFn: RandomFn = Math.random,
): string {
  const genderId = (slots.genderId ?? "") as OutfitStudioGenderId;
  const sceneTypeId = (slots.sceneTypeId ?? "") as OutfitStudioSceneTypeId;
  const framingId = (slots.framingId ?? "plein-pied") as OutfitStudioFramingId;
  const ratioId = (slots.ratioId ?? "4-5") as OutfitStudioRatioId;

  if (!genderId || !sceneTypeId || !framingId || !ratioId) return "";

  const imageFilenames = (slots.clothingImageFilenames ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const imageCount = Number.parseInt(slots.clothingImageCount ?? "0", 10) || imageFilenames.length;

  const hasImages = imageCount > 0 || Boolean(slots.clothingImageUrl);
  const userNotes = (slots.clothingNotes ?? "").trim();
  if (!hasImages && userNotes.length < 2) return "";

  const poseRaw = (slots.poseId ?? "").trim();
  const poseId = poseRaw ? (poseRaw as OutfitStudioPoseId) : null;

  return assembleOutfitStudioPrompt({
    genderId,
    sceneTypeId,
    subContextId: (slots.subContextId ?? "").trim() || null,
    framingId,
    ratioId,
    poseId,
    userNotes,
    imageCount: hasImages ? Math.max(imageCount, 1) : 0,
    imageFilenames,
    randomFn,
  });
}

export function isOutfitStudioGuideReady(slots: TemplateSlotValues): boolean {
  const genderId = (slots.genderId ?? "").trim();
  const sceneTypeId = (slots.sceneTypeId ?? "").trim();
  const framingId = (slots.framingId ?? "").trim();
  const ratioId = (slots.ratioId ?? "").trim();
  const userNotes = (slots.clothingNotes ?? "").trim();
  const hasImage = Boolean(slots.clothingImageUrl) || Number(slots.clothingImageCount ?? 0) > 0;

  if (!genderId || !sceneTypeId || !framingId || !ratioId) return false;
  if (!hasImage && userNotes.length < 2) return false;

  if (sceneTypeId !== "studio-blanc" && !(slots.subContextId ?? "").trim()) {
    return false;
  }

  return true;
}
