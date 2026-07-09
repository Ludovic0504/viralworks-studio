import type { TemplateSlotValues } from "./promptTemplateEngine";
import {
  enrichProfileForUsage,
  inferPackshotFlyingElements,
  inferPackshotMaterialHints,
  inferPackshotUsageContext,
  isPackshotLevitationPosition,
  isPackshotPosedTemplate,
  resolvePackshotAmbianceProfile,
  resolvePackshotFormatRatio,
  type PackshotAmbianceId,
  type PackshotBackgroundId,
  type PackshotFormatId,
  type PackshotInteractionId,
  type PackshotPositionId,
  type PackshotProductStateId,
  type PackshotUsageContextId,
} from "./packshotDynamiqueConfig";

export type PackshotAssemblyInput = {
  productDescription: string;
  positionId: PackshotPositionId;
  backgroundId: PackshotBackgroundId;
  ambianceId: PackshotAmbianceId | null;
  customAmbiance: string | null;
  interactionId: PackshotInteractionId;
  productStateId: PackshotProductStateId;
  formatId: PackshotFormatId;
};

type ResolvedCamera = {
  focale: number;
  ouverture: string;
  proportionCadre: number;
};

function resolveCamera(positionId: PackshotPositionId, ratio: string): ResolvedCamera {
  if (positionId === "allonge") {
    return { focale: 60, ouverture: "2.0", proportionCadre: 38 };
  }
  if (positionId === "levitation") {
    return { focale: 75, ouverture: "2.8", proportionCadre: 35 };
  }
  if (positionId === "debout-incline") {
    return { focale: 85, ouverture: "2.8", proportionCadre: 40 };
  }
  if (ratio === "1:1") {
    return { focale: 90, ouverture: "4.0", proportionCadre: 42 };
  }
  return { focale: 85, ouverture: "2.8", proportionCadre: 42 };
}

function resolveLightingType(backgroundId: PackshotBackgroundId): string {
  return backgroundId === "neutre"
    ? "Flash studio / softbox"
    : "Lumière mixte (naturelle + appoint)";
}

function resolveLightDirection(positionId: PackshotPositionId): string {
  return positionId === "levitation"
    ? "Contre-jour (backlight)"
    : "Latérale douce (45°)";
}

function resolveShadowPresence(positionId: PackshotPositionId): string {
  return positionId === "levitation"
    ? "ombre portée diffuse sous le produit flottant"
    : "ombres douces et naturelles sous le produit";
}

function buildBlocSujet(
  productDescription: string,
  positionId: PackshotPositionId,
  productStateId: PackshotProductStateId,
): string {
  const product = productDescription.trim();
  const positionDetail = resolvePositionDetail(positionId);

  if (productStateId === "ouvert-entame") {
    const opening = inferOpeningDetail(product);
    const interior = inferInteriorTexture(product);
    return `Un ${product}, ${positionDetail} au centre du cadre, ${opening} visible à côté, ${interior} apparente.`;
  }

  const surfaceDetail = inferClosedSurfaceDetail(product);
  return `Un ${product}, ${positionDetail} au centre du cadre, ${surfaceDetail}.`;
}

function resolvePositionDetail(positionId: PackshotPositionId): string {
  switch (positionId) {
    case "debout-droit":
      return "posé debout";
    case "debout-incline":
      return "légèrement incliné";
    case "allonge":
      return "couché sur le côté";
    case "levitation":
      return "en lévitation stylisée";
    default:
      return "mis en scène";
  }
}

function inferOpeningDetail(product: string): string {
  if (/\b(bougie|candle)\b/i.test(product)) return "couvercle en bois retiré";
  if (/\b(boisson|bouteille|bottle|canette|can)\b/i.test(product)) return "bouchon ou capsule retiré";
  if (/\b(cosmétique|crème|cream|pot|jar)\b/i.test(product)) return "couvercle retiré";
  if (/\b(boîte|box|emballage)\b/i.test(product)) return "emballage partiellement ouvert";
  return "élément d'ouverture retiré";
}

function inferInteriorTexture(product: string): string {
  if (/\b(bougie|candle|cire|wax)\b/i.test(product)) return "cire végétale chaude et mèche allumée";
  if (/\b(boisson|bottle|jus|drink)\b/i.test(product)) return "liquide intérieur";
  if (/\b(cosmétique|crème|cream)\b/i.test(product)) return "texture intérieure du produit";
  return "contenu intérieur";
}

function inferClosedSurfaceDetail(product: string): string {
  if (/\b(verre|glass|bouteille|bottle|canette)\b/i.test(product)) {
    return "étiquette nette et matière du contenant bien visible";
  }
  if (/\b(bois|wood|carton|kraft)\b/i.test(product)) {
    return "texture de surface naturelle bien définie";
  }
  return "détails de surface et finitions du produit bien visibles";
}

