import type { UgcSelfieGender } from "./ugcSelfieProfiles";

export type BrandCampaignAmbianceId =
  | "sportif-luxe"
  | "minimaliste-luxe"
  | "streetwear-energique"
  | "romantique-nostalgique"
  | "editorial-haute-couture";

export type BrandCampaignCameraAngleId =
  | "face-a-face"
  | "vue-dessous"
  | "vue-hauteur"
  | "vue-cote";

export type BrandCampaignGazeId = "vers-camera" | "regard-ailleurs";

export type BrandCampaignDistanceId = "tres-proche" | "buste-portrait" | "corps-entier";

export type BrandCampaignMorphologyId = "athletique" | "standard" | "enrobe";

export type BrandCampaignFormatId = "feed" | "story";

export type WeightedTier = {
  weight: number;
  value: string;
};

export type BrandCampaignAmbianceOption = {
  id: BrandCampaignAmbianceId;
  label: string;
  image: string;
  promptValue: string;
};

export type BrandCampaignGridOption = {
  id: string;
  label: string;
  promptValue: string;
};

export type BrandCampaignBankOption = {
  label: string;
  promptValue: string;
};

export type BrandCampaignCameraAngleOption = {
  id: BrandCampaignCameraAngleId;
  label: string;
  subtitle: string;
  tiers: WeightedTier[];
};

const BRAND_CAMPAIGN_IMAGE_BASE = "/image-studio/templates/brand-campaign";

export const BRAND_CAMPAIGN_AMBIANCE_OPTIONS: BrandCampaignAmbianceOption[] = [
  {
    id: "sportif-luxe",
    label: "Sportif-luxe",
    image: `${BRAND_CAMPAIGN_IMAGE_BASE}/ambiance-sportif-luxe.png`,
    promptValue: "sporty-luxe",
  },
  {
    id: "minimaliste-luxe",
    label: "Minimaliste luxe",
    image: "/image-studio/templates/shot-serre-minimal.jpg",
    promptValue: "minimalist luxury",
  },
  {
    id: "streetwear-energique",
    label: "Streetwear énergique",
    image: "/image-studio/templates/lifestyle/shot-pov-debout.jpg",
    promptValue: "energetic streetwear",
  },
  {
    id: "romantique-nostalgique",
    label: "Romantique nostalgique",
    image: "/image-studio/templates/lifestyle/shot-produit-seul.jpg",
    promptValue: "romantic nostalgic",
  },
  {
    id: "editorial-haute-couture",
    label: "Éditorial haute couture",
    image: "/image-studio/templates/shot-vue-basse.jpg",
    promptValue: "high-fashion editorial",
  },
];

