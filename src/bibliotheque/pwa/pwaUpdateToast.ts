const TOAST_ID = "vws-pwa-update-toast";

/** Toast discret avant un rechargement PWA (DOM léger, hors React). */
export function showPwaUpdateToast(message = "Mise à jour de l'application…"): void {
  if (typeof document === "undefined") return;

  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = TOAST_ID;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:max(1.25rem,env(safe-area-inset-bottom))",
      "transform:translateX(-50%)",
      "z-index:99999",
      "padding:0.625rem 1rem",
      "border-radius:0.75rem",
      "background:rgba(12,17,22,0.94)",
      "border:1px solid rgba(52,211,153,0.35)",
      "color:#a7f3d0",
      "font:500 0.8125rem/1.35 system-ui,-apple-system,sans-serif",
      "box-shadow:0 8px 32px rgba(0,0,0,0.45)",
      "pointer-events:none",
      "opacity:0",
      "transition:opacity 180ms ease",
    ].join(";");
    document.body.appendChild(el);
  }

  el.textContent = message;
  requestAnimationFrame(() => {
    el!.style.opacity = "1";
  });
}