function buildBlocSurface(
  positionId: PackshotPositionId,
  profile: ReturnType<typeof resolvePackshotAmbianceProfile>,
): string {
  const surface = profile.surfaceType;
  const support = profile.elementAppui;

  switch (positionId) {
    case "debout-droit":
      return `Le produit repose verticalement sur ${surface}, stable et centré, avec un reflet flou du produit visible en dessous.`;
    case "debout-incline":
      return `Le produit est légèrement incliné, appuyé contre ${support}, créant un angle naturel d'environ 12 degrés, posé sur ${surface}.`;
    case "allonge":
      return `Le produit est couché sur le côté sur ${surface}, son étiquette tournée vers la caméra, avec un léger reflet de contact visible.`;
    default:
      return "";
  }
}

function buildBlocOmbrePortee(
  profile: ReturnType<typeof resolvePackshotAmbianceProfile>,
): string {
  return `Le produit flotte à mi-hauteur au-dessus de ${profile.surfaceType}, une ombre portée douce et diffuse visible en dessous, sans contact au sol ni reflet miroir.`;
}

function buildBlocDecor(
  backgroundId: PackshotBackgroundId,
  profile: ReturnType<typeof resolvePackshotAmbianceProfile>,
): string {
  if (backgroundId === "neutre") {
    const couleurFond = inferNeutralBackgroundColor(profile);
    return `Arrière-plan neutre uni ${couleurFond}, sans éléments de décor, dégradé doux et propre.`;
  }
  return `Arrière-plan flou : ${profile.decorElements}, sur fond de ${profile.fondAmbiance}.`;
}

function inferNeutralBackgroundColor(
  profile: ReturnType<typeof resolvePackshotAmbianceProfile>,
): string {
  if (profile.temperatureCouleur.includes("froide")) return "gris clair froid";
  if (profile.temperatureCouleur.includes("chaude")) return "beige chaud doux";
  return "gris perle neutre";
}

function inferLiquidType(product: string): string {
  if (/\b(boisson|jus|drink|bottle|canette|soda|eau)\b/i.test(product)) return "liquide frais";
  if (/\b(parfun|parfum|perfume|huile|oil)\b/i.test(product)) return "huile légère";
  if (/\b(crème|cream|lait|milk)\b/i.test(product)) return "crème onctueuse";
  return "liquide";
}

function inferFlyingElements(
  product: string,
  usage: PackshotUsageContextId | null,
): string {
  return inferPackshotFlyingElements(product, usage);
}

function inferEnvelopingMatter(product: string): { matter: string; visiblePart: string } {
  if (/\b(glace|ice|frozen)\b/i.test(product) || /\b(boisson|drink)\b/i.test(product)) {
    return { matter: "glace cristalline", visiblePart: "l'étiquette et le haut du contenant" };
  }
  if (/\b(cosmétique|cream|crème)\b/i.test(product)) {
    return { matter: "crème onctueuse", visiblePart: "le packaging et le bord du produit" };
  }
  if (/\b(bougie|candle|wax|cire)\b/i.test(product)) {
    return { matter: "cire fondue translucide", visiblePart: "le verre et l'étiquette" };
  }
  return { matter: "matière enveloppante stylisée", visiblePart: "la partie centrale du produit" };
}

function inferSmokeType(product: string): { smoke: string; position: string } {
  if (/\b(bougie|candle)\b/i.test(product)) {
    return { smoke: "fumée blanche délicate", position: "au-dessus de la mèche" };
  }
  if (/\b(café|coffee|thé|tea)\b/i.test(product)) {
    return { smoke: "vapeur chaude légère", position: "au-dessus du produit" };
  }
  return { smoke: "volute de vapeur atmosphérique", position: "au-dessus du produit" };
}

function buildBlocInteraction(
  interactionId: PackshotInteractionId,
  product: string,
  usage: PackshotUsageContextId | null,
): string {
  switch (interactionId) {
    case "eclaboussure": {
      const liquid = inferLiquidType(product);
      return `Une éclaboussure de ${liquid} éclatant autour du produit, gouttelettes suspendues en l'air, mouvement figé net.`;
    }
    case "elements-volants": {
      const elements = inferFlyingElements(product, usage);
      return `Des ${elements} flottent et virevoltent autour du produit, suspendus en plein mouvement.`;
    }
    case "matiere-englobante": {
      const { matter, visiblePart } = inferEnvelopingMatter(product);
      return `Le produit est partiellement enrobé dans ${matter}, laissant apparaître ${visiblePart} du produit à travers la matière.`;
    }
    case "fumee-vapeur": {
      const { smoke, position } = inferSmokeType(product);
      return `Une fine volute de ${smoke} s'élève doucement ${position} du produit, ajoutant une texture atmosphérique.`;
    }
    default:
      return "";
  }
}

