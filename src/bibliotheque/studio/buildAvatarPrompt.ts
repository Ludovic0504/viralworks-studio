import type { AvatarConfig } from "@/bibliotheque/studio/avatarOptions";
import {
  ACCESSOIRES_PAR_METIER,
  resolveAvatarMetierLabel,
  resolveAvatarMetierSlug,
} from "@/bibliotheque/studio/avatarMetiersCatalog";

const PROMPT_FACE_TEMPLATE = `
Photographie couleur réaliste, style portrait corporate 
professionnel. UNE SEULE photo verticale, fond studio gris 
neutre uni, éclairage doux et diffus, aucun équipement de 
studio visible.

PERSONNAGE {GENRE} français(e), {MÉTIER}, {ÂGE} ans. 
Cheveux châtains courts, visage ovale, mâchoire légèrement 
marquée, légères rides naturelles d'expression. Physique 
naturel et adapté au métier. Expression neutre, bouche 
fermée, regard calme dirigé vers la caméra.

TENUE Haut : {HAUT}. Bas : {BAS}. 
Chaussures : {CHAUSSURES}. Accessoires : {ACCESSOIRES}.

CADRAGE Corps entier des pieds à la tête. Strictement DE 
FACE, 0° rotation, parfaitement symétrique, pas de 
trois-quarts. Il/Elle regarde la caméra. Les deux pieds 
entièrement visibles. La tête entière visible avec espace 
au-dessus du crâne.

INTERDICTIONS Pas de sourire. Pas de rotation du corps. 
Pas de logo de marque visible. Pas d'équipement de studio 
dans le fond. Photo couleur uniquement.
`;

const COULEUR_PROMPT_LABELS: Record<string, string> = {
  blanc: "blanc",
  noir: "noir",
  bleu: "bleu marine",
  gris: "gris anthracite",
  orange: "orange",
  vert: "vert",
};

const DEFAULT_ACCESSOIRES = "accessoires de travail adaptés au métier";

function resolveGenreLabel(genre: string | null): string {
  if (genre === "femme") return "Femme";
  if (genre === "homme") return "Homme";
  return "Homme";
}

function resolveMetierLabel(metier: string): string {
  return resolveAvatarMetierLabel(metier);
}

function resolveCouleurLabel(couleur: string | null): string {
  if (!couleur) return COULEUR_PROMPT_LABELS.blanc;
  return COULEUR_PROMPT_LABELS[couleur] ?? COULEUR_PROMPT_LABELS.blanc;
}

function resolveAccessoires(metier: string, accessoires: boolean): string {
  if (!accessoires) return "Aucun";
  const slug = resolveAvatarMetierSlug(metier);
  return ACCESSOIRES_PAR_METIER[slug] ?? ACCESSOIRES_PAR_METIER[metier] ?? DEFAULT_ACCESSOIRES;
}

export function getTenueDetails(
  metier: string,
  styleTenue: string | null,
  couleurDominante: string | null
): { haut: string; bas: string; chaussures: string } {
  const metierLabel = resolveMetierLabel(metier);
  const couleurLabel = resolveCouleurLabel(couleurDominante);
  const style = styleTenue ?? "casual";

  switch (style) {
    case "travail":
      return {
        haut: `${couleurLabel} de travail adapté au métier de ${metierLabel}`,
        bas: "pantalon de travail résistant",
        chaussures: "chaussures de sécurité",
      };
    case "ville":
      return {
        haut: `chemise ${couleurLabel} col ouvert`,
        bas: "pantalon chino beige",
        chaussures: "mocassins en cuir marron",
      };
    case "casual":
    default:
      return {
        haut: `t-shirt ${couleurLabel} uni`,
        bas: "jean ajusté bleu",
        chaussures: "sneakers blanches",
      };
  }
}

function replacePlaceholders(
  template: string,
  values: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }
  return result.trim().replace(/\n{3,}/g, "\n\n");
}

export function buildPromptTriptyque(config: AvatarConfig): string {
  const tenue = getTenueDetails(
    config.metier,
    config.styleTenue,
    config.couleurDominante
  );
  const accessoires = resolveAccessoires(config.metier, config.accessoires);

  return `Réf. figée. Reproduire exact : visage, morphologie, 
carnation, cheveux. TENUE ref. — Haut : ${tenue.haut}. Bas : ${tenue.bas}. 
Chaussures : ${tenue.chaussures}. Access. : ${accessoires}. Tenue inchangée.

1 image COULEUR, 3 colonnes. Fond studio gris, éclairage doux, 
sans équipement.

GAUCHE : corps entier pieds à tête, dos uniquement visible, 
nuque visible, visage invisible, bras le long du corps.
Tenue identique à la référence visible de dos.

CENTRE : corps entier pieds à tête, de face strict,
0° rotation, regard caméra, bouche fermée.

DROITE : gros plan portrait serré, visage entier visible.
Tête complète non coupée, menton visible, cou, 
haut des épaules à mi-épaule maximum. 
Regard vers l'horizon. Expression neutre.`.trim();
}

export function buildPromptFace(config: AvatarConfig): string {
  const genre = resolveGenreLabel(config.genre);
  const metier = resolveMetierLabel(config.metier);
  const age = config.age;
  const { haut, bas, chaussures } = getTenueDetails(
    config.metier,
    config.styleTenue,
    config.couleurDominante
  );
  const accessoires = resolveAccessoires(config.metier, config.accessoires);

  return replacePlaceholders(PROMPT_FACE_TEMPLATE, {
    GENRE: genre,
    "MÉTIER": metier,
    "ÂGE": age,
    HAUT: haut,
    BAS: bas,
    CHAUSSURES: chaussures,
    ACCESSOIRES: accessoires,
  });
}
