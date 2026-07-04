export type PromptTemplateVariable = {
  key: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  required?: boolean;
};

export type ProductShotStyle = {
  id: string;
  label: string;
  image: string;
  promptValue: string;
  /** Remplace le détail SUBJECT par défaut (studio splash). */
  subjectDetail?: string;
  /** Remplace la section BASE par défaut. */
  baseSection?: string;
  /** Remplace l'intro de scène (avant [TYPE DE SHOT]). */
  sceneIntro?: string;
  /** Remplace la section LIGHTING par défaut. */
  lightingSection?: string;
  /** Remplace la section STYLE par défaut. */
  styleSection?: string;
};

export const PRODUCT_PHOTOGRAPHY_DEFAULT_SCENE_INTRO =
  "Ultra-sharp studio product photography, 50mm lens f/8,";

export const PRODUCT_PHOTOGRAPHY_DEFAULT_LIGHTING_SECTION =
  "Three-point studio setup — main large softbox upper-left at 5500K casting clean cool-white light; rim light from right edge creating container separation and material glow; subtle fill light to soften hard shadows. Individual water droplets catch bright specular highlights. Slight backlight halo outlining the container silhouette.";

export const PRODUCT_PHOTOGRAPHY_DEFAULT_STYLE_SECTION =
  "High-end commercial product photography, photorealistic, ultra-sharp foreground with slight background blur (bokeh on distant elements), consistent cinematic color grading, 4K resolution. Reference: iconic brand advertising campaigns, Helmut Newton product photography discipline.";

export const PRODUCT_PHOTOGRAPHY_DEFAULT_SUBJECT_DETAIL =
  "floating slightly above center frame, condensation water droplets visible on the cold surface, brand label clearly legible. Bottom of the container dripping water onto the surface below.";

export const PRODUCT_PHOTOGRAPHY_DEFAULT_BASE_SECTION =
  "Dramatic frozen water splash with individual suspended water droplets in mid-air, small crushed ice shards scattered on the surface catching light.";

const MACRO_LABEL_SUBJECT_DETAIL =
  "extreme close-up on the label and container surface, macro detail in sharp focus, condensation droplets in the foreground, brand label clearly legible and dominant in frame.";

const FREEZE_FRAME_SUBJECT_DETAIL =
  "captured mid-motion above center frame, condensation on the cold surface, brand label clearly legible, dynamic freeze-frame energy with ingredients erupting around the container.";

const UNDERWATER_SUBJECT_DETAIL =
  "container submerged and slightly tilted in crystal-clear water, fine condensation and realistic water beads on the cold aluminum surface, brand label clearly legible through natural underwater refraction and subtle chromatic aberration at the water line.";

const UNDERWATER_BASE_SECTION =
  "Dense columns of air bubbles in varied organic sizes rising through the water, a soft bubble trail descending from above as if the container just plunged in, suspended micro-droplets and caustic light ripples on the tank floor — natural imperfect bubble distribution, not symmetrical CGI.";

const UNDERWATER_SCENE_INTRO =
  "Ultra-sharp underwater commercial product photography, 50mm lens f/8,";

const UNDERWATER_LIGHTING_SECTION =
  "Natural underwater lighting — bright soft daylight filtering from the water surface above, caustic light patterns dancing across the container and ingredients, strong green rim light from behind separating the can from the deep background, realistic specular highlights on bubbles and condensation with varied bubble sizes and imperfect organic shapes.";

const UNDERWATER_STYLE_SECTION =
  "Photorealistic underwater product photography captured on a professional camera, natural depth of field with soft bokeh on distant bubbles and ingredients, subtle film-like color grading, organic imperfect placement avoiding symmetrical CGI layout, 4K resolution. Reference: high-end beverage advertising underwater campaigns.";

const TOP_DOWN_SUBJECT_DETAIL =
  "centered on a wet reflective surface photographed from directly above, condensation on the cold surface, brand label clearly legible from bird's eye perspective.";

const TOP_DOWN_BASE_SECTION =
  "Thin layer of water, scattered ingredients and small ice shards on the surface around the container, catching overhead light.";

