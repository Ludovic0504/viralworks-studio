import { getImageUrlFromHistory } from "@/bibliotheque/imageStudio/imageStudioHistory";
import { getImageStudioUserPrompt } from "@/bibliotheque/imageStudio/promptMentions";

export const IMAGE_STUDIO_HISTORY_DRAG_MIME = "application/x-vw-image-studio-history";

export function serializeHistoryDragPayload(item) {
  const imageUrl = getImageUrlFromHistory(item);
  if (!imageUrl) return null;
  return JSON.stringify({
    historyId: item.id || null,
    imageUrl,
    prompt: getImageStudioUserPrompt(item?.input) || "",
  });
}

export function parseHistoryDragPayload(dataTransfer) {
  if (!dataTransfer) return null;
  try {
    const raw =
      dataTransfer.getData(IMAGE_STUDIO_HISTORY_DRAG_MIME) ||
      dataTransfer.getData("application/json") ||
      dataTransfer.getData("text/plain");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.imageUrl || typeof parsed.imageUrl !== "string") return null;
    return {
      historyId: typeof parsed.historyId === "string" ? parsed.historyId : null,
      imageUrl: parsed.imageUrl.trim(),
      prompt: typeof parsed.prompt === "string" ? parsed.prompt : "",
    };
  } catch {
    return null;
  }
}
