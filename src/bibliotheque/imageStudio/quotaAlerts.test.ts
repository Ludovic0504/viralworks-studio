import { describe, expect, it } from "vitest";
import {
  getImageStudioQuotaState,
  IMAGE_STUDIO_WARNING_USED,
} from "./quotaAlerts";

describe("getImageStudioQuotaState", () => {
  it("reste à 200 crédits au départ", () => {
    const state = getImageStudioQuotaState(0);
    expect(state.remaining).toBe(200);
    expect(state.level).toBe("ok");
  });

  it("passe en warning à 100 images utilisées", () => {
    const state = getImageStudioQuotaState(IMAGE_STUDIO_WARNING_USED);
    expect(state.remaining).toBe(100);
    expect(state.usedPercent).toBe(50);
    expect(state.level).toBe("warning");
  });

  it("passe en exhausted à 200 images", () => {
    const state = getImageStudioQuotaState(200);
    expect(state.remaining).toBe(0);
    expect(state.level).toBe("exhausted");
  });
});
