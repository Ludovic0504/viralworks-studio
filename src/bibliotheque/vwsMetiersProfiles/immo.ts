import type { VwsMetierProfile } from "./types";

/** Immobilier & habitat — 8 métiers */
export const IMMO_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Agent immobilier",
    recommendedVideoFormatId: "story_lifestyle",
    environmentHint:
      "bien réel en vente (appartement, maison, studio), entrée, pièce de vie, cuisine, salle d’eau, extérieur ou balcon selon le bien",
    stylePlaceholder:
      "Ex. : T3 rénové, style haussmannien, vue dégagée, quartier résidentiel, lumière naturelle, mandat exclusif…",
    inspireContext:
      "accroche sur le besoin client, visite courte pièce par pièce, focus points forts mesurables (surface, luminosité, extérieur)",
  },
  {
    label: "Architecte",
    recommendedVideoFormatId: "story_probleme_solution",
    environmentHint:
      "plans 2D/3D, maquette, chantier structure, façade projet, réunion client autour des plans",
    stylePlaceholder:
      "Ex. : extension maison, permis de construire, maison contemporaine bois, réhabilitation grange, conformité PLU…",
    inspireContext:
      "contrainte terrain ou budget, proposition volumétrie, chantier ou rendu 3D convaincant",
  },
  {
    label: "Architecte d'intérieur",
    recommendedVideoFormatId: "story_probleme_solution",
    environmentHint:
      "échantillons matériaux, moodboard, pièce en relooking, rendu 3D intérieur, échanges client",
    stylePlaceholder:
      "Ex. : rénovation appartement ancien, optimisation petit espace, conception cuisine, ambiance haut de gamme…",
    inspireContext:
      "problème d’aménagement posé, solution visuelle proposée, projection avant/après compréhensible",
  },
  {
    label: "Promoteur",
    recommendedVideoFormatId: "process_timelapse",
    environmentHint:
      "programme neuf, maquette lotissement, chantier VEFA, show apartment, panneaux commercialisation",
    stylePlaceholder:
      "Ex. : résidence 20 logements, lotissement, livraison clés, standing éco, quartier en développement…",
    inspireContext:
      "terrain nu puis construction, avancement travaux, livraison ou appartement témoin",
  },
  {
    label: "Géomètre",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "station totale, bornes, plan parcellaire, terrain à lever, limite de propriété marquée",
    stylePlaceholder:
      "Ex. : bornage terrain, plan division, copropriété, implantation construction, levé topographique…",
    inspireContext:
      "prise de mesure terrain, pose borne ou trait, plan remis au client",
  },
  {
    label: "Expert immobilier",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "bureau expertise, dossier vente ou succession, photos bien, rapport, visite contradictoire",
    stylePlaceholder:
      "Ex. : valeur vénale maison, expertise divorce, litige voisinage, marché local, bien atypique…",
    inspireContext:
      "méthode d’évaluation expliquée, visite bien, fourchette valeur argumentée",
  },
  {
    label: "Gestionnaire de biens",
    recommendedVideoFormatId: "story_lifestyle",
    environmentHint:
      "immeuble locatif, hall, état des lieux, clés, dossier locataire, réunion copropriété",
    stylePlaceholder:
      "Ex. : gestion 50 lots, recherche locataire, régularisation charges, travaux copro, bail commercial…",
    inspireContext:
      "visite appartement, état des lieux, sérénité propriétaire et locataire",
  },
  {
    label: "Diagnostiqueur immobilier",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "test DPE, humidimètre, rapport diagnostics, combles, tableau électrique, étiquette énergie",
    stylePlaceholder:
      "Ex. : DPE avant vente, amiante, électricité, ERP, pack diagnostics location, conseil travaux…",
    inspireContext:
      "mesure sur site, étiquette ou rapport, explication vendeur ou acquéreur",
  },
];
