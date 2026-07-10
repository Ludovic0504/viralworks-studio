export type ProduitApplicationProductTypeId = "texture" | "objet";

export type ProduitApplicationGenderId = "homme" | "femme";

export type ProduitApplicationBodyZoneId =
  | "visage-joue"
  | "contour-yeux"
  | "cou-decollete"
  | "cuir-chevelu"
  | "cheveux-longueurs"
  | "main-avant-bras"
  | "coude"
  | "genou"
  | "mollet"
  | "cuisse"
  | "pied-cheville"
  | "dos-omoplate"
  | "epaule"
  | "aisselle"
  | "ventre-taille";

export type ProduitApplicationContainerId = "visible" | "hors-cadre";

export type ProduitApplicationTextureTypeId =
  | "serum-liquide"
  | "creme-riche"
  | "gel"
  | "mousse"
  | "poudre"
  | "huile"
  | "baume-solide"
  | "lotion"
  | "argile-masque";

export type ProduitApplicationObjectTypeId =
  | "rasoir-facial"
  | "pinceau-maquillage"
  | "eponge-beaute"
  | "rouleau-jade"
  | "brosse-nettoyante"
  | "rasoir-jetable"
  | "rasoir-electrique"
  | "epilateur"
  | "brosse-cheveux"
  | "peigne"
  | "brosse-demelante"
  | "brosse-massage-cuir-chevelu"
  | "gant-exfoliant"
  | "brosse-corporelle"
  | "eponge-konjac"
  | "rouleau-massage"
  | "lime"
  | "pinceau-vernis"
  | "batonnet-cuticules";

export type ProduitApplicationPostureId =
  | "debout"
  | "assis-objet"
  | "assis-sol-naturel";

export type ProduitApplicationDecorId = "studio" | "environnement";

export type ProduitApplicationLightingId =
  | "naturelle-douce"
  | "studio-dramatique-bicolore"
  | "studio-classique-commercial";

export type ProduitApplicationButtonOption<T extends string = string> = {
  id: T;
  label: string;
};

export const PRODUIT_APPLICATION_HERO_IMAGE =
  "/image-studio/templates/produit-en-application/produit-en-application.png";

export const PRODUIT_APPLICATION_PRODUCT_TYPE_OPTIONS: ProduitApplicationButtonOption<ProduitApplicationProductTypeId>[] =
  [
    { id: "texture", label: "Produit texture (crème, sérum…)" },
    { id: "objet", label: "Objet (rasoir, brosse…)" },
  ];

export const PRODUIT_APPLICATION_GENDER_OPTIONS: ProduitApplicationButtonOption<ProduitApplicationGenderId>[] =
  [
    { id: "homme", label: "Homme" },
    { id: "femme", label: "Femme" },
  ];

export const PRODUIT_APPLICATION_BODY_ZONE_OPTIONS: ProduitApplicationButtonOption<ProduitApplicationBodyZoneId>[] =
  [
    { id: "visage-joue", label: "Visage / joue" },
    { id: "contour-yeux", label: "Contour des yeux" },
    { id: "cou-decollete", label: "Cou / décolleté" },
    { id: "cuir-chevelu", label: "Cuir chevelu" },
    { id: "cheveux-longueurs", label: "Cheveux" },
    { id: "main-avant-bras", label: "Main / avant-bras" },
    { id: "coude", label: "Coude" },
    { id: "genou", label: "Genou" },
    { id: "mollet", label: "Mollet" },
    { id: "cuisse", label: "Cuisse" },
    { id: "pied-cheville", label: "Pied / cheville" },
    { id: "dos-omoplate", label: "Dos / omoplate" },
    { id: "epaule", label: "Épaule" },
    { id: "aisselle", label: "Aisselle" },
    { id: "ventre-taille", label: "Ventre / taille" },
  ];