export const PRODUCT_PHOTOGRAPHY_SHOT_STYLES: ProductShotStyle[] = [
  {
    id: "low-angle",
    label: "Vue basse",
    image: "/image-studio/templates/shot-vue-basse.jpg",
    promptValue:
      "centered, slightly low camera angle (worm's eye view), container monumental and imposing",
  },
  {
    id: "macro-label",
    label: "Gros plan",
    image: "/image-studio/templates/shot-gros-plan-label.jpg",
    promptValue:
      "extreme close-up on the label and container surface, macro detail, condensation droplets in foreground",
    subjectDetail: MACRO_LABEL_SUBJECT_DETAIL,
  },
  {
    id: "explosion-wide",
    label: "Explosion large",
    image: "/image-studio/templates/shot-explosion-large.jpg",
    promptValue:
      "wide shot, container small in frame, ingredients explosion filling 80% of the image",
  },
  {
    id: "freeze-frame",
    label: "Freeze-frame",
    image: "/image-studio/templates/shot-freeze-frame.jpg",
    promptValue:
      "freeze-frame action shot, container mid-fall, ingredients and ice erupting outward in all directions",
    subjectDetail: FREEZE_FRAME_SUBJECT_DETAIL,
  },
  {
    id: "ground-fog",
    label: "Brume au sol",
    image: "/image-studio/templates/shot-brume-sol.jpg",
    promptValue:
      "smoke and mist ground effect, container emerging from a low fog layer, moody atmosphere",
  },
];

export const PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED: ProductShotStyle[] = [
  {
    id: "diagonal-45",
    label: "45° diagonal",
    image: "/image-studio/templates/shot-45-diagonal.jpg",
    promptValue:
      "45-degree angle shot, container slightly tilted, dynamic diagonal composition",
  },
  {
    id: "tight-minimal",
    label: "Serré minimal",
    image: "/image-studio/templates/shot-serre-minimal.jpg",
    promptValue:
      "tight centered shot, container filling 70% of frame, minimal ingredients, clean and minimal",
  },
  {
    id: "side-left",
    label: "Côté gauche",
    image: "/image-studio/templates/shot-cote-gauche.jpg",
    promptValue:
      "side profile shot, container facing left, ingredients bursting from the right side",
  },
  {
    id: "underwater",
    label: "Underwater",
    image: "/image-studio/templates/shot-underwater.jpg",
    promptValue:
      "underwater-style shot, container submerged, bubbles and water distortion around it",
    subjectDetail: UNDERWATER_SUBJECT_DETAIL,
    baseSection: UNDERWATER_BASE_SECTION,
    sceneIntro: UNDERWATER_SCENE_INTRO,
    lightingSection: UNDERWATER_LIGHTING_SECTION,
    styleSection: UNDERWATER_STYLE_SECTION,
  },
  {
    id: "top-down",
    label: "Vue du dessus",
    image: "/image-studio/templates/shot-vue-dessus.jpg",
    promptValue:
      "bird's eye view, top-down flat lay, container centered from above, ingredients spread around",
    subjectDetail: TOP_DOWN_SUBJECT_DETAIL,
    baseSection: TOP_DOWN_BASE_SECTION,
  },
];

export const ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES: ProductShotStyle[] = [
  ...PRODUCT_PHOTOGRAPHY_SHOT_STYLES,
  ...PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED,
];

export function getProductShotStyleById(
  shotId: string | null | undefined,
): ProductShotStyle | undefined {
  if (!shotId) return undefined;
  return ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES.find((style) => style.id === shotId);
}

export type LifestyleShotStyle = {
  id: string;
  label: string;
  image: string;
  promptValue: string;
  templateVariant: "body-continuity" | "standalone";
};

export type PromptTemplateGuideMode =
  | "studio-product"
  | "lifestyle-product"
  | "ugc-selfie"
  | "ugc-presentation"
  | "brand-campaign-shoot"
  | "generic";

export type PromptTemplateDefinition = {
  id: string;
  label: string;
  summary: string;
  icon: "product";
  /** Vignette hub (public/). */
  heroImage?: string;
  guideMode?: PromptTemplateGuideMode;
  extractorId: "beverage-hero" | "generic-product";
  botIntro: string;
  botAskRequired: string;
  botAskEnvironment?: string;
  botAskElementsMode?: string;
  botAskPackagingMode?: string;
  botAskCustomElements?: string;
  botReady: string;
  variables: PromptTemplateVariable[];
  /** Corps du prompt — placeholders `{{key}}`, sauts de ligne conservés. */
  body: string;
  fixedTail?: string;
};

const BEVERAGE_FLAVOR_DEFAULT =
  "Fresh ingredients and flavor elements characteristic of the drink — whole and sliced, cut surfaces facing camera revealing their interior, all suspended mid-air in a dynamic circular orbital arrangement around the container — some tumbling, some whole, scattered at various distances and angles creating depth and energy.";

