import {
  PACKSHOT_AMBIANCE_OPTIONS,
  PACKSHOT_BACKGROUND_OPTIONS,
  PACKSHOT_FORMAT_OPTIONS,
  type PackshotAmbianceId,
  type PackshotBackgroundId,
  type PackshotFormatId,
} from "./packshotDynamiqueConfig";

export type EditorialSceneTypeId = "bijou-porte" | "produit-tenu";

export type EditorialGenderId = "homme" | "femme";

export type EditorialJewelryZoneId =
  | "cou"
  | "poignet-main"
  | "oreille"
  | "doigt"
  | "cheville";

export type EditorialHeldZoneId = "visage-levres" | "joue" | "cou" | "main";

export type EditorialZoneId = EditorialJewelryZoneId | EditorialHeldZoneId;

export type EditorialFramingId = "macro" | "mi-corps" | "corps-entier";

export type EditorialPostureId = "debout" | "assise";

export type EditorialButtonOption<T extends string = string> = {
  id: T;
  label: string;
};

export const EDITORIAL_SCENE_TYPE_OPTIONS: EditorialButtonOption<EditorialSceneTypeId>[] = [
  { id: "bijou-porte", label: "Bijou porté" },
  { id: "produit-tenu", label: "Produit tenu en main" },
];

export const EDITORIAL_GENDER_OPTIONS: EditorialButtonOption<EditorialGenderId>[] = [
  { id: "femme", label: "Femme" },
  { id: "homme", label: "Homme" },
];

export const EDITORIAL_JEWELRY_ZONE_OPTIONS: EditorialButtonOption<EditorialJewelryZoneId>[] = [
  { id: "cou", label: "Cou" },
  { id: "poignet-main", label: "Poignet-main" },
  { id: "oreille", label: "Oreille" },
  { id: "doigt", label: "Doigt" },
  { id: "cheville", label: "Cheville" },
];

export const EDITORIAL_HELD_ZONE_OPTIONS: EditorialButtonOption<EditorialHeldZoneId>[] = [
  { id: "visage-levres", label: "Visage-lèvres" },
  { id: "joue", label: "Joue" },
  { id: "cou", label: "Cou" },
  { id: "main", label: "Main" },
];

export const EDITORIAL_FRAMING_OPTIONS: EditorialButtonOption<EditorialFramingId>[] = [
  { id: "macro", label: "Macro" },
  { id: "mi-corps", label: "Mi-corps" },
  { id: "corps-entier", label: "Corps entier" },
];

export const EDITORIAL_POSTURE_OPTIONS: EditorialButtonOption<EditorialPostureId>[] = [
  { id: "debout", label: "Debout" },
  { id: "assise", label: "Assise" },
];

export const EDITORIAL_BACKGROUND_OPTIONS = PACKSHOT_BACKGROUND_OPTIONS;
export const EDITORIAL_AMBIANCE_OPTIONS = PACKSHOT_AMBIANCE_OPTIONS;
export const EDITORIAL_FORMAT_OPTIONS = PACKSHOT_FORMAT_OPTIONS;

export const EDITORIAL_HERO_IMAGE =
  "/image-studio/templates/editorial-worn-held/editorial-worn-held.png";

export type EditorialZoneProfile = {
  zoneCorps: string;
  defaultPosture: EditorialPostureId;
  defaultGesture: string;
  positionProduit: string;
  detailPresentationZone: string;
  detailPerspective: string;
  orientationRegard: string;
  cadrageDetail: string;
  detailPeauNaturel: string;
};