/** Zones cohérentes avec la table zone→objets (template objet). */
export const PRODUIT_APPLICATION_OBJECT_BODY_ZONE_IDS: ProduitApplicationBodyZoneId[] = [
  "visage-joue",
  "aisselle",
  "genou",
  "mollet",
  "cuisse",
  "pied-cheville",
  "cuir-chevelu",
  "cheveux-longueurs",
  "dos-omoplate",
  "main-avant-bras",
  "coude",
  "epaule",
];

export type ProduitApplicationZoneProfile = {
  zoneCorps: string;
  cadrageZone: string;
  focale: string;
  ouverture: string;
  profondeurChamp: string;
};

export const PRODUIT_APPLICATION_ZONE_PROFILES: Record<
  ProduitApplicationBodyZoneId,
  ProduitApplicationZoneProfile
> = {
  "visage-joue": {
    zoneCorps: "visage et joue",
    cadrageZone: "ECU macro, cadrage serré tiers du visage",
    focale: "85mm",
    ouverture: "f/2",
    profondeurChamp: "faible profondeur de champ, arrière-plan en bokeh doux",
  },
  "contour-yeux": {
    zoneCorps: "contour des yeux",
    cadrageZone: "ECU macro extrême",
    focale: "100mm",
    ouverture: "f/2.8",
    profondeurChamp: "faible profondeur de champ, arrière-plan en bokeh doux",
  },
  "cou-decollete": {
    zoneCorps: "cou et décolleté",
    cadrageZone: "CU, épaules incluses",
    focale: "85mm",
    ouverture: "f/2.2",
    profondeurChamp: "profondeur de champ modérée, épaules légèrement adoucies",
  },
  "cuir-chevelu": {
    zoneCorps: "cuir chevelu et racines",
    cadrageZone: "CU serré, mèches séparées visibles",
    focale: "85mm",
    ouverture: "f/2.5",
    profondeurChamp: "faible profondeur de champ, arrière-plan en bokeh doux",
  },
  "cheveux-longueurs": {
    zoneCorps: "longueurs de cheveux",
    cadrageZone: "MS, cheveux en mouvement ou tenus",
    focale: "50mm",
    ouverture: "f/2",
    profondeurChamp: "profondeur de champ modérée, mouvement des mèches lisible",
  },
  "main-avant-bras": {
    zoneCorps: "main et avant-bras",
    cadrageZone: "CU, poignet à coude",
    focale: "85mm",
    ouverture: "f/2.5",
    profondeurChamp: "faible profondeur de champ, avant-bras en léger flou",
  },
  coude: {
    zoneCorps: "coude",
    cadrageZone: "CU serré",
    focale: "85mm",
    ouverture: "f/2.8",
    profondeurChamp: "faible profondeur de champ, arrière-plan en bokeh doux",
  },
  genou: {
    zoneCorps: "genou",
    cadrageZone: "CU serré",
    focale: "85mm",
    ouverture: "f/2.5",
    profondeurChamp: "faible profondeur de champ, jambe en léger flou",
  },
  mollet: {
    zoneCorps: "mollet et tibia",
    cadrageZone: "CU à MS, jambe entière visible",
    focale: "50mm",
    ouverture: "f/2.8",
    profondeurChamp: "profondeur de champ modérée, cuisse en léger flou",
  },
  cuisse: {
    zoneCorps: "cuisse",
    cadrageZone: "MS",
    focale: "50mm",
    ouverture: "f/2.5",
    profondeurChamp: "profondeur de champ modérée, hanches en léger flou",
  },
  "pied-cheville": {
    zoneCorps: "pied et cheville",
    cadrageZone: "CU",
    focale: "85mm",
    ouverture: "f/2.8",
    profondeurChamp: "faible profondeur de champ, sol en bokeh doux",
  },
  "dos-omoplate": {
    zoneCorps: "dos et omoplate",
    cadrageZone: "MS",
    focale: "50mm",
    ouverture: "f/2.5",
    profondeurChamp: "profondeur de champ modérée, silhouette lisible",
  },
  epaule: {
    zoneCorps: "épaule",
    cadrageZone: "CU à MS",
    focale: "85mm",
    ouverture: "f/2.5",
    profondeurChamp: "profondeur de champ modérée, buste en léger flou",
  },
  aisselle: {
    zoneCorps: "aisselle",
    cadrageZone: "CU serré",
    focale: "85mm",
    ouverture: "f/2.8",
    profondeurChamp: "faible profondeur de champ, arrière-plan en bokeh doux",
  },
  "ventre-taille": {
    zoneCorps: "ventre et taille",
    cadrageZone: "MS",
    focale: "50mm",
    ouverture: "f/2.5",
    profondeurChamp: "profondeur de champ modérée, hanches en léger flou",
  },
};

