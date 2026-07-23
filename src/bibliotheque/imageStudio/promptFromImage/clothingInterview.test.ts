import { describe, expect, it } from "vitest";
import {
  addClothingTextRef,
  applyAccessoriesNotes,
  applyClothingPieceType,
  applyFullOutfitScope,
  applyPersonTraits,
  beginClothingImageRef,
  buildAccessoriesDecision,
  buildClothingDecision,
  chooseChangeOutfit,
  chooseDropAccessories,
  chooseKeepAccessories,
  chooseKeepOutfit,
  chooseNoOtherAccessories,
  chooseRestRandom,
  chooseWantOtherAccessories,
  createInitialClothingInterviewState,
  MAX_CLOTHING_REFS,
} from "./clothingInterview";

describe("clothingInterview", () => {
  it("keeps avatar outfit then asks accessories", () => {
    let state = createInitialClothingInterviewState();
    state = applyPersonTraits(state, {
      gender: "femme",
      ageRange: "25-30",
      colors: "light skin, brown hair",
      physiquePrompt: "A 25-30-year-old woman, light skin, brown hair",
    });
    state = chooseKeepOutfit(state);
    expect(state.step).toBe("keep_accessories");
    expect(buildClothingDecision(state)).toEqual({ mode: "keep_avatar_outfit" });
  });

  it("keeps accessories and goes to pick_chatbot", () => {
    let state = createInitialClothingInterviewState();
    state = chooseKeepOutfit(state);
    state = chooseKeepAccessories(state);
    expect(state.step).toBe("pick_chatbot");
    expect(buildAccessoriesDecision(state)).toEqual({ mode: "keep" });
  });

  it("drops accessories then removes without replacement", () => {
    let state = createInitialClothingInterviewState();
    state = chooseKeepOutfit(state);
    state = chooseDropAccessories(state);
    expect(state.step).toBe("other_accessories");
    state = chooseNoOtherAccessories(state);
    expect(state.step).toBe("pick_chatbot");
    expect(buildAccessoriesDecision(state)).toEqual({ mode: "remove" });
  });

  it("replaces accessories with user notes", () => {
    let state = createInitialClothingInterviewState();
    state = chooseKeepOutfit(state);
    state = chooseDropAccessories(state);
    state = chooseWantOtherAccessories(state);
    expect(state.step).toBe("await_accessories_input");
    state = applyAccessoriesNotes(state, "sunglasses and a leather bag");
    expect(state.step).toBe("pick_chatbot");
    expect(buildAccessoriesDecision(state)).toEqual({
      mode: "replace",
      notes: "sunglasses and a leather bag",
    });
  });

  it("handles clothing image ref as haut then rest random then accessories", () => {
    let state = createInitialClothingInterviewState();
    state = applyPersonTraits(state, {
      gender: "homme",
      ageRange: "30s",
      colors: "tan skin",
      physiquePrompt: "A 30s-year-old man, tan skin",
    });
    state = chooseChangeOutfit(state);
    state = beginClothingImageRef(state, "https://example.com/top.jpg");
    state = applyClothingPieceType(state, "haut");
    expect(state.step).toBe("rest_of_outfit");
    expect(state.refs).toHaveLength(1);
    state = chooseRestRandom(state);
    expect(state.step).toBe("keep_accessories");
    const decision = buildClothingDecision(state);
    expect(decision.mode).toBe("change");
    if (decision.mode === "change") {
      expect(decision.restRandom).toBe(true);
      expect(decision.refs[0]?.pieceType).toBe("haut");
    }
  });

  it("asks full outfit scope for tenue_entiere", () => {
    let state = createInitialClothingInterviewState();
    state = chooseChangeOutfit(state);
    state = beginClothingImageRef(state, "https://example.com/look.jpg");
    state = applyClothingPieceType(state, "tenue_entiere");
    expect(state.step).toBe("full_outfit_scope");
    state = applyFullOutfitScope(state, "full_outfit");
    expect(state.refs[0]?.scope).toBe("full_outfit");
    expect(state.step).toBe("rest_of_outfit");
  });

  it("caps clothing refs at MAX_CLOTHING_REFS then asks accessories", () => {
    let state = createInitialClothingInterviewState();
    state = chooseChangeOutfit(state);
    for (let i = 0; i < MAX_CLOTHING_REFS; i += 1) {
      state = addClothingTextRef(state, `piece ${i + 1}`);
    }
    expect(state.refs).toHaveLength(MAX_CLOTHING_REFS);
    expect(state.step).toBe("keep_accessories");
    const before = state.refs.length;
    state = addClothingTextRef(state, "extra");
    expect(state.refs).toHaveLength(before);
  });
});
