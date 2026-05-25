import type { VwsMetierProfile } from "./types";

/** Restauration & alimentation — 9 métiers */
export const RESTAURATION_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Restaurateur",
    recommendedVideoFormatId: "produit_demo",
    environmentHint:
      "cuisine en service, plan de travail, dressage, salle ou terrasse, équipe en mouvement, plats prêts à servir",
    stylePlaceholder:
      "Ex. : service du midi, cuisine bistronomique, burger maison, four à pizza, ambiance du soir, carte saison…",
    inspireContext:
      "préparation en cadence, dressage final, sortie de plat, réaction client en dégustation",
  },
  {
    label: "Traiteur",
    recommendedVideoFormatId: "produit_demo",
    environmentHint:
      "cuisine laboratoire, buffets, plateaux réception, mariage ou séminaire, dressage volume, livraison événement",
    stylePlaceholder:
      "Ex. : cocktail entreprise, mariage 120 couverts, brunch corporate, buffet froid, animation live cooking…",
    inspireContext:
      "montage buffet ou plateau, sortie du passe, réception client satisfaite",
  },
  {
    label: "Boulanger / Pâtissier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "fournil, pétrin, façonnage pain, viennoiseries, pâtisserie vitrine, farine et couches de pâte",
    stylePlaceholder:
      "Ex. : baguette tradition, croissants beurre, gâteau anniversaire, pain bio levain, macarons…",
    inspireContext:
      "pétrissage ou façonnage, cuisson four, produit doré sorti et présenté",
  },
  {
    label: "Boucher / Charcutier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "labo boucherie, découpe carcasse, vitrine produits, saucisson, hachoir, respect chaîne du froid",
    stylePlaceholder:
      "Ex. : découpe entrecôte, plateau barbecue, saucisson maison, volaille rôtie, conseil cuisson…",
    inspireContext:
      "découpe précise, présentation vitrine, conseil client sur morceau",
  },
  {
    label: "Food truck",
    recommendedVideoFormatId: "produit_demo",
    environmentHint:
      "camion aménagé, passe cuisine compact, file clients, événement ou marché, enseigne lumineuse",
    stylePlaceholder:
      "Ex. : tacos street food, burger gourmet, festival été, menu du jour ardoise, tournée ville…",
    inspireContext:
      "commande en cadence, préparation plancha, remise plat au comptoir",
  },
  {
    label: "Glacier",
    recommendedVideoFormatId: "produit_demo",
    environmentHint:
      "labo glace artisanale, turbine, vitrine bac, cornets, parfums saison, toppings",
    stylePlaceholder:
      "Ex. : glace pistache artisanale, sorbet fruits été, bac vitrine 12 parfums, cornet deux boules…",
    inspireContext:
      "churn ou dressage cornet, texture crémeuse, client qui goûte",
  },
  {
    label: "Chocolatier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "atelier chocolat, tempérage, moules, bonbons, tablettes, décors fins",
    stylePlaceholder:
      "Ex. : coffret fêtes, tablette 70%, ganache maison, sculpture chocolat, atelier dégustation…",
    inspireContext:
      "tempérage ou moulage, démoulage brillant, coffret présenté",
  },
  {
    label: "Poissonnier",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "étal marée, glace display, découpe poisson, huîtres, conseil cuisson, propreté maritime",
    stylePlaceholder:
      "Ex. : plateau fruits de mer, filet saumon, préparation crevettes, soupe poisson, livraison fraîcheur…",
    inspireContext:
      "découpe nette, présentation étal, conseil cuisson au client",
  },
  {
    label: "Cave à vins",
    recommendedVideoFormatId: "story_lifestyle",
    environmentHint:
      "cave bouteilles, étiquettes régions, dégustation verre, conseil accord mets-vins, ambiance chaleureuse",
    stylePlaceholder:
      "Ex. : dégustation Bordeaux, accord fromage, cave à domicile, box découverte, événement vigneron…",
    inspireContext:
      "choix bouteille, service ou dégustation, client qui découvre arômes",
  },
];