export const PRODUIT_APPLICATION_CONTAINER_OPTIONS: ProduitApplicationButtonOption<ProduitApplicationContainerId>[] =
  [
    { id: "visible", label: "Contenant visible" },
    { id: "hors-cadre", label: "Hors-cadre (texture/geste seul)" },
  ];

export type ProduitApplicationTextureProfile = {
  textureType: string;
  transparence: string;
  brillance: string;
  etatTexture: string;
};

export const PRODUIT_APPLICATION_TEXTURE_PROFILES: Record<
  ProduitApplicationTextureTypeId,
  ProduitApplicationTextureProfile
> = {
  "serum-liquide": {
    textureType: "sérum liquide",
    transparence: "transparent à doré translucide",
    brillance: "glossy, très réfléchissant",
    etatTexture: "goutte qui perle / traînée fine qui coule",
  },
  "creme-riche": {
    textureType: "crème riche",
    transparence: "opaque, blanc à ivoire",
    brillance: "satiné à mat",
    etatTexture: "noisette non étalée / partiellement fondue",
  },
  gel: {
    textureType: "gel",
    transparence: "translucide, incolore à bleuté",
    brillance: "glossy humide",
    etatTexture: "fraîchement déposé, aspect gélatineux",
  },
  mousse: {
    textureType: "mousse (rasage, nettoyante)",
    transparence: "opaque blanc",
    brillance: "mat, aspect aéré",
    etatTexture: "bulles visibles, volume net",
  },
  poudre: {
    textureType: "poudre compacte",
    transparence: "opaque",
    brillance: "mat",
    etatTexture: "nuage léger en suspension ou déposé net",
  },
  huile: {
    textureType: "huile",
    transparence: "transparent doré",
    brillance: "très glossy, reflets marqués",
    etatTexture: "fines gouttes, film brillant sur la peau",
  },
  "baume-solide": {
    textureType: "baume solide",
    transparence: "opaque, souvent teinté",
    brillance: "satiné",
    etatTexture: "trace épaisse laissée par le stick",
  },
  lotion: {
    textureType: "lotion fluide",
    transparence: "opaque léger, blanc cassé",
    brillance: "satiné",
    etatTexture: "fine pellicule, absorption partielle visible",
  },
  "argile-masque": {
    textureType: "argile / masque",
    transparence: "opaque, terre à gris",
    brillance: "mat total",
    etatTexture: "couche épaisse, texture granuleuse visible",
  },
};

export const PRODUIT_APPLICATION_TEXTURE_TYPE_OPTIONS: ProduitApplicationButtonOption<ProduitApplicationTextureTypeId>[] =
  [
    { id: "serum-liquide", label: "Sérum liquide" },
    { id: "creme-riche", label: "Crème riche" },
    { id: "gel", label: "Gel" },
    { id: "mousse", label: "Mousse" },
    { id: "poudre", label: "Poudre" },
    { id: "huile", label: "Huile" },
    { id: "baume-solide", label: "Baume solide" },
    { id: "lotion", label: "Lotion" },
    { id: "argile-masque", label: "Argile-masque" },
  ];

