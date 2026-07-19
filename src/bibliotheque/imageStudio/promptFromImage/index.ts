export type {
  ClothingDecision,
  ClothingInterviewStep,
  ClothingPieceType,
  ClothingRefItem,
  ClothingRefScope,
  PersonGender,
  PersonTraits,
  PromptFromImageContext,
} from "./types";
export { MAX_CLOTHING_REFS } from "./types";

export {
  analyzePersonFromImage,
  buildPersonTraitsFromFallback,
} from "./analyzePersonFromImage";
export { analyzeClothingRef } from "./analyzeClothingRef";

export {
  addClothingTextRef,
  applyClothingPieceType,
  applyClothingPieceTypeFallback,
  applyFullOutfitScope,
  applyPersonFallbackDetails,
  applyPersonFallbackGender,
  applyPersonTraits,
  beginClothingImageRef,
  buildClothingDecision,
  canAddMoreClothingRefs,
  chooseAddMoreClothing,
  chooseChangeOutfit,
  chooseKeepOutfit,
  chooseRestRandom,
  clothingRefsRemaining,
  createInitialClothingInterviewState,
  pieceTypeLabel,
  requestPieceTypeFallback,
  type ClothingInterviewState,
} from "./clothingInterview";

export {
  brandCampaignInitialStep,
  buildClothingNotesForPrompt,
  buildGuideApplyExtrasFromImageContext,
  ensureMentionTokensInPrompt,
  genderFromContext,
  outfitStudioInitialStep,
  physiqueFromContext,
  shouldSkipClothingProductStep,
  shouldSkipIdentitySteps,
  ugcSelfieInitialStep,
  ageRangeFromContext,
} from "./fromImageContext";
