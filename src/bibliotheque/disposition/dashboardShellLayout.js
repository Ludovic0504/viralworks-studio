/**
 * Profils de layout du shell dashboard — un profil par « zone » produit
 * pour éviter qu'un overflow-hidden d'une page immersive bloque les autres.
 */

const ACCUEIL_PADDING =
  "max-md:pt-[calc(4rem+var(--pwa-install-banner-height,0px))] md:pt-16";

const DEFAULT_PADDING =
  "pt-[calc(4rem+var(--promo-images-banner-height,0px))] max-md:pt-[calc(4rem+var(--promo-images-banner-height,0px)+var(--pwa-install-banner-height,0px))]";

/** Gouttière horizontale partagée : header, pages, footer (alignement logo ↔ contenu). */
export const PAGE_SHELL_INNER_CLASS =
  "relative mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8";

/** Accueil — hero plein écran + section sous le fold scrollable. */
const ACCUEIL = {
  shellLayoutClass: "min-h-dvh",
  contentAreaFlexClass: "flex-none",
  sidebarMainClassName: "flex-none",
  mainWrapperClass: "flex-none",
  mainShellTopPadding: ACCUEIL_PADDING,
  compactFooter: true,
};

/** Image Studio — canva à hauteur fixe ; scroll interne au feed (mobile + desktop). */
const IMAGE_STUDIO = {
  shellLayoutClass: "min-h-dvh h-dvh overflow-hidden",
  contentAreaFlexClass: "min-h-0 flex-1",
  sidebarMainClassName: "flex-1 min-h-0 overflow-hidden",
  mainWrapperClass: "min-h-0 flex-1 overflow-hidden",
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

/** Communauté VWS — hauteur viewport fixe ; scroll interne à la liste des conversations. */
const COMMUNaute_VWS = {
  shellLayoutClass: "h-dvh max-h-dvh overflow-hidden",
  contentAreaFlexClass: "min-h-0 flex-1",
  sidebarMainClassName: "flex-1 min-h-0 overflow-hidden",
  mainWrapperClass: "min-h-0 flex-1 overflow-hidden flex flex-col",
  mainShellTopPadding: DEFAULT_PADDING,
  compactFooter: true,
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

function isCommunauteVwsPath(pathname) {
  return pathname === "/communaute-vws";
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

  if (isCommunauteVwsPath(pathname)) {
    return { profile: "communaute-vws", ...COMMUNaute_VWS };
  }

  if (isViralWorksVideoPath(pathname) || pathname === "/edit-video") {
    return { profile: "video-studio", ...VIDEO_STUDIO };
  }

  return { profile: "scroll", ...SCROLL };
}

export { isViralWorksImagePath, isViralWorksVideoPath };
