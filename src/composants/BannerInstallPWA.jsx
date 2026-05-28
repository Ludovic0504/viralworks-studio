import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, Plus, Share, X } from "lucide-react";

const STORAGE_KEY = "pwa_banner_dismissed";
const MOBILE_MQ = "(max-width: 768px)";
const BANNER_HEIGHT_VAR = "--pwa-install-banner-height";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setBannerHeight(px) {
  document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, `${px}px`);
}

const IOS_INSTALL_STEPS = [
  {
    step: 1,
    Icon: Share,
    iconClassName: "text-blue-400",
    text: "Appuie sur le bouton Partager en bas",
    note: null,
  },
  {
    step: 2,
    Icon: ChevronUp,
    iconClassName: "text-gray-200",
    text: "Appuie sur « Voir plus » si besoin",
    note: null,
  },
  {
    step: 3,
    Icon: Plus,
    iconClassName: "text-gray-100",
    text: "Appuie sur « Sur l'écran d'accueil »",
    note: null,
  },
];

function IosInstallStep({ step, Icon, iconClassName, text, note }) {
  return (
    <li className="flex items-start gap-4">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center text-lg font-bold text-emerald-400"
        aria-hidden
      >
        {step}
      </span>
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 ${iconClassName}`}
      >
        <Icon size={22} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-base font-medium leading-snug text-white">{text}</p>
        {note ? <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{note}</p> : null}
      </div>
    </li>
  );
}

function IosInstallSheet({ open, onClose }) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[65] bg-black/60"
        aria-label="Fermer les instructions"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-ios-sheet-title"
        className="fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl border-t border-white/10 bg-[#161C23] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-white/10 pb-4">
          <h2 id="pwa-ios-sheet-title" className="text-lg font-bold text-white">
            Installer l&apos;app
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-gray-200"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
        <ol className="space-y-6">
          {IOS_INSTALL_STEPS.map((item) => (
            <IosInstallStep key={item.step} {...item} />
          ))}
        </ol>
      </div>
    </>
  );
}

export default function BannerInstallPWA() {
  const bannerRef = useRef(null);
  const deferredPromptRef = useRef(null);

  const [isMobile, setIsMobile] = useState(false);
  const [visible, setVisible] = useState(false);
  const [iosSheetOpen, setIosSheetOpen] = useState(false);
  const [canInstallAndroid, setCanInstallAndroid] = useState(false);

  const evaluateVisibility = useCallback(() => {
    const mobile = window.matchMedia(MOBILE_MQ).matches;
    setIsMobile(mobile);

    if (!mobile || isStandalone() || isDismissed()) {
      setVisible(false);
      return;
    }

    setVisible(true);
  }, []);

  useEffect(() => {
    evaluateVisibility();

    const mq = window.matchMedia(MOBILE_MQ);
    const onMqChange = () => evaluateVisibility();
    mq.addEventListener("change", onMqChange);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanInstallAndroid(true);
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanInstallAndroid(false);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      mq.removeEventListener("change", onMqChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [evaluateVisibility]);

  useEffect(() => {
    if (!visible) {
      setBannerHeight(0);
      return;
    }

    const el = bannerRef.current;
    if (!el) {
      setBannerHeight(0);
      return;
    }

    const updateHeight = () => {
      setBannerHeight(el.offsetHeight);
    };

    updateHeight();

    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);

    return () => {
      ro.disconnect();
      setBannerHeight(0);
    };
  }, [visible]);

  useEffect(() => {
    return () => setBannerHeight(0);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
    setIosSheetOpen(false);
  };

  const handleInstall = async () => {
    if (isIOS()) {
      setIosSheetOpen(true);
      return;
    }

    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    deferredPromptRef.current = null;
    setCanInstallAndroid(false);

    if (outcome === "accepted") {
      setVisible(false);
    }
  };

  const showInstallButton = isIOS() || canInstallAndroid;

  if (!isMobile || !visible) {
    return <IosInstallSheet open={iosSheetOpen} onClose={() => setIosSheetOpen(false)} />;
  }

  return (
    <>
      <div
        ref={bannerRef}
        role="region"
        aria-label="Installer l'application ViralWorks"
        className="fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-[#0C1116] pt-[env(safe-area-inset-top)]"
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <img
            src="/pwa-192x192.png"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 shrink-0"
            decoding="async"
          />
          <p className="min-w-0 flex-1 truncate text-sm text-gray-200">
            ViralWorks — Accès rapide
          </p>
          {showInstallButton ? (
            <button
              type="button"
              onClick={handleInstall}
              className="btn-vws-primary shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Installer
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-gray-200"
            aria-label="Fermer définitivement"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <IosInstallSheet open={iosSheetOpen} onClose={() => setIosSheetOpen(false)} />
    </>
  );
}
