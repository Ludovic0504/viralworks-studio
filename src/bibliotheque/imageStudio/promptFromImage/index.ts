export type {
  AccessoriesDecision,
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
  applyAccessoriesNotes,
  applyClothingPieceType,
  applyClothingPieceTypeFallback,
  applyFullOutfitScope,
  applyPersonFallbackDetails,
  applyPersonFallbackGender,
  applyPersonTraits,
  beginClothingImageRef,
  buildAccessoriesDecision,
  buildClothingDecision,
  canAddMoreClothingRefs,
  chooseAddMoreClothing,
  chooseChangeOutfit,
  chooseDropAccessories,
  chooseKeepAccessories,
  chooseKeepOutfit,
  chooseNoOtherAccessories,
  chooseRestRandom,
  chooseWantOtherAccessories,
  clothingRefsRemaining,
  createInitialClothingInterviewState,
  pieceTypeLabel,
  requestPieceTypeFallback,
  type ClothingInterviewState,
} from "./clothingInterview";

export {
  brandCampaignInitialStep,
  buildAccessoriesNotesForPrompt,
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