export type ProduitApplicationObjectProfile = {
  objetDesc: string;
  gesteObjet: string;
  typeContact: string;
  resultatVisuelPeau: string;
};

export const PRODUIT_APPLICATION_OBJECT_PROFILES: Record<
  ProduitApplicationObjectTypeId,
  ProduitApplicationObjectProfile
> = {
  "rasoir-facial": {
    objetDesc: "rasoir facial (dermaplaning)",
    gesteObjet: "fait glisser la lame en un mouvement long et contrôlé",
    typeContact: "lame en contact plat avec la peau",
    resultatVisuelPeau: "ligne nette rasée contrastant avec la mousse restante",
  },
  "pinceau-maquillage": {
    objetDesc: "pinceau maquillage",
    gesteObjet: "tapote ou balaie en petits mouvements circulaires",
    typeContact: "poils du pinceau en contact léger avec la peau",
    resultatVisuelPeau: "produit fondu, fini uniforme",
  },
  "eponge-beaute": {
    objetDesc: "éponge beauté",
    gesteObjet: "tapote ou balaie en petits mouvements circulaires",
    typeContact: "surface de l'éponge en contact avec la peau",
    resultatVisuelPeau: "produit fondu, fini uniforme",
  },
  "rouleau-jade": {
    objetDesc: "rouleau de jade/gua sha",
    gesteObjet: "fait rouler ou glisser fermement le long du contour",
    typeContact: "pierre en pression glissante sur la peau",
    resultatVisuelPeau: "trace légère de pression, peau lisse et hydratée",
  },
  "brosse-nettoyante": {
    objetDesc: "brosse nettoyante",
    gesteObjet: "frotte en mouvements circulaires fermes",
    typeContact: "poils de la brosse en contact avec la peau",
    resultatVisuelPeau: "peau légèrement rosée, mousse ou résidus visibles",
  },
  "rasoir-jetable": {
    objetDesc: "rasoir jetable",
    gesteObjet: "fait glisser la lame en un mouvement long et contrôlé",
    typeContact: "lame en contact plat avec la peau",
    resultatVisuelPeau: "ligne nette rasée contrastant avec la mousse restante",
  },
  "rasoir-electrique": {
    objetDesc: "rasoir électrique",
    gesteObjet: "passe l'appareil à plat contre la peau",
    typeContact: "tête de rasoir en contact plat",
    resultatVisuelPeau: "zone nette contrastant avec la zone non traitée",
  },
  epilateur: {
    objetDesc: "épilateur",
    gesteObjet: "passe l'appareil à plat contre la peau",
    typeContact: "tête d'épilateur en contact plat",
    resultatVisuelPeau: "zone nette contrastant avec la zone non traitée",
  },
  "brosse-cheveux": {
    objetDesc: "brosse à cheveux",
    gesteObjet: "tire la brosse le long des longueurs en un geste ample",
    typeContact: "poils de la brosse dans les mèches",
    resultatVisuelPeau: "mèches lissées, légère brillance, quelques cheveux volants",
  },
  peigne: {
    objetDesc: "peigne",
    gesteObjet: "tire la brosse le long des longueurs en un geste ample",
    typeContact: "dents du peigne dans les mèches",
    resultatVisuelPeau: "mèches lissées, légère brillance, quelques cheveux volants",
  },
  "brosse-demelante": {
    objetDesc: "brosse démêlante",
    gesteObjet: "tire la brosse le long des longueurs en un geste ample",
    typeContact: "poils de la brosse dans les mèches",
    resultatVisuelPeau: "mèches lissées, légère brillance, quelques cheveux volants",
  },
  "brosse-massage-cuir-chevelu": {
    objetDesc: "brosse à massage cuir chevelu",
    gesteObjet: "tire la brosse le long des longueurs en un geste ample",
    typeContact: "poils de la brosse sur le cuir chevelu",
    resultatVisuelPeau: "mèches lissées, légère brillance, quelques cheveux volants",
  },
  "gant-exfoliant": {
    objetDesc: "gant exfoliant",
    gesteObjet: "frotte en mouvements circulaires fermes",
    typeContact: "texture du gant en frottement sur la peau",
    resultatVisuelPeau: "peau légèrement rosée, mousse ou résidus visibles",
  },
  "brosse-corporelle": {
    objetDesc: "brosse corporelle sèche",
    gesteObjet: "frotte en mouvements circulaires fermes",
    typeContact: "poils de la brosse en contact ferme avec la peau",
    resultatVisuelPeau: "peau légèrement rosée, mousse ou résidus visibles",
  },
  "eponge-konjac": {
    objetDesc: "éponge konjac",
    gesteObjet: "frotte en mouvements circulaires fermes",
    typeContact: "surface de l'éponge en contact avec la peau",
    resultatVisuelPeau: "peau légèrement rosée, mousse ou résidus visibles",
  },
  "rouleau-massage": {
    objetDesc: "rouleau de massage",
    gesteObjet: "fait rouler ou glisser fermement le long du contour",
    typeContact: "rouleau en pression glissante sur la peau",
    resultatVisuelPeau: "trace légère de pression, peau lisse et hydratée",
  },
  lime: {
    objetDesc: "lime",
    gesteObjet: "fait glisser la lime en un mouvement contrôlé",
    typeContact: "lime en contact avec l'ongle",
    resultatVisuelPeau: "ongle lissé, bord net",
  },
  "pinceau-vernis": {
    objetDesc: "pinceau vernis",
    gesteObjet: "tapote ou balaie en petits mouvements circulaires",
    typeContact: "poils du pinceau sur l'ongle",
    resultatVisuelPeau: "vernis appliqué, fini uniforme",
  },
  "batonnet-cuticules": {
    objetDesc: "bâtonnet repousse-cuticules",
    gesteObjet: "fait glisser le bâtonnet le long du contour de l'ongle",
    typeContact: "bâtonnet en contact avec la cuticule",
    resultatVisuelPeau: "cuticule repoussée, contour net",
  },
};