export const BRAND_CAMPAIGN_CAMERA_ANGLE_OPTIONS: BrandCampaignCameraAngleOption[] = [
  {
    id: "face-a-face",
    label: "Face à face",
    subtitle: "Hauteur naturelle, comme un regard humain",
    tiers: [
      {
        weight: 50,
        value:
          "camera positioned directly at the subject's eye level, perfectly centered, natural perspective, minimal distortion",
      },
      {
        weight: 50,
        value:
          "camera positioned at the subject's eye level, subject slightly off-center, natural perspective, minimal distortion",
      },
    ],
  },
  {
    id: "vue-dessous",
    label: "Vue du dessous",
    subtitle: "Caméra au ras du sol, effet impressionnant",
    tiers: [
      {
        weight: 35,
        value:
          "camera positioned slightly below the subject's eye level, subtle upward tilt, mild perspective effect",
      },
      {
        weight: 35,
        value:
          "camera positioned noticeably below the subject's eye level, moderate upward angle, visible perspective convergence",
      },
      {
        weight: 20,
        value:
          "camera positioned well below the subject's eye level, strong upward perspective, wide-angle lens effect, foreground elements appear larger",
      },
      {
        weight: 10,
        value:
          "camera physically placed at ground level looking upward toward the subject, wide-angle lens, extreme worm's-eye perspective, visible barrel distortion, foreground elements disproportionately large and close to the lens, strong convergence toward the top of the frame",
      },
    ],
  },
  {
    id: "vue-hauteur",
    label: "Vue en hauteur",
    subtitle: "Caméra au-dessus, vue plongeante",
    tiers: [
      {
        weight: 35,
        value:
          "camera positioned slightly above the subject's eye level, subtle downward tilt, mild foreshortening",
      },
      {
        weight: 35,
        value:
          "camera positioned noticeably above the subject's eye level, moderate downward angle, visible foreshortening effect",
      },
      {
        weight: 20,
        value:
          "camera positioned well above the subject's eye level, strong downward perspective, subject appears compressed",
      },
      {
        weight: 10,
        value:
          "camera positioned high above the subject looking directly down, extreme bird's-eye perspective, subject appears significantly compressed and smaller within the frame",
      },
    ],
  },
  {
    id: "vue-cote",
    label: "Vue de côté",
    subtitle: "Caméra sur le profil de la personne",
    tiers: [
      {
        weight: 35,
        value:
          "camera positioned at a slight angle to the subject's body, three-quarter view, natural depth",
      },
      {
        weight: 35,
        value:
          "camera positioned at approximately 45 degrees to the subject's body, pronounced three-quarter profile, visible depth compression",
      },
      {
        weight: 20,
        value:
          "camera positioned at approximately 70 degrees to the subject's body, near-full profile view",
      },
      {
        weight: 10,
        value:
          "camera positioned at 90 degrees to the subject's body, full profile silhouette, strong depth compression along the lens axis",
      },
    ],
  },
];

export const BRAND_CAMPAIGN_FACE_TO_FACE_GAZE =
  "looking directly at the camera with a confident, composed expression";

export const BRAND_CAMPAIGN_GAZE_VALUES: Record<BrandCampaignGazeId, string> = {
  "vers-camera":
    "direct eye contact with the camera despite the body's orientation, slight head/neck rotation toward the lens",
  "regard-ailleurs":
    "gaze directed off-frame, no direct eye contact with the camera, natural candid feel, gaze direction consistent with the body's orientation",
};

export const BRAND_CAMPAIGN_DISTANCE_OPTIONS: Array<{
  id: BrandCampaignDistanceId;
  label: string;
  tiers: WeightedTier[];
}> = [
  {
    id: "tres-proche",
    label: "Très proche",
    tiers: [
      {
        weight: 60,
        value: "extreme close-up, face and shoulders filling most of the frame",
      },
      {
        weight: 40,
        value: "extreme close-up, face filling nearly the entire frame, minimal background visible",
      },
    ],
  },
  {
    id: "buste-portrait",
    label: "Buste/portrait",
    tiers: [
      {
        weight: 60,
        value: "medium shot, waist-up framing, subject and immediate surroundings both visible",
      },
      {
        weight: 40,
        value: "medium shot, chest-up framing, tighter crop on the upper body",
      },
    ],
  },
  {
    id: "corps-entier",
    label: "Corps entier",
    tiers: [
      {
        weight: 60,
        value: "full shot, subject's entire body visible, environment visible around the subject",
      },
      {
        weight: 40,
        value: "full shot, subject fills most of the vertical frame, minimal margin around the body",
      },
    ],
  },
];

