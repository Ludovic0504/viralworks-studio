import type { ImageStudioAspectRatio } from "./imageStudioHistory";
import type { ImageStudioModelId } from "./generateImageStudio";
import { IMAGE_STUDIO_PROMPT_MAX_LENGTH } from "./promptMentions";

export type ImageStudioUiState = {
  feedScrollTop: number;
  thumbScrollTop: number;
  activeHistoryId: string | null;
  prompt: string;
  model: ImageStudioModelId;
  aspectRatio: ImageStudioAspectRatio;
  generationCount: number;
};

const STORAGE_PREFIX = "image_studio_ui:";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function isAspectRatio(value: unknown): value is ImageStudioAspectRatio {
  return value === "1:1" || value === "4:5" || value === "9:16" || value === "16:9";
}

function isModelId(value: unknown): value is ImageStudioModelId {
  return value === "nano_banana_pro" || value === "hailuo" || value === "gpt_image_2";
}

export function loadImageStudioUiState(userId: string): Partial<ImageStudioUiState> | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ImageStudioUiState>;
    if (!parsed || typeof parsed !== "object") return null;

    const state: Partial<ImageStudioUiState> = {};

    if (typeof parsed.feedScrollTop === "number" && parsed.feedScrollTop >= 0) {
      state.feedScrollTop = parsed.feedScrollTop;
    }
    if (typeof parsed.thumbScrollTop === "number" && parsed.thumbScrollTop >= 0) {
      state.thumbScrollTop = parsed.thumbScrollTop;
    }
    if (typeof parsed.activeHistoryId === "string" || parsed.activeHistoryId === null) {
      state.activeHistoryId = parsed.activeHistoryId;
    }
    if (typeof parsed.prompt === "string") {
      state.prompt = parsed.prompt.slice(0, IMAGE_STUDIO_PROMPT_MAX_LENGTH);
    }
    if (isModelId(parsed.model)) {
      state.model = parsed.model;
    }
    if (isAspectRatio(parsed.aspectRatio)) {
      state.aspectRatio = parsed.aspectRatio;
    }
    if ([1, 2, 3, 4].includes(Number(parsed.generationCount))) {
      state.generationCount = Number(parsed.generationCount);
    }

    return state;
  } catch {
    return null;
  }
}

export function saveImageStudioUiState(
  userId: string,
  state: Partial<ImageStudioUiState>,
): void {
  if (!userId) return;
  try {
    const current = loadImageStudioUiState(userId) ?? {};
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        feedScrollTop: 0,
        thumbScrollTop: 0,
        activeHistoryId: null,
        prompt: "",
        model: "nano_banana_pro",
        aspectRatio: "1:1",
        generationCount: 1,
        ...current,
        ...state,
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}