/** Table zone→objets (template objet). */
export const PRODUIT_APPLICATION_ZONE_OBJECT_IDS: Record<
  ProduitApplicationBodyZoneId,
  ProduitApplicationObjectTypeId[]
> = {
  "visage-joue": [
    "rasoir-facial",
    "pinceau-maquillage",
    "eponge-beaute",
    "rouleau-jade",
    "brosse-nettoyante",
  ],
  "contour-yeux": [],
  "cou-decollete": [],
  "cuir-chevelu": [
    "brosse-cheveux",
    "peigne",
    "brosse-demelante",
    "brosse-massage-cuir-chevelu",
  ],
  "cheveux-longueurs": ["brosse-cheveux", "peigne", "brosse-demelante"],
  "main-avant-bras": [
    "gant-exfoliant",
    "brosse-corporelle",
    "eponge-konjac",
    "rouleau-massage",
    "lime",
    "pinceau-vernis",
    "batonnet-cuticules",
  ],
  coude: ["gant-exfoliant", "brosse-corporelle", "eponge-konjac", "rouleau-massage"],
  genou: ["rasoir-jetable", "rasoir-electrique", "epilateur"],
  mollet: ["rasoir-jetable", "rasoir-electrique", "epilateur"],
  cuisse: ["rasoir-jetable", "rasoir-electrique", "epilateur"],
  "pied-cheville": ["rasoir-jetable", "rasoir-electrique", "epilateur"],
  "dos-omoplate": ["gant-exfoliant", "brosse-corporelle", "eponge-konjac", "rouleau-massage"],
  epaule: ["gant-exfoliant", "brosse-corporelle", "eponge-konjac", "rouleau-massage"],
  aisselle: ["rasoir-jetable", "rasoir-electrique", "epilateur"],
  "ventre-taille": [],
};