export const BRAND_CAMPAIGN_ACTION_BANKS: Record<BrandCampaignAmbianceId, BrandCampaignBankOption[]> = {
  "sportif-luxe": [
    {
      label: "Accroupi, équipement au sol",
      promptValue:
        "crouching on one knee, resting a forearm on top of a sports equipment planted in the ground, other hand resting near the ankle",
    },
    {
      label: "Marche, veste sur l'épaule",
      promptValue:
        "walking mid-stride, jacket or garment draped casually over one shoulder",
    },
    {
      label: "Appuyé, bras croisés",
      promptValue: "leaning back against a structure, arms crossed, confident posture",
    },
  ],
  "minimaliste-luxe": [
    {
      label: "Immobile, main en poche",
      promptValue:
        "standing still, one hand resting in a pocket, weight shifted onto one leg, composed and understated posture",
    },
    {
      label: "Assis au bord d'un banc",
      promptValue:
        "seated on the edge of a minimal bench or ledge, back straight, hands resting on the knees",
    },
    {
      label: "Marche lente vers la caméra",
      promptValue:
        "walking slowly toward the camera, arms relaxed at the sides, deliberate and unhurried pace",
    },
  ],
  "streetwear-energique": [
    {
      label: "Saut ou mouvement",
      promptValue:
        "mid-jump or mid-motion, one arm raised, dynamic energy, clothing caught in movement",
    },
    {
      label: "Appuyé contre un mur",
      promptValue:
        "leaning against a wall at an angle, one foot propped up behind, casual confident stance",
    },
    {
      label: "Foulée assurée",
      promptValue:
        "walking with an exaggerated confident stride, hands in pockets, head slightly tilted",
    },
  ],
  "romantique-nostalgique": [
    {
      label: "Assis, genoux relevés",
      promptValue:
        "sitting on the ground or on steps, knees drawn up slightly, gentle wistful expression, hair caught in a light breeze",
    },
    {
      label: "Près d'une fenêtre",
      promptValue:
        "standing near a window or doorway, one hand gently touching the frame, soft contemplative pose",
    },
    {
      label: "Marche le long d'un chemin",
      promptValue:
        "walking slowly along a path, looking slightly off to the side, relaxed flowing movement",
    },
  ],
  "editorial-haute-couture": [
    {
      label: "Pose sculpturale",
      promptValue:
        "standing in a sharp, sculptural pose, one arm angled dramatically, strong graphic silhouette",
    },
    {
      label: "Assis sur chaise ornée",
      promptValue:
        "seated on an ornate or architectural chair, posture elongated and deliberate, hands elegantly placed",
    },
    {
      label: "Torsion en mouvement",
      promptValue:
        "mid-turn, fabric or garment caught in motion, dramatic twist of the torso",
    },
  ],
};

export const BRAND_CAMPAIGN_ENVIRONMENT_BANKS: Record<
  BrandCampaignAmbianceId,
  BrandCampaignBankOption[]
> = {
  "sportif-luxe": [
    {
      label: "Green de golf, mer et montagne",
      promptValue:
        "a golf course green in the foreground, calm turquoise ocean behind, dramatic mountain silhouette in the distance under a clear blue sky",
    },
    {
      label: "Piste d'athlétisme",
      promptValue:
        "an athletics track, other lanes visible, minimalist modern stadium architecture in the background",
    },
    {
      label: "Rooftop urbain, golden hour",
      promptValue:
        "a sun-bleached urban rooftop at golden hour, city skyline hazy in the background",
    },
  ],
  "minimaliste-luxe": [
    {
      label: "Studio blanc, ombre diagonale",
      promptValue:
        "a minimalist white studio backdrop with a single hard diagonal shadow cast across the floor",
    },
    {
      label: "Intérieur marbre, lumière douce",
      promptValue:
        "a quiet marble-clad interior, soft natural light from large windows, negative space around the subject",
    },
    {
      label: "Cour moderne vide",
      promptValue:
        "an empty modern courtyard, clean concrete surfaces, geometric architectural lines in the background",
    },
  ],
  "streetwear-energique": [
    {
      label: "Terrain de basket urbain",
      promptValue:
        "an urban basketball court at dusk, chain-link fence and city lights in the background",
    },
    {
      label: "Ruelle graffiti",
      promptValue:
        "a graffiti-covered alleyway, hard artificial lighting, gritty urban texture",
    },
    {
      label: "Carrefour nocturne, néons",
      promptValue:
        "a busy city crosswalk at night, neon signage and motion blur from traffic in the background",
    },
  ],
  "romantique-nostalgique": [
    {
      label: "Cottage campagne, golden hour",
      promptValue:
        "a sun-faded countryside cottage exterior, golden hour light, soft haze in the air",
    },
    {
      label: "Boardwalk en bord de mer",
      promptValue:
        "an old seaside boardwalk at sunset, warm pastel sky, weathered wood textures",
    },
    {
      label: "Route de terre, voiture vintage",
      promptValue:
        "a vintage car parked on a quiet dirt road, wildflowers along the roadside, warm late afternoon light",
    },
  ],
  "editorial-haute-couture": [
    {
      label: "Escalier de marbre",
      promptValue:
        "a grand marble staircase inside a historic building, dramatic overhead lighting",
    },
    {
      label: "Désert sculptural",
      promptValue:
        "a vast empty desert landscape, sculptural rock formations, stark contrast between sky and ground",
    },
    {
      label: "Lobby d'hôtel opulent",
      promptValue:
        "an opulent hotel lobby or ballroom, ornate architecture, dramatic chiaroscuro lighting",
    },
  ],
};