const BEVERAGE_BRAND_BACKDROP_DEFAULT =
  "Deep studio backdrop in the brand's primary color with a subtle darker radial gradient vignette toward the corners — premium, dramatic, consistent with the brand's visual identity.";

const BEVERAGE_BRAND_PALETTE_DEFAULT =
  "Brand's dominant background tone, label's signature colors, ingredient colors coherent with the drink's flavor profile, crystal-clear container material.";

const BEVERAGE_PACKAGING_DEFAULT = "can, bottle, carton or other";

export const PRODUCT_PHOTOGRAPHY_PLACEHOLDERS = {
  drinkName: "[NOM DE LA BOISSON]",
  formatPackaging: "[FORMAT PACKAGING : can, bottle, carton or other]",
  shotType: "[TYPE DE SHOT]",
  subjectDetail: "[DETAIL SUJET]",
  flavorElements: "[ELEMENTS SAVEUR]",
  baseSection: "[SECTION BASE]",
  brandBackdrop: "[FOND STUDIO]",
  brandPalette: "[PALETTE COULEURS]",
  sceneIntro: "[INTRO SCENE]",
  lightingSection: "[ECLAIRAGE]",
  styleSection: "[STYLE PHOTO]",
} as const;

export function isStudioProductGuideTemplate(
  template: Pick<PromptTemplateDefinition, "guideMode">,
): boolean {
  return template.guideMode === "studio-product";
}

export function isLifestyleProductGuideTemplate(
  template: Pick<PromptTemplateDefinition, "guideMode">,
): boolean {
  return template.guideMode === "lifestyle-product";
}

export function isUgcSelfieGuideTemplate(
  template: Pick<PromptTemplateDefinition, "guideMode">,
): boolean {
  return template.guideMode === "ugc-selfie";
}

export function isUgcPresentationGuideTemplate(
  template: Pick<PromptTemplateDefinition, "guideMode">,
): boolean {
  return template.guideMode === "ugc-presentation";
}

export function isBrandCampaignShootGuideTemplate(
  template: Pick<PromptTemplateDefinition, "guideMode">,
): boolean {
  return template.guideMode === "brand-campaign-shoot";
}

export function isShotStyleGuideTemplate(
  template: Pick<PromptTemplateDefinition, "guideMode">,
): boolean {
  return isStudioProductGuideTemplate(template) || isLifestyleProductGuideTemplate(template);
}

export const LIFESTYLE_PLACEHOLDERS = {
  productName: "[NOM DU PRODUIT]",
  shotType: "[TYPE DE SHOT]",
  environment: "[LIEU]",
} as const;

export const UGC_SELFIE_PLACEHOLDERS = {
  age: "[ÂGE]",
  sex: "[SEXE]",
  physicalDescription: "[DESCRIPTION PHYSIQUE LIÉE À L'ÂGE ET AU SEXE]",
  skinTone: "[TEINT DE PEAU]",
  hair: "[CHEVEUX]",
  pronounSubject: "[Il/Elle]",
  productName: "[NOM DU PRODUIT]",
  pronounPossessive: "[his/her]",
  outfit: "[TENUE]",
  location: "[LIEU]",
} as const;

export const UGC_SELFIE_TEMPLATE_BODY = `Realistic outdoor selfie, arm extended holding the phone slightly above eye level, warm natural daylight with a soft ambient bounce light appropriate to the setting. A ${UGC_SELFIE_PLACEHOLDERS.age}-year-old ${UGC_SELFIE_PLACEHOLDERS.sex} with an elegant, natural face — ${UGC_SELFIE_PLACEHOLDERS.physicalDescription}, warm healthy glow, dewy skin with real texture. ${UGC_SELFIE_PLACEHOLDERS.skinTone} skin tone. ${UGC_SELFIE_PLACEHOLDERS.hair} hair, softly styled, slightly moved by natural movement. ${UGC_SELFIE_PLACEHOLDERS.pronounSubject}'s holding a small ${UGC_SELFIE_PLACEHOLDERS.productName} close to ${UGC_SELFIE_PLACEHOLDERS.pronounPossessive} chest with one hand, presenting it toward the camera with a warm, genuine, closed-lip smile and direct eye contact, calm and confident. ${UGC_SELFIE_PLACEHOLDERS.pronounSubject}'s wearing ${UGC_SELFIE_PLACEHOLDERS.outfit}. Background is a blurred ${UGC_SELFIE_PLACEHOLDERS.location}, softly out of focus. Shot on iPhone 15 Pro, medium close-up framing chest to face, sharp natural phone quality, no over-smoothing, slight natural grain, 9:16 aspect ratio.`;

