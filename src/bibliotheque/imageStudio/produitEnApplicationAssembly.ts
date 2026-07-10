import type { TemplateSlotValues } from "./promptTemplateEngine";
import { resolveBrandCampaignRandomPhysique } from "./brandCampaignShootAssembly";
import type { UgcSelfieGender } from "./ugcSelfieProfiles";
import {
  PRODUIT_APPLICATION_DEFAULT_GRAIN,
  PRODUIT_APPLICATION_DEFAULT_RATIO,
  PRODUIT_APPLICATION_ECLAIRAGE_DESC,
  PRODUIT_APPLICATION_OBJET_TEMPLATE_BODY,
  PRODUIT_APPLICATION_OBJECT_PROFILES,
  PRODUIT_APPLICATION_POSTURE_DESC,
  PRODUIT_APPLICATION_TEXTURE_PROFILES,
  PRODUIT_APPLICATION_TEXTURE_TEMPLATE_BODY,
  PRODUIT_APPLICATION_ZONE_PROFILES,
  resolveProduitApplicationColorimetrie,
  resolveProduitApplicationContenantDescObjet,
  resolveProduitApplicationContenantDescTexture,
  resolveProduitApplicationDecorDesc,
  resolveProduitApplicationDefaultAmbianceStyle,
  resolveProduitApplicationGesteApplication,
  resolveProduitApplicationMateriauObjet,
  type ProduitApplicationBodyZoneId,
  type ProduitApplicationContainerId,
  type ProduitApplicationDecorId,
  type ProduitApplicationGenderId,
  type ProduitApplicationLightingId,
  type ProduitApplicationObjectTypeId,
  type ProduitApplicationPostureId,
  type ProduitApplicationProductTypeId,
  type ProduitApplicationTextureTypeId,
} from "./produitEnApplicationConfig";

type RandomFn = () => number;

export type ProduitApplicationAssemblyInput = {
  productTypeId: ProduitApplicationProductTypeId;
  genderId: ProduitApplicationGenderId;
  bodyZoneId: ProduitApplicationBodyZoneId;
  containerId: ProduitApplicationContainerId;
  textureTypeId: ProduitApplicationTextureTypeId | null;
  objectTypeId: ProduitApplicationObjectTypeId | null;
  postureId: ProduitApplicationPostureId;
  decorId: ProduitApplicationDecorId;
  lightingId: ProduitApplicationLightingId;
  productName: string;
  physique: string;
  randomFn?: RandomFn;
};

function replaceAllPlaceholders(
  template: string,
  replacements: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`[${key}]`, value);
  }
  return result.trim();
}

export function assembleProduitApplicationTexturePrompt(
  input: ProduitApplicationAssemblyInput,
): string {
  const zone = PRODUIT_APPLICATION_ZONE_PROFILES[input.bodyZoneId];
  const texture = PRODUIT_APPLICATION_TEXTURE_PROFILES[input.textureTypeId ?? "creme-riche"];
  const randomFn = input.randomFn ?? Math.random;
  const ambianceStyle = resolveProduitApplicationDefaultAmbianceStyle(input.lightingId);
  const productName = input.productName.trim();

  return replaceAllPlaceholders(PRODUIT_APPLICATION_TEXTURE_TEMPLATE_BODY, {
    CADRAGE_ZONE: zone.cadrageZone,
    FOCALE: zone.focale,
    OUVERTURE: zone.ouverture,
    PROFONDEUR_CHAMP: zone.profondeurChamp,
    PHYSIQUE: input.physique,
    POSTURE_DESC: PRODUIT_APPLICATION_POSTURE_DESC[input.postureId],
    GESTE_APPLICATION: resolveProduitApplicationGesteApplication(productName, randomFn),
    ZONE_CORPS: zone.zoneCorps,
    TEXTURE_TYPE: texture.textureType,
    TRANSPARENCE: texture.transparence,
    BRILLANCE: texture.brillance,
    ETAT_TEXTURE: texture.etatTexture,
    CONTENANT_DESC: resolveProduitApplicationContenantDescTexture(input.containerId, randomFn),
    ECLAIRAGE_DESC: PRODUIT_APPLICATION_ECLAIRAGE_DESC[input.lightingId],
    DECOR_DESC: resolveProduitApplicationDecorDesc(input.decorId),
    AMBIANCE_STYLE: ambianceStyle,
    GRAIN: PRODUIT_APPLICATION_DEFAULT_GRAIN,
    COLORIMETRIE: resolveProduitApplicationColorimetrie(ambianceStyle, input.lightingId),
    RATIO: PRODUIT_APPLICATION_DEFAULT_RATIO,
  });
}

