/**
 * Catalogue des formats vidéo Campagne VWS (étape 1) — source unique labels + presets rendu.
 * Les préréglages remplacent l’ancien trio « Pack Vlog / Démo / Avant-Après ».
 */

export type VwsVideoFormatCategoryId =
  | "produit"
  | "storytelling"
  | "humain"
  | "process"
  | "social";

export type VwsVideoFormatRenderingPatch = {
  tempo: "real_time" | "timelapse" | "slow_motion";
  sequenceType: "single_8s" | "three_x_8s";
  cameraFixed: boolean;
  revealMode: boolean;
  cinematicMovement: boolean;
  selfieMode: boolean;
};

export type VwsVideoFormatDef = {
  id: string;
  categoryId: VwsVideoFormatCategoryId;
  name: string;
  description: string;
  popular: boolean;
  placeholderIdea: string;
  rendering: VwsVideoFormatRenderingPatch;
  /** Requête Pexels (anglais) pour l’image d’aperçu de la carte */
  pexelsQuery: string;
};

export type VwsVideoFormatCategoryDef = {
  id: VwsVideoFormatCategoryId;
  tabLabel: string;
  tabEmoji: string;
};

const PRESET_VLOG: VwsVideoFormatRenderingPatch = {
  tempo: "real_time",
  sequenceType: "single_8s",
  cameraFixed: false,
  revealMode: false,
  cinematicMovement: false,
  selfieMode: true,
};

const PRESET_DEMO: VwsVideoFormatRenderingPatch = {
  tempo: "real_time",
  sequenceType: "single_8s",
  cameraFixed: false,
  revealMode: false,
  cinematicMovement: true,
  selfieMode: false,
};

const PRESET_AVANT_APRES: VwsVideoFormatRenderingPatch = {
  tempo: "timelapse",
  sequenceType: "single_8s",
  cameraFixed: false,
  revealMode: true,
  cinematicMovement: false,
  selfieMode: false,
};

const PRESET_NEUTRAL: VwsVideoFormatRenderingPatch = {
  tempo: "real_time",
  sequenceType: "single_8s",
  cameraFixed: true,
  revealMode: false,
  cinematicMovement: false,
  selfieMode: false,
};

const PRESET_TIMELAPSE: VwsVideoFormatRenderingPatch = {
  tempo: "timelapse",
  sequenceType: "single_8s",
  cameraFixed: false,
  revealMode: false,
  cinematicMovement: false,
  selfieMode: false,
};

const PRESET_FACE: VwsVideoFormatRenderingPatch = {
  tempo: "real_time",
  sequenceType: "single_8s",
  cameraFixed: true,
  revealMode: false,
  cinematicMovement: false,
  selfieMode: true,
};

const PRESET_CINEMA: VwsVideoFormatRenderingPatch = {
  tempo: "real_time",
  sequenceType: "three_x_8s",
  cameraFixed: false,
  revealMode: false,
  cinematicMovement: true,
  selfieMode: false,
};

const PRESET_STORY_MULTI: VwsVideoFormatRenderingPatch = {
  tempo: "real_time",
  sequenceType: "three_x_8s",
  cameraFixed: false,
  revealMode: false,
  cinematicMovement: true,
  selfieMode: false,
};

const PRESET_INTERVIEW: VwsVideoFormatRenderingPatch = {
  tempo: "real_time",
  sequenceType: "single_8s",
  cameraFixed: true,
  revealMode: false,
  cinematicMovement: false,
  selfieMode: false,
};

const PRESET_SLOW: VwsVideoFormatRenderingPatch = {
  tempo: "slow_motion",
  sequenceType: "single_8s",
  cameraFixed: true,
  revealMode: false,
  cinematicMovement: true,
  selfieMode: false,
};

export const VWS_VIDEO_FORMAT_CATEGORIES: VwsVideoFormatCategoryDef[] = [
  { id: "produit", tabLabel: "Produit", tabEmoji: "📦" },
  { id: "storytelling", tabLabel: "Storytelling", tabEmoji: "🎬" },
  { id: "humain", tabLabel: "Humain", tabEmoji: "👤" },
  { id: "process", tabLabel: "Process / Transformation", tabEmoji: "🔧" },
  { id: "social", tabLabel: "Social natif", tabEmoji: "📱" },
];