export const UGC_PRESENTATION_PLACEHOLDERS = {
  cadrageZone: "[CADRAGE_ZONE]",
  heroFocus: "[HERO_FOCUS]",
  sexeDescription: "[SEXE_DESCRIPTION]",
  age: "[AGE]",
  hairDescription: "[hair description]",
  pose: "[POSE]",
  pronounSubjectCap: "[She/He]",
  produit: "[PRODUIT]",
  pronounPossessive: "[her/his]",
  physique: "[PHYSIQUE]",
  pronounSubjectLower: "[she/he]",
  autreTenue: "[AUTRE_TENUE]",
  jewelry: "[jewelry appropriate to gender/style]",
  makeupGrooming: "[makeup/grooming]",
  sceneSetting: "[SCENE_SETTING]",
  lightingBlock: "[LIGHTING_BLOCK]",
  environmentBlock: "[ENVIRONMENT_BLOCK]",
  styleMoodBlock: "[STYLE_MOOD_BLOCK]",
  pronounObject: "[her/him]",
  waistSide: "[waist/side]",
} as const;

export const UGC_PRESENTATION_HELD_TEMPLATE_BODY = `Photorealistic lifestyle portrait, shot as if taken with a smartphone on a self-timer or by a friend, natural amateur-professional quality. Medium shot, framed from roughly waist up, product held at chest height clearly visible in frame. ${UGC_PRESENTATION_PLACEHOLDERS.sceneSetting}

Subject: ${UGC_PRESENTATION_PLACEHOLDERS.sexeDescription} a ${UGC_PRESENTATION_PLACEHOLDERS.age}-year-old [confident/warm] smile, ${UGC_PRESENTATION_PLACEHOLDERS.hairDescription}. ${UGC_PRESENTATION_PLACEHOLDERS.pose}

Physical: ${UGC_PRESENTATION_PLACEHOLDERS.physique}

Outfit: ${UGC_PRESENTATION_PLACEHOLDERS.pronounSubjectLower} is wearing ${UGC_PRESENTATION_PLACEHOLDERS.autreTenue} underneath. Subtle ${UGC_PRESENTATION_PLACEHOLDERS.jewelry}.

Skin and makeup: natural, soft skin texture appropriate for ${UGC_PRESENTATION_PLACEHOLDERS.pronounPossessive} age, subtle warm-toned ${UGC_PRESENTATION_PLACEHOLDERS.makeupGrooming}, soft glowing complexion, no over-smoothing.

Lighting: ${UGC_PRESENTATION_PLACEHOLDERS.lightingBlock}.

Environment: ${UGC_PRESENTATION_PLACEHOLDERS.environmentBlock}

Composition: subject centered, camera at chest height, shallow depth of field keeping ${UGC_PRESENTATION_PLACEHOLDERS.pronounObject} and the product sharp while the background stays gently detailed, portrait orientation (9:16).

Style and mood: ${UGC_PRESENTATION_PLACEHOLDERS.styleMoodBlock}.

Photorealistic quality, high detail, natural skin texture, 4K, soft cinematic color grading, warm tones, slight natural grain, vertical 9:16 aspect ratio.`;

export const UGC_PRESENTATION_WORN_TEMPLATE_BODY = `Photorealistic lifestyle portrait, shot as if taken with a smartphone on a self-timer or by a friend, natural amateur-professional quality. ${UGC_PRESENTATION_PLACEHOLDERS.cadrageZone}. ${UGC_PRESENTATION_PLACEHOLDERS.sceneSetting}

Subject: ${UGC_PRESENTATION_PLACEHOLDERS.sexeDescription} a ${UGC_PRESENTATION_PLACEHOLDERS.age}-year-old [confident/warm] smile, ${UGC_PRESENTATION_PLACEHOLDERS.hairDescription}. ${UGC_PRESENTATION_PLACEHOLDERS.pose}. Her/His hands are relaxed, one resting near ${UGC_PRESENTATION_PLACEHOLDERS.waistSide} and the other loosely at ${UGC_PRESENTATION_PLACEHOLDERS.pronounPossessive} side, not holding anything.

Hero focus: ${UGC_PRESENTATION_PLACEHOLDERS.heroFocus}

Physical: ${UGC_PRESENTATION_PLACEHOLDERS.physique}

Outfit: ${UGC_PRESENTATION_PLACEHOLDERS.pronounSubjectLower} is fully wearing ${UGC_PRESENTATION_PLACEHOLDERS.produit}. ${UGC_PRESENTATION_PLACEHOLDERS.autreTenue}. Subtle ${UGC_PRESENTATION_PLACEHOLDERS.jewelry}.

Skin and makeup: natural, soft skin texture appropriate for ${UGC_PRESENTATION_PLACEHOLDERS.pronounPossessive} age, subtle warm-toned ${UGC_PRESENTATION_PLACEHOLDERS.makeupGrooming}, soft glowing complexion, no over-smoothing.

Lighting: ${UGC_PRESENTATION_PLACEHOLDERS.lightingBlock}[FOOTWEAR_LIGHTING_SUFFIX]

Environment: ${UGC_PRESENTATION_PLACEHOLDERS.environmentBlock}

Composition: subject centered, camera positioned to match ${UGC_PRESENTATION_PLACEHOLDERS.cadrageZone} framing, shallow depth of field keeping ${UGC_PRESENTATION_PLACEHOLDERS.pronounObject} sharp while the background stays gently detailed, portrait orientation (9:16).

Style and mood: ${UGC_PRESENTATION_PLACEHOLDERS.styleMoodBlock}.

Photorealistic quality, high detail, natural skin texture, 4K, soft cinematic color grading, warm tones, slight natural grain, vertical 9:16 aspect ratio.`;

