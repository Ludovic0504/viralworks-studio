/**
 * Glossaire FR → EN pour le Prompt Assistant (étape 1).
 * Aligné sur la méthode AICU et le vocabulaire des guides Image Studio.
 */

export type GlossaryCategory =
  | "shot"
  | "lens"
  | "lighting"
  | "style"
  | "material"
  | "intent";

export type GlossaryEntry = {
  id: string;
  /** Termes ou expressions français reconnus (minuscules, sans accents en matching). */
  termsFr: string[];
  /** Formulation anglaise précise à utiliser dans le prompt final. */
  promptEn: string;
  category: GlossaryCategory;
  /** Indication optionnelle pour le routage futur (étape 2+). */
  templateHint?: string;
};

export const PROMPT_TRANSLATION_GLOSSARY: GlossaryEntry[] = [
  // — Plans & cadrage (AICU + shot styles Image Studio)
  {
    id: "shot-ecu",
    termsFr: ["gros plan extreme", "ultra gros plan", "macro", "extreme close-up"],
    promptEn: "extreme close-up (ECU), macro detail in sharp focus",
    category: "shot",
  },
  {
    id: "shot-cu",
    termsFr: ["gros plan", "plan rapproche", "close-up", "portrait serre"],
    promptEn: "close-up (CU), chest-up framing, intimate composition",
    category: "shot",
  },
  {
    id: "shot-ms",
    termsFr: ["plan moyen", "medium shot", "taille"],
    promptEn: "medium shot (MS), waist-up framing",
    category: "shot",
  },
  {
    id: "shot-fs",
    termsFr: ["plan americain", "plan 3/4", "three-quarter shot"],
    promptEn: "medium long shot (American/3-4), knees-up framing",
    category: "shot",
  },
  {
    id: "shot-full",
    termsFr: ["plan entier", "corps entier", "full shot", "full body"],
    promptEn: "full shot (FS), head-to-toe framing",
    category: "shot",
  },
  {
    id: "shot-wide",
    termsFr: ["plan large", "plan eloigne", "long shot", "wide shot"],
    promptEn: "long shot (LS), subject small within the environment",
    category: "shot",
  },
  {
    id: "shot-ews",
    termsFr: ["plan tres eloigne", "extreme wide", "plan general"],
    promptEn: "extreme wide shot (EWS), epic environmental scale",
    category: "shot",
  },
  {
    id: "shot-bird-eye",
    termsFr: [
      "vue plongeante",
      "vue du dessus",
      "plongee",
      "bird's eye",
      "vue aerienne",
      "top-down",
      "flat lay",
    ],
    promptEn: "high angle shot, bird's eye view, overhead composition",
    category: "shot",
    templateHint: "product-photography",
  },
  {
    id: "shot-worm-eye",
    termsFr: ["vue contre-plongee", "contre-plongee", "vue basse", "worm's eye", "angle bas"],
    promptEn: "low angle shot, worm's eye view, subject monumental and imposing",
    category: "shot",
    templateHint: "product-photography",
  },
  {
    id: "shot-ots",
    termsFr: ["over the shoulder", "par-dessus l'epaule", "par dessus l epaule"],
    promptEn: "over-the-shoulder shot (OTS), cinematic presence",
    category: "shot",
  },
  {
    id: "shot-pov",
    termsFr: ["pov", "premiere personne", "point de vue", "vue subjective"],
    promptEn: "POV first-person perspective, immersive framing",
    category: "shot",
    templateHint: "lifestyle-product-photography",
  },
  {
    id: "shot-diagonal",
    termsFr: ["45 degres", "diagonal", "angle dynamique"],
    promptEn: "45-degree angle shot, dynamic diagonal composition",
    category: "shot",
  },
  {
    id: "shot-underwater",
    termsFr: ["sous l'eau", "sous l eau", "underwater", "aquatique"],
    promptEn: "underwater commercial product photography, crystal-clear water, caustic light patterns",
    category: "shot",
    templateHint: "product-photography",
  },
  {
    id: "shot-freeze",
    termsFr: ["freeze frame", "freeze-frame", "fige", "action figee", "mid-motion"],
    promptEn: "freeze-frame action shot, ingredients erupting outward in all directions",
    category: "shot",
  },
  {
    id: "shot-levitation",
    termsFr: ["levitation", "en levitation", "flottant", "suspendu dans les airs"],
    promptEn: "product floating mid-air, dynamic levitation, soft bokeh environment",
    category: "shot",
    templateHint: "packshot-dynamique",
  },
  {
    id: "shot-tight-minimal",
    termsFr: ["serre minimal", "minimal", "cadre serre", "cadrage serre"],
    promptEn: "tight minimal framing, product dominant in frame, shallow depth of field",
    category: "shot",
  },
  {
    id: "shot-wide-context",
    termsFr: ["cadrage large", "contexte large", "scene large"],
    promptEn: "wide contextual framing, product integrated in lifestyle scene, deeper depth of field",
    category: "shot",
  },

  // — Objectifs
  {
    id: "lens-wide",
    termsFr: ["grand angle", "24mm", "35mm", "objectif large"],
    promptEn: "24-35mm wide-angle lens, environmental dynamic framing",
    category: "lens",
  },
  {
    id: "lens-standard",
    termsFr: ["50mm", "objectif standard", "oeil humain"],
    promptEn: "50mm standard lens, natural human-eye perspective",
    category: "lens",
  },
  {
    id: "lens-portrait",
    termsFr: ["85mm", "135mm", "portrait", "objectif portrait", "f/1.4", "f1.4", "bokeh"],
    promptEn: "85mm portrait lens at f/1.4, shallow depth of field, background compression",
    category: "lens",
  },
  {
    id: "lens-tele",
    termsFr: ["teleobjectif", "200mm", "longue focale"],
    promptEn: "200mm telephoto lens, flat background, subject isolation",
    category: "lens",
  },

  // — Éclairage
  {
    id: "light-natural",
    termsFr: ["lumiere naturelle", "lumiere du jour", "soleil", "fenetre"],
    promptEn: "soft natural window light, realistic daylight, 5000-5600K neutral tone",
    category: "lighting",
  },
  {
    id: "light-studio",
    termsFr: ["studio", "softbox", "eclairage studio", "flash studio"],
    promptEn: "three-point studio setup, main softbox, controlled commercial lighting",
    category: "lighting",
  },
  {
    id: "light-rembrandt",
    termsFr: ["rembrandt", "lumiere laterale", "clair-obscur"],
    promptEn: "Rembrandt side lighting, sculptural shadows, dramatic depth",
    category: "lighting",
  },
  {
    id: "light-backlit",
    termsFr: ["contre-jour", "contre jour", "backlit", "silhouette"],
    promptEn: "backlit rim light, halo separation, contre-jour atmosphere",
    category: "lighting",
  },
  {
    id: "light-neon",
    termsFr: ["neon", "led", "cyberpunk", "lumiere coloree"],
    promptEn: "neon and LED accent lighting, futuristic colored glow",
    category: "lighting",
  },
  {
    id: "light-warm",
    termsFr: ["lumiere chaude", "tons chauds", "golden hour", "coucher de soleil", "3200k"],
    promptEn: "warm lighting 2700-3500K, golden hour glow, cozy atmosphere",
    category: "lighting",
  },
  {
    id: "light-cold",
    termsFr: ["lumiere froide", "tons froids", "6500k", "clinical"],
    promptEn: "cool lighting 6000-7000K, crisp clinical tone",
    category: "lighting",
  },
  {
    id: "light-hard",
    termsFr: ["lumiere dure", "ombres nettes", "flash direct"],
    promptEn: "hard direct flash, sharp shadows, high contrast",
    category: "lighting",
  },
  {
    id: "light-soft",
    termsFr: ["lumiere douce", "diffuse", "flatteuse"],
    promptEn: "soft diffused light, flattering shadows, even skin tones",
    category: "lighting",
  },
  {
    id: "light-mist",
    termsFr: ["brume", "brume au sol", "fog", "brouillard", "fumee au sol"],
    promptEn: "ground fog and mist layer, moody atmospheric depth",
    category: "lighting",
  },

  // — Styles & rendus
  {
    id: "style-sketch",
    termsFr: ["croquis", "esquisse", "sketch", "dessin", "line art", "trait"],
    promptEn: "hand-drawn pencil sketch style, clean line art, minimal shading, artistic illustration",
    category: "style",
  },
  {
    id: "style-photorealistic",
    termsFr: ["photo realiste", "realiste", "photorealistic", "ultra realiste"],
    promptEn: "photorealistic quality, high detail, 4K, natural textures",
    category: "style",
  },
  {
    id: "style-commercial",
    termsFr: ["commercial", "pub", "publicite", "packshot", "e-commerce"],
    promptEn: "high-end commercial product photography, clean brand-ready composition",
    category: "style",
    templateHint: "packshot-dynamique",
  },
  {
    id: "style-luxury",
    termsFr: ["luxe", "luxury", "premium", "haut de gamme", "editorial"],
    promptEn: "premium luxury editorial aesthetic, high-fashion commercial quality",
    category: "style",
  },
  {
    id: "style-minimal",
    termsFr: ["minimaliste", "epure", "clean", "fond blanc", "fond neutre"],
    promptEn: "minimal clean composition, neutral background, negative space",
    category: "style",
  },
  {
    id: "style-ugc",
    termsFr: ["ugc", "instagram", "tiktok", "organique", "authentique", "naturel"],
    promptEn: "authentic UGC smartphone aesthetic, organic social-media realism",
    category: "style",
    templateHint: "ugc-selfie-produit",
  },
  {
    id: "style-selfie",
    termsFr: ["selfie", "miroir", "mirror selfie"],
    promptEn: "smartphone mirror selfie, natural candid energy, 9:16 aspect",
    category: "style",
    templateHint: "ugc-selfie-produit",
  },
  {
    id: "style-cinematic",
    termsFr: ["cinematique", "cinema", "film", "movie still"],
    promptEn: "cinematic color grading, film-like contrast, dramatic storytelling frame",
    category: "style",
  },
  {
    id: "style-y2k",
    termsFr: ["y2k", "annees 2000", "2000s"],
    promptEn: "glossy Y2K fashion aesthetic, early 2000s pop editorial style",
    category: "style",
  },

  // — Matériaux & textures
  {
    id: "mat-condensation",
    termsFr: ["condensation", "gouttes", "gouttelettes", "froid"],
    promptEn: "visible condensation droplets on cold surface, crisp specular highlights",
    category: "material",
  },
  {
    id: "mat-glossy",
    termsFr: ["brillant", "glossy", "reflets", "huile", "oiled skin"],
    promptEn: "glossy reflective finish, bright specular highlights",
    category: "material",
  },
  {
    id: "mat-matte",
    termsFr: ["mat", "matte", "sans reflet"],
    promptEn: "matte non-reflective surface texture",
    category: "material",
  },

  // — Intentions → types d'image (hints pour le LLM, routage étape 2)
  {
    id: "intent-packshot",
    termsFr: ["packshot", "fiche produit", "photo produit"],
    promptEn: "studio packshot product hero, clean product focus",
    category: "intent",
    templateHint: "packshot-dynamique",
  },
  {
    id: "intent-lifestyle",
    termsFr: ["lifestyle", "en situation", "mise en scene", "contexte de vie"],
    promptEn: "lifestyle in-context product photography, natural environment integration",
    category: "intent",
    templateHint: "lifestyle-product-photography",
  },
  {
    id: "intent-beverage",
    termsFr: ["boisson", "canette", "bouteille", "splash", "splash dynamique"],
    promptEn: "studio beverage hero shot, dynamic splash and flavor elements",
    category: "intent",
    templateHint: "product-photography",
  },
  {
    id: "intent-outfit",
    termsFr: ["tenue", "outfit", "look", "vetement", "mode"],
    promptEn: "fashion outfit studio presentation, garment-focused composition",
    category: "intent",
    templateHint: "outfit-studio",
  },
  {
    id: "intent-mannequin-worn",
    termsFr: [
      "mannequin",
      "modele",
      "porté",
      "portee",
      "porte par",
      "porté par",
      "sur mannequin",
      "on-body",
      "editorial porté",
    ],
    promptEn:
      "editorial fashion photograph, fashion model wearing the product, natural on-body fit, confident pose, garment clearly visible",
    category: "intent",
    templateHint: "editorial-worn-held",
  },
  {
    id: "intent-campaign",
    termsFr: ["campagne", "brand campaign", "shooting marque"],
    promptEn: "brand campaign editorial shoot, confident model with product",
    category: "intent",
    templateHint: "brand-campaign-shoot",
  },
];
