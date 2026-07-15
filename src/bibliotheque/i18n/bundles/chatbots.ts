import type { LocaleBundle } from "./ui";
import {
  chatbotGuideExtrasEn,
  chatbotGuideExtrasEs,
  chatbotGuideExtrasDe,
  chatbotGuideExtrasPt,
  chatbotGuideExtrasIt,
} from "./chatbotsGuideExtras";

function mergeGuideExtras(
  base: { chatbot: Record<string, unknown> },
  extras: typeof chatbotGuideExtrasEn,
) {
  return {
    chatbot: {
      ...base.chatbot,
      ui: { ...(base.chatbot.ui as object), ...extras.ui },
      ...Object.fromEntries(
        Object.entries(extras).filter(([key]) => key !== "ui").map(([key, value]) => [key, value]),
      ),
    },
  };
}

const chatbotEn = {
  chatbot: {
    ui: {
      shotStyleQuestion: "What shot style?",
      seeMoreStyles: "See more styles?",
      yes: "Yes",
      no: "No",
      skip: "Skip",
      pass: "Skip",
      send: "Send",
      yourMessage: "Your message",
      pickShotStyle: "Choose a shot style to continue.",
      destinationFormat: "Destination format?",
      formatQuestion: "Destination format?",
      whichDrink: "Which drink?",
      whichProduct: "Describe your product (name, visible material, dominant color)",
      whichEnvironment: "What environment?",
      packagingQuestion: "Can or bottle?",
      elementsQuestion: "How would you like to define the visual elements around the drink?",
      customElementsQuestion: "Describe the elements around the drink and those that make up its flavor.",
      promptReady:
        "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
      applyPrompt: "Apply to prompt",
      back: "Back to templates",
      close: "Close",
      styleOfShot: "Shot style",
      seeMoreStylesAria: "See more styles",
      productState: "New/sealed or opened/used product?",
      typing: "The guide is typing…",
      moreStylesShown: "Here are more styles:",
      chooseCanOrBottle: 'Choose "Can" or "Bottle", or use the buttons above.',
      chooseElementsMode:
        'Choose an option: "Brand reference elements" or "Choose myself", or use the buttons above.',
      can: "Can",
      bottle: "Bottle",
      brandReferenceElements: "Brand reference elements",
      chooseElementsSelf: "Choose elements myself",
      framingQuestion: "What framing?",
      framingHintDefault: "Tight: product dominant. Wide: product integrated into the scene.",
      framingHintDeuxMains:
        "Tight: product dominant. Wide: medium shot — hands and action visible, more background.",
      genderQuestion: "What gender?",
      describeProduct: "Describe your product (name, visible material, dominant color)",
      productPosition: "How is the product positioned?",
      backgroundQuestion: "What type of background do you want?",
      ambianceQuestion: "What ambiance?",
      customAmbianceQuestion: "Specify your custom ambiance",
      dynamicEffectQuestion: "Do you want to add a dynamic effect?",
      imageType: "Image type",
      guideSub: "No-AI guide — automatic fill",
      guide: "Guide",
      adjustFields: "Adjust fields",
      openGuide: "Open the {label} guide",
      other: "Other",
      placeholderPackshotCustomAmbiance: "E.g. desert bohemian, raw industrial…",
      placeholderPackshotProduct: "E.g. artisan amber glass candle, vegetable wax…",
      placeholderYourAnswer: "Your answer…",
      placeholderLifestyleProduct: "E.g. HOLY Hydration Strawberry Kiwi…",
      placeholderLifestyleEnvironment: "E.g. modern gym, tennis court…",
      placeholderDescribeProduct: "Describe the product…",
      placeholderDrink: "E.g. Monster Energy or Monster Energy with green limes…",
      placeholderPackagingMode: "Or choose an option above…",
      placeholderElementsMode: "Or choose an option above…",
      placeholderCustomElements: "Describe the surrounding elements and flavor…",
      placeholderDescribeDrink: "Describe the drink…",
      ariaProductPosition: "Product position",
      ariaBackgroundType: "Background type",
      ariaAmbianceEnv: "Environment ambiance",
      ariaDynamicEffect: "Dynamic effect",
      ariaProductState: "Product state",
      ariaDestinationFormat: "Destination format",
      ariaLifestyleFraming: "Lifestyle framing",
      ariaElementsMode: "Elements mode",
      ariaPackagingFormat: "Packaging format",
    },
    shots: {
      "low-angle": "Low angle",
      "macro-label": "Close-up",
      "explosion-wide": "Wide explosion",
      "freeze-frame": "Freeze-frame",
      "ground-fog": "Ground fog",
      "diagonal-45": "45° diagonal",
      "tight-minimal": "Tight minimal",
      "side-left": "Left side",
      underwater: "Underwater",
      "top-down": "Top-down view",
      "pov-assis": "Seated POV",
      "pov-debout": "Standing POV",
      "produit-levitation": "Floating product",
      "produit-seul": "Product alone",
      "main-gros-plan": "Hand close-up",
      "vue-dessus": "Top-down view",
      "zoom-produit": "Product zoom",
      "deux-mains": "Product in hand, in motion",
    },
    templates: {
      "product-photography": {
        label: "Studio product photo",
        summary: "Studio hero beverage — brand, can/bottle format and ingredients.",
        botIntro:
          "Which drink would you like to feature? Enter the brand or product name — you can also specify surrounding elements now (e.g. \"Monster Energy with green limes\").",
        botAskRequired:
          "Which drink would you like to feature? (e.g. Monster Energy, Coca-Cola, mango juice…)",
        botAskElementsMode:
          "How would you like to define the visual elements around the drink?\n\n• Brand reference elements — typical ingredients associated with this drink\n• Choose myself — describe elements around the product and those that make up the flavor",
        botAskPackagingMode: "Can or bottle?",
        botAskCustomElements:
          "Describe the elements to place around the drink and those that make up its flavor. Example: \"whole and sliced green limes, mint leaves\" or \"mango, passion fruit, ice cubes\".",
        botReady:
          "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
        vars: {
          drink: "Drink / brand",
          packaging: "Packaging format",
          flavorElements: "Ingredients / flavor around",
          brandBackdrop: "Studio background (brand)",
          brandPalette: "Color palette",
        },
      },
      "lifestyle-product-photography": {
        label: "Lifestyle product",
        summary: "Product held in hand in a real setting — brand and environment.",
        botIntro: "What is your product name?",
        botAskRequired: "What is your product name? (e.g. HOLY Hydration, Optiva Energy…)",
        botAskEnvironment:
          "What environment? (e.g. gym, tennis court, modern kitchen…)",
        botReady:
          "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
        vars: {
          product: "Product / brand",
          environment: "Environment / location",
        },
      },
      "ugc-selfie-produit": {
        label: "UGC product selfie",
        summary: "Natural selfie: person presenting a product, smartphone style.",
        botIntro: "What gender?",
        botAskRequired: "What is the product?",
        botReady:
          "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
        vars: {
          productName: "Product",
          location: "Location",
          skinTone: "Skin tone",
          hair: "Hair",
          outfit: "Outfit",
        },
      },
      "ugc-presentation-produit": {
        label: "UGC product presentation",
        summary: "Fixed camera: product held in hand or worn on the body.",
        botIntro: "Is the product held in hand or worn on the body?",
        botAskRequired: "What is the product?",
        botReady:
          "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
        vars: {
          productName: "Product",
          location: "Location",
          physique: "Physique",
          hair: "Hair",
          autreTenue: "Rest of outfit",
        },
      },
      "brand-campaign-shoot": {
        label: "Campaign shoot",
        summary: "Premium campaign style — pose, narrative setting and editorial framing.",
        botIntro: "Who presents the product?",
        botAskRequired: "Describe the outfit or product to feature",
        botReady:
          "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
        vars: {
          productOutfit: "Outfit / product",
          ambiancePrompt: "Ambiance",
          physique: "Physique",
          environment: "Environment",
        },
      },
      "packshot-dynamique": {
        label: "Dynamic Packshot",
        summary:
          "Staged product packshot — posture (placed or levitation) and optional dynamic effect.",
        botIntro: "Describe your product (name, visible material, dominant color)",
        botAskRequired:
          "Describe your product (name, visible material, dominant color) — at least a few words.",
        botReady:
          "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
        vars: {
          productDescription: "Product",
          positionId: "Position",
          backgroundId: "Background",
          ambianceId: "Ambiance",
          customAmbiance: "Custom ambiance",
          interactionId: "Dynamic effect",
          productStateId: "Product state",
          formatId: "Format",
        },
      },
      "editorial-worn-held": {
        label: "Editorial Worn & Held",
        summary:
          "Worn jewelry or held product — high-fashion editorial rendering, macro to full-body framing.",
        botIntro: "What type of staging?",
        botAskRequired:
          "Describe the jewelry or product — at least a few words (material, color, shape…).",
        botReady:
          "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
        vars: {
          sceneTypeId: "Staging type",
          genderId: "Model gender",
          zoneId: "Body zone",
          framingId: "Framing",
          outfitDescription: "Outfit (full body)",
          backgroundId: "Background",
          ambianceId: "Ambiance",
          customAmbiance: "Custom ambiance",
          productDescription: "Jewelry / product",
          postureId: "Posture",
          customGesture: "Custom gesture",
          formatId: "Format",
        },
      },
      "produit-en-application": {
        label: "Product in application",
        summary:
          "Texture or object in contact with the body — application gesture, targeted zone and photorealistic rendering.",
        botIntro: "What type of product?",
        botAskRequired:
          "What is the product name? (e.g. moisturizer, vitamin C serum…) — at least a few words or an @Product image.",
        botReady:
          "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
        vars: {
          productTypeId: "Product type",
          genderId: "Model gender",
          bodyZoneId: "Body zone",
          containerId: "Container",
          textureTypeId: "Texture type",
          objectTypeId: "Object type",
          postureId: "Posture",
          decorId: "Setting",
          lightingId: "Lighting",
          productName: "Product name",
          physique: "Physique",
        },
      },
      "outfit-studio": {
        label: "Outfit Studio",
        summary:
          "Style one or more uploaded garments on a model — studio, lifestyle, commercial interior or mirror selfie.",
        botIntro: "Model gender",
        botAskRequired:
          "Upload at least one garment image or describe the piece to style (e.g. focus on the jacket, bust shot…).",
        botReady:
          "Your prompt is ready. Review it below, then apply it to the input area, or adjust the fields if needed.",
        vars: {
          genderId: "Model gender",
          clothingNotes: "Garment notes",
          sceneTypeId: "Scene type",
          subContextId: "Sub-context",
          framingId: "Framing",
          ratioId: "Output ratio",
          poseId: "Pose",
          clothingImageCount: "Garment image count",
          clothingImageFilenames: "Garment files",
        },
      },
    },
    packshot: {
      position: {
        "debout-droit": "Upright standing",
        "debout-incline": "Tilted standing",
        allonge: "Lying down",
        levitation: "Levitating",
      },
      background: {
        environnement: "Thematic environment",
        neutre: "Neutral background",
      },
      ambiance: {
        "artisanal-cosy": "Artisan-cozy",
        "spa-bien-etre": "Spa-wellness",
        "gourmand-frais": "Gourmet-fresh",
        "tech-minimal": "Tech-minimal",
        autre: "Other",
      },
      interaction: {
        aucun: "None",
        eclaboussure: "Liquid splash",
        "elements-volants": "Flying elements",
        "matiere-englobante": "Enveloping material",
        "fumee-vapeur": "Smoke-steam",
      },
      state: {
        "ferme-neuf": "Sealed-new",
        "ouvert-entame": "Opened-used",
      },
      format: {
        "carre-1-1": "Square post (1:1)",
        "story-9-16": "Story-Reel (9:16)",
        "banniere-4-5": "Ad banner (4:5)",
      },
    },
    framing: {
      serre: {
        label: "Tight framing",
        hint: "Product dominant in the frame.",
      },
      large: {
        label: "Wide framing",
        hint: "Product integrated into the lifestyle scene.",
      },
    },
  },
};