export const LIFESTYLE_TEMPLATE_BODY_CONTINUITY = `Ultra-realistic lifestyle product photography, POV first-person perspective,
85mm lens f/2.0, natural light.

SUBJECT: ${LIFESTYLE_PLACEHOLDERS.productName}, brand label clearly visible and facing the camera.

SHOT TYPE: ${LIFESTYLE_PLACEHOLDERS.shotType}

BODY CONTINUITY: This is a first-person POV shot — the viewer IS the person
holding the product. The arm enters the frame naturally from the same side
as the body posture below, wrist angle and forearm direction anatomically
consistent with someone seated/standing in this exact position. The sleeve
or clothing on the arm matches the clothing visible on the rest of the body
in frame (same fabric, same color, same lighting). No floating or disconnected
limbs — the hand must read as physically attached and reaching from the
photographer's own body.

ENVIRONMENT: ${LIFESTYLE_PLACEHOLDERS.environment}

LIGHTING: Soft natural daylight adapted to the environment, gentle directional
shadows on the product surface, consistent light direction and color temperature
across both the hand/arm and the body below — no mismatched lighting between
the limb and the environment, organic warm color temperature 4500K.

COMPOSITION: Portrait orientation 9:16, product as the clear focal point of
the frame, arm and hand entering from the bottom or side of frame in a way
that logically connects to the visible body/lap/legs below, environment in
soft bokeh behind.

MOOD: Authentic, organic, aspirational without being staged. Feels like a
genuine first-person photo taken by the person themselves.

STYLE: High-end lifestyle editorial photography, photorealistic, cinematic
color grading, soft contrast, 4K resolution. Reference: outdoor brand
campaigns, Apple lifestyle photography aesthetic.`;

export const LIFESTYLE_TEMPLATE_BODY_STANDALONE = `Ultra-realistic lifestyle product photography, 85mm lens f/2.0, natural light.

SUBJECT: ${LIFESTYLE_PLACEHOLDERS.productName}, brand label clearly visible and facing the camera.

SHOT TYPE: ${LIFESTYLE_PLACEHOLDERS.shotType}

ENVIRONMENT: ${LIFESTYLE_PLACEHOLDERS.environment}

LIGHTING: Soft natural daylight adapted to the environment, gentle directional
shadows on the product surface, no harsh flash, organic warm color temperature
4500K.

COMPOSITION: Portrait orientation 9:16, product as the clear focal point of
the frame, environment in soft bokeh behind.

MOOD: Authentic, organic, aspirational without being staged. No studio feel.

STYLE: High-end lifestyle editorial photography, photorealistic, cinematic
color grading, soft contrast, 4K resolution. Reference: outdoor brand
campaigns, Apple lifestyle photography aesthetic.`;

const LIFESTYLE_SHOT_POV_ASSIS =
  "First-person POV, product held securely in one hand with a natural mid-body grip — fingers wrapped around the middle of the container, palm supporting from behind, thumb on the opposite side, stable grip so the product cannot slip or fall. Strong low-angle view looking down toward the seated body, legs and lower body visible in the lower portion of the frame.";

const LIFESTYLE_SHOT_POV_DEBOUT =
  "First-person POV, arm extended forward holding the product at shoulder height while walking, product slightly motion-blurred at the edges to suggest movement, ground or path visible in the lower portion of the frame beneath the extended arm.";

