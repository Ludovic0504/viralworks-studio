const BLOCKING_OVERLAY_SELECTOR = [
  ".image-studio-settings-sheet-backdrop",
  ".image-studio-quota-modal-backdrop",
  ".image-studio-history-sheet-backdrop",
  ".image-studio-preview-backdrop",
  ".image-studio-prompts-modal",
  "[data-pwa-block-drawer='true']",
  "[aria-modal='true']",
].join(", ");

/** Empêche le swipe drawer si une popup / sheet est ouverte. */
export function hasPwaBlockingOverlay(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(BLOCKING_OVERLAY_SELECTOR) != null;
}