export const PRODUIT_APPLICATION_OBJECT_TYPE_OPTIONS: ProduitApplicationButtonOption<ProduitApplicationObjectTypeId>[] =
  Object.entries(PRODUIT_APPLICATION_OBJECT_PROFILES).map(([id, profile]) => ({
    id: id as ProduitApplicationObjectTypeId,
    label: profile.objetDesc.charAt(0).toUpperCase() + profile.objetDesc.slice(1),
  }));

export const PRODUIT_APPLICATION_POSTURE_OPTIONS: ProduitApplicationButtonOption<ProduitApplicationPostureId>[] =
  [
    { id: "debout", label: "Debout" },
    { id: "assis-objet", label: "Assis sur objet (chaise, rebord)" },
    { id: "assis-sol-naturel", label: "Assis au sol ou élément naturel" },
  ];

export const PRODUIT_APPLICATION_DECOR_OPTIONS: ProduitApplicationButtonOption<ProduitApplicationDecorId>[] =
  [
    { id: "studio", label: "Studio fond neutre" },
    { id: "environnement", label: "Environnement dynamique" },
  ];

export const PRODUIT_APPLICATION_LIGHTING_OPTIONS: ProduitApplicationButtonOption<ProduitApplicationLightingId>[] =
  [
    { id: "naturelle-douce", label: "Naturelle douce" },
    { id: "studio-dramatique-bicolore", label: "Studio dramatique bicolore" },
    { id: "studio-classique-commercial", label: "Studio classique commercial" },
  ];

export const PRODUIT_APPLICATION_GESTE_APPLICATION_POOL = [
  "étale [le produit] en mouvements circulaires légers",
  "fait pénétrer [le produit] en tapotant du bout des doigts",
  "masse [le produit] en pressions douces",
  "applique [le produit] en un geste fluide et continu",
  "dépose [le produit] du bout des doigts sans encore l'étaler",
  "fait glisser [le produit] en un mouvement ascendant",
  "presse [le produit] entre les paumes avant application",
  "vient de retirer les doigts, laissant une trace nette de produit",
] as const;

export const PRODUIT_APPLICATION_CONTENANT_VISIBLE_TEXTURE_POOL = [
  "Flacon compte-gouttes en verre dépoli, embout noir, étiquette minimaliste — tenu en amorce du cadre, produit lisible",
  "Pot en verre à couvercle, logo visible sur le dessus, posé ou tenu ouvert",
  "Tube souple pressé d'une main, packaging mat, logo en relief",
  "Flacon pompe, buse visible, une pression vient d'être actionnée",
  "Spray/atomiseur, fine brume encore visible en suspension",
  "Stick/baume, capuchon retiré posé à côté ou tenu dans l'autre main",
] as const;

export const PRODUIT_APPLICATION_CONTENANT_HORS_CADRE_TEXTURE =
  "aucun packaging visible, seule la texture sur la peau et le geste d'application sont dans le cadre";

export const PRODUIT_APPLICATION_CONTENANT_OBJET_POOL = [
  "Objet tenu en gros plan, design et matériau clairement lisibles",
  "Objet partiellement hors-cadre, seul le point de contact avec la peau est net",
] as const;

export const PRODUIT_APPLICATION_CONTENANT_OBJET_DEFAULT =
  PRODUIT_APPLICATION_CONTENANT_OBJET_POOL[0];

export const PRODUIT_APPLICATION_MATERIAU_OBJET_POOL = [
  "métal brossé mat",
  "plastique blanc mat premium",
  "silicone souple texturé",
  "bois clair naturel",
  "bambou",
  "céramique blanche",
] as const;

export const PRODUIT_APPLICATION_POSTURE_DESC: Record<ProduitApplicationPostureId, string> = {
  debout: "debout, buste droit, poids légèrement sur une jambe",
  "assis-objet": "assis sur une chaise ou un tabouret, dos droit",
  "assis-sol-naturel": "assis au sol, jambes repliées sur le côté",
};

