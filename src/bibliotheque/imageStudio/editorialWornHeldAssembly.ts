import type { TemplateSlotValues } from "./promptTemplateEngine";
import {
  inferPackshotMaterialHints,
  resolvePackshotAmbianceProfile,
  type PackshotAmbianceId,
  type PackshotBackgroundId,
  type PackshotFormatId,
} from "./packshotDynamiqueConfig";
import {
  resolveEditorialCamera,
  resolveEditorialFormatRatio,
  resolveEditorialFramingDescription,
  resolveEditorialModelDescription,
  resolveEditorialProportion,
  resolveEditorialSeatedSurface,
  resolveEditorialTenueSimpleDefaut,
  resolveEditorialZoneProfile,
  type EditorialFramingId,
  type EditorialGenderId,
  type EditorialPostureId,
  type EditorialSceneTypeId,
  type EditorialZoneId,
} from "./editorialWornHeldConfig";

export type EditorialWornHeldAssemblyInput = {
  sceneTypeId: EditorialSceneTypeId;
  genderId: EditorialGenderId;
  zoneId: EditorialZoneId;
  framingId: EditorialFramingId;
  outfitDescription: string | null;
  backgroundId: PackshotBackgroundId;
  ambianceId: PackshotAmbianceId | null;
  customAmbiance: string | null;
  productDescription: string;
  postureId: EditorialPostureId | null;
  customGesture: string | null;
  formatId: PackshotFormatId;
};

function resolveLightingType(backgroundId: PackshotBackgroundId): string {
  return backgroundId === "neutre"
    ? "Flash studio / softbox"
    : "Lumière mixte (naturelle + appoint)";
}

function resolveLightDirection(): string {
  return "Latérale douce (45°)";
}

function resolveFocusLogic(
  framingId: EditorialFramingId,
  zoneCorps: string,
  productDescription: string,
): string {
  switch (framingId) {
    case "macro":
      return `mise au point nette sur ${productDescription} et la peau environnante`;
    case "mi-corps":
      return `mise au point nette sur le produit et la zone du corps concernée, léger flou d'arrière-plan`;
    case "corps-entier":
      return `mise au point différentielle : netteté maximale et quasi macro sur ${zoneCorps} et ${productDescription}, netteté qui se relâche progressivement et doucement vers le reste du corps, silhouette générale identifiable mais moins piquée, créant un gradient naturel qui guide l'œil vers ${zoneCorps}`;
    default:
      return `mise au point nette sur le produit et ${zoneCorps}`;
  }
}

function resolveProductOuModele(sceneTypeId: EditorialSceneTypeId): string {
  return sceneTypeId === "bijou-porte" ? "le bijou" : "le produit";
}

function resolveWearVerb(sceneTypeId: EditorialSceneTypeId): "porté" | "tenu" {
  return sceneTypeId === "bijou-porte" ? "porté" : "tenu";
}

function buildBlocPerspectiveBijou(
  framingId: EditorialFramingId,
  zoneCorps: string,
  detailPerspective: string,
): string {
  if (framingId !== "corps-entier") return "";
  return `Posture orientée de façon à rapprocher ${zoneCorps} de l'objectif par rapport au reste du corps : ${detailPerspective}, créant un effet de perspective qui agrandit relativement ${zoneCorps} malgré le cadrage corps entier. `;
}

function buildBlocRefletLocalise(
  framingId: EditorialFramingId,
  productDescription: string,
  zoneCorps: string,
): string {
  if (framingId !== "corps-entier") return "";
  return ` Un reflet ponctuel plus intense accroche spécifiquement ${productDescription}, créant un petit point de brillance qui attire l'œil vers ${zoneCorps}.`;
}

function buildBlocDecor(
  backgroundId: PackshotBackgroundId,
  profile: ReturnType<typeof resolvePackshotAmbianceProfile>,
): string {
  if (backgroundId === "neutre") {
    const couleurFond = profile.temperatureCouleur.includes("froide")
      ? "gris clair froid"
      : profile.temperatureCouleur.includes("chaude")
        ? "beige chaud doux"
        : "gris perle neutre";
    return `Arrière-plan neutre uni ${couleurFond}, sans éléments de décor.`;
  }
  return `Arrière-plan flou : ${profile.decorElements}, sur fond de ${profile.fondAmbiance}.`;
}

