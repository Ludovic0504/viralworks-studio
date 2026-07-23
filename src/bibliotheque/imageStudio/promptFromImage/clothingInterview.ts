import type {
  AccessoriesDecision,
  ClothingDecision,
  ClothingInterviewStep,
  ClothingPieceType,
  ClothingRefItem,
  ClothingRefScope,
  PersonGender,
  PersonTraits,
} from "./types";
import { MAX_CLOTHING_REFS as MAX_REFS } from "./types";

export { MAX_REFS as MAX_CLOTHING_REFS };

export type ClothingInterviewState = {
  step: ClothingInterviewStep;
  personTraits: PersonTraits | null;
  keepOutfit: boolean | null;
  refs: ClothingRefItem[];
  restRandom: boolean;
  notes: string;
  /** Ref en cours d’analyse (image) */
  pendingRefImageUrl: string | null;
  pendingPieceType: ClothingPieceType | null;
  accessories: AccessoriesDecision | null;
};

export function createInitialClothingInterviewState(): ClothingInterviewState {
  return {
    step: "analyzing_person",
    personTraits: null,
    keepOutfit: null,
    refs: [],
    restRandom: false,
    notes: "",
    pendingRefImageUrl: null,
    pendingPieceType: null,
    accessories: null,
  };
}

function nextRefId(): string {
  return `cref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function canAddMoreClothingRefs(state: ClothingInterviewState): boolean {
  return state.refs.length < MAX_REFS;
}

export function clothingRefsRemaining(state: ClothingInterviewState): number {
  return Math.max(0, MAX_REFS - state.refs.length);
}

export function applyPersonTraits(
  state: ClothingInterviewState,
  traits: PersonTraits,
): ClothingInterviewState {
  return {
    ...state,
    personTraits: traits,
    step: "keep_or_change",
  };
}

export function applyPersonFallbackGender(
  state: ClothingInterviewState,
  gender: PersonGender,
): ClothingInterviewState {
  return {
    ...state,
    personTraits: {
      gender,
      ageRange: "",
      colors: "",
      physiquePrompt: "",
      fromFallback: true,
    },
    step: "fallback_age_colors",
  };
}

export function applyPersonFallbackDetails(
  state: ClothingInterviewState,
  ageRange: string,
  colors: string,
  buildTraits: (input: {
    gender: PersonGender;
    ageRange: string;
    colors: string;
  }) => PersonTraits,
): ClothingInterviewState {
  const gender = state.personTraits?.gender ?? "femme";
  return {
    ...state,
    personTraits: buildTraits({ gender, ageRange, colors }),
    step: "keep_or_change",
  };
}

export function chooseKeepOutfit(state: ClothingInterviewState): ClothingInterviewState {
  return {
    ...state,
    keepOutfit: true,
    refs: [],
    restRandom: false,
    notes: "",
    step: "keep_accessories",
  };
}

export function chooseChangeOutfit(state: ClothingInterviewState): ClothingInterviewState {
  return {
    ...state,
    keepOutfit: false,
    step: "await_clothing_input",
  };
}

export function chooseKeepAccessories(state: ClothingInterviewState): ClothingInterviewState {
  return {
    ...state,
    accessories: { mode: "keep" },
    step: "pick_chatbot",
  };
}

export function chooseDropAccessories(state: ClothingInterviewState): ClothingInterviewState {
  return {
    ...state,
    accessories: null,
    step: "other_accessories",
  };
}

export function chooseNoOtherAccessories(state: ClothingInterviewState): ClothingInterviewState {
  return {
    ...state,
    accessories: { mode: "remove" },
    step: "pick_chatbot",
  };
}

export function chooseWantOtherAccessories(state: ClothingInterviewState): ClothingInterviewState {
  return {
    ...state,
    step: "await_accessories_input",
  };
}

export function applyAccessoriesNotes(
  state: ClothingInterviewState,
  notes: string,
): ClothingInterviewState {
  const trimmed = notes.trim();
  return {
    ...state,
    accessories: trimmed
      ? { mode: "replace", notes: trimmed }
      : { mode: "remove" },
    step: "pick_chatbot",
  };
}

export function beginClothingImageRef(
  state: ClothingInterviewState,
  imageUrl: string,
): ClothingInterviewState {
  if (!canAddMoreClothingRefs(state)) return state;
  return {
    ...state,
    pendingRefImageUrl: imageUrl,
    pendingPieceType: null,
    step: "analyzing_clothing_ref",
  };
}

export function applyClothingPieceType(
  state: ClothingInterviewState,
  pieceType: ClothingPieceType,
): ClothingInterviewState {
  if (pieceType === "tenue_entiere") {
    return {
      ...state,
      pendingPieceType: pieceType,
      step: "full_outfit_scope",
    };
  }
  return commitPendingImageRef(state, pieceType, "piece");
}

export function applyClothingPieceTypeFallback(
  state: ClothingInterviewState,
  pieceType: ClothingPieceType,
): ClothingInterviewState {
  return applyClothingPieceType(state, pieceType);
}

export function requestPieceTypeFallback(state: ClothingInterviewState): ClothingInterviewState {
  return { ...state, step: "fallback_piece_type" };
}

export function applyFullOutfitScope(
  state: ClothingInterviewState,
  scope: ClothingRefScope,
): ClothingInterviewState {
  const pieceType = state.pendingPieceType ?? "tenue_entiere";
  return commitPendingImageRef(state, pieceType, scope);
}

function commitPendingImageRef(
  state: ClothingInterviewState,
  pieceType: ClothingPieceType,
  scope: ClothingRefScope,
): ClothingInterviewState {
  const imageUrl = state.pendingRefImageUrl;
  if (!imageUrl) {
    return { ...state, step: "await_clothing_input" };
  }
  const item: ClothingRefItem = {
    id: nextRefId(),
    source: "image",
    imageUrl,
    pieceType,
    scope,
  };
  const refs = [...state.refs, item];
  const next: ClothingInterviewState = {
    ...state,
    refs,
    pendingRefImageUrl: null,
    pendingPieceType: null,
    step: refs.length >= MAX_REFS ? "keep_accessories" : "rest_of_outfit",
  };
  return next;
}

export function addClothingTextRef(
  state: ClothingInterviewState,
  text: string,
): ClothingInterviewState {
  const trimmed = text.trim();
  if (!trimmed || !canAddMoreClothingRefs(state)) return state;
  const item: ClothingRefItem = {
    id: nextRefId(),
    source: "text",
    text: trimmed,
  };
  const notes = state.notes ? `${state.notes}; ${trimmed}` : trimmed;
  const refs = [...state.refs, item];
  return {
    ...state,
    refs,
    notes,
    step: refs.length >= MAX_REFS ? "keep_accessories" : "rest_of_outfit",
  };
}

export function chooseRestRandom(state: ClothingInterviewState): ClothingInterviewState {
  return {
    ...state,
    restRandom: true,
    step: "keep_accessories",
  };
}

export function chooseAddMoreClothing(state: ClothingInterviewState): ClothingInterviewState {
  if (!canAddMoreClothingRefs(state)) {
    return { ...state, step: "keep_accessories" };
  }
  return {
    ...state,
    step: "await_clothing_input",
  };
}

export function buildClothingDecision(state: ClothingInterviewState): ClothingDecision {
  if (state.keepOutfit) {
    return { mode: "keep_avatar_outfit" };
  }
  return {
    mode: "change",
    refs: state.refs,
    restRandom: state.restRandom,
    notes: state.notes,
  };
}

export function buildAccessoriesDecision(
  state: ClothingInterviewState,
): AccessoriesDecision | null {
  return state.accessories;
}

export function pieceTypeLabel(pieceType: ClothingPieceType): string {
  switch (pieceType) {
    case "haut":
      return "un haut";
    case "bas":
      return "un bas";
    case "chaussures":
      return "des chaussures";
    case "tenue_entiere":
      return "une tenue entière";
    default:
      return "un vêtement";
  }
}
