// ============================================================
// VIDEO FORMAT CONFIG — ViralWorks Studio
// ============================================================
// Ce fichier remplace les anciens choix manuels "camera" et
// "vitesse de lecture" (timelapse / slow motion / normal).
// Chaque format fixe ses propres paramètres par défaut.
// Ces valeurs sont injectées directement dans le pipeline de
// génération de prompt (input API) sans passer par un LLM.
// ============================================================

export type VideoSpeed =
  | "normal"
  | "slow_motion"
  | "timelapse"
  | "accelere"
  | "mixte"; // timelapse + zooms normaux sur moments clés

export type CameraAngle =
  | "face"
  | "plongee"
  | "contre_plongee"
  | "macro"
  | "travelling"
  | "epaule"
  | "selfie_pov"
  | "fixe_trépied"
  | "panoramique"
  | "gros_plan_mains";

export type MontageStyle =
  | "cinematique"
  | "didactique"
  | "dynamique"
  | "brut_authentique"
  | "reveal_progressif"
  | "lineaire"
  | "alternatif"
  | "minimaliste";

export type VideoRatio = "9:16" | "16:9" | "1:1" | "4:5";

export interface VideoFormatParams {
  label: string;
  categorie: VideoFormatCategory;
  populaire?: boolean;
  description: string;

  // — Anciens paramètres manuels, maintenant fixés par le format —
  vitesse: VideoSpeed;
  camera: CameraAngle[];           // angles recommandés, dans l'ordre de priorité

  // — Paramètres complémentaires pour enrichir le prompt moteur vidéo —
  duree_secondes: [number, number]; // [min, max]
  ratio: VideoRatio;
  montage: MontageStyle;
  eclairage: string;               // description libre pour le prompt
  ambiance_sonore: string;         // description libre pour le prompt
  accroche_type: string;           // type d'accroche pour les 3 premières secondes
  mots_cles_prompt: string[];      // injectés dans le prompt moteur vidéo
}

export type VideoFormatCategory =
  | "produit"
  | "storytelling"
  | "humain"
  | "process"
  | "social_natif";

// ============================================================
// PRODUIT (8 formats)
// ============================================================

