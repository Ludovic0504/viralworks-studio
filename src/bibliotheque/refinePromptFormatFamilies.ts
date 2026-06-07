import { getFormatById } from "./vwsVideoFormatsCatalog";
import type { VwsVideoFormatCategoryId } from "./vwsVideoFormatsCatalog";

export const FORMAT_FAMILY_INSTRUCTIONS: Record<VwsVideoFormatCategoryId, string> = {
  produit: `Format famille PRODUIT. Le prompt final Veo3 doit mettre le produit au centre de chaque plan
décrit. Privilégier gros plans, macro, plongée, mains en action, travelling lent ou dévoilement
progressif selon l'idée. Sections Camera et Lighting : éclairage contrôlé (studio, rasante,
dramatique) ou neutre didactique. Section Tone : sensoriel/luxe pour esthétique et reveal ;
clair et pédagogique pour démo, test, comparatif. Section Important : le produit reste visible
et identifiable du début à la fin ; pas de dérive vers un discours métier générique. Si l'idée
mentionne un hook ou décor produit, les intégrer sans les contredire.`,

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

export function getRefinePromptFormatFamilyInstruction(
  videoFormatId: string | null | undefined
): string {
  if (!videoFormatId || typeof videoFormatId !== "string") return "";
  const format = getFormatById(videoFormatId.trim());
  if (!format?.categoryId) return "";
  return FORMAT_FAMILY_INSTRUCTIONS[format.categoryId] ?? "";
}