const LIFESTYLE_SHOT_PRODUIT_LEVITATION =
  "Product alone, captured mid-air or mid-fall as if just placed down, slight motion energy, dynamic diagonal composition, environment blurred around it. No hands or person visible.";

const LIFESTYLE_SHOT_PRODUIT_SEUL =
  "Product alone, no hands or person, resting on a natural surface within the environment, slightly elevated or placed at an interesting angle. Clean isolated product focus, 45-degree angle shot, shallow depth of field.";

const LIFESTYLE_SHOT_MAIN_GROS_PLAN =
  "Close-up shot of one hand holding the product at chest height, fingers wrapped naturally around the container, slightly tilted, casual confident grip. Hand and product fill most of the frame, no body or arm context visible beyond the wrist. Eye-level angle.";

const LIFESTYLE_SHOT_VUE_DESSUS =
  "Top-down bird's eye view, product placed flat on a surface within the environment, surrounded by complementary lifestyle objects related to the context, clean overhead composition.";

const LIFESTYLE_SHOT_ZOOM_PRODUIT =
  "Extreme close-up macro shot on the product label and surface texture, no hands, shallow depth of field, fine details and material texture sharply visible, background fully blurred.";

const LIFESTYLE_SHOT_DEUX_MAINS =
  "First-person POV, two hands visible, one holding the base steady, the other mid-action opening or interacting with the product, slight motion blur on the moving hand, close mid-shot, eye-level angle.";

export const LIFESTYLE_SHOT_STYLES: LifestyleShotStyle[] = [
  {
    id: "pov-assis",
    label: "POV assis",
    image: "/image-studio/templates/lifestyle/shot-pov-assis.jpg",
    promptValue: LIFESTYLE_SHOT_POV_ASSIS,
    templateVariant: "body-continuity",
  },
  {
    id: "pov-debout",
    label: "POV debout",
    image: "/image-studio/templates/lifestyle/shot-pov-debout.jpg",
    promptValue: LIFESTYLE_SHOT_POV_DEBOUT,
    templateVariant: "body-continuity",
  },
  {
    id: "produit-levitation",
    label: "Produit en lévitation",
    image: "/image-studio/templates/lifestyle/shot-produit-levitation.jpg",
    promptValue: LIFESTYLE_SHOT_PRODUIT_LEVITATION,
    templateVariant: "standalone",
  },
  {
    id: "produit-seul",
    label: "Produit seul",
    image: "/image-studio/templates/lifestyle/shot-produit-seul.jpg",
    promptValue: LIFESTYLE_SHOT_PRODUIT_SEUL,
    templateVariant: "standalone",
  },
  {
    id: "main-gros-plan",
    label: "Main en gros plan",
    image: "/image-studio/templates/lifestyle/shot-main-gros-plan.jpg",
    promptValue: LIFESTYLE_SHOT_MAIN_GROS_PLAN,
    templateVariant: "standalone",
  },
];

export const LIFESTYLE_SHOT_STYLES_EXTENDED: LifestyleShotStyle[] = [
  {
    id: "vue-dessus",
    label: "Vue du dessus",
    image: "/image-studio/templates/lifestyle/shot-vue-dessus.jpg",
    promptValue: LIFESTYLE_SHOT_VUE_DESSUS,
    templateVariant: "standalone",
  },
  {
    id: "zoom-produit",
    label: "Zoom sur le produit",
    image: "/image-studio/templates/lifestyle/shot-zoom-produit.jpg",
    promptValue: LIFESTYLE_SHOT_ZOOM_PRODUIT,
    templateVariant: "standalone",
  },
  {
    id: "deux-mains",
    label: "Produit en main, en mouvement",
    image: "/image-studio/templates/lifestyle/shot-deux-mains.jpg",
    promptValue: LIFESTYLE_SHOT_DEUX_MAINS,
    templateVariant: "body-continuity",
  },
];

export const ALL_LIFESTYLE_SHOT_STYLES: LifestyleShotStyle[] = [
  ...LIFESTYLE_SHOT_STYLES,
  ...LIFESTYLE_SHOT_STYLES_EXTENDED,
];

export function getLifestyleShotStyleById(
  shotId: string | null | undefined,
): LifestyleShotStyle | undefined {
  if (!shotId) return undefined;
  return ALL_LIFESTYLE_SHOT_STYLES.find((style) => style.id === shotId);
}