function buildSurrealNote(
  positionId: PackshotPositionId,
  interactionId: PackshotInteractionId,
): string {
  if (positionId === "levitation" && interactionId === "matiere-englobante") {
    return "Flottaison stylisée et surréaliste assumée, au-delà du réalisme physique strict. ";
  }
  return "";
}

export function assemblePackshotDynamiquePrompt(input: PackshotAssemblyInput): string {
  const product = input.productDescription.trim();
  if (!product) return "";

  const ratio = resolvePackshotFormatRatio(input.formatId);
  const baseProfile = resolvePackshotAmbianceProfile(
    input.backgroundId,
    input.ambianceId,
    input.customAmbiance,
  );
  const usage = inferPackshotUsageContext(product);
  const profile =
    input.backgroundId === "environnement"
      ? enrichProfileForUsage(baseProfile, product, input.ambianceId)
      : baseProfile;
  const material = inferPackshotMaterialHints(product);
  const camera = resolveCamera(input.positionId, ratio);
  const lightingType = resolveLightingType(input.backgroundId);
  const lightDirection = resolveLightDirection(input.positionId);
  const temperature =
    input.backgroundId === "environnement"
      ? profile.temperatureCouleur
      : material.temperatureOverride ?? profile.temperatureCouleur;
  const shadowPresence = resolveShadowPresence(input.positionId);

  const blocSujet = buildBlocSujet(product, input.positionId, input.productStateId);
  const blocDecor = buildBlocDecor(input.backgroundId, profile);
  const blocInteraction = buildBlocInteraction(input.interactionId, product, usage);
  const surrealNote = buildSurrealNote(input.positionId, input.interactionId);

  const lines = [
    `Photo produit packshot, plan rapproché centré, objectif macro ${camera.focale}mm à f/${camera.ouverture}, mise au point nette sur le produit avec arrière-plan en léger flou (bokeh).`,
    "",
    blocSujet,
    "",
    `Éclairage ${lightingType} venant de ${lightDirection}, température ${temperature}, reflets ${material.qualiteReflets} sur ${material.matiereProduit}, ${shadowPresence}.`,
    "",
  ];

  if (isPackshotPosedTemplate(input.positionId)) {
    lines.push(buildBlocSurface(input.positionId, profile), "");
  } else if (isPackshotLevitationPosition(input.positionId)) {
    lines.push(buildBlocOmbrePortee(profile), "");
  }

  lines.push(blocDecor, "");

  if (blocInteraction) {
    lines.push(blocInteraction, "");
  }

  const compositionLine = isPackshotLevitationPosition(input.positionId)
    ? `Composition centrée, sujet en lévitation occupant environ ${camera.proportionCadre}% de la hauteur du cadre, espace négatif autour pour respiration visuelle et ajout de texte éventuel.`
    : `Composition centrée, sujet occupant environ ${camera.proportionCadre}% de la hauteur du cadre, espace négatif en haut pour ajout de texte éventuel.`;

  lines.push(
    `${compositionLine} Profondeur en trois plans : ${profile.planPremier} (premier plan), produit net (plan moyen), ${profile.planArriere} (arrière-plan).`,
    "",
    `Style éditorial ${profile.styleEditorial}, palette ${profile.paletteCouleurs}, ambiance ${profile.ambianceLabel}.`,
    `${surrealNote}Photoréaliste, haute définition, 4K, rendu commercial studio, ratio ${ratio}.`,
  );

  return lines.join("\n").trim();
}

export function assemblePackshotDynamiquePromptFromSlots(slots: TemplateSlotValues): string {
  const productDescription = (slots.productDescription ?? "").trim();
  if (!productDescription) return "";

  return assemblePackshotDynamiquePrompt({
    productDescription,
    positionId: (slots.positionId ?? "debout-droit") as PackshotPositionId,
    backgroundId: (slots.backgroundId ?? "neutre") as PackshotBackgroundId,
    ambianceId: (slots.ambianceId ?? null) as PackshotAmbianceId | null,
    customAmbiance: slots.customAmbiance ?? null,
    interactionId: (slots.interactionId ?? "aucun") as PackshotInteractionId,
    productStateId: (slots.productStateId ?? "ferme-neuf") as PackshotProductStateId,
    formatId: (slots.formatId ?? "banniere-4-5") as PackshotFormatId,
  });
}

export function isPackshotDynamiqueGuideReady(slots: TemplateSlotValues): boolean {
  const productDescription = (slots.productDescription ?? "").trim();
  const positionId = (slots.positionId ?? "").trim();
  const backgroundId = (slots.backgroundId ?? "").trim();

  if (productDescription.length < 2 || !positionId || !backgroundId) return false;

  if (backgroundId === "environnement") {
    const ambianceId = (slots.ambianceId ?? "").trim();
    if (!ambianceId) return false;
    if (ambianceId === "autre") {
      return (slots.customAmbiance ?? "").trim().length >= 2;
    }
  }

  return true;
}