const chatbotEs = {
  chatbot: {
    ui: {
      shotStyleQuestion: "¿Qué estilo de plano?",
      seeMoreStyles: "¿Ver más estilos?",
      yes: "Sí",
      no: "No",
      skip: "Omitir",
      pass: "Omitir",
      send: "Enviar",
      yourMessage: "Tu mensaje",
      pickShotStyle: "Elige un estilo de plano para continuar.",
      destinationFormat: "¿Formato de destino?",
      formatQuestion: "¿Formato de destino?",
      whichDrink: "¿Qué bebida?",
      whichProduct: "Describe tu producto (nombre, material visible, color dominante)",
      whichEnvironment: "¿Qué entorno?",
      packagingQuestion: "¿Lata o botella?",
      elementsQuestion: "¿Cómo quieres definir los elementos visuales alrededor de la bebida?",
      customElementsQuestion:
        "Describe los elementos alrededor de la bebida y los que componen su sabor.",
      promptReady:
        "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
      applyPrompt: "Aplicar al prompt",
      back: "Volver a las plantillas",
      close: "Cerrar",
      styleOfShot: "Estilo de plano",
      seeMoreStylesAria: "Ver más estilos",
      productState: "¿Producto nuevo/cerrado o abierto/usado?",
      typing: "El guía está escribiendo…",
      moreStylesShown: "Aquí hay más estilos:",
      chooseCanOrBottle: 'Elige "Lata" o "Botella", o usa los botones de arriba.',
      chooseElementsMode:
        'Elige una opción: "Elementos de referencia de la marca" o "Elegir yo mismo", o usa los botones de arriba.',
      can: "Lata",
      bottle: "Botella",
      brandReferenceElements: "Elementos de referencia de la marca",
      chooseElementsSelf: "Elegir los elementos yo mismo",
      framingQuestion: "¿Qué encuadre?",
      framingHintDefault: "Cerrado: producto dominante. Amplio: producto integrado en la escena.",
      framingHintDeuxMains:
        "Cerrado: producto dominante. Amplio: plano medio — manos y acción visibles, más decorado.",
      genderQuestion: "¿Qué sexo?",
      describeProduct: "Describe tu producto (nombre, material visible, color dominante)",
      productPosition: "¿Cómo está posicionado el producto?",
      backgroundQuestion: "¿Qué tipo de fondo quieres?",
      ambianceQuestion: "¿Qué ambiente?",
      customAmbianceQuestion: "Especifica tu ambiente personalizado",
      dynamicEffectQuestion: "¿Quieres añadir un efecto dinámico?",
      imageType: "Tipo de imagen",
      guideSub: "Guía sin IA — relleno automático",
      guide: "Guía",
      adjustFields: "Ajustar campos",
      openGuide: "Abrir la guía {label}",
      other: "Otro",
      placeholderPackshotCustomAmbiance: "Ej. bohemio desértico, industrial crudo…",
      placeholderPackshotProduct: "Ej. vela artesanal en vidrio ámbar, cera vegetal…",
      placeholderYourAnswer: "Tu respuesta…",
      placeholderLifestyleProduct: "Ej. HOLY Hydration Strawberry Kiwi…",
      placeholderLifestyleEnvironment: "Ej. gimnasio moderno, pista de tenis…",
      placeholderDescribeProduct: "Describe el producto…",
      placeholderDrink: "Ej. Monster Energy o Monster Energy con limas verdes…",
      placeholderPackagingMode: "O elige una opción arriba…",
      placeholderElementsMode: "O elige una opción arriba…",
      placeholderCustomElements: "Describe los elementos alrededor y el sabor…",
      placeholderDescribeDrink: "Describe la bebida…",
      ariaProductPosition: "Posición del producto",
      ariaBackgroundType: "Tipo de fondo",
      ariaAmbianceEnv: "Ambiente del entorno",
      ariaDynamicEffect: "Efecto dinámico",
      ariaProductState: "Estado del producto",
      ariaDestinationFormat: "Formato de destino",
      ariaLifestyleFraming: "Encuadre lifestyle",
      ariaElementsMode: "Modo de elementos",
      ariaPackagingFormat: "Formato de envase",
    },
    shots: {
      "low-angle": "Vista baja",
      "macro-label": "Primer plano",
      "explosion-wide": "Explosión amplia",
      "freeze-frame": "Freeze-frame",
      "ground-fog": "Niebla en el suelo",
      "diagonal-45": "Diagonal 45°",
      "tight-minimal": "Cerrado minimal",
      "side-left": "Lado izquierdo",
      underwater: "Subacuático",
      "top-down": "Vista cenital",
      "pov-assis": "POV sentado",
      "pov-debout": "POV de pie",
      "produit-levitation": "Producto en levitación",
      "produit-seul": "Producto solo",
      "main-gros-plan": "Mano en primer plano",
      "vue-dessus": "Vista cenital",
      "zoom-produit": "Zoom en el producto",
      "deux-mains": "Producto en mano, en movimiento",
    },
    templates: {
      "product-photography": {
        label: "Foto de producto en estudio",
        summary: "Bebida héroe en estudio — marca, formato lata/botella e ingredientes.",
        botIntro:
          "¿Qué bebida quieres destacar? Indica la marca o el nombre del producto — también puedes precisar los elementos alrededor desde ahora (ej. «Monster Energy con limas verdes»).",
        botAskRequired:
          "¿Qué bebida quieres destacar? (ej. Monster Energy, Coca-Cola, zumo de mango…)",
        botAskElementsMode:
          "¿Cómo quieres definir los elementos visuales alrededor de la bebida?\n\n• Elementos de referencia de la marca — ingredientes típicos asociados a esta bebida\n• Elegir yo mismo — describir los elementos alrededor del producto y los que componen el sabor",
        botAskPackagingMode: "¿En lata o en botella?",
        botAskCustomElements:
          "Describe los elementos a colocar alrededor de la bebida y los que componen su sabor. Ejemplo: «limas verdes enteras y en rodajas, hojas de menta» o «mango, maracuyá, cubitos de hielo».",
        botReady:
          "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
        vars: {
          drink: "Bebida / marca",
          packaging: "Formato de envase",
          flavorElements: "Ingredientes / sabor alrededor",
          brandBackdrop: "Fondo de estudio (marca)",
          brandPalette: "Paleta de colores",
        },
      },
      "lifestyle-product-photography": {
        label: "Producto en lifestyle",
        summary: "Producto sostenido en la mano en un entorno real — marca y ambiente.",
        botIntro: "¿Cuál es el nombre de tu producto?",
        botAskRequired: "¿Cuál es el nombre de tu producto? (ej. HOLY Hydration, Optiva Energy…)",
        botAskEnvironment:
          "¿En qué entorno? (ej. gimnasio, pista de tenis, cocina moderna…)",
        botReady:
          "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
        vars: {
          product: "Producto / marca",
          environment: "Entorno / lugar",
        },
      },
      "ugc-selfie-produit": {
        label: "Selfie producto UGC",
        summary: "Selfie natural: la persona presenta un producto, estilo smartphone.",
        botIntro: "¿Qué sexo?",
        botAskRequired: "¿Cuál es el producto?",
        botReady:
          "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
        vars: {
          productName: "Producto",
          location: "Lugar",
          skinTone: "Tono de piel",
          hair: "Cabello",
          outfit: "Atuendo",
        },
      },
      "ugc-presentation-produit": {
        label: "Presentación producto UGC",
        summary: "Cámara fija: producto sostenido en la mano o llevado en el cuerpo.",
        botIntro: "¿El producto se sostiene en la mano o se lleva en el cuerpo?",
        botAskRequired: "¿Cuál es el producto?",
        botReady:
          "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
        vars: {
          productName: "Producto",
          location: "Lugar",
          physique: "Físico",
          hair: "Cabello",
          autreTenue: "Resto del atuendo",
        },
      },
      "brand-campaign-shoot": {
        label: "Sesión de campaña",
        summary: "Estilo campaña premium — pose, decorado narrativo y encuadre editorial.",
        botIntro: "¿Quién presenta el producto?",
        botAskRequired: "Describe el atuendo o producto a destacar",
        botReady:
          "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
        vars: {
          productOutfit: "Atuendo / producto",
          ambiancePrompt: "Ambiente",
          physique: "Físico",
          environment: "Entorno",
        },
      },
      "packshot-dynamique": {
        label: "Packshot Dinámico",
        summary:
          "Packshot de producto escenificado — postura (colocado o levitación) y efecto dinámico opcional.",
        botIntro: "Describe tu producto (nombre, material visible, color dominante)",
        botAskRequired:
          "Describe tu producto (nombre, material visible, color dominante) — al menos unas palabras.",
        botReady:
          "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
        vars: {
          productDescription: "Producto",
          positionId: "Posición",
          backgroundId: "Fondo",
          ambianceId: "Ambiente",
          customAmbiance: "Ambiente personalizado",
          interactionId: "Efecto dinámico",
          productStateId: "Estado del producto",
          formatId: "Formato",
        },
      },
      "editorial-worn-held": {
        label: "Editorial Llevado y Portado",
        summary:
          "Joya llevada o producto sostenido — renderizado editorial de alta costura, macro a cuerpo entero.",
        botIntro: "¿Qué tipo de escenificación?",
        botAskRequired:
          "Describe la joya o el producto — al menos unas palabras (material, color, forma…).",
        botReady:
          "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
        vars: {
          sceneTypeId: "Tipo de escenificación",
          genderId: "Género del modelo",
          zoneId: "Zona del cuerpo",
          framingId: "Encuadre",
          outfitDescription: "Atuendo (cuerpo entero)",
          backgroundId: "Fondo",
          ambianceId: "Ambiente",
          customAmbiance: "Ambiente personalizado",
          productDescription: "Joya / producto",
          postureId: "Postura",
          customGesture: "Gesto personalizado",
          formatId: "Formato",
        },
      },
      "produit-en-application": {
        label: "Producto en aplicación",
        summary:
          "Textura u objeto en contacto con el cuerpo — gesto de aplicación, zona objetivo y renderizado fotorrealista.",
        botIntro: "¿Qué tipo de producto?",
        botAskRequired:
          "¿Cuál es el nombre del producto? (ej. crema hidratante, sérum vitamina C…) — al menos unas palabras o una imagen @Producto.",
        botReady:
          "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
        vars: {
          productTypeId: "Tipo de producto",
          genderId: "Sexo del modelo",
          bodyZoneId: "Zona del cuerpo",
          containerId: "Envase",
          textureTypeId: "Tipo de textura",
          objectTypeId: "Tipo de objeto",
          postureId: "Postura",
          decorId: "Decorado",
          lightingId: "Iluminación",
          productName: "Nombre del producto",
          physique: "Físico",
        },
      },
      "outfit-studio": {
        label: "Outfit Studio",
        summary:
          "Estiliza una o varias prendas subidas en un maniquí — estudio, lifestyle, interior comercial o mirror selfie.",
        botIntro: "Sexo del modelo",
        botAskRequired:
          "Sube al menos una imagen de prenda o describe la pieza a estilizar (ej. foco en la chaqueta, plano busto…).",
        botReady:
          "Tu prompt está listo. Revísalo abajo y aplícalo al área de entrada, o ajusta los campos si es necesario.",
        vars: {
          genderId: "Sexo del modelo",
          clothingNotes: "Notas sobre prendas",
          sceneTypeId: "Tipo de escena",
          subContextId: "Subcontexto",
          framingId: "Encuadre",
          ratioId: "Ratio de salida",
          poseId: "Pose",
          clothingImageCount: "Número de imágenes de prendas",
          clothingImageFilenames: "Archivos de prendas",
        },
      },
    },
    packshot: {
      position: {
        "debout-droit": "De pie recto",
        "debout-incline": "De pie inclinado",
        allonge: "Tumbado",
        levitation: "En levitación",
      },
      background: {
        environnement: "Entorno temático",
        neutre: "Fondo neutro",
      },
      ambiance: {
        "artisanal-cosy": "Artesanal-acogedor",
        "spa-bien-etre": "Spa-bienestar",
        "gourmand-frais": "Gourmet-fresco",
        "tech-minimal": "Tech-minimal",
        autre: "Otro",
      },
      interaction: {
        aucun: "Ninguno",
        eclaboussure: "Salpicadura líquida",
        "elements-volants": "Elementos voladores",
        "matiere-englobante": "Materia envolvente",
        "fumee-vapeur": "Humo-vapor",
      },
      state: {
        "ferme-neuf": "Cerrado-nuevo",
        "ouvert-entame": "Abierto-usado",
      },
      format: {
        "carre-1-1": "Post cuadrado (1:1)",
        "story-9-16": "Story-Reel (9:16)",
        "banniere-4-5": "Banner publicitario (4:5)",
      },
    },
    framing: {
      serre: {
        label: "Encuadre cerrado",
        hint: "Producto dominante en el encuadre.",
      },
      large: {
        label: "Encuadre amplio",
        hint: "Producto integrado en la escena de vida.",
      },
    },
  },
};