const JEWELRY_ZONE_PROFILES: Record<EditorialJewelryZoneId, EditorialZoneProfile> = {
  cou: {
    zoneCorps: "cou et clavicule",
    defaultPosture: "debout",
    defaultGesture: "tête légèrement tournée de trois-quarts, menton levé",
    positionProduit: "autour du cou et de la clavicule",
    detailPresentationZone:
      "col dégagé et clavicules visibles pour exposer le bijou sur toute sa longueur",
    detailPerspective:
      "tête légèrement inclinée et épaules orientées vers l'objectif, rapprochant le cou du premier plan",
    orientationRegard: "regard légèrement déporté, hors champ ou vers l'objectif selon la pose",
    cadrageDetail: "cadrage serré sur le cou et la clavicule, bijou comme point focal",
    detailPeauNaturel: "texture fine du cou et des clavicules",
  },
  "poignet-main": {
    zoneCorps: "main et poignet",
    defaultPosture: "debout",
    defaultGesture: "main remontant délicatement dans les cheveux",
    positionProduit: "autour du poignet",
    detailPresentationZone:
      "poignet tourné vers l'objectif, main légèrement ouverte pour dégager le bijou sur toute sa longueur",
    detailPerspective:
      "main levée rapprochant le poignet du visage et de l'objectif par rapport au reste du corps",
    orientationRegard: "regard doux vers l'objectif ou légèrement déporté",
    cadrageDetail: "cadrage serré sur la main et le poignet, bijou comme point focal",
    detailPeauNaturel: "texture réaliste du dos de la main, des tendons et du poignet",
  },
  oreille: {
    zoneCorps: "oreille et mâchoire",
    defaultPosture: "debout",
    defaultGesture: "tête inclinée, cheveux dégagés d'une main",
    positionProduit: "à l'oreille",
    detailPresentationZone:
      "cheveux écartés et profil dégagé pour exposer le bijou d'oreille sans obstruction",
    detailPerspective:
      "tête inclinée et profil tourné vers l'objectif, rapprochant l'oreille du premier plan",
    orientationRegard: "regard déporté ou vers l'objectif selon l'inclinaison de la tête",
    cadrageDetail: "cadrage serré sur l'oreille et la mâchoire, bijou comme point focal",
    detailPeauNaturel: "texture fine de l'oreille, de la mâchoire et du cou",
  },
  doigt: {
    zoneCorps: "main et doigts",
    defaultPosture: "debout",
    defaultGesture: "mains posées sur le sommet de la tête, doigts visibles",
    positionProduit: "au doigt",
    detailPresentationZone:
      "doigts légèrement écartés et paumes orientées vers l'objectif pour dégager la bague",
    detailPerspective:
      "mains levées au-dessus de la tête, rapprochant les doigts de l'objectif par rapport au corps",
    orientationRegard: "regard vers l'objectif ou légèrement baissé",
    cadrageDetail: "cadrage serré sur les mains et les doigts, bijou comme point focal",
    detailPeauNaturel: "texture réaliste des doigts, des jointures et des ongles",
  },
  cheville: {
    zoneCorps: "cheville et pied",
    defaultPosture: "assise",
    defaultGesture:
      "assise, jambe croisée ramenant la cheville vers l'avant, pied légèrement soulevé, orteils pointés, cheville tournée pour dégager la chaîne du bijou",
    positionProduit: "autour de la cheville",
    detailPresentationZone:
      "pied tourné et cheville orientée vers l'objectif pour dégager le bijou sur toute sa longueur",
    detailPerspective:
      "jambe croisée ramenant la cheville vers l'avant et légèrement vers l'objectif par rapport au reste du corps",
    orientationRegard: "regard déporté ou vers l'objectif selon la posture assise",
    cadrageDetail: "cadrage serré sur la cheville et le pied, bijou comme point focal",
    detailPeauNaturel: "texture réaliste de la cheville, du pied et des orteils",
  },
};

const HELD_ZONE_PROFILES: Record<EditorialHeldZoneId, EditorialZoneProfile> = {
  "visage-levres": {
    zoneCorps: "visage et lèvres",
    defaultPosture: "debout",
    defaultGesture: "produit tenu à hauteur de bouche, tête légèrement inclinée",
    positionProduit: "près des lèvres",
    detailPresentationZone:
      "produit tenu à distance naturelle des lèvres, étiquette et forme bien visibles",
    detailPerspective:
      "tête légèrement inclinée vers l'objectif, rapprochant le visage et le produit du premier plan",
    orientationRegard: "regard vers l'objectif ou légèrement déporté",
    cadrageDetail: "cadrage serré sur le visage et le produit tenu près des lèvres",
    detailPeauNaturel: "texture réaliste du visage, des lèvres et de la peau environnante",
  },
  joue: {
    zoneCorps: "joue et pommette",
    defaultPosture: "debout",
    defaultGesture: "produit tenu près de la joue, regard vers l'objectif",
    positionProduit: "près de la joue",
    detailPresentationZone:
      "produit tenu à distance naturelle de la joue, packaging et forme bien visibles",
    detailPerspective:
      "tête légèrement tournée vers l'objectif, rapprochant la joue et le produit du premier plan",
    orientationRegard: "regard direct vers l'objectif",
    cadrageDetail: "cadrage serré sur la joue et le produit tenu à proximité",
    detailPeauNaturel: "texture réaliste de la joue, de la pommette et du visage",
  },
  cou: {
    zoneCorps: "cou et clavicule",
    defaultPosture: "debout",
    defaultGesture: "tête penchée, produit tenu près du cou",
    positionProduit: "près du cou",
    detailPresentationZone:
      "produit tenu à distance naturelle du cou, forme et détails bien visibles",
    detailPerspective:
      "tête penchée et épaules orientées vers l'objectif, rapprochant le cou et le produit du premier plan",
    orientationRegard: "regard déporté ou vers l'objectif",
    cadrageDetail: "cadrage serré sur le cou et le produit tenu à proximité",
    detailPeauNaturel: "texture fine du cou et des clavicules",
  },
  main: {
    zoneCorps: "main et avant-bras",
    defaultPosture: "debout",
    defaultGesture: "produit tenu dans une main, avant-bras visible",
    positionProduit: "dans une main",
    detailPresentationZone:
      "main légèrement ouverte, avant-bras visible, produit tenu de façon à exposer sa forme entière",
    detailPerspective:
      "main et avant-bras levés vers l'objectif, rapprochant le produit du premier plan par rapport au corps",
    orientationRegard: "regard vers l'objectif ou légèrement déporté",
    cadrageDetail: "cadrage serré sur la main, l'avant-bras et le produit tenu",
    detailPeauNaturel: "texture réaliste de la main, de l'avant-bras et du poignet",
  },
};

