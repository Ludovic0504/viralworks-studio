import type { VwsMetierProfile } from "./types";

/** Technique & installation — 14 métiers */
export const TECHNIC_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Plombier",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "intervention en salle de bain, cuisine ou local technique, fuite localisée, raccords, vannes, outillage plomberie",
    stylePlaceholder:
      "Ex. : fuite sous évier, remplacement robinet, débouchage, rénovation réseau eau chaude, chauffe-eau…",
    inspireContext:
      "constat du défaut, action de réparation, remise en eau et vérification d’étanchéité",
  },
  {
    label: "Électricien",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "tableau électrique, prises, éclairages, câblage apparent en chantier, EPI et gestes de sécurité visibles",
    stylePlaceholder:
      "Ex. : mise aux normes NFC 15-100, ajout de prises, éclairage LED, domotique maison, disjoncteur…",
    inspireContext:
      "diagnostic panne ou besoin, intervention claire au tableau, test final avec éclairage fonctionnel",
  },
  {
    label: "Chauffagiste",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "chaudière gaz ou fioul, circulateur, vase expansion, radiateurs, détartrage ou remplacement brûleur, outils de mesure",
    stylePlaceholder:
      "Ex. : entretien annuel chaudière, dépannage panne chauffage, remplacement chaudière condensation…",
    inspireContext:
      "contrôle combustion ou pression, entretien pièce, remise en chauffe et confort retrouvé",
  },
  {
    label: "Climatisation / VMC",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "unité split intérieure/extérieure, gainable, VMC double flux, conduit, manomètres et recharge gaz si applicable",
    stylePlaceholder:
      "Ex. : installation clim réversible, entretien VMC, désembouage, dépannage unité extérieure bruyante…",
    inspireContext:
      "diagnostic confort thermique, réglage ou nettoyage, test soufflage et température stable",
  },
  {
    label: "Énergéticien (pompe à chaleur)",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "pompe à chaleur air-eau ou géothermique, unité extérieure, ballon ECS, schéma hydraulique, logiciel de réglage",
    stylePlaceholder:
      "Ex. : remplacement chaudière par PAC, optimisation COP, aide MaPrimeRénov’, ballon thermodynamique…",
    inspireContext:
      "explication économies d’énergie, pose ou réglage PAC, courbe de température conforme",
  },
  {
    label: "Installateur solaire",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "panneaux photovoltaïques ou thermiques sur toiture, onduleur, câblage DC, échafaudage sécurisé, orientation sud",
    stylePlaceholder:
      "Ex. : installation 6 kWc, autoconsommation, revente surplus, intégration toiture, maintenance panneaux…",
    inspireContext:
      "fixation rails, pose modules, raccordement et production affichée au compteur",
  },
  {
    label: "Domoticien",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "maison connectée, thermostat, volets motorisés, application mobile, hub et câblage RJ45 ou radio",
    stylePlaceholder:
      "Ex. : scénario « je pars », éclairage Hue, alarme connectée, voice assistant, tableau domotique…",
    inspireContext:
      "démonstration scénario sur smartphone, action visible lumière ou volet, simplicité utilisateur",
  },
  {
    label: "Ramoneur",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "conduit de cheminée, hottes, aspirateur professionnel, brosses, certificat ramonnage, toiture accès conduit",
    stylePlaceholder:
      "Ex. : ramonage poêle à bois, insert, conduit tubage inox, nettoyage foyer, conformité assurance…",
    inspireContext:
      "avant encrassement visible, nettoyage conduit, feu qui repart proprement",
  },
  {
    label: "Pisciniste",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "bassin résidentiel, local technique, filtration, margelles, robot ou accessoires entretien, eau en condition réelle",
    stylePlaceholder:
      "Ex. : remise en route saison, traitement eau verte, installation pompe, entretien hebdomadaire, liner…",
    inspireContext:
      "analyse qualité d’eau, action de traitement, réglage filtration, résultat eau claire",
  },
  {
    label: "Serrurier",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "porte blindée, cylindre, poignée, outils de crochetage ou perçage, intervention urgence ou pose sécurisée",
    stylePlaceholder:
      "Ex. : ouverture porte claquée, remplacement serrure 3 points, blindage porte, digicode, coffre-fort…",
    inspireContext:
      "problème d’accès montré, intervention rapide, porte sécurisée et test fermeture",
  },
  {
    label: "Métallier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "atelier métal, meuleuse, soudure, garde-corps, escalier acier, structure industrielle sur mesure",
    stylePlaceholder:
      "Ex. : garde-corps verre et inox, portail coulissant, mezzanine acier, raccord soudé, thermolaquage…",
    inspireContext:
      "découpe ou soudure, assemblage, pose sur site et alignement parfait",
  },
  {
    label: "Automaticien portails & volets",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "portail motorisé, motorisation volet roulant, centrale de commande, photocellules, réglage fins de course",
    stylePlaceholder:
      "Ex. : motorisation portail battant, volet solaire, domotique portail smartphone, dépannage moteur…",
    inspireContext:
      "démonstration ouverture/fermeture fluide, réglage sécurité, client qui teste télécommande",
  },
  {
    label: "Installateur alarme / vidéosurveillance",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "centrale alarme, détecteurs, caméras IP, écran monitoring, câblage ou radio, application alerte mobile",
    stylePlaceholder:
      "Ex. : pack alarme maison, 4 caméras extérieures, détecteur mouvement, télésurveillance, mise aux normes…",
    inspireContext:
      "zone à risque identifiée, pose capteur ou caméra, test alerte sur téléphone",
  },
  {
    label: "Technicien fibre optique",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "boîtier fibre, soudeuse, testeur optique, tirage câble, prise murale FTTH, gaine technique immeuble",
    stylePlaceholder:
      "Ex. : raccordement box fibre, dépannage coupure, tirage ligne neuve, mesure puissance optique…",
    inspireContext:
      "soudure fibre sous loupe, test signal OK, débit affiché sur box client",
  },
];