const chatbotDe = {
  chatbot: {
    ui: {
      shotStyleQuestion: "Welcher Shot-Stil?",
      seeMoreStyles: "Weitere Stile anzeigen?",
      yes: "Ja",
      no: "Nein",
      skip: "Überspringen",
      pass: "Überspringen",
      send: "Senden",
      yourMessage: "Deine Nachricht",
      pickShotStyle: "Wähle einen Shot-Stil, um fortzufahren.",
      destinationFormat: "Zielformat?",
      formatQuestion: "Zielformat?",
      whichDrink: "Welches Getränk?",
      whichProduct: "Beschreibe dein Produkt (Name, sichtbares Material, dominante Farbe)",
      whichEnvironment: "Welche Umgebung?",
      packagingQuestion: "Dose oder Flasche?",
      elementsQuestion:
        "Wie möchtest du die visuellen Elemente um das Getränk definieren?",
      customElementsQuestion:
        "Beschreibe die Elemente um das Getränk und diejenigen, die den Geschmack ausmachen.",
      promptReady:
        "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
      applyPrompt: "Auf Prompt anwenden",
      back: "Zurück zu den Vorlagen",
      close: "Schließen",
      styleOfShot: "Shot-Stil",
      seeMoreStylesAria: "Weitere Stile anzeigen",
      productState: "Neues/verschlossenes oder geöffnetes/benutztes Produkt?",
      typing: "Der Guide schreibt…",
      moreStylesShown: "Hier sind weitere Stile:",
      chooseCanOrBottle: 'Wähle „Dose" oder „Flasche", oder nutze die Schaltflächen oben.',
      chooseElementsMode:
        'Wähle eine Option: „Marken-Referenzelemente" oder „Selbst wählen", oder nutze die Schaltflächen oben.',
      can: "Dose",
      bottle: "Flasche",
      brandReferenceElements: "Marken-Referenzelemente",
      chooseElementsSelf: "Elemente selbst wählen",
      framingQuestion: "Welcher Bildausschnitt?",
      framingHintDefault: "Eng: Produkt dominant. Weit: Produkt in die Szene integriert.",
      framingHintDeuxMains:
        "Eng: Produkt dominant. Weit: Halbtotale — Hände und Aktion sichtbar, mehr Dekor.",
      genderQuestion: "Welches Geschlecht?",
      describeProduct: "Beschreibe dein Produkt (Name, sichtbares Material, dominante Farbe)",
      productPosition: "Wie ist das Produkt positioniert?",
      backgroundQuestion: "Welche Art von Hintergrund möchtest du?",
      ambianceQuestion: "Welche Atmosphäre?",
      customAmbianceQuestion: "Gib deine individuelle Atmosphäre an",
      dynamicEffectQuestion: "Möchtest du einen dynamischen Effekt hinzufügen?",
      imageType: "Bildtyp",
      guideSub: "Guide ohne KI — automatisches Ausfüllen",
      guide: "Guide",
      adjustFields: "Felder anpassen",
      openGuide: "Guide {label} öffnen",
      other: "Andere",
      placeholderPackshotCustomAmbiance: "Z. B. Wüsten-Boheme, roh industriell…",
      placeholderPackshotProduct: "Z. B. handgefertigte Kerze in Bernsteinglas, Pflanzenwachs…",
      placeholderYourAnswer: "Deine Antwort…",
      placeholderLifestyleProduct: "Z. B. HOLY Hydration Strawberry Kiwi…",
      placeholderLifestyleEnvironment: "Z. B. modernes Fitnessstudio, Tennisplatz…",
      placeholderDescribeProduct: "Beschreibe das Produkt…",
      placeholderDrink: "Z. B. Monster Energy oder Monster Energy mit grünen Limetten…",
      placeholderPackagingMode: "Oder wähle oben eine Option…",
      placeholderElementsMode: "Oder wähle oben eine Option…",
      placeholderCustomElements: "Beschreibe die umgebenden Elemente und den Geschmack…",
      placeholderDescribeDrink: "Beschreibe das Getränk…",
      ariaProductPosition: "Produktposition",
      ariaBackgroundType: "Hintergrundtyp",
      ariaAmbianceEnv: "Umgebungsatmosphäre",
      ariaDynamicEffect: "Dynamischer Effekt",
      ariaProductState: "Produktzustand",
      ariaDestinationFormat: "Zielformat",
      ariaLifestyleFraming: "Lifestyle-Bildausschnitt",
      ariaElementsMode: "Elementmodus",
      ariaPackagingFormat: "Verpackungsformat",
    },
    shots: {
      "low-angle": "Untersicht",
      "macro-label": "Nahaufnahme",
      "explosion-wide": "Weite Explosion",
      "freeze-frame": "Freeze-frame",
      "ground-fog": "Bodennebel",
      "diagonal-45": "45° diagonal",
      "tight-minimal": "Eng minimal",
      "side-left": "Linke Seite",
      underwater: "Unterwasser",
      "top-down": "Draufsicht",
      "pov-assis": "POV sitzend",
      "pov-debout": "POV stehend",
      "produit-levitation": "Schwebendes Produkt",
      "produit-seul": "Produkt allein",
      "main-gros-plan": "Hand-Nahaufnahme",
      "vue-dessus": "Draufsicht",
      "zoom-produit": "Produkt-Zoom",
      "deux-mains": "Produkt in der Hand, in Bewegung",
    },
    templates: {
      "product-photography": {
        label: "Studio-Produktfoto",
        summary: "Studio-Hero-Getränk — Marke, Dosen-/Flaschenformat und Zutaten.",
        botIntro:
          "Welches Getränk möchtest du in den Mittelpunkt stellen? Gib die Marke oder den Produktnamen an — du kannst auch gleich die umgebenden Elemente angeben (z. B. \"Monster Energy mit grünen Limetten\").",
        botAskRequired:
          "Welches Getränk möchtest du in den Mittelpunkt stellen? (z. B. Monster Energy, Coca-Cola, Mangosaft…)",
        botAskElementsMode:
          "Wie möchtest du die visuellen Elemente um das Getränk definieren?\n\n• Marken-Referenzelemente — typische Zutaten, die mit diesem Getränk verbunden sind\n• Selbst wählen — Elemente um das Produkt und diejenigen beschreiben, die den Geschmack ausmachen",
        botAskPackagingMode: "In Dose oder Flasche?",
        botAskCustomElements:
          "Beschreibe die Elemente um das Getränk und diejenigen, die seinen Geschmack ausmachen. Beispiel: \"ganze und geschnittene grüne Limetten, Minzblätter\" oder \"Mango, Maracuja, Eiswürfel\".",
        botReady:
          "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
        vars: {
          drink: "Getränk / Marke",
          packaging: "Verpackungsformat",
          flavorElements: "Zutaten / Geschmack drumherum",
          brandBackdrop: "Studio-Hintergrund (Marke)",
          brandPalette: "Farbpalette",
        },
      },
      "lifestyle-product-photography": {
        label: "Lifestyle-Produkt",
        summary: "Produkt in der Hand in echter Umgebung — Marke und Setting.",
        botIntro: "Wie heißt dein Produkt?",
        botAskRequired: "Wie heißt dein Produkt? (z. B. HOLY Hydration, Optiva Energy…)",
        botAskEnvironment:
          "In welcher Umgebung? (z. B. Fitnessstudio, Tennisplatz, moderne Küche…)",
        botReady:
          "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
        vars: {
          product: "Produkt / Marke",
          environment: "Umgebung / Ort",
        },
      },
      "ugc-selfie-produit": {
        label: "UGC-Produkt-Selfie",
        summary: "Natürliches Selfie: Person präsentiert ein Produkt, Smartphone-Stil.",
        botIntro: "Welches Geschlecht?",
        botAskRequired: "Was ist das Produkt?",
        botReady:
          "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
        vars: {
          productName: "Produkt",
          location: "Ort",
          skinTone: "Hautton",
          hair: "Haare",
          outfit: "Outfit",
        },
      },
      "ugc-presentation-produit": {
        label: "UGC-Produktpräsentation",
        summary: "Feste Kamera: Produkt in der Hand oder am Körper getragen.",
        botIntro: "Wird das Produkt in der Hand gehalten oder am Körper getragen?",
        botAskRequired: "Was ist das Produkt?",
        botReady:
          "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
        vars: {
          productName: "Produkt",
          location: "Ort",
          physique: "Körperbau",
          hair: "Haare",
          autreTenue: "Rest des Outfits",
        },
      },
      "brand-campaign-shoot": {
        label: "Kampagnen-Shooting",
        summary: "Premium-Kampagnenstil — Pose, erzählerisches Setting und redaktioneller Bildausschnitt.",
        botIntro: "Wer präsentiert das Produkt?",
        botAskRequired: "Beschreibe das Outfit oder Produkt, das hervorgehoben werden soll",
        botReady:
          "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
        vars: {
          productOutfit: "Outfit / Produkt",
          ambiancePrompt: "Atmosphäre",
          physique: "Körperbau",
          environment: "Umgebung",
        },
      },
      "packshot-dynamique": {
        label: "Dynamischer Packshot",
        summary:
          "Inszenierter Produkt-Packshot — Haltung (platziert oder Levitation) und optionaler dynamischer Effekt.",
        botIntro: "Beschreibe dein Produkt (Name, sichtbares Material, dominante Farbe)",
        botAskRequired:
          "Beschreibe dein Produkt (Name, sichtbares Material, dominante Farbe) — mindestens ein paar Worte.",
        botReady:
          "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
        vars: {
          productDescription: "Produkt",
          positionId: "Position",
          backgroundId: "Hintergrund",
          ambianceId: "Atmosphäre",
          customAmbiance: "Individuelle Atmosphäre",
          interactionId: "Dynamischer Effekt",
          productStateId: "Produktzustand",
          formatId: "Format",
        },
      },
      "editorial-worn-held": {
        label: "Editorial Getragen & Gehalten",
        summary:
          "Getragener Schmuck oder gehaltenes Produkt — High-Fashion-Editorial, Makro bis Ganzkörper.",
        botIntro: "Welche Art der Inszenierung?",
        botAskRequired:
          "Beschreibe den Schmuck oder das Produkt — mindestens ein paar Worte (Material, Farbe, Form…).",
        botReady:
          "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
        vars: {
          sceneTypeId: "Inszenierungstyp",
          genderId: "Modell-Geschlecht",
          zoneId: "Körperzone",
          framingId: "Bildausschnitt",
          outfitDescription: "Outfit (Ganzkörper)",
          backgroundId: "Hintergrund",
          ambianceId: "Atmosphäre",
          customAmbiance: "Individuelle Atmosphäre",
          productDescription: "Schmuck / Produkt",
          postureId: "Haltung",
          customGesture: "Individuelle Geste",
          formatId: "Format",
        },
      },
      "produit-en-application": {
        label: "Produkt in Anwendung",
        summary:
          "Textur oder Objekt in Kontakt mit dem Körper — Auftrag-Geste, Zielzone und fotorealistisches Rendering.",
        botIntro: "Welche Produktart?",
        botAskRequired:
          "Wie heißt das Produkt? (z. B. Feuchtigkeitscreme, Vitamin-C-Serum…) — mindestens ein paar Worte oder ein @Produkt-Bild.",
        botReady:
          "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
        vars: {
          productTypeId: "Produkttyp",
          genderId: "Modell-Geschlecht",
          bodyZoneId: "Körperzone",
          containerId: "Behälter",
          textureTypeId: "Texturtyp",
          objectTypeId: "Objekttyp",
          postureId: "Haltung",
          decorId: "Dekor",
          lightingId: "Beleuchtung",
          productName: "Produktname",
          physique: "Körperbau",
        },
      },
      "outfit-studio": {
        label: "Outfit Studio",
        summary:
          "Style ein oder mehrere hochgeladene Kleidungsstücke auf einem Model — Studio, Lifestyle, kommerzielles Interieur oder Mirror Selfie.",
        botIntro: "Geschlecht des Modells",
        botAskRequired:
          "Lade mindestens ein Kleidungsbild hoch oder beschreibe das zu stylende Stück (z. B. Fokus auf die Jacke, Brustbild…).",
        botReady:
          "Dein Prompt ist fertig. Überprüfe ihn unten und wende ihn auf das Eingabefeld an, oder passe die Felder bei Bedarf an.",
        vars: {
          genderId: "Geschlecht des Modells",
          clothingNotes: "Kleidungshinweise",
          sceneTypeId: "Szenentyp",
          subContextId: "Unterkontext",
          framingId: "Bildausschnitt",
          ratioId: "Ausgabeformat",
          poseId: "Pose",
          clothingImageCount: "Anzahl Kleidungsbilder",
          clothingImageFilenames: "Kleidungsdateien",
        },
      },
    },
    packshot: {
      position: {
        "debout-droit": "Aufrecht stehend",
        "debout-incline": "Geneigt stehend",
        allonge: "Liegend",
        levitation: "Schwebend",
      },
      background: {
        environnement: "Thematische Umgebung",
        neutre: "Neutraler Hintergrund",
      },
      ambiance: {
        "artisanal-cosy": "Artisanal-gemütlich",
        "spa-bien-etre": "Spa-Wellness",
        "gourmand-frais": "Gourmet-frisch",
        "tech-minimal": "Tech-minimal",
        autre: "Andere",
      },
      interaction: {
        aucun: "Keiner",
        eclaboussure: "Flüssigkeitsspritzer",
        "elements-volants": "Fliegende Elemente",
        "matiere-englobante": "Umhüllendes Material",
        "fumee-vapeur": "Rauch-Dampf",
      },
      state: {
        "ferme-neuf": "Verschlossen-neu",
        "ouvert-entame": "Geöffnet-benutzt",
      },
      format: {
        "carre-1-1": "Quadratischer Post (1:1)",
        "story-9-16": "Story-Reel (9:16)",
        "banniere-4-5": "Werbebanner (4:5)",
      },
    },
    framing: {
      serre: {
        label: "Enger Bildausschnitt",
        hint: "Produkt dominant im Bild.",
      },
      large: {
        label: "Weiter Bildausschnitt",
        hint: "Produkt in die Lifestyle-Szene integriert.",
      },
    },
  },
};

