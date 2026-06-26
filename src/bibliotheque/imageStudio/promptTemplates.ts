export type PromptTemplateVariable = {
  key: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  required?: boolean;
};

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
      "Décrivez la boisson à mettre en avant (marque ou nom du produit). Vous pouvez ajouter la saveur ou les ingrédients autour. Exemple : « Monster Energy avec des citrons verts » ou « Coca-Cola avec des tranches d'orange ».",
    botAskRequired:
      "Quelle boisson souhaitez-vous mettre en avant ? (ex. Monster Energy, Coca-Cola, jus de mangue…)",
    botReady:
      "Voici le prompt que je propose. Vérifiez l'aperçu puis appliquez-le à la zone de saisie, ou ajustez les champs si besoin.",
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

SUBJECT: Iconic {{drink}} {{packaging}}, floating slightly above center frame, condensation water droplets visible on the cold surface, brand label clearly legible. Bottom of the container dripping water onto the surface below.

SURROUNDING ELEMENTS: {{flavorElements}}

BASE: Dramatic frozen water splash with individual suspended water droplets in mid-air, small crushed ice shards scattered on the surface catching light.

BACKGROUND: {{brandBackdrop}}

LIGHTING: Three-point studio setup — main large softbox upper-left at 5500K casting clean cool-white light; rim light from right edge creating container separation and material glow; subtle fill light to soften hard shadows. Individual water droplets catch bright specular highlights. Slight backlight halo outlining the container silhouette.

COLOR PALETTE: {{brandPalette}}

COMPOSITION: Portrait orientation 9:16, subject centered slightly below the geometric center, slightly low camera angle (worm's eye view) to give the container a monumental, imposing presence. Ingredients and flavor elements fill the upper and peripheral frame space dynamically.

STYLE: High-end commercial product photography, photorealistic, ultra-sharp foreground with slight background blur (bokeh on distant elements), consistent cinematic color grading, 4K resolution. Reference: iconic brand advertising campaigns, Helmut Newton product photography discipline.`,
  },
];

export function getPromptTemplateById(id: string): PromptTemplateDefinition | undefined {
  return IMAGE_STUDIO_PROMPT_TEMPLATES.find((template) => template.id === id);
}