export const PRODUIT_APPLICATION_DECOR_STUDIO_POOL = [
  "fond studio uni blanc, aucun élément de décor, ombre douce au sol",
  "fond studio uni gris clair, léger dégradé",
] as const;

export const PRODUIT_APPLICATION_DECOR_ENVIRONNEMENT_POOL = [
  "salle de bain moderne, carrelage clair, miroir flouté en arrière-plan",
  "extérieur lumineux, terrasse ou jardin flouté en arrière-plan",
  "chambre lumineuse, linge de lit flouté en amorce",
  "vestiaire/spa, ambiance chaleureuse floutée",
] as const;

export const PRODUIT_APPLICATION_ECLAIRAGE_DESC: Record<ProduitApplicationLightingId, string> = {
  "naturelle-douce":
    "lumière naturelle diffuse venant de face-haut, température neutre jour 5000K, ombres douces minimales",
  "studio-dramatique-bicolore":
    "deux sources contrastées (ex. gel coloré + faisceau blanc dur), bord de lumière net, met en valeur la texture du produit",
  "studio-classique-commercial":
    "softbox frontale, lumière douce et homogène, aucune ombre dure, rendu clean et lisible",
};

export const PRODUIT_APPLICATION_AMBIANCE_STYLE_POOL = [
  "clean beauty, éditorial épuré, registre skincare clinique (The Ordinary, Typology)",
  "lifestyle premium, punchy et coloré, registre DTC moderne (Rhode, Glossier)",
  "éditorial dramatique haut de gamme, registre campagne beauté (Fenty Skin)",
  "naturel et détendu, registre \"vécu\", lumière du quotidien",
  "spa / bien-être, ambiance apaisante et chaleureuse",
] as const;

export const PRODUIT_APPLICATION_DEFAULT_RATIO = "4:5";
export const PRODUIT_APPLICATION_DEFAULT_GRAIN = "léger, quasi imperceptible";
export const PRODUIT_APPLICATION_DEFAULT_COLORIMETRIE = "neutre et naturelle";
export const PRODUIT_APPLICATION_DRAMATIC_COLORIMETRIE = "saturée et contrastée";

export const PRODUIT_APPLICATION_TEXTURE_TEMPLATE_BODY = `Photo produit en application, [CADRAGE_ZONE], objectif [FOCALE] à [OUVERTURE], mise au point nette sur le geste et la texture, [PROFONDEUR_CHAMP].

Sujet : [PHYSIQUE], [POSTURE_DESC].

Application produit : [GESTE_APPLICATION] sur [ZONE_CORPS], [TEXTURE_TYPE] ([TRANSPARENCE], [BRILLANCE], [ETAT_TEXTURE]). [CONTENANT_DESC].

Éclairage : [ECLAIRAGE_DESC].

Décor : [DECOR_DESC].

Style et ambiance : [AMBIANCE_STYLE].

Qualité photoréaliste, haute définition, [GRAIN], [COLORIMETRIE], ratio [RATIO].`;

export const PRODUIT_APPLICATION_OBJET_TEMPLATE_BODY = `Photo produit en application, [CADRAGE_ZONE], objectif [FOCALE] à [OUVERTURE], mise au point nette sur l'objet et le point de contact, [PROFONDEUR_CHAMP].

Sujet : [PHYSIQUE], [POSTURE_DESC].

Application produit : [GESTE_OBJET] avec [OBJET_DESC] ([MATERIAU_OBJET]) sur [ZONE_CORPS], [TYPE_CONTACT] ([RESULTAT_VISUEL_PEAU]). [CONTENANT_DESC].

Éclairage : [ECLAIRAGE_DESC].

Décor : [DECOR_DESC].

Style et ambiance : [AMBIANCE_STYLE].

Qualité photoréaliste, haute définition, [GRAIN], [COLORIMETRIE], ratio [RATIO].`;