export function assembleProduitApplicationObjetPrompt(
  input: ProduitApplicationAssemblyInput,
): string {
  const zone = PRODUIT_APPLICATION_ZONE_PROFILES[input.bodyZoneId];
  const objectProfile =
    PRODUIT_APPLICATION_OBJECT_PROFILES[input.objectTypeId ?? "rasoir-jetable"];
  const randomFn = input.randomFn ?? Math.random;
  const ambianceStyle = resolveProduitApplicationDefaultAmbianceStyle(input.lightingId);

  return replaceAllPlaceholders(PRODUIT_APPLICATION_OBJET_TEMPLATE_BODY, {
    CADRAGE_ZONE: zone.cadrageZone,
    FOCALE: zone.focale,
    OUVERTURE: zone.ouverture,
    PROFONDEUR_CHAMP: zone.profondeurChamp,
    PHYSIQUE: input.physique,
    POSTURE_DESC: PRODUIT_APPLICATION_POSTURE_DESC[input.postureId],
    GESTE_OBJET: objectProfile.gesteObjet,
    OBJET_DESC: objectProfile.objetDesc,
    MATERIAU_OBJET: resolveProduitApplicationMateriauObjet(randomFn),
    ZONE_CORPS: zone.zoneCorps,
    TYPE_CONTACT: objectProfile.typeContact,
    RESULTAT_VISUEL_PEAU: objectProfile.resultatVisuelPeau,
    CONTENANT_DESC: resolveProduitApplicationContenantDescObjet(randomFn),
    ECLAIRAGE_DESC: PRODUIT_APPLICATION_ECLAIRAGE_DESC[input.lightingId],
    DECOR_DESC: resolveProduitApplicationDecorDesc(input.decorId),
    AMBIANCE_STYLE: ambianceStyle,
    GRAIN: PRODUIT_APPLICATION_DEFAULT_GRAIN,
    COLORIMETRIE: resolveProduitApplicationColorimetrie(ambianceStyle, input.lightingId),
    RATIO: PRODUIT_APPLICATION_DEFAULT_RATIO,
  });
}

export function assembleProduitApplicationPrompt(
  input: ProduitApplicationAssemblyInput,
): string {
  if (input.productTypeId === "texture") {
    return assembleProduitApplicationTexturePrompt(input);
  }
  return assembleProduitApplicationObjetPrompt(input);
}

function resolvePhysiqueFromGender(genderId: string, randomFn: RandomFn = Math.random): string {
  const gender: UgcSelfieGender = genderId === "homme" ? "homme" : "femme";
  return resolveBrandCampaignRandomPhysique(gender, randomFn);
}

export function assembleProduitApplicationPromptFromSlots(
  slots: TemplateSlotValues,
  randomFn: RandomFn = Math.random,
): string {
  const productName = (slots.productName ?? "").trim();
  if (!productName) return "";

  const productTypeId = (slots.productTypeId ?? "texture") as ProduitApplicationProductTypeId;
  const genderId = (slots.genderId ?? "femme") as ProduitApplicationGenderId;
  const physique =
    slots.physique?.trim() || resolvePhysiqueFromGender(genderId, randomFn);

  return assembleProduitApplicationPrompt({
    productTypeId,
    genderId,
    bodyZoneId: (slots.bodyZoneId ?? "visage-joue") as ProduitApplicationBodyZoneId,
    containerId: (slots.containerId ?? "visible") as ProduitApplicationContainerId,
    textureTypeId: (slots.textureTypeId as ProduitApplicationTextureTypeId | null) ?? null,
    objectTypeId: (slots.objectTypeId as ProduitApplicationObjectTypeId | null) ?? null,
    postureId: (slots.postureId ?? "debout") as ProduitApplicationPostureId,
    decorId: (slots.decorId ?? "studio") as ProduitApplicationDecorId,
    lightingId: (slots.lightingId ?? "naturelle-douce") as ProduitApplicationLightingId,
    productName,
    physique,
    randomFn,
  });
}

export function isProduitEnApplicationGuideReady(slots: TemplateSlotValues): boolean {
  const productTypeId = (slots.productTypeId ?? "").trim();
  const genderId = (slots.genderId ?? "").trim();
  const bodyZoneId = (slots.bodyZoneId ?? "").trim();
  const productName = (slots.productName ?? "").trim();

  if (!productTypeId || !genderId || !bodyZoneId) return false;
  if (productName.length < 2 && !slots.productImageUrl) return false;

  if (productTypeId === "texture") {
    return Boolean((slots.textureTypeId ?? "").trim());
  }

  return Boolean((slots.objectTypeId ?? "").trim());
}