const _formats: VwsVideoFormatDef[] = [
  {
    id: "produit_pub_esthetique",
    categoryId: "produit",
    name: "Publicité produit (shooting esthétique)",
    description: "Un produit filmé avec lumière dramatique et slow motion",
    popular: true,
    pexelsQuery: "product photography dramatic light",
    placeholderIdea:
      "Décris le produit, le décor, le jeu de lumière et le geste slow motion (ex. goutte, reflet, matière en gros plan).",
    rendering: PRESET_SLOW,
  },
  {
    id: "produit_demo",
    categoryId: "produit",
    name: "Démonstration produit",
    description: "L'outil ou le produit utilisé en direct",
    popular: true,
    pexelsQuery: "tool demonstration close up hands",
    placeholderIdea: "Quel produit, quel geste concret, dans quel contexte (plan de travail, atelier, client) ?",
    rendering: PRESET_DEMO,
  },
  {
    id: "produit_unboxing",
    categoryId: "produit",
    name: "Unboxing",
    description: "Ouverture d'une boîte avec reveal progressif",
    popular: false,
    pexelsQuery: "unboxing cardboard box open",
    placeholderIdea: "Contenu de la boîte, matériaux visibles, moment du reveal (son, main, cadrage).",
    rendering: { ...PRESET_DEMO, revealMode: true, cinematicMovement: true },
  },
  {
    id: "produit_test_review",
    categoryId: "produit",
    name: "Test / Review produit",
    description: "Quelqu'un essaie et donne son avis face caméra",
    popular: false,
    pexelsQuery: "person reviewing product camera",
    placeholderIdea: "Qui teste, sur quoi, quelle prise en main, quel critère d’avis (confort, rendu, efficacité) ?",
    rendering: { ...PRESET_VLOG, cameraFixed: true },
  },
  {
    id: "produit_comparatif",
    categoryId: "produit",
    name: "Comparatif produit",
    description: "Deux produits ou options testés côte à côte",
    popular: false,
    pexelsQuery: "two products side by side comparison",
    placeholderIdea: "Les deux options, le plan côte à côte, le critère de comparaison (prix, tenue, vitesse…).",
    rendering: { ...PRESET_DEMO, cameraFixed: true, cinematicMovement: false },
  },
  {
    id: "produit_focus_detail",
    categoryId: "produit",
    name: "Focus détail produit",
    description: "Zoom extrême sur une matière ou une finition",
    popular: false,
    pexelsQuery: "product detail texture macro",
    placeholderIdea: "Quel détail (texture, joint, vernis, couture) et le mouvement de caméra (zoom, travelling court).",
    rendering: { ...PRESET_DEMO, tempo: "slow_motion", cinematicMovement: true },
  },
  {
    id: "produit_preuve_performance",
    categoryId: "produit",
    name: "Preuve par performance",
    description: "Le produit dans une situation extrême",
    popular: false,
    pexelsQuery: "product stress test extreme",
    placeholderIdea: "L’épreuve concrète (choc, charge, intempéries) et ce qu’on doit voir pour être convaincu.",
    rendering: { ...PRESET_DEMO, tempo: "real_time", selfieMode: false, cameraFixed: false },
  },
  {
    id: "produit_reveal",
    categoryId: "produit",
    name: "Reveal produit",
    description: "Produit caché puis dévoilé progressivement",
    popular: false,
    pexelsQuery: "product reveal cloth dramatic",
    placeholderIdea: "Comment le produit est caché au départ, le geste de dévoilement, l’éclairage final.",
    rendering: { ...PRESET_DEMO, revealMode: true, cinematicMovement: true },
  },
  {
    id: "story_tv_spot",
    categoryId: "storytelling",
    name: "TV Spot (mini-film publicitaire)",
    description: "Une micro-histoire avec tension et résolution",
    popular: false,
    pexelsQuery: "film clap cinematic scene",
    placeholderIdea: "Problème en une image, rebond, résolution : qui, où, quoi change en 8 s (même fil logique).",
    rendering: PRESET_CINEMA,
  },
  {
    id: "story_probleme_solution",
    categoryId: "storytelling",
    name: "Publicité problème → solution",
    description: "Une situation négative résolue par le produit ou service",
    popular: true,
    pexelsQuery: "before after transformation",
    placeholderIdea: "L’irritation ou la panne visible, puis l’intervention / le produit qui règle la situation.",
    rendering: { ...PRESET_CINEMA, sequenceType: "single_8s" },
  },
  {
    id: "story_lifestyle",
    categoryId: "storytelling",
    name: "Mise en situation (lifestyle)",
    description: "Quelqu'un utilise le produit dans sa routine du matin",
    popular: true,
    pexelsQuery: "person using product home lifestyle",
    placeholderIdea: "Routine (lieu, lumière du matin), produit intégré naturellement, un seul fil d’action.",
    rendering: { ...PRESET_VLOG, cinematicMovement: true, cameraFixed: false },
  },
  {
    id: "story_histoire_client",
    categoryId: "storytelling",
    name: "Histoire client réelle",
    description: "Un cas concret raconté du début à la fin",
    popular: false,
    pexelsQuery: "customer testimonial conversation",
    placeholderIdea: "Avant (besoin), pendant (intervention), après (résultat chiffré ou visible) en un seul enchaîné visuel.",
    rendering: PRESET_STORY_MULTI,
  },
  {
    id: "story_origine",
    categoryId: "storytelling",
    name: "Story origine (why)",
    description: "Pourquoi l'entreprise existe, comment elle a commencé",
    popular: false,
    pexelsQuery: "entrepreneur small business origin",
    placeholderIdea: "L’image d’origine (atelier, premier client) et le symbole de la marque aujourd’hui — un seul mouvement de caméra possible.",
    rendering: { ...PRESET_FACE, selfieMode: false, cameraFixed: false, cinematicMovement: true },
  },
  {
    id: "story_projection_futur",
    categoryId: "storytelling",
    name: "Projection / scénario futur",
    description: "Ce que devient la vie du client après utilisation",
    popular: false,
    pexelsQuery: "success future vision bright",
    placeholderIdea: "État ‘avant’ sobre, flash vers le futur (espace, confort, temps gagné) en progression lisible.",
    rendering: PRESET_CINEMA,
  },
  {
    id: "humain_face_expert",
    categoryId: "humain",
    name: "Face caméra (expert / conseil)",
    description: "Un artisan explique un problème à la caméra",
    popular: true,
    pexelsQuery: "expert speaking camera professional",
    placeholderIdea: "Le problème client en une phrase, ton ton pro, arrière-plan métier (atelier, véhicule, chantier).",
    rendering: PRESET_FACE,
  },
  {
    id: "humain_temoignage",
    categoryId: "humain",
    name: "Témoignage client",
    description: "Un client raconte son expérience après une prestation",
    popular: true,
    pexelsQuery: "customer talking smiling happy",
    placeholderIdea: "Contexte du client, travail réalisé, résultat concret (phrase courte + décor identifiable).",
    rendering: { ...PRESET_FACE, selfieMode: false, cameraFixed: false },
  },
  {
    id: "humain_interview",
    categoryId: "humain",
    name: "Interview",
    description: "Deux personnes en échange questions / réponses",
    popular: false,
    pexelsQuery: "two people interview microphone",
    placeholderIdea: "Plan large ou champ-contrechamp suggéré : qui pose la question, sujet, lieu.",
    rendering: PRESET_INTERVIEW,
  },
  {
    id: "humain_faq",
    categoryId: "humain",
    name: "FAQ face caméra",
    description: "Répondre à une question fréquente client",
    popular: false,
    pexelsQuery: "person answering question camera",
    placeholderIdea: "La question exacte (comme un client la poserait) et la réponse en images possibles sur le même plan.",
    rendering: PRESET_FACE,
  },
  {
    id: "humain_mythe_realite",
    categoryId: "humain",
    name: "Mythe vs réalité",
    description: "Démontrer une croyance fausse du marché",
    popular: false,
    pexelsQuery: "myth reality fact check",
    placeholderIdea: "Le mythe en une ligne, la démonstration qui l’infirme (plan split ou avant/après conceptuel).",
    rendering: { ...PRESET_FACE, revealMode: true },
  },
  {
    id: "humain_reaction",
    categoryId: "humain",
    name: "Réaction (reaction video)",
    description: "Réagir à une situation, un produit ou un avis client",
    popular: false,
    pexelsQuery: "person surprised reaction genuine",
    placeholderIdea: "Ce que tu regardes ou lis (écran, papier) et ta réaction filmée au même cadrage.",
    rendering: PRESET_VLOG,
  },
  {
    id: "process_demo_geste",
    categoryId: "process",
    name: "Démonstration geste métier",
    description: "Réparer une serrure, poser un carreau, en gros plan",
    popular: false,
    pexelsQuery: "craftsman hands working close up",
    placeholderIdea: "L’outil, la zone touchée, le geste précis et le résultat immédiat visible.",
    rendering: { ...PRESET_DEMO, cameraFixed: true },
  },
  {
    id: "process_timelapse",
    categoryId: "process",
    name: "Timelapse / accéléré",
    description: "Construction ou réalisation en accéléré",
    popular: true,
    pexelsQuery: "construction timelapse building",
    placeholderIdea: "Ce qui se construit ou se transforme sur place (un seul axe de progression, même cadre).",
    rendering: PRESET_TIMELAPSE,
  },
  {
    id: "process_avant_apres",
    categoryId: "process",
    name: "Avant / Après",
    description: "Une pièce ou situation passe de sale / cassé à rénovée / réparée",
    popular: true,
    pexelsQuery: "room renovation before after",
    placeholderIdea: "État de départ lisible, même angle pour la révélation finale (réparation ou finition).",
    rendering: PRESET_AVANT_APRES,
  },
  {
    id: "process_coulisses",
    categoryId: "process",
    name: "Coulisses / backstage",
    description: "Préparation d'un chantier ou d'un tournage",
    popular: false,
    pexelsQuery: "behind the scenes filming crew",
    placeholderIdea: "Ce qui se prépare hors vue client : matériel, brief, équipe en mouvement (un seul lieu).",
    rendering: { ...PRESET_VLOG, selfieMode: false, cinematicMovement: true },
  },
  {
    id: "process_step_by_step",
    categoryId: "process",
    name: "Step-by-step (étapes visibles)",
    description: "Chaque étape d'un process montrée l'une après l'autre",
    popular: false,
    pexelsQuery: "step by step process workshop",
    placeholderIdea: "La chaîne d’étapes dans un même flux (ex. dépose → prépa → pose) sans couper l’idée visuelle globale.",
    rendering: { ...PRESET_TIMELAPSE, revealMode: true },
  },
  {
    id: "process_erreur_correction",
    categoryId: "process",
    name: "Erreur → correction",
    description: "Montrer une mauvaise pratique puis la bonne",
    popular: false,
    pexelsQuery: "wrong right correction work",
    placeholderIdea: "Le geste ou la pose incorrecte, puis la même prise corrigée (même cadrage si possible).",
    rendering: { ...PRESET_NEUTRAL, revealMode: true, sequenceType: "single_8s" },
  },
  {
    id: "process_accel_zoom",
    categoryId: "process",
    name: "Process accéléré + zoom moments clés",
    description: "Mélange timelapse + focus sur les détails importants",
    popular: false,
    pexelsQuery: "fast work montage craftsman",
    placeholderIdea: "La vue d’ensemble accélérée et 1–2 zooms sur les points critiques (joint, serrage, niveau).",
    rendering: { ...PRESET_TIMELAPSE, cinematicMovement: true, tempo: "timelapse" },
  },
  {
    id: "social_vlog_pov",
    categoryId: "social",
    name: "Vlog (POV / immersion)",
    description: '"Viens avec moi sur mon chantier" filmé en selfie',
    popular: true,
    pexelsQuery: "selfie vlog construction site pov",
    placeholderIdea: "Point de départ, trajet ou entrée sur le lieu, ce que tu montres en te déplaçant (un seul fil).",
    rendering: PRESET_VLOG,
  },
  {
    id: "social_hook_educatif",
    categoryId: "social",
    name: "Hook éducatif court",
    description: '"Si ton moteur fait ça, arrête tout" en 5 secondes',
    popular: true,
    pexelsQuery: "short video education phone",
    placeholderIdea: "Le signal d’alerte visuel, la pièce ou zone concernée, l’action à faire (sans sur-narrer).",
    rendering: { ...PRESET_FACE, cameraFixed: false, selfieMode: true },
  },
  {
    id: "social_challenge",
    categoryId: "social",
    name: "Challenge / expérience",
    description: "Tester un produit et montrer le résultat réel",
    popular: false,
    pexelsQuery: "person testing product result reaction",
    placeholderIdea: "La règle du test, la mise en situation, le résultat mesurable ou visible.",
    rendering: PRESET_DEMO,
  },
  {
    id: "social_trend",
    categoryId: "social",
    name: "Trend / détournement",
    description: "Reprendre une trend TikTok adaptée au métier",
    popular: false,
    pexelsQuery: "tiktok trend creative video",
    placeholderIdea: "Le format trend (même structure), ton détournement métier concret (geste, lieu, punchline visuelle).",
    rendering: PRESET_VLOG,
  },
  {
    id: "social_reponse_commentaire",
    categoryId: "social",
    name: "Réponse à commentaire",
    description: "Une vidéo qui répond directement à un commentaire affiché",
    popular: false,
    pexelsQuery: "phone comment reply social media",
    placeholderIdea: "Le commentaire (texte affiché ou lu), la démonstration qui répond en image.",
    rendering: PRESET_FACE,
  },
  {
    id: "social_duet_stitch",
    categoryId: "social",
    name: "Duet / Stitch",
    description: "Rebondir sur une autre vidéo",
    popular: false,
    pexelsQuery: "split screen two people video",
    placeholderIdea: "L’extrait rebondi (sujet), ta prise (même cadre ou split), la conclusion en une image.",
    rendering: { ...PRESET_FACE, cameraFixed: false },
  },
  {
    id: "social_liste_rapide",
    categoryId: "social",
    name: "Liste rapide (list format)",
    description: '"3 erreurs à éviter…" avec enchaînement rapide',
    popular: false,
    pexelsQuery: "person scrolling phone vertical video tips",
    placeholderIdea: "Le nombre d’items, chaque erreur identifiée visuellement (plan qui suit la liste sans dispersion).",
    rendering: { ...PRESET_FACE, sequenceType: "three_x_8s", cameraFixed: true },
  },
  {
    id: "social_avant_apres_explicatif",
    categoryId: "social",
    name: "Avant / Après + explication rapide",
    description: "Combo transformation + face caméra",
    popular: false,
    pexelsQuery: "before after room renovation split",
    placeholderIdea: "Plan avant (même angle), transformation ou résultat, retour face caméra pour une phrase clé.",
    rendering: { ...PRESET_AVANT_APRES, selfieMode: true, revealMode: true, tempo: "real_time" },
  },
];

export const VWS_VIDEO_FORMATS: VwsVideoFormatDef[] = _formats;

const byId = new Map<string, VwsVideoFormatDef>();
for (const f of VWS_VIDEO_FORMATS) {
  byId.set(f.id, f);
}

export function getFormatById(id: string | null | undefined): VwsVideoFormatDef | null {
  if (!id || typeof id !== "string") return null;
  return byId.get(id) ?? null;
}

export function getFormatsByCategory(categoryId: VwsVideoFormatCategoryId): VwsVideoFormatDef[] {
  return VWS_VIDEO_FORMATS.filter((f) => f.categoryId === categoryId);
}

export function getPopularIdsForCategory(categoryId: VwsVideoFormatCategoryId): string[] {
  return getFormatsByCategory(categoryId)
    .filter((f) => f.popular)
    .map((f) => f.id);
}

export function isValidVideoFormatId(id: string | null | undefined): boolean {
  return Boolean(id && byId.has(id));
}

export function getFormatHintForEngine(format: VwsVideoFormatDef | null): string {
  if (!format) return "";
  return `Format vidéo choisi : ${format.name}. Attendu : ${format.description}.`;
}