function resolveGesture(
  profile: ReturnType<typeof resolveEditorialZoneProfile>,
  customGesture: string | null,
): string {
  const custom = customGesture?.trim();
  if (custom) return custom;
  return profile?.defaultGesture ?? "";
}

function resolvePosture(
  profile: ReturnType<typeof resolveEditorialZoneProfile>,
  postureId: EditorialPostureId | null,
): EditorialPostureId {
  if (postureId) return postureId;
  return profile?.defaultPosture ?? "debout";
}

function buildBlocSujetMacro(
  modelDescription: string,
  gesture: string,
  productDescription: string,
  positionProduit: string,
): string {
  return `${modelDescription}, ${gesture}, mettant en valeur ${productDescription} ${positionProduit}.`;
}

function buildBlocSujetMiCorps(
  modelDescription: string,
  gesture: string,
  productDescription: string,
  positionProduit: string,
): string {
  const tenue = resolveEditorialTenueSimpleDefaut();
  return `${modelDescription} cadrée à mi-corps, ${tenue}, ${gesture}, mettant en valeur ${productDescription} ${positionProduit}.`;
}

function buildBlocSujetCorpsEntier(
  modelDescription: string,
  productDescription: string,
  positionProduit: string,
  outfitDescription: string,
  posture: EditorialPostureId,
  blocPerspective: string,
  detailPresentation: string,
  wearVerb: "porté" | "tenu",
): string {
  const tenue = outfitDescription.trim() || "une tenue éditoriale sobre et élégante";
  const posturePhrase =
    posture === "assise"
      ? `assise sur ${resolveEditorialSeatedSurface()}`
      : "debout";

  return `${modelDescription} visible en entier, portant ${tenue}, ${posturePhrase}. ${blocPerspective}${productDescription} est ${wearVerb} ${positionProduit}, ${detailPresentation}.`;
}

function buildBlocSujet(input: EditorialWornHeldAssemblyInput): string {
  const profile = resolveEditorialZoneProfile(input.sceneTypeId, input.zoneId);
  if (!profile) return "";

  const product = input.productDescription.trim();
  const modelDescription = resolveEditorialModelDescription(input.genderId);
  const gesture = resolveGesture(profile, input.customGesture);
  const posture = resolvePosture(profile, input.postureId);
  const wearVerb = resolveWearVerb(input.sceneTypeId);
  const blocPerspective = buildBlocPerspectiveBijou(
    input.framingId,
    profile.zoneCorps,
    profile.detailPerspective,
  );

  switch (input.framingId) {
    case "macro":
      return buildBlocSujetMacro(
        modelDescription,
        gesture,
        product,
        profile.positionProduit,
      );
    case "mi-corps":
      return buildBlocSujetMiCorps(
        modelDescription,
        gesture,
        product,
        profile.positionProduit,
      );
    case "corps-entier":
      return buildBlocSujetCorpsEntier(
        modelDescription,
        product,
        profile.positionProduit,
        input.outfitDescription ?? "",
        posture,
        blocPerspective,
        profile.detailPresentationZone,
        wearVerb,
      );
    default:
      return buildBlocSujetMiCorps(
        modelDescription,
        gesture,
        product,
        profile.positionProduit,
      );
  }
}

