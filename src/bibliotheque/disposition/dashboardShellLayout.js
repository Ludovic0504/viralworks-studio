/**
 * Profils de layout du shell dashboard — un profil par « zone » produit
 * pour éviter qu'un overflow-hidden d'une page immersive bloque les autres.
 */

const ACCUEIL_PADDING =
  "max-md:pt-[calc(4rem+var(--pwa-install-banner-height,0px))] md:pt-16";

const DEFAULT_PADDING =
  "pt-[calc(4rem+var(--promo-images-banner-height,0px))] max-md:pt-[calc(4rem+var(--promo-images-banner-height,0px)+var(--pwa-install-banner-height,0px))]";

/** Accueil — plein écran, sans scroll document. */
const ACCUEIL = {
  shellLayoutClass: "h-dvh overflow-hidden",
  contentAreaFlexClass: "min-h-0 flex-1",
  sidebarMainClassName: "flex-1 min-h-0 overflow-hidden",
  mainWrapperClass: "min-h-0 flex-1 overflow-hidden",
  mainShellTopPadding: ACCUEIL_PADDING,
  compactFooter: true,
};

/** Image Studio — sans scroll page sur mobile uniquement. */
const IMAGE_STUDIO = {
  shellLayoutClass: "min-h-dvh max-md:h-dvh max-md:overflow-hidden",
  contentAreaFlexClass: "max-md:min-h-0 max-md:flex-1 flex-none",
  sidebarMainClassName: "max-md:flex-1 max-md:min-h-0 max-md:overflow-hidden flex-none",
  mainWrapperClass: "max-md:min-h-0 max-md:flex-1 max-md:overflow-hidden flex-none",
  mainShellTopPadding: DEFAULT_PADDING,
  compactFooter: true,
};

/** Avatar IA (/studio) — immersif desktop ; scroll document sur mobile. */
const AVATAR_STUDIO = {
  shellLayoutClass: "min-h-dvh lg:h-dvh lg:overflow-hidden",
  contentAreaFlexClass: "max-lg:flex-none lg:min-h-0 lg:flex-1",
  sidebarMainClassName: "max-lg:flex-none lg:flex-1 lg:min-h-0 lg:overflow-hidden",
  mainWrapperClass: "max-lg:flex-none max-lg:min-h-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden",
  mainShellTopPadding: DEFAULT_PADDING,
  compactFooter: false,
};

/** ViralWorks Vidéo — création / édition : scroll document libre. */
const VIDEO_STUDIO = {
  shellLayoutClass: "min-h-dvh",
  contentAreaFlexClass: "flex-none",
  sidebarMainClassName: "flex-none",
  mainWrapperClass: "flex-none",
  mainShellTopPadding: DEFAULT_PADDING,
  compactFooter: false,
};

/** Playbook, Lab, profil, etc. — scroll document libre. */
const SCROLL = VIDEO_STUDIO;

function isAvatarStudioPath(pathname) {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

function isViralWorksVideoPath(pathname) {
  return pathname === "/viralworks" || pathname.startsWith("/viralworks/");
}

function isViralWorksImagePath(pathname) {
  return pathname === "/image-studio" || isAvatarStudioPath(pathname);
}

export function getDashboardShellLayout(pathname) {
  if (pathname === "/") {
    return { profile: "accueil", ...ACCUEIL };
  }

  if (pathname === "/image-studio") {
    return { profile: "image-studio", ...IMAGE_STUDIO };
  }

  if (isAvatarStudioPath(pathname)) {
    return { profile: "avatar-studio", ...AVATAR_STUDIO };
  }

  if (isViralWorksVideoPath(pathname) || pathname === "/edit-video") {
    return { profile: "video-studio", ...VIDEO_STUDIO };
  }

  return { profile: "scroll", ...SCROLL };
}

export { isViralWorksImagePath, isViralWorksVideoPath };