const FRAMING_UNAVAILABLE: Partial<
  Record<EditorialJewelryZoneId, Partial<Record<EditorialFramingId, boolean>>>
> = {
  doigt: { "corps-entier": false },
  oreille: { "corps-entier": false },
};

export function resolveEditorialZoneProfile(
  sceneTypeId: EditorialSceneTypeId,
  zoneId: EditorialZoneId,
): EditorialZoneProfile | null {
  if (sceneTypeId === "bijou-porte") {
    return JEWELRY_ZONE_PROFILES[zoneId as EditorialJewelryZoneId] ?? null;
  }
  return HELD_ZONE_PROFILES[zoneId as EditorialHeldZoneId] ?? null;
}

export function isEditorialFramingAvailable(
  sceneTypeId: EditorialSceneTypeId,
  zoneId: EditorialZoneId,
  framingId: EditorialFramingId,
): boolean {
  if (sceneTypeId === "produit-tenu") return true;
  const zoneRestrictions = FRAMING_UNAVAILABLE[zoneId as EditorialJewelryZoneId];
  if (!zoneRestrictions) return true;
  return zoneRestrictions[framingId] !== false;
}

export function getAvailableEditorialFramingOptions(
  sceneTypeId: EditorialSceneTypeId,
  zoneId: EditorialZoneId,
): EditorialButtonOption<EditorialFramingId>[] {
  return EDITORIAL_FRAMING_OPTIONS.filter((option) =>
    isEditorialFramingAvailable(sceneTypeId, zoneId, option.id),
  );
}

export function resolveEditorialModelDescription(genderId: EditorialGenderId): string {
  if (genderId === "homme") {
    return "Un homme au teint naturel et chaleureux, mâchoire marquée";
  }
  return "Une femme au teint naturel et chaleureux, traits fins";
}

export function resolveEditorialTenueSimpleDefaut(): string {
  return "en tenue sobre et épurée aux tons neutres";
}

export const EDITORIAL_SEATED_SURFACES = [
  "un tabouret haut",
  "le bord d'un rebord de fenêtre",
  "le sol",
  "une chaise minimaliste",
] as const;

export function resolveEditorialSeatedSurface(): string {
  const index = Math.floor(Math.random() * EDITORIAL_SEATED_SURFACES.length);
  return EDITORIAL_SEATED_SURFACES[index] ?? EDITORIAL_SEATED_SURFACES[0];
}

export function resolveEditorialFormatRatio(
  formatId: PackshotFormatId | string | null | undefined,
): string {
  if (formatId === "carre-1-1") return "1:1";
  if (formatId === "story-9-16") return "9:16";
  return "4:5";
}

export function resolveEditorialProportion(framingId: EditorialFramingId): string {
  switch (framingId) {
    case "macro":
      return "10-15";
    case "mi-corps":
      return "4-7";
    case "corps-entier":
      return "1-3";
    default:
      return "4-7";
  }
}

export function resolveEditorialFramingDescription(framingId: EditorialFramingId): string {
  switch (framingId) {
    case "macro":
      return "macro gros plan";
    case "mi-corps":
      return "mi-corps";
    case "corps-entier":
      return "corps entier";
    default:
      return "mi-corps";
  }
}

export type EditorialCameraSettings = {
  focale: number;
  ouverture: string;
};

export function resolveEditorialCamera(framingId: EditorialFramingId): EditorialCameraSettings {
  switch (framingId) {
    case "macro":
      return { focale: 100, ouverture: "2.8" };
    case "mi-corps":
      return { focale: 85, ouverture: "2.8" };
    case "corps-entier":
      return { focale: 50, ouverture: "4.0" };
    default:
      return { focale: 85, ouverture: "2.8" };
  }
}

export function isEditorialJewelryZone(zoneId: EditorialZoneId): zoneId is EditorialJewelryZoneId {
  return (EDITORIAL_JEWELRY_ZONE_OPTIONS as EditorialButtonOption<EditorialJewelryZoneId>[]).some(
    (option) => option.id === zoneId,
  );
}

export type EditorialAmbianceId = PackshotAmbianceId;
export type EditorialBackgroundId = PackshotBackgroundId;
export type EditorialFormatId = PackshotFormatId;