export function assembleEditorialWornHeldPrompt(
  input: EditorialWornHeldAssemblyInput,
): string {
  const product = input.productDescription.trim();
  if (!product) return "";

  const profile = resolveEditorialZoneProfile(input.sceneTypeId, input.zoneId);
  if (!profile) return "";

  const ratio = resolveEditorialFormatRatio(input.formatId);
  const camera = resolveEditorialCamera(input.framingId);
  const framingDesc = resolveEditorialFramingDescription(input.framingId);
  const proportion = resolveEditorialProportion(input.framingId);
  const material = inferPackshotMaterialHints(product);
  const decorProfile = resolvePackshotAmbianceProfile(
    input.backgroundId,
    input.ambianceId,
    input.customAmbiance,
  );
  const lightingType = resolveLightingType(input.backgroundId);
  const lightDirection = resolveLightDirection();
  const focusLogic = resolveFocusLogic(input.framingId, profile.zoneCorps, product);
  const productOuModele = resolveProductOuModele(input.sceneTypeId);

  const blocSujet = buildBlocSujet(input);
  const blocDecor = buildBlocDecor(input.backgroundId, decorProfile);
  const blocRefletLocalise = buildBlocRefletLocalise(
    input.framingId,
    product,
    profile.zoneCorps,
  );

  const lines = [
    `Photo éditoriale ${framingDesc}, objectif ${camera.focale}mm à f/${camera.ouverture}, ${focusLogic}.`,
    "",
    blocSujet,
    "",
    `Peau texturée de façon réaliste : ${profile.detailPeauNaturel}, grain de peau visible, non lissé.`,
    "",
    `Éclairage ${lightingType} venant de ${lightDirection}, reflets ${material.qualiteReflets} sur ${material.matiereProduit}, ombres douces qui sculptent ${profile.zoneCorps}.${blocRefletLocalise}`,
    "",
    blocDecor,
    "",
    `Composition ${profile.cadrageDetail}, ${productOuModele} occupant environ ${proportion}% de la hauteur du cadre, ${profile.orientationRegard}.`,
    "",
    `Style éditorial haute couture, photoréaliste, haute définition, 4K, grain photo naturel, ratio ${ratio}.`,
  ];

  return lines.join("\n").trim();
}

export function assembleEditorialWornHeldPromptFromSlots(
  slots: TemplateSlotValues,
): string {
  const productDescription = (slots.productDescription ?? "").trim();
  if (!productDescription) return "";

  return assembleEditorialWornHeldPrompt({
    sceneTypeId: (slots.sceneTypeId ?? "bijou-porte") as EditorialSceneTypeId,
    genderId: (slots.genderId ?? "femme") as EditorialGenderId,
    zoneId: (slots.zoneId ?? "poignet-main") as EditorialZoneId,
    framingId: (slots.framingId ?? "macro") as EditorialFramingId,
    outfitDescription: slots.outfitDescription ?? null,
    backgroundId: (slots.backgroundId ?? "neutre") as PackshotBackgroundId,
    ambianceId: (slots.ambianceId ?? null) as PackshotAmbianceId | null,
    customAmbiance: slots.customAmbiance ?? null,
    productDescription,
    postureId: (slots.postureId ?? null) as EditorialPostureId | null,
    customGesture: slots.customGesture ?? null,
    formatId: (slots.formatId ?? "banniere-4-5") as PackshotFormatId,
  });
}

export function isEditorialWornHeldGuideReady(slots: TemplateSlotValues): boolean {
  const productDescription = (slots.productDescription ?? "").trim();
  const sceneTypeId = (slots.sceneTypeId ?? "").trim();
  const genderId = (slots.genderId ?? "").trim();
  const zoneId = (slots.zoneId ?? "").trim();
  const framingId = (slots.framingId ?? "").trim();
  const backgroundId = (slots.backgroundId ?? "").trim();

  if (
    productDescription.length < 2 ||
    !sceneTypeId ||
    !genderId ||
    !zoneId ||
    !framingId ||
    !backgroundId
  ) {
    return false;
  }

  if (framingId === "corps-entier") {
    if ((slots.outfitDescription ?? "").trim().length < 2) return false;
  }

  if (backgroundId === "environnement") {
    const ambianceId = (slots.ambianceId ?? "").trim();
    if (!ambianceId) return false;
    if (ambianceId === "autre") {
      return (slots.customAmbiance ?? "").trim().length >= 2;
    }
  }

  return true;
}
