import { getFormatById } from "./vwsVideoFormatsCatalog";
import type { VwsVideoFormatCategoryId } from "./vwsVideoFormatsCatalog";

const BASE_PRODUCT_INSTRUCTION = `Format famille PRODUIT. Le prompt final Veo3 doit mettre le produit au centre de chaque plan décrit. Sections Camera et Lighting : éclairage contrôlé (studio, rasante, dramatique) ou neutre didactique selon l'intention. Section Important : le produit reste identifiable du début à la fin. Si l'idée mentionne un hook ou décor produit, les intégrer sans les contredire.`;

const PRODUCT_FORMAT_SUPPLEMENTS: Record<string, string> = {
  produit_pub_esthetique: `Tone : sensoriel, luxueux, aucun discours — laisser l'image parler. Privilégier macro, travelling lent, slow motion sur la matière. Section Idea : produit seul ou accompagné d'éléments de décor — pas de personne sauf si l'idée le demande explicitement.`,

  produit_demo: `Tone : clair et pédagogique. Section Idea : décrire l'usage du produit de façon séquentielle — une action à la fois. Gros plan mains en action. Privilégier un plan continu plutôt que 3 actions simultanées.`,

  produit_unboxing: `Tone : anticipation, découverte progressive. Section Idea : décrire l'ouverture étape par étape (shrink wrap → grip boîte → ouverture → révélation produit). For unboxing sequences: one hand must remain stationary holding the product base at all times while the other hand performs the opening gesture. The two hands must never perform the same motion simultaneously. The stabilizing hand does not move during the opening.`,

  produit_test_review: `Tone : honnête, réactif, spontané. Section Idea : la personne essaie le produit et réagit face caméra. Alterner regard caméra et interaction produit. Éviter les pauses statiques.`,

  produit_comparatif: `Tone : objectif, factuel, structuré. Section Idea : nommer les deux produits comparés et les positionner (gauche/droite ou alternance). Décrire les critères de comparaison retenus. Montage alternatif entre les deux produits.`,

  produit_focus_detail: `Tone : sensoriel, précis, contemplatif. Section Idea : décrire la texture, matière ou finition à zoomer. Slow motion macro. Le produit est statique — l'intérêt vient du cadrage et de la lumière rasante.`,

  produit_preuve_performance: `Tone : tension, résultat, preuve. Section Idea : décrire l'épreuve imposée au produit (choc, chaleur, eau, etc.), le moment de stress, puis le résultat visible. Pas de discours — les images prouvent.`,

  produit_reveal: `Tone : mystère, dévoilement, impact. Section Idea : décrire l'état caché initial (texture de ce qui cache), le geste de dévoilement, et la révélation du produit. Le reveal doit être progressif — jamais instantané.`,
};

function resolveProductFamilyInstruction(videoFormatId?: string): string {
  const supplement = videoFormatId ? PRODUCT_FORMAT_SUPPLEMENTS[videoFormatId] ?? "" : "";
  return supplement ? `${BASE_PRODUCT_INSTRUCTION}\n\n${supplement}` : BASE_PRODUCT_INSTRUCTION;
}

export const FORMAT_FAMILY_INSTRUCTIONS: Record<VwsVideoFormatCategoryId, string> = {
  produit: BASE_PRODUCT_INSTRUCTION,

  storytelling: `Format famille STORYTELLING. Construire un arc narratif court : situation initiale, tension ou
besoin, résolution ou vision positive. Sections Idea et Tone : émotion, identification,
transformation ou aspiration. Camera : mouvements cinématiques (travelling, épaule), pas un
simple talking head statique sauf si l'idée l'exige. Si ProjectFormat est three_x_8s, structurer
implicitement intro / cœur de l'action / résultat final. Lighting : évolution cohérente avec
le récit (contraste avant/après si pertinent). Important : une seule histoire continue, pas un
catalogue de scènes disjointes.`,

  humain: `Format famille HUMAIN. Le prompt final doit ancrer une ou deux personnes parlant ou réagissant
face caméra. Section Camera : plan face, légère contre-plongée ou épaule ; caméra stable sauf
réaction selfie. Section Tone : direct, confiant, authentique, jamais surjoué. Section Idea :
problème posé, réponse FAQ, témoignage vécu, ou réaction à un stimulus. Important : présence
humaine continue ; le métier se voit dans le décor et le discours, pas via un process technique
détaillé mains-seules.`,

  process: `Format famille PROCESS. Décrire une transformation ou un geste métier observable : mains,
outils, matériaux, progression dans le temps. Section Camera : gros plan mains, plongée, macro,
ou plan fixe pour timelapse/avant-après. Si Reveal est true ou format avant/après : état initial
puis révélation finale, même cadrage. Si Tempo-Literal est timelapse : évolution accélérée
continue. Important : continuité spatiale, object permanence, pas d'apparition/disparition
magique. Pour erreur→correction : montrer d'abord la mauvaise pratique puis la correction.`,

  social: `Format famille SOCIAL NATIF. Optimiser pour scroll-stop : hook visuel ou verbal dans les
3 premières secondes. Section Tone : direct, urgent, authentique, énergique. Camera : selfie
POV, face caméra proche, léger handheld. Montage dynamique sauf formats minimalistes (réponse
commentaire). Section Idea : une promesse claire (alerte, liste, challenge, trend, réponse).
Important : format court et lisible sur mobile vertical ; pas de sur-narration ; si l'idée
mentionne un commentaire ou un duet, le traiter comme élément visible du plan.`,
};

export type RefinePromptFormatFamilyInput = {
  categoryId: string;
  videoFormatId?: string;
};

export function getRefinePromptFormatFamilyInstruction(
  videoFormatIdOrFormat: string | null | undefined | RefinePromptFormatFamilyInput,
): string {
  let categoryId: string | null = null;
  let videoFormatId: string | undefined;

  if (
    videoFormatIdOrFormat &&
    typeof videoFormatIdOrFormat === "object" &&
    "categoryId" in videoFormatIdOrFormat
  ) {
    categoryId = videoFormatIdOrFormat.categoryId;
    videoFormatId = videoFormatIdOrFormat.videoFormatId;
  } else {
    const id = typeof videoFormatIdOrFormat === "string" ? videoFormatIdOrFormat.trim() : "";
    if (!id) return "";
    const format = getFormatById(id);
    if (!format?.categoryId) return "";
    categoryId = format.categoryId;
    videoFormatId = id;
  }

  if (!categoryId) return "";

  if (categoryId === "produit") {
    return resolveProductFamilyInstruction(videoFormatId);
  }

  return FORMAT_FAMILY_INSTRUCTIONS[categoryId as VwsVideoFormatCategoryId] ?? "";
}