export const BRAND_CAMPAIGN_AGE_OPTIONS = [20, 30, 40, 50, 60] as const;

export type BrandCampaignAge = (typeof BRAND_CAMPAIGN_AGE_OPTIONS)[number];

export const BRAND_CAMPAIGN_MORPHOLOGY_OPTIONS: Array<{
  id: BrandCampaignMorphologyId;
  label: string;
}> = [
  { id: "athletique", label: "Athlétique" },
  { id: "standard", label: "Standard" },
  { id: "enrobe", label: "Enrobé" },
];

export const BRAND_CAMPAIGN_PLACEHOLDERS = {
  ambiance: "[AMBIANCE_GENERALE]",
  cameraAngle: "[BLOC_ANGLE_CAMERA]",
  distance: "[BLOC_DISTANCE_CAMERA]",
  physique: "[PHYSIQUE]",
  action: "[ACTION_MOUVEMENT]",
  gaze: "[BLOC_REGARD]",
  product: "[PRODUIT_TENUE]",
  environment: "[ENVIRONNEMENT]",
  ratio: "[RATIO]",
} as const;

export const BRAND_CAMPAIGN_TEMPLATE_BODY = `Editorial ${BRAND_CAMPAIGN_PLACEHOLDERS.ambiance} campaign photograph.

${BRAND_CAMPAIGN_PLACEHOLDERS.cameraAngle}, ${BRAND_CAMPAIGN_PLACEHOLDERS.distance}.

${BRAND_CAMPAIGN_PLACEHOLDERS.physique}, ${BRAND_CAMPAIGN_PLACEHOLDERS.action}. ${BRAND_CAMPAIGN_PLACEHOLDERS.gaze}.

Wearing ${BRAND_CAMPAIGN_PLACEHOLDERS.product}.

Skin with natural visible pores and subtle sheen, natural grooming.

Lighting: bright natural sunlight, hard directional light from front-right, strong contrast,
deep natural shadows, warm color temperature around 5600K.

Environment: ${BRAND_CAMPAIGN_PLACEHOLDERS.environment}.

Style and mood: aspirational, confident, sun-drenched campaign feel. Editorial style referencing
high-end brand campaigns.

Photorealistic quality, high detail, 4K, cinematic color grading, slight film grain, natural
finish, ${BRAND_CAMPAIGN_PLACEHOLDERS.ratio} aspect ratio.`;

type ManualPhysiqueKey = `${UgcSelfieGender}-${BrandCampaignAge}-${BrandCampaignMorphologyId}`;

const MORPHOLOGY_EN: Record<BrandCampaignMorphologyId, string> = {
  athletique: "athletic",
  standard: "average-build",
  enrobe: "stocky",
};

function manualPhysiqueKey(
  gender: UgcSelfieGender,
  age: BrandCampaignAge,
  morphology: BrandCampaignMorphologyId,
): ManualPhysiqueKey {
  return `${gender}-${age}-${morphology}`;
}