export function getProduitApplicationBodyZoneOptions(
  productTypeId: ProduitApplicationProductTypeId | null,
): ProduitApplicationButtonOption<ProduitApplicationBodyZoneId>[] {
  if (productTypeId === "objet") {
    return PRODUIT_APPLICATION_BODY_ZONE_OPTIONS.filter((option) =>
      PRODUIT_APPLICATION_OBJECT_BODY_ZONE_IDS.includes(option.id),
    );
  }
  return PRODUIT_APPLICATION_BODY_ZONE_OPTIONS;
}

export function getProduitApplicationObjectOptionsForZone(
  zoneId: ProduitApplicationBodyZoneId | null,
): ProduitApplicationButtonOption<ProduitApplicationObjectTypeId>[] {
  if (!zoneId) return [];
  const objectIds = PRODUIT_APPLICATION_ZONE_OBJECT_IDS[zoneId] ?? [];
  return PRODUIT_APPLICATION_OBJECT_TYPE_OPTIONS.filter((option) =>
    objectIds.includes(option.id),
  );
}

export function resolveProduitApplicationDefaultLightingId(
  _decorId: ProduitApplicationDecorId,
): ProduitApplicationLightingId {
  return "naturelle-douce";
}

export function resolveProduitApplicationDefaultAmbianceStyle(
  lightingId: ProduitApplicationLightingId,
): string {
  if (lightingId === "studio-dramatique-bicolore") {
    return PRODUIT_APPLICATION_AMBIANCE_STYLE_POOL[2];
  }
  return PRODUIT_APPLICATION_AMBIANCE_STYLE_POOL[0];
}

export function resolveProduitApplicationDecorDesc(decorId: ProduitApplicationDecorId): string {
  if (decorId === "studio") {
    return PRODUIT_APPLICATION_DECOR_STUDIO_POOL[0];
  }
  return PRODUIT_APPLICATION_DECOR_ENVIRONNEMENT_POOL[0];
}

type RandomFn = () => number;

function pickRandom<T>(items: readonly T[], randomFn: RandomFn = Math.random): T {
  const index = Math.floor(randomFn() * items.length);
  return items[Math.min(index, items.length - 1)] ?? items[0];
}

export function resolveProduitApplicationGesteApplication(
  productName: string,
  randomFn: RandomFn = Math.random,
): string {
  const template = pickRandom(PRODUIT_APPLICATION_GESTE_APPLICATION_POOL, randomFn);
  const productRef = productName.trim() || "le produit";
  return template.replaceAll("[le produit]", productRef);
}

export function resolveProduitApplicationContenantDescTexture(
  containerId: ProduitApplicationContainerId,
  randomFn: RandomFn = Math.random,
): string {
  if (containerId === "hors-cadre") {
    return PRODUIT_APPLICATION_CONTENANT_HORS_CADRE_TEXTURE;
  }
  return pickRandom(PRODUIT_APPLICATION_CONTENANT_VISIBLE_TEXTURE_POOL, randomFn);
}

export function resolveProduitApplicationContenantDescObjet(): string {
  return PRODUIT_APPLICATION_CONTENANT_OBJET_DEFAULT;
}

export function resolveProduitApplicationMateriauObjet(randomFn: RandomFn = Math.random): string {
  return pickRandom(PRODUIT_APPLICATION_MATERIAU_OBJET_POOL, randomFn);
}

export function resolveProduitApplicationColorimetrie(
  ambianceStyle: string,
  lightingId: ProduitApplicationLightingId,
): string {
  if (
    lightingId === "studio-dramatique-bicolore" ||
    ambianceStyle.includes("dramatique") ||
    ambianceStyle.includes("coloré")
  ) {
    return PRODUIT_APPLICATION_DRAMATIC_COLORIMETRIE;
  }
  return PRODUIT_APPLICATION_DEFAULT_COLORIMETRIE;
}
