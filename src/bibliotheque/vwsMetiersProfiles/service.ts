import type { VwsMetierProfile } from "./types";

/** Services aux particuliers — 9 métiers */
export const SERVICE_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Déménageur",
    recommendedVideoFormatId: "process_timelapse",
    environmentHint:
      "cartons, housse mobilier, camion porte latérale, diable, protection sols, appartement avant/après départ",
    stylePlaceholder:
      "Ex. : déménagement T2, monte-meuble, emballage fragile, garde-meuble, déménagement longue distance…",
    inspireContext:
      "chargement méthodique, protection meubles, livraison et pièce vidée puis meublée",
  },
  {
    label: "Nettoyage professionnel",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "bureaux ou logement, matériel Karcher, chariot ménage, produits pro, sols et vitres brillants",
    stylePlaceholder:
      "Ex. : ménage fin de chantier, nettoyage bureaux hebdo, moquette shampoing, vitres immeuble, désinfection…",
    inspireContext:
      "pièce encombrée ou sale, passage méthodique, surface propre et odeur fraîche",
  },
  {
    label: "Aide à domicile",
    recommendedVideoFormatId: "story_lifestyle",
    environmentHint:
      "domicile senior, accompagnement quotidien, repas, courses, ménage léger, relation bienveillante visible",
    stylePlaceholder:
      "Ex. : aide lever matin, courses, préparation repas, compagnie, maintien à domicile, répit aidants…",
    inspireContext:
      "besoin du senior exprimé, geste d’aide concret, autonomie préservée et sourire",
  },
  {
    label: "Garde d'animaux / toiletteur",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "salon toilettage ou domicile client, bain chien, tondeuse, griffes, séchage, promenade chien en laisse",
    stylePlaceholder:
      "Ex. : toilettage complet caniche, garde chats vacances, promenade quotidienne, coupe griffes, anti-puces…",
    inspireContext:
      "animal avant malpropre ou poils longs, soin ou balade, animal propre et détendu",
  },
  {
    label: "Laveur de vitres",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "vitres immeuble ou maison, raclette, perche télescopique, eau pure, baies vitrées sans traces",
    stylePlaceholder:
      "Ex. : nettoyage vitres 4e étage, verrières, vitrines commerce, traitement anti-pluie, contrat mensuel…",
    inspireContext:
      "vitre ternie puis passage raclette, transparence et reflet sans trace",
  },
  {
    label: "Débouchage canalisations",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "caméra inspection, furet électrique, pompe, regard extérieur, cuisine ou salle de bain en débouchage",
    stylePlaceholder:
      "Ex. : WC bouché urgence, évier cuisine, colonne immeuble, hydrocurage, odeurs évacuation…",
    inspireContext:
      "évacuation bloquée, outil d’inspection ou débouchage, eau qui repart normalement",
  },
  {
    label: "Dépannage électroménager",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "lave-linge ou four démonté partiellement, multimètre, pièces détachées, cuisine chez particulier",
    stylePlaceholder:
      "Ex. : lave-linge ne vidange pas, four ne chauffe plus, frigo fuite, SAV toutes marques, devis pièce…",
    inspireContext:
      "panne expliquée, test composant, appareil remis en service chez client",
  },
  {
    label: "Agent de sécurité",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "ronde bâtiment, écran CCTV, badge, uniforme, parking ou entrée surveillée, rapport d’incident",
    stylePlaceholder:
      "Ex. : gardiennage magasin, ronde nocturne résidence, accueil sécurité, événement VIP, télésurveillance…",
    inspireContext:
      "zone à risque identifiée, ronde ou contrôle accès, site calme et sécurisé",
  },
  {
    label: "Ambulancier / VSL",
    recommendedVideoFormatId: "story_lifestyle",
    environmentHint:
      "ambulance ou VSL, brancard, patient accompagné, conduite sécurisée, hôpital ou domicile",
    stylePlaceholder:
      "Ex. : transport dialyse, transfert EHPAD, urgence non vitale, VSL fauteuil roulant, équipe 2 secouristes…",
    inspireContext:
      "prise en charge patient, installation sécurisée, arrivée établissement sereine",
  },
];
