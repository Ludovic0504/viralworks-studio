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
};

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
  },
  {
    id: "top-down",
    label: "Vue du dessus",
    image: "/image-studio/templates/shot-vue-dessus.jpg",
    promptValue:
      "bird's eye view, top-down flat lay, container centered from above, ingredients spread around",
  },
];

export const ALL_PRODUCT_PHOTOGRAPHY_SHOT_STYLES: ProductShotStyle[] = [
  ...PRODUCT_PHOTOGRAPHY_SHOT_STYLES,
  ...PRODUCT_PHOTOGRAPHY_SHOT_STYLES_EXTENDED,
];

export type PromptTemplateDefinition = {
  id: string;
  label: string;
  summary: string;
  icon: "product";
  /** Vignette hub (public/). */
  heroImage?: string;
  extractorId: "beverage-hero" | "generic-product";
  botIntro: string;
  botAskRequired: string;
  botAskElementsMode?: string;
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

const BEVERAGE_PACKAGING_DEFAULT =
  "in its original packaging format (can, bottle, carton or other)";

export const IMAGE_STUDIO_PROMPT_TEMPLATES: PromptTemplateDefinition[] = [
  {
    id: "product-photography",
    label: "Studio Product Photography",
    summary:
      "Boisson en héros studio — condensation, éclaboussures, ingrédients en orbite. Indiquez la marque et la saveur.",
    icon: "product",
    heroImage: "/image-studio/templates/product-photography-beverage.png",
    extractorId: "beverage-hero",
    botIntro:
      "Quelle boisson souhaitez-vous mettre en avant ? Indiquez la marque ou le nom du produit — vous pouvez aussi préciser les éléments autour dès maintenant (ex. « Monster Energy avec des citrons verts »).",
    botAskRequired:
      "Quelle boisson souhaitez-vous mettre en avant ? (ex. Monster Energy, Coca-Cola, jus de mangue…)",
    botAskElementsMode:
      "Comment souhaitez-vous définir les éléments visuels autour de la boisson ?\n\n• Éléments de référence de la marque — ingrédients typiques associés à cette boisson\n• Choisir moi-même — décrire les éléments autour du produit et ceux qui composent la saveur",
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
    body: `Ultra-sharp studio product photography, 50mm lens f/8, centered composition.

SUBJECT: Iconic [NOM DE LA BOISSON], floating slightly above center frame, condensation water droplets visible on the cold surface, brand label clearly legible. Bottom of the container dripping water onto the surface below.

SURROUNDING ELEMENTS: ${BEVERAGE_FLAVOR_DEFAULT}

BASE: Dramatic frozen water splash with individual suspended water droplets in mid-air, small crushed ice shards scattered on the surface catching light.

BACKGROUND: ${BEVERAGE_BRAND_BACKDROP_DEFAULT}

LIGHTING: Three-point studio setup — main large softbox upper-left at 5500K casting clean cool-white light; rim light from right edge creating container separation and material glow; subtle fill light to soften hard shadows. Individual water droplets catch bright specular highlights. Slight backlight halo outlining the container silhouette.

COLOR PALETTE: ${BEVERAGE_BRAND_PALETTE_DEFAULT}

COMPOSITION: Portrait orientation 9:16, subject centered slightly below the geometric center, [TYPE DE SHOT]. Ingredients and flavor elements fill the upper and peripheral frame space dynamically.

STYLE: High-end commercial product photography, photorealistic, ultra-sharp foreground with slight background blur (bokeh on distant elements), consistent cinematic color grading, 4K resolution. Reference: iconic brand advertising campaigns, Helmut Newton product photography discipline.`,
  },
];

export function getPromptTemplateById(id: string): PromptTemplateDefinition | undefined {
  return IMAGE_STUDIO_PROMPT_TEMPLATES.find((template) => template.id === id);
}