export const IMAGE_STUDIO_PROMPT_TEMPLATES: PromptTemplateDefinition[] = [
  {
    id: "product-photography",
    label: "Studio Product Photography",
    summary:
      "Boisson en héros studio — condensation, éclaboussures, ingrédients en orbite. Indiquez la marque et la saveur.",
    icon: "product",
    heroImage: "/image-studio/templates/product-photography-beverage.png",
    guideMode: "studio-product",
    extractorId: "beverage-hero",
    botIntro:
      "Quelle boisson souhaitez-vous mettre en avant ? Indiquez la marque ou le nom du produit — vous pouvez aussi préciser les éléments autour dès maintenant (ex. « Monster Energy avec des citrons verts »).",
    botAskRequired:
      "Quelle boisson souhaitez-vous mettre en avant ? (ex. Monster Energy, Coca-Cola, jus de mangue…)",
    botAskElementsMode:
      "Comment souhaitez-vous définir les éléments visuels autour de la boisson ?\n\n• Éléments de référence de la marque — ingrédients typiques associés à cette boisson\n• Choisir moi-même — décrire les éléments autour du produit et ceux qui composent la saveur",
    botAskPackagingMode: "En canette ou en bouteille ?",
    botAskCustomElements:
      "Décrivez les éléments à placer autour de la boisson et ceux qui composent sa saveur. Exemple : « citrons verts entiers et en tranches, feuilles de menthe » ou « mangue, fruit de la passion, glaçons ».",
    botReady:
      "Votre prompt est prêt. Vérifiez-le ci-dessous puis appliquez-le à la zone de saisie, ou ajustez les champs si besoin.",
    variables: [
      {
        key: "drink",
        label: "Boisson / marque",
        placeholder: "ex. Monster Energy drink",
        defaultValue: "",
        required: true,
      },
      {
        key: "packaging",
        label: "Format emballage",
        placeholder: "ex. can, bottle, carton",
        defaultValue: BEVERAGE_PACKAGING_DEFAULT,
      },
      {
        key: "flavorElements",
        label: "Ingrédients / saveur autour",
        placeholder: "ex. fresh limes, whole and sliced",
        defaultValue: BEVERAGE_FLAVOR_DEFAULT,
      },
      {
        key: "brandBackdrop",
        label: "Fond studio (marque)",
        placeholder: "ex. deep black with green radial glow",
        defaultValue: BEVERAGE_BRAND_BACKDROP_DEFAULT,
      },
      {
        key: "brandPalette",
        label: "Palette couleurs",
        placeholder: "ex. neon green, matte black, lime highlights",
        defaultValue: BEVERAGE_BRAND_PALETTE_DEFAULT,
      },
    ],
    body: `${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.sceneIntro} ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.shotType} composition.

SUBJECT: Iconic ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.drinkName} in its original packaging format (${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.formatPackaging}), ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.subjectDetail}

SURROUNDING ELEMENTS: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.flavorElements}

BASE: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.baseSection}

BACKGROUND: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.brandBackdrop}

LIGHTING: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.lightingSection}

COLOR PALETTE: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.brandPalette}

COMPOSITION: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.shotType}, portrait orientation 9:16, ingredients and flavor elements fill the frame space dynamically.

STYLE: ${PRODUCT_PHOTOGRAPHY_PLACEHOLDERS.styleSection}`,
  },
  {
    id: "lifestyle-product-photography",
    label: "Lifestyle Product Photography",
    summary:
      "Produit en situation réelle — main, décor naturel, lumière du jour. Indiquez la marque et le contexte.",
    icon: "product",
    heroImage: "/image-studio/templates/lifestyle-product-photography.png",
    guideMode: "lifestyle-product",
    extractorId: "generic-product",
    botIntro: "Quel est le nom de votre produit ?",
    botAskRequired:
      "Quel est le nom de votre produit ? (ex. HOLY Hydration, Optiva Energy…)",
    botAskEnvironment:
      "Dans quel environnement ? (ex. salle de sport, terrain de tennis, cuisine moderne…)",
    botReady:
      "Votre prompt est prêt. Vérifiez-le ci-dessous puis appliquez-le à la zone de saisie, ou ajustez les champs si besoin.",
    variables: [
      {
        key: "product",
        label: "Produit / marque",
        placeholder: "ex. HOLY Hydration Strawberry Kiwi",
        defaultValue: "",
        required: true,
      },
      {
        key: "environment",
        label: "Environnement / lieu",
        placeholder: "ex. modern gym interior, walking path outdoors",
        defaultValue: "",
        required: true,
      },
    ],
    body: "",
  },
  {
    id: "ugc-selfie-produit",
    label: "UGC Selfie Produit",
    summary:
      "Selfie UGC réaliste — personne tenant un produit, style smartphone naturel. Choisissez le profil, le produit et le lieu.",
    icon: "product",
    heroImage: "/image-studio/templates/ugc-selfie/Selfie_Femme_30ans.png",
    guideMode: "ugc-selfie",
    extractorId: "generic-product",
    botIntro: "Quel sexe ?",
    botAskRequired: "Quel est le produit ?",
    botReady:
      "Votre prompt est prêt. Vérifiez-le ci-dessous puis appliquez-le à la zone de saisie, ou ajustez les champs si besoin.",
    variables: [
      {
        key: "productName",
        label: "Produit",
        placeholder: "ex. Chewing-gum Freedent",
        defaultValue: "",
        required: true,
      },
      {
        key: "location",
        label: "Lieu",
        placeholder: "ex. modern gym interior",
        defaultValue: "",
        required: true,
      },
      {
        key: "skinTone",
        label: "Teint de peau",
        placeholder: "ex. fair",
        defaultValue: "",
      },
      {
        key: "hair",
        label: "Cheveux",
        placeholder: "ex. short dark",
        defaultValue: "",
      },
      {
        key: "outfit",
        label: "Tenue",
        placeholder: "ex. a casual t-shirt",
        defaultValue: "",
      },
    ],
    body: UGC_SELFIE_TEMPLATE_BODY,
  },
  {
    id: "ugc-presentation-produit",
    label: "Présentation Produit UGC",
    summary:
      "Personne présentant un produit face à une caméra fixe — en main ou porté — style dressing luxe, caméra posée (pas selfie).",
    icon: "product",
    heroImage: "/image-studio/templates/ugc-presentation/presentation-produit-ugc.png",
    guideMode: "ugc-presentation",
    extractorId: "generic-product",
    botIntro: "Le produit est-il tenu en main ou porté sur le corps ?",
    botAskRequired: "Quel est le produit ?",
    botReady:
      "Votre prompt est prêt. Vérifiez-le ci-dessous puis appliquez-le à la zone de saisie, ou ajustez les champs si besoin.",
    variables: [
      {
        key: "productName",
        label: "Produit",
        placeholder: "ex. red sleeveless draped dress",
        defaultValue: "",
        required: true,
      },
      {
        key: "location",
        label: "Lieu",
        placeholder: "ex. luxury master bedroom",
        defaultValue: "",
      },
      {
        key: "physique",
        label: "Physique",
        placeholder: "ex. natural, unremarkable build",
        defaultValue: "",
      },
      {
        key: "hair",
        label: "Cheveux",
        placeholder: "ex. long wavy brown",
        defaultValue: "",
      },
      {
        key: "autreTenue",
        label: "Reste de la tenue",
        placeholder: "ex. soft beige knit cardigan",
        defaultValue: "",
      },
    ],
    body: UGC_PRESENTATION_HELD_TEMPLATE_BODY,
  },
  {
    id: "brand-campaign-shoot",
    label: "Brand Campaign Shoot",
    summary:
      "Shooting éditorial haut de gamme — mannequin en action, environnement narratif, contrôle caméra et regard. Style campagne premium.",
    icon: "product",
    heroImage: "/image-studio/templates/brand-campaign/brand-campaign-shoot.png",
    guideMode: "brand-campaign-shoot",
    extractorId: "generic-product",
    botIntro: "Qui présente le produit ?",
    botAskRequired: "Décris la tenue ou le produit à mettre en avant",
    botReady:
      "Votre prompt est prêt. Vérifiez-le ci-dessous puis appliquez-le à la zone de saisie, ou ajustez les champs si besoin.",
    variables: [
      {
        key: "productOutfit",
        label: "Tenue / produit",
        placeholder: "ex. navy Lacoste polo with yellow shoulder stripes",
        defaultValue: "",
        required: true,
      },
      {
        key: "ambiancePrompt",
        label: "Ambiance",
        placeholder: "ex. sporty-luxe",
        defaultValue: "",
      },
      {
        key: "physique",
        label: "Physique",
        placeholder: "ex. A 30-year-old athletic man…",
        defaultValue: "",
      },
      {
        key: "environment",
        label: "Environnement",
        placeholder: "ex. golf course green with ocean behind",
        defaultValue: "",
      },
    ],
    body: "",
  },
];

export function getPromptTemplateById(id: string): PromptTemplateDefinition | undefined {
  return IMAGE_STUDIO_PROMPT_TEMPLATES.find((template) => template.id === id);
}