const chatbotPt = {
  chatbot: {
    ui: {
      shotStyleQuestion: "Qual estilo de plano?",
      seeMoreStyles: "Ver mais estilos?",
      yes: "Sim",
      no: "Não",
      skip: "Pular",
      pass: "Pular",
      send: "Enviar",
      yourMessage: "Sua mensagem",
      pickShotStyle: "Escolha um estilo de plano para continuar.",
      destinationFormat: "Formato de destino?",
      formatQuestion: "Formato de destino?",
      whichDrink: "Qual bebida?",
      whichProduct: "Descreva seu produto (nome, material visível, cor dominante)",
      whichEnvironment: "Qual ambiente?",
      packagingQuestion: "Lata ou garrafa?",
      elementsQuestion: "Como você quer definir os elementos visuais ao redor da bebida?",
      customElementsQuestion:
        "Descreva os elementos ao redor da bebida e os que compõem seu sabor.",
      promptReady:
        "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
      applyPrompt: "Aplicar ao prompt",
      back: "Voltar aos modelos",
      close: "Fechar",
      styleOfShot: "Estilo de plano",
      seeMoreStylesAria: "Ver mais estilos",
      productState: "Produto novo/fechado ou aberto/usado?",
      typing: "O guia está digitando…",
      moreStylesShown: "Aqui estão mais estilos:",
      chooseCanOrBottle: 'Escolha "Lata" ou "Garrafa", ou use os botões acima.',
      chooseElementsMode:
        'Escolha uma opção: "Elementos de referência da marca" ou "Escolher eu mesmo", ou use os botões acima.',
      can: "Lata",
      bottle: "Garrafa",
      brandReferenceElements: "Elementos de referência da marca",
      chooseElementsSelf: "Escolher os elementos eu mesmo",
      framingQuestion: "Qual enquadramento?",
      framingHintDefault: "Fechado: produto dominante. Amplo: produto integrado na cena.",
      framingHintDeuxMains:
        "Fechado: produto dominante. Amplo: plano médio — mãos e ação visíveis, mais cenário.",
      genderQuestion: "Qual sexo?",
      describeProduct: "Descreva seu produto (nome, material visível, cor dominante)",
      productPosition: "Como o produto está posicionado?",
      backgroundQuestion: "Que tipo de fundo você quer?",
      ambianceQuestion: "Qual ambiente?",
      customAmbianceQuestion: "Especifique seu ambiente personalizado",
      dynamicEffectQuestion: "Quer adicionar um efeito dinâmico?",
      imageType: "Tipo de imagem",
      guideSub: "Guia sem IA — preenchimento automático",
      guide: "Guia",
      adjustFields: "Ajustar campos",
      openGuide: "Abrir o guia {label}",
      other: "Outro",
      placeholderPackshotCustomAmbiance: "Ex. boêmio desértico, industrial bruto…",
      placeholderPackshotProduct: "Ex. vela artesanal em vidro âmbar, cera vegetal…",
      placeholderYourAnswer: "Sua resposta…",
      placeholderLifestyleProduct: "Ex. HOLY Hydration Strawberry Kiwi…",
      placeholderLifestyleEnvironment: "Ex. academia moderna, quadra de tênis…",
      placeholderDescribeProduct: "Descreva o produto…",
      placeholderDrink: "Ex. Monster Energy ou Monster Energy com limões verdes…",
      placeholderPackagingMode: "Ou escolha uma opção acima…",
      placeholderElementsMode: "Ou escolha uma opção acima…",
      placeholderCustomElements: "Descreva os elementos ao redor e o sabor…",
      placeholderDescribeDrink: "Descreva a bebida…",
      ariaProductPosition: "Posição do produto",
      ariaBackgroundType: "Tipo de fundo",
      ariaAmbianceEnv: "Ambiente do cenário",
      ariaDynamicEffect: "Efeito dinâmico",
      ariaProductState: "Estado do produto",
      ariaDestinationFormat: "Formato de destino",
      ariaLifestyleFraming: "Enquadramento lifestyle",
      ariaElementsMode: "Modo de elementos",
      ariaPackagingFormat: "Formato de embalagem",
    },
    shots: {
      "low-angle": "Vista baixa",
      "macro-label": "Close-up",
      "explosion-wide": "Explosão ampla",
      "freeze-frame": "Freeze-frame",
      "ground-fog": "Névoa no chão",
      "diagonal-45": "Diagonal 45°",
      "tight-minimal": "Fechado minimal",
      "side-left": "Lado esquerdo",
      underwater: "Subaquático",
      "top-down": "Vista de cima",
      "pov-assis": "POV sentado",
      "pov-debout": "POV em pé",
      "produit-levitation": "Produto em levitação",
      "produit-seul": "Produto sozinho",
      "main-gros-plan": "Mão em close-up",
      "vue-dessus": "Vista de cima",
      "zoom-produit": "Zoom no produto",
      "deux-mains": "Produto na mão, em movimento",
    },
    templates: {
      "product-photography": {
        label: "Foto de produto em estúdio",
        summary: "Bebida herói em estúdio — marca, formato lata/garrafa e ingredientes.",
        botIntro:
          "Qual bebida você quer destacar? Informe a marca ou o nome do produto — você também pode especificar os elementos ao redor agora (ex. «Monster Energy com limões verdes»).",
        botAskRequired:
          "Qual bebida você quer destacar? (ex. Monster Energy, Coca-Cola, suco de manga…)",
        botAskElementsMode:
          "Como você quer definir os elementos visuais ao redor da bebida?\n\n• Elementos de referência da marca — ingredientes típicos associados a esta bebida\n• Escolher eu mesmo — descrever os elementos ao redor do produto e os que compõem o sabor",
        botAskPackagingMode: "Em lata ou garrafa?",
        botAskCustomElements:
          "Descreva os elementos a colocar ao redor da bebida e os que compõem seu sabor. Exemplo: «limões verdes inteiros e fatiados, folhas de hortelã» ou «manga, maracujá, cubos de gelo».",
        botReady:
          "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
        vars: {
          drink: "Bebida / marca",
          packaging: "Formato de embalagem",
          flavorElements: "Ingredientes / sabor ao redor",
          brandBackdrop: "Fundo de estúdio (marca)",
          brandPalette: "Paleta de cores",
        },
      },
      "lifestyle-product-photography": {
        label: "Produto em lifestyle",
        summary: "Produto segurado na mão em cenário real — marca e ambiente.",
        botIntro: "Qual é o nome do seu produto?",
        botAskRequired: "Qual é o nome do seu produto? (ex. HOLY Hydration, Optiva Energy…)",
        botAskEnvironment:
          "Em qual ambiente? (ex. academia, quadra de tênis, cozinha moderna…)",
        botReady:
          "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
        vars: {
          product: "Produto / marca",
          environment: "Ambiente / local",
        },
      },
      "ugc-selfie-produit": {
        label: "Selfie produto UGC",
        summary: "Selfie natural: pessoa apresenta um produto, estilo smartphone.",
        botIntro: "Qual sexo?",
        botAskRequired: "Qual é o produto?",
        botReady:
          "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
        vars: {
          productName: "Produto",
          location: "Local",
          skinTone: "Tom de pele",
          hair: "Cabelo",
          outfit: "Roupa",
        },
      },
      "ugc-presentation-produit": {
        label: "Apresentação produto UGC",
        summary: "Câmera fixa: produto segurado na mão ou usado no corpo.",
        botIntro: "O produto é segurado na mão ou usado no corpo?",
        botAskRequired: "Qual é o produto?",
        botReady:
          "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
        vars: {
          productName: "Produto",
          location: "Local",
          physique: "Físico",
          hair: "Cabelo",
          autreTenue: "Resto da roupa",
        },
      },
      "brand-campaign-shoot": {
        label: "Shooting de campanha",
        summary: "Estilo campanha premium — pose, cenário narrativo e enquadramento editorial.",
        botIntro: "Quem apresenta o produto?",
        botAskRequired: "Descreva a roupa ou produto a destacar",
        botReady:
          "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
        vars: {
          productOutfit: "Roupa / produto",
          ambiancePrompt: "Ambiente",
          physique: "Físico",
          environment: "Cenário",
        },
      },
      "packshot-dynamique": {
        label: "Packshot Dinâmico",
        summary:
          "Packshot de produto em cena — postura (apoiado ou levitação) e efeito dinâmico opcional.",
        botIntro: "Descreva seu produto (nome, material visível, cor dominante)",
        botAskRequired:
          "Descreva seu produto (nome, material visível, cor dominante) — pelo menos algumas palavras.",
        botReady:
          "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
        vars: {
          productDescription: "Produto",
          positionId: "Posição",
          backgroundId: "Fundo",
          ambianceId: "Ambiente",
          customAmbiance: "Ambiente personalizado",
          interactionId: "Efeito dinâmico",
          productStateId: "Estado do produto",
          formatId: "Formato",
        },
      },
      "editorial-worn-held": {
        label: "Editorial Usado e Segurado",
        summary:
          "Joia usada ou produto segurado — renderização editorial alta costura, macro a corpo inteiro.",
        botIntro: "Qual tipo de encenação?",
        botAskRequired:
          "Descreva a joia ou o produto — pelo menos algumas palavras (material, cor, forma…).",
        botReady:
          "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
        vars: {
          sceneTypeId: "Tipo de encenação",
          genderId: "Gênero do modelo",
          zoneId: "Zona do corpo",
          framingId: "Enquadramento",
          outfitDescription: "Roupa (corpo inteiro)",
          backgroundId: "Fundo",
          ambianceId: "Ambiente",
          customAmbiance: "Ambiente personalizado",
          productDescription: "Joia / produto",
          postureId: "Postura",
          customGesture: "Gesto personalizado",
          formatId: "Formato",
        },
      },
      "produit-en-application": {
        label: "Produto em aplicação",
        summary:
          "Textura ou objeto em contato com o corpo — gesto de aplicação, zona alvo e renderização fotorrealista.",
        botIntro: "Qual tipo de produto?",
        botAskRequired:
          "Qual é o nome do produto? (ex. hidratante, sérum vitamina C…) — pelo menos algumas palavras ou uma imagem @Produto.",
        botReady:
          "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
        vars: {
          productTypeId: "Tipo de produto",
          genderId: "Sexo do modelo",
          bodyZoneId: "Zona do corpo",
          containerId: "Recipiente",
          textureTypeId: "Tipo de textura",
          objectTypeId: "Tipo de objeto",
          postureId: "Postura",
          decorId: "Cenário",
          lightingId: "Iluminação",
          productName: "Nome do produto",
          physique: "Físico",
        },
      },
      "outfit-studio": {
        label: "Outfit Studio",
        summary:
          "Estilize uma ou mais peças enviadas em um manequim — estúdio, lifestyle, interior comercial ou mirror selfie.",
        botIntro: "Sexo do modelo",
        botAskRequired:
          "Envie pelo menos uma imagem de roupa ou descreva a peça a estilizar (ex. foco na jaqueta, plano busto…).",
        botReady:
          "Seu prompt está pronto. Revise abaixo e aplique na área de entrada, ou ajuste os campos se necessário.",
        vars: {
          genderId: "Sexo do modelo",
          clothingNotes: "Notas sobre roupas",
          sceneTypeId: "Tipo de cena",
          subContextId: "Subcontexto",
          framingId: "Enquadramento",
          ratioId: "Proporção de saída",
          poseId: "Pose",
          clothingImageCount: "Número de imagens de roupas",
          clothingImageFilenames: "Arquivos de roupas",
        },
      },
    },
    packshot: {
      position: {
        "debout-droit": "Em pé reto",
        "debout-incline": "Em pé inclinado",
        allonge: "Deitado",
        levitation: "Em levitação",
      },
      background: {
        environnement: "Ambiente temático",
        neutre: "Fundo neutro",
      },
      ambiance: {
        "artisanal-cosy": "Artesanal-acolhedor",
        "spa-bien-etre": "Spa-bem-estar",
        "gourmand-frais": "Gourmet-fresco",
        "tech-minimal": "Tech-minimal",
        autre: "Outro",
      },
      interaction: {
        aucun: "Nenhum",
        eclaboussure: "Respingo líquido",
        "elements-volants": "Elementos voadores",
        "matiere-englobante": "Matéria envolvente",
        "fumee-vapeur": "Fumaça-vapor",
      },
      state: {
        "ferme-neuf": "Fechado-novo",
        "ouvert-entame": "Aberto-usado",
      },
      format: {
        "carre-1-1": "Post quadrado (1:1)",
        "story-9-16": "Story-Reel (9:16)",
        "banniere-4-5": "Banner publicitário (4:5)",
      },
    },
    framing: {
      serre: {
        label: "Enquadramento fechado",
        hint: "Produto dominante no quadro.",
      },
      large: {
        label: "Enquadramento amplo",
        hint: "Produto integrado na cena de vida.",
      },
    },
  },
};

