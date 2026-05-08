type Fbq = ((...args: any[]) => void) & {
  queue?: any[];
  loaded?: boolean;
  version?: string;
  callMethod?: (...args: any[]) => void;
  push?: (...args: any[]) => void;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    __metaPixelInitialized?: boolean;
    __metaPixelLastTrackedUrl?: string;
  }
}

function getPixelId(): string {
  const raw = String(import.meta.env.VITE_META_PIXEL_ID ?? "").trim();
  return raw;
}

function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function ensureFbqStub(): Fbq {
  const w = window as Window;
  if (w.fbq) return w.fbq;

  const fbq: Fbq = function (...args: any[]) {
    if (fbq.callMethod) return fbq.callMethod(...args);
    fbq.queue = fbq.queue || [];
    fbq.queue.push(args);
  } as Fbq;

  fbq.queue = [];
  fbq.loaded = false;
  fbq.version = "2.0";
  fbq.push = fbq;

  w.fbq = fbq;
  w._fbq = fbq;
  return fbq;
}

export function initMetaPixel(): void {
  if (!canUseDom()) return;

  const pixelId = getPixelId();
  if (!pixelId) return;

  if (window.__metaPixelInitialized) return;
  window.__metaPixelInitialized = true;

  const fbq = ensureFbqStub();

  // Charger le script une seule fois
  if (!document.querySelector('script[data-meta-pixel="1"]')) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    s.setAttribute("data-meta-pixel", "1");
    document.head.appendChild(s);
  }

  try {
    fbq("init", pixelId);
  } catch {
    // no-op
  }
}

export function track(eventName: string, params?: Record<string, any>): void {
  if (!canUseDom()) return;
  const pixelId = getPixelId();
  if (!pixelId) return;
  if (!window.fbq) initMetaPixel();
  if (!window.fbq) return;

  try {
    if (params && Object.keys(params).length > 0) {
      window.fbq("track", eventName, params);
    } else {
      window.fbq("track", eventName);
    }
  } catch {
    // no-op
  }
}

export function trackPageView(url?: string): void {
  if (!canUseDom()) return;
  const pixelId = getPixelId();
  if (!pixelId) return;

  const safeUrl =
    typeof url === "string" && url.trim()
      ? url.trim()
      : `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (window.__metaPixelLastTrackedUrl === safeUrl) return;
  window.__metaPixelLastTrackedUrl = safeUrl;

  track("PageView");
}