/** 30 descriptions uniques — une par combinaison âge × morphologie × sexe. */
export const BRAND_CAMPAIGN_MANUAL_PHYSIQUE: Record<ManualPhysiqueKey, string> = {
  "homme-20-athletique":
    "A 20-year-old athletic man with a lean muscular frame, sharp jawline, and energetic youthful features",
  "homme-20-standard":
    "A 20-year-old man of average build with balanced proportions, soft angular features, and an approachable expression",
  "homme-20-enrobe":
    "A 20-year-old stocky man with a broad sturdy frame, rounded shoulders, and a warm open face",
  "homme-30-athletique":
    "A 30-year-old athletic man with toned shoulders, defined cheekbones, and a confident steady gaze",
  "homme-30-standard":
    "A 30-year-old man of average build with even features, natural stubble shadow, and relaxed posture",
  "homme-30-enrobe":
    "A 30-year-old stocky man with a solid torso, strong neck, and composed masculine presence",
  "homme-40-athletique":
    "A 40-year-old athletic man with a firm jaw, visible fitness in the shoulders, and mature alert eyes",
  "homme-40-standard":
    "A 40-year-old man of average build with subtle smile lines, balanced features, and grounded presence",
  "homme-40-enrobe":
    "A 40-year-old stocky man with a broad chest, full face, and dignified mature expression",
  "homme-50-athletique":
    "A 50-year-old athletic man with weathered tan skin, lean muscle definition, and silver at the temples",
  "homme-50-standard":
    "A 50-year-old man of average build with gentle forehead lines, salt-and-pepper hair, and calm authority",
  "homme-50-enrobe":
    "A 50-year-old stocky man with a heavyset frame, deep-set eyes, and a warm seasoned look",
  "homme-60-athletique":
    "A 60-year-old athletic man with wiry lean muscle, sun-worn skin, and sharp attentive eyes",
  "homme-60-standard":
    "A 60-year-old man of average build with soft age lines, silver hair, and a serene composed face",
  "homme-60-enrobe":
    "A 60-year-old stocky man with a broad silhouette, full cheeks, and a gentle authoritative presence",
  "femme-20-athletique":
    "A 20-year-old athletic woman with toned limbs, high cheekbones, and bright youthful energy",
  "femme-20-standard":
    "A 20-year-old woman of average build with soft oval features, clear skin, and a natural smile",
  "femme-20-enrobe":
    "A 20-year-old curvy woman with a full figure, rounded cheeks, and warm expressive eyes",
  "femme-30-athletique":
    "A 30-year-old athletic woman with a lean defined frame, sculpted shoulders, and poised confidence",
  "femme-30-standard":
    "A 30-year-old woman of average build with refined features, even skin tone, and relaxed elegance",
  "femme-30-enrobe":
    "A 30-year-old curvy woman with soft curves, full lips, and a grounded self-assured presence",
  "femme-40-athletique":
    "A 40-year-old athletic woman with firm muscle tone, angular cheek structure, and mature vitality",
  "femme-40-standard":
    "A 40-year-old woman of average build with faint smile lines, balanced symmetry, and calm grace",
  "femme-40-enrobe":
    "A 40-year-old curvy woman with a full silhouette, warm skin, and a composed mature warmth",
  "femme-50-athletique":
    "A 50-year-old athletic woman with lean definition, sun-kissed skin, and striking mature cheekbones",
  "femme-50-standard":
    "A 50-year-old woman of average build with silver-streaked hair, soft nasolabial lines, and quiet confidence",
  "femme-50-enrobe":
    "A 50-year-old curvy woman with a generous frame, rounded features, and lived-in elegance",
  "femme-60-athletique":
    "A 60-year-old athletic woman with wiry tone, weathered graceful skin, and bright attentive eyes",
  "femme-60-standard":
    "A 60-year-old woman of average build with pearl-gray hair, gentle wrinkles, and dignified poise",
  "femme-60-enrobe":
    "A 60-year-old curvy woman with a full mature figure, soft cheeks, and a warm serene expression",
};

