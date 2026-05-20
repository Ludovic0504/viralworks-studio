import type { AvatarConfig } from "@/bibliotheque/studio/avatarOptions";
import { METIERS } from "@/bibliotheque/studio/avatarOptions";

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

const ACCESSOIRES_PAR_METIER: Record<string, string> = {
  electricien: "ceinture porte-outils, mètre ruban",
  plombier: "ceinture porte-outils, gants de travail",
  macon: "gants de protection, casque de chantier",
  climaticien: "carnet technique, stylo",
  menuisier: "ceinture porte-outils, lunettes de protection",
  peintre: "gants fins, tablier de peintre",
  carreleur: "genouillères, gants",
  couvreur: "harnais de sécurité, casque",
};

const DEFAULT_ACCESSOIRES = "accessoires de travail adaptés au métier";

function resolveGenreLabel(genre: string | null): string {
  if (genre === "femme") return "Femme";
  if (genre === "homme") return "Homme";
  return "Homme";
}

function resolveMetierLabel(metier: string): string {
  const found = METIERS.find((m) => m.value === metier);
  return found?.label ?? metier;
}

function resolveCouleurLabel(couleur: string | null): string {
  if (!couleur) return COULEUR_PROMPT_LABELS.blanc;
  return COULEUR_PROMPT_LABELS[couleur] ?? COULEUR_PROMPT_LABELS.blanc;
}

function resolveAccessoires(metier: string, accessoires: boolean): string {
  if (!accessoires) return "Aucun";
  return ACCESSOIRES_PAR_METIER[metier] ?? DEFAULT_ACCESSOIRES;
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

  return `Image de référence : source unique et figée. 
Reproduis EXACTEMENT ce personnage : même visage, même 
morphologie, même carnation, même cheveux.

TENUE OBLIGATOIRE identique à la référence — Haut : ${tenue.haut}. 
Bas : ${tenue.bas}. Chaussures : ${tenue.chaussures}. 
Accessoires : ${accessoires}. Aucun changement de tenue autorisé.

UNE SEULE image COULEUR, 3 colonnes verticales côte à côte. 
Fond studio gris neutre, éclairage doux, aucun équipement visible.

GAUCHE : vue de dos obligatoire. Le personnage tourne 
le dos à la caméra. On voit uniquement la nuque, 
le dos, les fesses et les talons. Le visage est 
totalement invisible. Corps entier de la tête aux pieds.
Dos strictement perpendiculaire à la caméra, aucun profil,
aucun trois-quarts. Tenue identique à l'image de référence :
même haut, même bas, mêmes chaussures, mêmes accessoires 
visibles dans le dos.

CENTRE : corps entier pieds à tête, de face strict, 
0° rotation, regard caméra, bouche fermée.

DROITE : gros plan portrait, côté droit du visage uniquement. 
Tête entière, oreille droite visible, cou, haut des épaules. 
Regard vers l'horizon, pas vers caméra.

INTERDICTIONS : pas de sourire. Pas de trois-quarts. 
Pas de regard caméra gauche et droite. 
Ne pas modifier la tenue. Pas de visage visible colonne gauche.
Pas de profil colonne gauche.
Colonne gauche = dos complet avec tenue de référence.`.trim();
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