const PRODUIT_FORMATS = {

  publicite_produit_esthetique: {
    label: "Publicité produit (shooting esthétique)",
    categorie: "produit" as const,
    populaire: true,
    description: "Un produit filmé avec lumière dramatique et slow motion",
    vitesse: "slow_motion" as const,
    camera: ["macro", "travelling", "plongee"] as CameraAngle[],
    duree_secondes: [15, 30] as [number, number],
    ratio: "9:16" as const,
    montage: "cinematique" as const,
    eclairage: "lumière dramatique, contre-jour, reflets contrôlés",
    ambiance_sonore: "musique ambient luxe ou cinématique, peu ou pas de voix",
    accroche_type: "visuelle_sensorielle",
    mots_cles_prompt: ["slow motion", "dramatic lighting", "product close-up", "cinematic", "luxury feel"],
  },

  demonstration_produit: {
    label: "Démonstration produit",
    categorie: "produit" as const,
    populaire: true,
    description: "L'outil ou le produit utilisé en direct",
    vitesse: "normal" as const,
    camera: ["face", "gros_plan_mains", "plongee"] as CameraAngle[],
    duree_secondes: [30, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "didactique" as const,
    eclairage: "neutre et clair, pas d'ombres dures",
    ambiance_sonore: "légère, fonctionnelle, voix off ou face caméra possible",
    accroche_type: "probleme_solution",
    mots_cles_prompt: ["product in use", "close-up hands", "clear lighting", "tutorial style"],
  },

  unboxing: {
    label: "Unboxing",
    categorie: "produit" as const,
    description: "Ouverture d'une boîte avec reveal progressif",
    vitesse: "normal" as const,
    camera: ["plongee", "gros_plan_mains", "macro"] as CameraAngle[],
    duree_secondes: [30, 90] as [number, number],
    ratio: "9:16" as const,
    montage: "reveal_progressif" as const,
    eclairage: "naturel ou studio doux",
    ambiance_sonore: "sons ASMR de l'emballage, musique de curiosité en fond",
    accroche_type: "suspense_curiosite",
    mots_cles_prompt: ["unboxing", "overhead shot", "hands opening package", "reveal", "ASMR texture"],
  },

  test_review_produit: {
    label: "Test / Review produit",
    categorie: "produit" as const,
    description: "Quelqu'un essaie et donne son avis face caméra",
    vitesse: "normal" as const,
    camera: ["face", "gros_plan_mains", "macro"] as CameraAngle[],
    duree_secondes: [45, 90] as [number, number],
    ratio: "9:16" as const,
    montage: "dynamique" as const,
    eclairage: "naturel ou studio semi-professionnel",
    ambiance_sonore: "voix principale, musique discrète",
    accroche_type: "opinion_directe",
    mots_cles_prompt: ["talking head", "product testing", "honest review", "close-up reaction"],
  },

  comparatif_produit: {
    label: "Comparatif produit",
    categorie: "produit" as const,
    description: "Deux produits ou options testés côte à côte",
    vitesse: "normal" as const,
    camera: ["plongee", "face", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [30, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "alternatif" as const,
    eclairage: "uniforme et neutre pour les deux sujets",
    ambiance_sonore: "voix structurée, transitions sonores nettes",
    accroche_type: "comparaison_directe",
    mots_cles_prompt: ["side by side comparison", "split frame", "overhead product shot", "neutral lighting"],
  },

  focus_detail_produit: {
    label: "Focus détail produit",
    categorie: "produit" as const,
    description: "Zoom extrême sur une matière ou une finition",
    vitesse: "slow_motion" as const,
    camera: ["macro", "gros_plan_mains", "plongee"] as CameraAngle[],
    duree_secondes: [10, 20] as [number, number],
    ratio: "9:16" as const,
    montage: "cinematique" as const,
    eclairage: "lumière rasante pour révéler la texture",
    ambiance_sonore: "ASMR texture, silence ou ambient minimaliste",
    accroche_type: "sensorielle_texture",
    mots_cles_prompt: ["extreme macro", "material texture", "slow motion detail", "raking light", "craftsmanship"],
  },

  preuve_par_performance: {
    label: "Preuve par performance",
    categorie: "produit" as const,
    description: "Le produit dans une situation extrême",
    vitesse: "normal" as const,
    camera: ["epaule", "travelling", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [20, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "dynamique" as const,
    eclairage: "naturel, environnement réel (chantier, terrain, etc.)",
    ambiance_sonore: "sons d'ambiance forts, musique percutante",
    accroche_type: "defi_performance",
    mots_cles_prompt: ["extreme conditions", "product stress test", "real environment", "action shot", "durability"],
  },

  reveal_produit: {
    label: "Reveal produit",
    categorie: "produit" as const,
    description: "Produit caché puis dévoilé progressivement",
    vitesse: "slow_motion" as const,
    camera: ["plongee", "macro", "travelling"] as CameraAngle[],
    duree_secondes: [15, 30] as [number, number],
    ratio: "9:16" as const,
    montage: "reveal_progressif" as const,
    eclairage: "spot dramatique, fond sombre",
    ambiance_sonore: "montée musicale, silence puis impact sonore",
    accroche_type: "tension_devoilement",
    mots_cles_prompt: ["product reveal", "dramatic reveal", "slow motion unveil", "spotlight", "dark background"],
  },

} satisfies Record<string, VideoFormatParams>;

// ============================================================
// STORYTELLING (6 formats)
// ============================================================

const STORYTELLING_FORMATS = {

  tv_spot_mini_film: {
    label: "TV Spot (mini-film publicitaire)",
    categorie: "storytelling" as const,
    description: "Une micro-histoire avec tension et résolution",
    vitesse: "normal" as const,
    camera: ["travelling", "epaule", "face"] as CameraAngle[],
    duree_secondes: [15, 30] as [number, number],
    ratio: "9:16" as const,
    montage: "cinematique" as const,
    eclairage: "cinématique, ambiance travaillée",
    ambiance_sonore: "musique narrative, sound design, peu ou pas de voix",
    accroche_type: "narrative_tension",
    mots_cles_prompt: ["cinematic storytelling", "narrative arc", "dramatic lighting", "mini film", "emotional"],
  },

  pub_probleme_solution: {
    label: "Publicité problème → solution",
    categorie: "storytelling" as const,
    populaire: true,
    description: "Une situation négative résolue par le produit ou service",
    vitesse: "normal" as const,
    camera: ["face", "epaule", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [30, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "alternatif" as const,
    eclairage: "sombre côté problème, lumineux côté solution",
    ambiance_sonore: "tension → résolution musicale",
    accroche_type: "douleur_identifiable",
    mots_cles_prompt: ["before after", "problem solution", "contrast lighting", "relatable situation", "transformation"],
  },

  mise_en_situation_lifestyle: {
    label: "Mise en situation (lifestyle)",
    categorie: "storytelling" as const,
    populaire: true,
    description: "Quelqu'un utilise le produit dans sa routine du matin",
    vitesse: "normal" as const,
    camera: ["epaule", "selfie_pov", "travelling"] as CameraAngle[],
    duree_secondes: [20, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "dynamique" as const,
    eclairage: "naturel, lumière dorée matin ou ambiance cosy",
    ambiance_sonore: "musique lifestyle positive, sons du quotidien",
    accroche_type: "identification_style_vie",
    mots_cles_prompt: ["lifestyle shot", "natural light", "morning routine", "authentic moment", "handheld"],
  },

  histoire_client_reelle: {
    label: "Histoire client réelle",
    categorie: "storytelling" as const,
    description: "Un cas concret raconté du début à la fin",
    vitesse: "normal" as const,
    camera: ["face", "epaule", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [45, 90] as [number, number],
    ratio: "9:16" as const,
    montage: "lineaire" as const,
    eclairage: "naturel ou studio simple",
    ambiance_sonore: "voix principale, fond musical discret",
    accroche_type: "temoignage_authentique",
    mots_cles_prompt: ["testimonial", "real story", "interview style", "authentic", "talking head"],
  },

  story_origine_why: {
    label: "Story origine (why)",
    categorie: "storytelling" as const,
    description: "Pourquoi l'entreprise existe, comment elle a commencé",
    vitesse: "normal" as const,
    camera: ["face", "travelling", "epaule"] as CameraAngle[],
    duree_secondes: [45, 90] as [number, number],
    ratio: "9:16" as const,
    montage: "lineaire" as const,
    eclairage: "chaleureux, humain",
    ambiance_sonore: "musique inspirante, voix sincère",
    accroche_type: "raison_detre",
    mots_cles_prompt: ["founder story", "why we exist", "personal narrative", "warm lighting", "authentic"],
  },

  projection_scenario_futur: {
    label: "Projection / scénario futur",
    categorie: "storytelling" as const,
    description: "Ce que devient la vie du client après utilisation",
    vitesse: "normal" as const,
    camera: ["travelling", "contre_plongee", "epaule"] as CameraAngle[],
    duree_secondes: [20, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "cinematique" as const,
    eclairage: "lumineux, ouvert, optimiste",
    ambiance_sonore: "musique aspirationnelle, voix off ou face caméra",
    accroche_type: "vision_futur_desirable",
    mots_cles_prompt: ["aspirational", "future vision", "bright lighting", "empowered person", "cinematic wide shot"],
  },

} satisfies Record<string, VideoFormatParams>;

// ============================================================
// HUMAIN (6 formats)
// ============================================================

const HUMAIN_FORMATS = {

  face_camera_expert: {
    label: "Face caméra (expert / conseil)",
    categorie: "humain" as const,
    populaire: true,
    description: "Un artisan explique un problème à la caméra",
    vitesse: "normal" as const,
    camera: ["face", "contre_plongee", "epaule"] as CameraAngle[],
    duree_secondes: [30, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "minimaliste" as const,
    eclairage: "trois points ou naturel bien contrôlé",
    ambiance_sonore: "voix seule ou fond musical très discret",
    accroche_type: "autorite_expertise",
    mots_cles_prompt: ["talking head", "expert advice", "direct to camera", "professional setting", "confident"],
  },

  temoignage_client: {
    label: "Témoignage client",
    categorie: "humain" as const,
    populaire: true,
    description: "Un client raconte son expérience après une prestation",
    vitesse: "normal" as const,
    camera: ["face", "epaule"] as CameraAngle[],
    duree_secondes: [30, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "brut_authentique" as const,
    eclairage: "naturel, pas de setup artificiel",
    ambiance_sonore: "voix naturelle, sons d'ambiance légers",
    accroche_type: "preuve_sociale",
    mots_cles_prompt: ["customer testimonial", "authentic", "natural light", "real person", "satisfied client"],
  },

  interview: {
    label: "Interview",
    categorie: "humain" as const,
    description: "Deux personnes en échange questions / réponses",
    vitesse: "normal" as const,
    camera: ["face", "epaule", "contre_plongee"] as CameraAngle[],
    duree_secondes: [45, 120] as [number, number],
    ratio: "9:16" as const,
    montage: "alternatif" as const,
    eclairage: "studio ou naturel propre",
    ambiance_sonore: "deux voix, fond discret",
    accroche_type: "dialogue_tension",
    mots_cles_prompt: ["interview setup", "two shot", "question answer", "professional", "over the shoulder"],
  },

  faq_face_camera: {
    label: "FAQ face caméra",
    categorie: "humain" as const,
    description: "Répondre à une question fréquente client",
    vitesse: "normal" as const,
    camera: ["face", "contre_plongee"] as CameraAngle[],
    duree_secondes: [20, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "minimaliste" as const,
    eclairage: "neutre et clair",
    ambiance_sonore: "voix directe, pas de musique ou très discrète",
    accroche_type: "question_directe",
    mots_cles_prompt: ["FAQ", "direct answer", "talking head", "simple background", "clear and confident"],
  },

  mythe_vs_realite: {
    label: "Mythe vs réalité",
    categorie: "humain" as const,
    description: "Démontrer une croyance fausse du marché",
    vitesse: "normal" as const,
    camera: ["face", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [30, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "alternatif" as const,
    eclairage: "clair et propre",
    ambiance_sonore: "voix dynamique, effets sonores de validation/invalidation",
    accroche_type: "contre_intuition",
    mots_cles_prompt: ["myth busting", "direct to camera", "expressive", "fact vs fiction", "educational"],
  },

  reaction_video: {
    label: "Réaction (reaction video)",
    categorie: "humain" as const,
    description: "Réagir à une situation, un produit ou un avis client",
    vitesse: "normal" as const,
    camera: ["face", "selfie_pov"] as CameraAngle[],
    duree_secondes: [20, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "dynamique" as const,
    eclairage: "naturel ou lumière d'écran acceptée",
    ambiance_sonore: "voix spontanée, réactions authentiques",
    accroche_type: "emotion_spontanee",
    mots_cles_prompt: ["reaction", "genuine surprise", "face cam", "authentic emotion", "candid"],
  },

} satisfies Record<string, VideoFormatParams>;

// ============================================================
// PROCESS / TRANSFORMATION (7 formats)
// ============================================================

const PROCESS_FORMATS = {

  demonstration_geste_metier: {
    label: "Démonstration geste métier",
    categorie: "process" as const,
    description: "Réparer une serrure, poser un carreau, en gros plan",
    vitesse: "normal" as const,
    camera: ["gros_plan_mains", "plongee", "macro"] as CameraAngle[],
    duree_secondes: [30, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "didactique" as const,
    eclairage: "lumière directe sur les mains, fond neutre ou réel",
    ambiance_sonore: "sons du geste métier, voix off ou silence",
    accroche_type: "savoir_faire_visible",
    mots_cles_prompt: ["close-up hands", "craftsman skill", "overhead POV", "professional technique", "satisfying"],
  },

  timelapse_accelere: {
    label: "Timelapse / accéléré",
    categorie: "process" as const,
    populaire: true,
    description: "Construction ou réalisation en accéléré",
    vitesse: "timelapse" as const,
    camera: ["fixe_trépied", "panoramique", "plongee"] as CameraAngle[],
    duree_secondes: [15, 30] as [number, number],
    ratio: "9:16" as const,
    montage: "cinematique" as const,
    eclairage: "naturel évoluant dans le temps",
    ambiance_sonore: "musique rythmée ou épique, pas de voix",
    accroche_type: "transformation_rapide",
    mots_cles_prompt: ["timelapse", "fixed camera", "time compression", "construction process", "satisfying transformation"],
  },

  avant_apres: {
    label: "Avant / Après",
    categorie: "process" as const,
    populaire: true,
    description: "Une pièce ou situation passe de sale / cassé à rénovée / réparée",
    vitesse: "normal" as const,
    camera: ["fixe_trépied", "plongee", "face"] as CameraAngle[],
    duree_secondes: [15, 30] as [number, number],
    ratio: "9:16" as const,
    montage: "alternatif" as const,
    eclairage: "identique avant et après pour la comparaison",
    ambiance_sonore: "transition sonore marquée (whoosh), musique uplifting",
    accroche_type: "transformation_choc",
    mots_cles_prompt: ["before after", "same angle", "wipe transition", "transformation reveal", "dramatic change"],
  },

  coulisses_backstage: {
    label: "Coulisses / backstage",
    categorie: "process" as const,
    description: "Préparation d'un chantier ou d'un tournage",
    vitesse: "normal" as const,
    camera: ["epaule", "selfie_pov", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [30, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "brut_authentique" as const,
    eclairage: "naturel, lumière de situation",
    ambiance_sonore: "sons d'ambiance du lieu, voix naturelle",
    accroche_type: "transparence_authenticite",
    mots_cles_prompt: ["behind the scenes", "handheld", "authentic", "workplace", "candid moment"],
  },

  step_by_step: {
    label: "Step-by-step (étapes visibles)",
    categorie: "process" as const,
    description: "Chaque étape d'un process montrée l'une après l'autre",
    vitesse: "normal" as const,
    camera: ["plongee", "gros_plan_mains", "face"] as CameraAngle[],
    duree_secondes: [45, 90] as [number, number],
    ratio: "9:16" as const,
    montage: "didactique" as const,
    eclairage: "clair et uniforme",
    ambiance_sonore: "voix structurée, numérotation des étapes",
    accroche_type: "promesse_methode_simple",
    mots_cles_prompt: ["step by step", "overhead tutorial", "numbered steps", "clear lighting", "educational"],
  },

  erreur_correction: {
    label: "Erreur → correction",
    categorie: "process" as const,
    description: "Montrer une mauvaise pratique puis la bonne",
    vitesse: "normal" as const,
    camera: ["face", "gros_plan_mains", "epaule"] as CameraAngle[],
    duree_secondes: [30, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "alternatif" as const,
    eclairage: "neutre",
    ambiance_sonore: "son d'erreur / son de validation, voix explicative",
    accroche_type: "erreur_identifiable",
    mots_cles_prompt: ["wrong vs right", "common mistake", "correction", "educational contrast", "expressive reaction"],
  },

  process_accelere_zoom_cles: {
    label: "Process accéléré + zoom moments clés",
    categorie: "process" as const,
    description: "Mélange timelapse + focus sur les détails importants",
    vitesse: "mixte" as const,
    camera: ["fixe_trépied", "macro", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [20, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "dynamique" as const,
    eclairage: "naturel évoluant",
    ambiance_sonore: "musique rythmée, pauses sur les moments clés",
    accroche_type: "expertise_condensee",
    mots_cles_prompt: ["timelapse with closeups", "key moments highlighted", "mixed speed", "process mastery", "satisfying"],
  },

} satisfies Record<string, VideoFormatParams>;

// ============================================================
// SOCIAL NATIF (8 formats)
// ============================================================

const SOCIAL_NATIF_FORMATS = {

  vlog_pov_immersion: {
    label: "Vlog (POV / immersion)",
    categorie: "social_natif" as const,
    populaire: true,
    description: '"Viens avec moi sur mon chantier" filmé en selfie',
    vitesse: "normal" as const,
    camera: ["selfie_pov", "epaule"] as CameraAngle[],
    duree_secondes: [20, 60] as [number, number],
    ratio: "9:16" as const,
    montage: "brut_authentique" as const,
    eclairage: "naturel de situation",
    ambiance_sonore: "sons d'ambiance réels, voix naturelle et spontanée",
    accroche_type: "immersion_follow_me",
    mots_cles_prompt: ["POV selfie", "follow me", "authentic vlog", "handheld selfie", "real environment"],
  },

  hook_educatif_court: {
    label: "Hook éducatif court",
    categorie: "social_natif" as const,
    populaire: true,
    description: '"Si ton moteur fait ça, arrête tout" en 5 secondes',
    vitesse: "normal" as const,
    camera: ["face", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [15, 30] as [number, number],
    ratio: "9:16" as const,
    montage: "dynamique" as const,
    eclairage: "clair et direct",
    ambiance_sonore: "voix impactante, cut sec, pas de musique ou très discrète",
    accroche_type: "alerte_urgence",
    mots_cles_prompt: ["urgent hook", "direct to camera", "educational short", "attention-grabbing", "clear face"],
  },

  challenge_experience: {
    label: "Challenge / expérience",
    categorie: "social_natif" as const,
    description: "Tester un produit et montrer le résultat réel",
    vitesse: "normal" as const,
    camera: ["face", "epaule", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [20, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "dynamique" as const,
    eclairage: "naturel ou lumière de situation",
    ambiance_sonore: "réaction spontanée, sons du test, fond dynamique",
    accroche_type: "defi_curiosite",
    mots_cles_prompt: ["challenge", "product test", "genuine reaction", "real result", "experiment"],
  },

  trend_detournement: {
    label: "Trend / détournement",
    categorie: "social_natif" as const,
    description: "Reprendre une trend TikTok adaptée au métier",
    vitesse: "normal" as const,
    camera: ["face", "selfie_pov"] as CameraAngle[],
    duree_secondes: [10, 30] as [number, number],
    ratio: "9:16" as const,
    montage: "dynamique" as const,
    eclairage: "naturel ou ambiance tendance",
    ambiance_sonore: "son tendance du moment adapté",
    accroche_type: "reconnaissance_trend",
    mots_cles_prompt: ["trending format", "TikTok style", "relatable", "fun adaptation", "face cam"],
  },

  reponse_commentaire: {
    label: "Réponse à commentaire",
    categorie: "social_natif" as const,
    description: "Une vidéo qui répond directement à un commentaire affiché",
    vitesse: "normal" as const,
    camera: ["face"] as CameraAngle[],
    duree_secondes: [20, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "minimaliste" as const,
    eclairage: "naturel simple",
    ambiance_sonore: "voix directe, commentaire visible à l'écran",
    accroche_type: "interaction_communaute",
    mots_cles_prompt: ["reply to comment", "direct address", "talking head", "comment overlay", "community engagement"],
  },

  duet_stitch: {
    label: "Duet / Stitch",
    categorie: "social_natif" as const,
    description: "Rebondir sur une autre vidéo",
    vitesse: "normal" as const,
    camera: ["face", "epaule"] as CameraAngle[],
    duree_secondes: [15, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "alternatif" as const,
    eclairage: "naturel",
    ambiance_sonore: "réaction à l'audio original",
    accroche_type: "rebond_contenu",
    mots_cles_prompt: ["stitch reaction", "split screen", "response video", "duet format", "reaction face cam"],
  },

  liste_rapide_list_format: {
    label: "Liste rapide (list format)",
    categorie: "social_natif" as const,
    description: '"3 erreurs à éviter..." avec enchaînement rapide',
    vitesse: "normal" as const,
    camera: ["face", "gros_plan_mains"] as CameraAngle[],
    duree_secondes: [20, 45] as [number, number],
    ratio: "9:16" as const,
    montage: "dynamique" as const,
    eclairage: "clair et propre",
    ambiance_sonore: "voix rythmée, transitions sonores entre items",
    accroche_type: "promesse_liste_chiffree",
    mots_cles_prompt: ["list format", "numbered tips", "quick cuts", "talking head", "educational"],
  },

  avant_apres_explication_rapide: {
    label: "Avant / Après + explication rapide",
    categorie: "social_natif" as const,
    description: "Combo transformation + face caméra",
    vitesse: "normal" as const,
    camera: ["fixe_trépied", "face"] as CameraAngle[],
    duree_secondes: [20, 40] as [number, number],
    ratio: "9:16" as const,
    montage: "alternatif" as const,
    eclairage: "identique avant/après + face cam neutre",
    ambiance_sonore: "transition whoosh, voix explicative courte",
    accroche_type: "transformation_expliquee",
    mots_cles_prompt: ["before after", "talking head explanation", "wipe transition", "quick transformation", "clear result"],
  },

} satisfies Record<string, VideoFormatParams>;

// ============================================================
// EXPORT CENTRAL
// ============================================================

export const VIDEO_FORMATS = {
  ...PRODUIT_FORMATS,
  ...STORYTELLING_FORMATS,
  ...HUMAIN_FORMATS,
  ...PROCESS_FORMATS,
  ...SOCIAL_NATIF_FORMATS,
} as const;

export type VideoFormatKey = keyof typeof VIDEO_FORMATS;

// Helper : récupérer la config d'un format par sa clé
export function getVideoFormatConfig(key: VideoFormatKey): VideoFormatParams {
  return VIDEO_FORMATS[key];
}

// Helper : récupérer tous les formats d'une catégorie
export function getFormatsByCategory(categorie: VideoFormatCategory): VideoFormatParams[] {
  return Object.values(VIDEO_FORMATS).filter(f => f.categorie === categorie);
}

/**
 * Correspondance IDs catalogue UI (`vwsVideoFormatsCatalog`) → clés `VIDEO_FORMATS`.
 * Les IDs persistés (`video_format_id`) restent ceux du catalogue.
 */
export const CATALOG_ID_TO_VIDEO_FORMAT_KEY = {
  produit_pub_esthetique: "publicite_produit_esthetique",
  produit_demo: "demonstration_produit",
  produit_unboxing: "unboxing",
  produit_test_review: "test_review_produit",
  produit_comparatif: "comparatif_produit",
  produit_focus_detail: "focus_detail_produit",
  produit_preuve_performance: "preuve_par_performance",
  produit_reveal: "reveal_produit",
  story_tv_spot: "tv_spot_mini_film",
  story_probleme_solution: "pub_probleme_solution",
  story_lifestyle: "mise_en_situation_lifestyle",
  story_histoire_client: "histoire_client_reelle",
  story_origine: "story_origine_why",
  story_projection_futur: "projection_scenario_futur",
  humain_face_expert: "face_camera_expert",
  humain_temoignage: "temoignage_client",
  humain_interview: "interview",
  humain_faq: "faq_face_camera",
  humain_mythe_realite: "mythe_vs_realite",
  humain_reaction: "reaction_video",
  process_demo_geste: "demonstration_geste_metier",
  process_timelapse: "timelapse_accelere",
  process_avant_apres: "avant_apres",
  process_coulisses: "coulisses_backstage",
  process_step_by_step: "step_by_step",
  process_erreur_correction: "erreur_correction",
  process_accel_zoom: "process_accelere_zoom_cles",
  social_vlog_pov: "vlog_pov_immersion",
  social_hook_educatif: "hook_educatif_court",
  social_challenge: "challenge_experience",
  social_trend: "trend_detournement",
  social_reponse_commentaire: "reponse_commentaire",
  social_duet_stitch: "duet_stitch",
  social_liste_rapide: "liste_rapide_list_format",
  social_avant_apres_explicatif: "avant_apres_explication_rapide",
} as const satisfies Record<string, VideoFormatKey>;

export type CatalogVideoFormatId = keyof typeof CATALOG_ID_TO_VIDEO_FORMAT_KEY;

export function getVideoFormatKeyForCatalogId(catalogId: string | null | undefined): VideoFormatKey | null {
  if (!catalogId || typeof catalogId !== "string") return null;
  const key = CATALOG_ID_TO_VIDEO_FORMAT_KEY[catalogId as CatalogVideoFormatId];
  return key ?? null;
}

/** Config dérivée d’un ID catalogue ; `null` si ID inconnu ou absent. */
export function getVideoFormatConfigForCatalogId(catalogId: string | null | undefined): VideoFormatParams | null {
  const key = getVideoFormatKeyForCatalogId(catalogId);
  if (!key) return null;
  return getVideoFormatConfig(key);
}

/** Bloc texte à injecter dans les prompts (LLM / Veo), sans appel LLM. */
export function formatVideoFormatParamsPromptAppendix(params: VideoFormatParams): string {
  const [dMin, dMax] = params.duree_secondes;
  return [
    "Video format parameters (fixed, config):",
    `pace: ${params.vitesse}`,
    `camera: ${params.camera.join(", ")}`,
    `editing: ${params.montage}`,
    `lighting: ${params.eclairage}`,
    `sound_atmosphere: ${params.ambiance_sonore}`,
    `hook_type: ${params.accroche_type}`,
    `duration_seconds: ${dMin}-${dMax}`,
    `ratio: ${params.ratio}`,
    `prompt_keywords: ${params.mots_cles_prompt.join(", ")}`,
  ].join("\n");
}