export function getBrandCampaignAmbianceById(
  id: BrandCampaignAmbianceId | string | null | undefined,
): BrandCampaignAmbianceOption | undefined {
  return BRAND_CAMPAIGN_AMBIANCE_OPTIONS.find((option) => option.id === id);
}

export function getBrandCampaignCameraAngleById(
  id: BrandCampaignCameraAngleId | string | null | undefined,
): BrandCampaignCameraAngleOption | undefined {
  return BRAND_CAMPAIGN_CAMERA_ANGLE_OPTIONS.find((option) => option.id === id);
}

export function resolveBrandCampaignManualPhysique(
  gender: UgcSelfieGender,
  age: BrandCampaignAge,
  morphology: BrandCampaignMorphologyId,
): string {
  const key = manualPhysiqueKey(gender, age, morphology);
  const resolved = BRAND_CAMPAIGN_MANUAL_PHYSIQUE[key];
  if (resolved) return resolved;

  const sexWord = gender === "homme" ? "man" : "woman";
  const morphologyWord = MORPHOLOGY_EN[morphology];
  return `A ${age}-year-old ${morphologyWord} ${sexWord} with natural features and campaign-ready presence`;
}

type RandomFn = () => number;

export function pickWeightedTier(tiers: WeightedTier[], randomFn: RandomFn = Math.random): string {
  const total = tiers.reduce((sum, tier) => sum + tier.weight, 0);
  if (total <= 0) return tiers[0]?.value ?? "";

  let roll = randomFn() * total;
  for (const tier of tiers) {
    roll -= tier.weight;
    if (roll <= 0) return tier.value;
  }
  return tiers[tiers.length - 1]?.value ?? "";
}

export function pickRandomFromBank<T>(bank: T[], randomFn: RandomFn = Math.random): T {
  if (bank.length === 0) {
    throw new Error("Cannot pick from an empty bank");
  }
  return bank[Math.floor(randomFn() * bank.length)] ?? bank[0];
}

export function resolveBrandCampaignCameraAngleTier(
  angleId: BrandCampaignCameraAngleId,
  randomFn: RandomFn = Math.random,
): string {
  const option = getBrandCampaignCameraAngleById(angleId);
  if (!option) return "";
  return pickWeightedTier(option.tiers, randomFn);
}

export function resolveBrandCampaignDistanceTier(
  distanceId: BrandCampaignDistanceId,
  randomFn: RandomFn = Math.random,
): string {
  const option = BRAND_CAMPAIGN_DISTANCE_OPTIONS.find((item) => item.id === distanceId);
  if (!option) return "";
  return pickWeightedTier(option.tiers, randomFn);
}

export function resolveBrandCampaignGaze(
  cameraAngleId: BrandCampaignCameraAngleId,
  gazeId?: BrandCampaignGazeId | null,
): string {
  if (cameraAngleId === "face-a-face") {
    return BRAND_CAMPAIGN_FACE_TO_FACE_GAZE;
  }
  if (!gazeId) return BRAND_CAMPAIGN_GAZE_VALUES["vers-camera"];
  return BRAND_CAMPAIGN_GAZE_VALUES[gazeId];
}

export function resolveBrandCampaignAction(
  ambianceId: BrandCampaignAmbianceId,
  randomFn: RandomFn = Math.random,
): string {
  return pickRandomFromBank(BRAND_CAMPAIGN_ACTION_BANKS[ambianceId], randomFn).promptValue;
}

export function resolveBrandCampaignEnvironment(
  ambianceId: BrandCampaignAmbianceId,
  randomFn: RandomFn = Math.random,
): string {
  return pickRandomFromBank(BRAND_CAMPAIGN_ENVIRONMENT_BANKS[ambianceId], randomFn).promptValue;
}

export function buildBrandCampaignBankGridOptions(
  bank: BrandCampaignBankOption[],
  prefix: string,
): BrandCampaignGridOption[] {
  return bank.map((option, index) => ({
    id: `${prefix}-${index}`,
    label: option.label,
    promptValue: option.promptValue,
  }));
}