const chatbotIt = {
  chatbot: {
    ui: {
      shotStyleQuestion: "Che stile di inquadratura?",
      seeMoreStyles: "Vedere altri stili?",
      yes: "Sì",
      no: "No",
      skip: "Salta",
      pass: "Salta",
      send: "Invia",
      yourMessage: "Il tuo messaggio",
      pickShotStyle: "Scegli uno stile di inquadratura per continuare.",
      destinationFormat: "Formato di destinazione?",
      formatQuestion: "Formato di destinazione?",
      whichDrink: "Quale bevanda?",
      whichProduct: "Descrivi il tuo prodotto (nome, materiale visibile, colore dominante)",
      whichEnvironment: "Quale ambiente?",
      packagingQuestion: "Lattina o bottiglia?",
      elementsQuestion: "Come vuoi definire gli elementi visivi attorno alla bevanda?",
      customElementsQuestion:
        "Descrivi gli elementi attorno alla bevanda e quelli che compongono il suo sapore.",
      promptReady:
        "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
      applyPrompt: "Applica al prompt",
      back: "Torna ai modelli",
      close: "Chiudi",
      styleOfShot: "Stile di inquadratura",
      seeMoreStylesAria: "Vedi altri stili",
      productState: "Prodotto nuovo/chiuso o aperto/usato?",
      typing: "La guida sta scrivendo…",
      moreStylesShown: "Ecco altri stili:",
      chooseCanOrBottle: 'Scegli "Lattina" o "Bottiglia", o usa i pulsanti sopra.',
      chooseElementsMode:
        'Scegli un\'opzione: "Elementi di riferimento del brand" o "Scegliere io stesso", o usa i pulsanti sopra.',
      can: "Lattina",
      bottle: "Bottiglia",
      brandReferenceElements: "Elementi di riferimento del brand",
      chooseElementsSelf: "Scegliere gli elementi io stesso",
      framingQuestion: "Quale inquadratura?",
      framingHintDefault: "Stretto: prodotto dominante. Ampio: prodotto integrato nella scena.",
      framingHintDeuxMains:
        "Stretto: prodotto dominante. Ampio: piano medio — mani e azione visibili, più scenografia.",
      genderQuestion: "Quale sesso?",
      describeProduct: "Descrivi il tuo prodotto (nome, materiale visibile, colore dominante)",
      productPosition: "Come è posizionato il prodotto?",
      backgroundQuestion: "Che tipo di sfondo vuoi?",
      ambianceQuestion: "Quale atmosfera?",
      customAmbianceQuestion: "Specifica la tua atmosfera personalizzata",
      dynamicEffectQuestion: "Vuoi aggiungere un effetto dinamico?",
      imageType: "Tipo di immagine",
      guideSub: "Guida senza IA — compilazione automatica",
      guide: "Guida",
      adjustFields: "Modifica campi",
      openGuide: "Apri la guida {label}",
      other: "Altro",
      placeholderPackshotCustomAmbiance: "Es. bohemien desertico, industriale grezzo…",
      placeholderPackshotProduct: "Es. candela artigianale in vetro ambrato, cera vegetale…",
      placeholderYourAnswer: "La tua risposta…",
      placeholderLifestyleProduct: "Es. HOLY Hydration Strawberry Kiwi…",
      placeholderLifestyleEnvironment: "Es. palestra moderna, campo da tennis…",
      placeholderDescribeProduct: "Descrivi il prodotto…",
      placeholderDrink: "Es. Monster Energy o Monster Energy con lime verdi…",
      placeholderPackagingMode: "O scegli un'opzione sopra…",
      placeholderElementsMode: "O scegli un'opzione sopra…",
      placeholderCustomElements: "Descrivi gli elementi attorno e il sapore…",
      placeholderDescribeDrink: "Descrivi la bevanda…",
      ariaProductPosition: "Posizione del prodotto",
      ariaBackgroundType: "Tipo di sfondo",
      ariaAmbianceEnv: "Atmosfera dell'ambiente",
      ariaDynamicEffect: "Effetto dinamico",
      ariaProductState: "Stato del prodotto",
      ariaDestinationFormat: "Formato di destinazione",
      ariaLifestyleFraming: "Inquadratura lifestyle",
      ariaElementsMode: "Modalità elementi",
      ariaPackagingFormat: "Formato confezione",
    },
    shots: {
      "low-angle": "Vista dal basso",
      "macro-label": "Primo piano",
      "explosion-wide": "Esplosione ampia",
      "freeze-frame": "Freeze-frame",
      "ground-fog": "Nebbia a terra",
      "diagonal-45": "Diagonale 45°",
      "tight-minimal": "Stretto minimal",
      "side-left": "Lato sinistro",
      underwater: "Subacqueo",
      "top-down": "Vista dall'alto",
      "pov-assis": "POV seduto",
      "pov-debout": "POV in piedi",
      "produit-levitation": "Prodotto in levitazione",
      "produit-seul": "Prodotto da solo",
      "main-gros-plan": "Mano in primo piano",
      "vue-dessus": "Vista dall'alto",
      "zoom-produit": "Zoom sul prodotto",
      "deux-mains": "Prodotto in mano, in movimento",
    },
    templates: {
      "product-photography": {
        label: "Foto prodotto in studio",
        summary: "Bevanda hero in studio — marca, formato lattina/bottiglia e ingredienti.",
        botIntro:
          "Quale bevanda vuoi mettere in evidenza? Indica il marchio o il nome del prodotto — puoi anche specificare gli elementi attorno subito (es. «Monster Energy con lime verdi»).",
        botAskRequired:
          "Quale bevanda vuoi mettere in evidenza? (es. Monster Energy, Coca-Cola, succo di mango…)",
        botAskElementsMode:
          "Come vuoi definire gli elementi visivi attorno alla bevanda?\n\n• Elementi di riferimento del brand — ingredienti tipici associati a questa bevanda\n• Scegliere io stesso — descrivere gli elementi attorno al prodotto e quelli che compongono il sapore",
        botAskPackagingMode: "In lattina o in bottiglia?",
        botAskCustomElements:
          "Descrivi gli elementi da posizionare attorno alla bevanda e quelli che compongono il suo sapore. Esempio: «lime verdi interi e a fette, foglie di menta» o «mango, frutto della passione, cubetti di ghiaccio».",
        botReady:
          "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
        vars: {
          drink: "Bevanda / marca",
          packaging: "Formato confezione",
          flavorElements: "Ingredienti / sapore attorno",
          brandBackdrop: "Sfondo studio (marca)",
          brandPalette: "Palette colori",
        },
      },
      "lifestyle-product-photography": {
        label: "Prodotto in lifestyle",
        summary: "Prodotto tenuto in mano in un ambiente reale — marca e contesto.",
        botIntro: "Qual è il nome del tuo prodotto?",
        botAskRequired: "Qual è il nome del tuo prodotto? (es. HOLY Hydration, Optiva Energy…)",
        botAskEnvironment:
          "In quale ambiente? (es. palestra, campo da tennis, cucina moderna…)",
        botReady:
          "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
        vars: {
          product: "Prodotto / marca",
          environment: "Ambiente / luogo",
        },
      },
      "ugc-selfie-produit": {
        label: "Selfie prodotto UGC",
        summary: "Selfie naturale: la persona presenta un prodotto, stile smartphone.",
        botIntro: "Quale sesso?",
        botAskRequired: "Qual è il prodotto?",
        botReady:
          "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
        vars: {
          productName: "Prodotto",
          location: "Luogo",
          skinTone: "Tono della pelle",
          hair: "Capelli",
          outfit: "Outfit",
        },
      },
      "ugc-presentation-produit": {
        label: "Presentazione prodotto UGC",
        summary: "Camera fissa: prodotto tenuto in mano o indossato sul corpo.",
        botIntro: "Il prodotto è tenuto in mano o indossato sul corpo?",
        botAskRequired: "Qual è il prodotto?",
        botReady:
          "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
        vars: {
          productName: "Prodotto",
          location: "Luogo",
          physique: "Fisico",
          hair: "Capelli",
          autreTenue: "Resto dell'outfit",
        },
      },
      "brand-campaign-shoot": {
        label: "Shooting campagna",
        summary: "Stile campagna premium — posa, scenografia narrativa e inquadratura editoriale.",
        botIntro: "Chi presenta il prodotto?",
        botAskRequired: "Descrivi l'outfit o il prodotto da mettere in evidenza",
        botReady:
          "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
        vars: {
          productOutfit: "Outfit / prodotto",
          ambiancePrompt: "Atmosfera",
          physique: "Fisico",
          environment: "Ambiente",
        },
      },
      "packshot-dynamique": {
        label: "Packshot Dinamico",
        summary:
          "Packshot prodotto in scena — postura (appoggiato o levitazione) ed effetto dinamico opzionale.",
        botIntro: "Descrivi il tuo prodotto (nome, materiale visibile, colore dominante)",
        botAskRequired:
          "Descrivi il tuo prodotto (nome, materiale visibile, colore dominante) — almeno qualche parola.",
        botReady:
          "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
        vars: {
          productDescription: "Prodotto",
          positionId: "Posizione",
          backgroundId: "Sfondo",
          ambianceId: "Atmosfera",
          customAmbiance: "Atmosfera personalizzata",
          interactionId: "Effetto dinamico",
          productStateId: "Stato del prodotto",
          formatId: "Formato",
        },
      },
      "editorial-worn-held": {
        label: "Editorial Indossato e Tenuto",
        summary:
          "Gioiello indossato o prodotto tenuto — resa editoriale alta moda, macro a figura intera.",
        botIntro: "Che tipo di messa in scena?",
        botAskRequired:
          "Descrivi il gioiello o il prodotto — almeno qualche parola (materiale, colore, forma…).",
        botReady:
          "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
        vars: {
          sceneTypeId: "Tipo di messa in scena",
          genderId: "Genere del modello",
          zoneId: "Zona del corpo",
          framingId: "Inquadratura",
          outfitDescription: "Outfit (figura intera)",
          backgroundId: "Sfondo",
          ambianceId: "Atmosfera",
          customAmbiance: "Atmosfera personalizzata",
          productDescription: "Gioiello / prodotto",
          postureId: "Postura",
          customGesture: "Gesto personalizzato",
          formatId: "Formato",
        },
      },
      "produit-en-application": {
        label: "Prodotto in applicazione",
        summary:
          "Texture o oggetto a contatto con il corpo — gesto di applicazione, zona mirata e resa fotorealistica.",
        botIntro: "Che tipo di prodotto?",
        botAskRequired:
          "Qual è il nome del prodotto? (es. crema idratante, siero vitamina C…) — almeno qualche parola o un'immagine @Prodotto.",
        botReady:
          "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
        vars: {
          productTypeId: "Tipo di prodotto",
          genderId: "Sesso del modello",
          bodyZoneId: "Zona del corpo",
          containerId: "Contenitore",
          textureTypeId: "Tipo di texture",
          objectTypeId: "Tipo di oggetto",
          postureId: "Postura",
          decorId: "Scenario",
          lightingId: "Illuminazione",
          productName: "Nome del prodotto",
          physique: "Fisico",
        },
      },
      "outfit-studio": {
        label: "Outfit Studio",
        summary:
          "Stylizza uno o più capi caricati su un manichino — studio, lifestyle, interno commerciale o mirror selfie.",
        botIntro: "Sesso del modello",
        botAskRequired:
          "Carica almeno un'immagine di abbigliamento o descrivi il capo da stylizzare (es. focus sulla giacca, piano busto…).",
        botReady:
          "Il tuo prompt è pronto. Controllalo qui sotto e applicalo all'area di input, o modifica i campi se necessario.",
        vars: {
          genderId: "Sesso del modello",
          clothingNotes: "Note sugli abiti",
          sceneTypeId: "Tipo di scena",
          subContextId: "Sotto-contesto",
          framingId: "Inquadratura",
          ratioId: "Rapporto di output",
          poseId: "Posa",
          clothingImageCount: "Numero di immagini abbigliamento",
          clothingImageFilenames: "File abbigliamento",
        },
      },
    },
    packshot: {
      position: {
        "debout-droit": "In piedi dritto",
        "debout-incline": "In piedi inclinato",
        allonge: "Sdraiato",
        levitation: "In levitazione",
      },
      background: {
        environnement: "Ambiente tematico",
        neutre: "Sfondo neutro",
      },
      ambiance: {
        "artisanal-cosy": "Artigianale-accogliente",
        "spa-bien-etre": "Spa-benessere",
        "gourmand-frais": "Gourmet-fresco",
        "tech-minimal": "Tech-minimal",
        autre: "Altro",
      },
      interaction: {
        aucun: "Nessuno",
        eclaboussure: "Schizzo liquido",
        "elements-volants": "Elementi volanti",
        "matiere-englobante": "Materia avvolgente",
        "fumee-vapeur": "Fumo-vapore",
      },
      state: {
        "ferme-neuf": "Chiuso-nuovo",
        "ouvert-entame": "Aperto-usato",
      },
      format: {
        "carre-1-1": "Post quadrato (1:1)",
        "story-9-16": "Story-Reel (9:16)",
        "banniere-4-5": "Banner pubblicitario (4:5)",
      },
    },
    framing: {
      serre: {
        label: "Inquadratura stretta",
        hint: "Prodotto dominante nell'inquadratura.",
      },
      large: {
        label: "Inquadratura ampia",
        hint: "Prodotto integrato nella scena di vita.",
      },
    },
  },
};

/** FR uses French source strings as fallback — no `fr` entries needed. */
export const chatbotBundle = {
  en: mergeGuideExtras(chatbotEn, chatbotGuideExtrasEn),
  es: mergeGuideExtras(chatbotEs, chatbotGuideExtrasEs),
  de: mergeGuideExtras(chatbotDe, chatbotGuideExtrasDe),
  pt: mergeGuideExtras(chatbotPt, chatbotGuideExtrasPt),
  it: mergeGuideExtras(chatbotIt, chatbotGuideExtrasIt),
} as unknown as LocaleBundle;
