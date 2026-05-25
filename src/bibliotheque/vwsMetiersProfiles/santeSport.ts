import type { VwsMetierProfile } from "./types";

/** Santé & sport — 8 métiers */
export const SANTE_SPORT_METIER_PROFILES: VwsMetierProfile[] = [
  {
    label: "Coach sportif",
    recommendedVideoFormatId: "social_hook_educatif",
    environmentHint:
      "coaching en salle ou extérieur, client en mouvement, haltères ou poids du corps, démonstration exercice, correction posture",
    stylePlaceholder:
      "Ex. : programme perte de poids, coaching force, remise en forme débutant, séance HIIT 30 min, prépa physique…",
    inspireContext:
      "objectif client clair, exercice démontré, correction posture, progression mesurable",
  },
  {
    label: "Salle de sport",
    recommendedVideoFormatId: "story_lifestyle",
    environmentHint:
      "salle de sport active (musculation, cardio, functional), matériel utilisé, membres en séance, ambiance énergique",
    stylePlaceholder:
      "Ex. : abonnement sans engagement, cours collectif, zone crossfit, coaching inclus, ouverture nouvelle salle…",
    inspireContext:
      "ambiance salle, membre qui s’entraîne, équipement mis en valeur et offre claire",
  },
  {
    label: "Ostéopathe",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "cabinet ostéopathie, table de soin, patient allongé, gestes doux, explication postural debout",
    stylePlaceholder:
      "Ex. : douleur dos bureau, suivi sportif, nourrisson, maux de tête tension, première séance…",
    inspireContext:
      "écoute motif, test mobilité, manipulation ou relâchement, soulagement exprimé",
  },
  {
    label: "Kiné",
    recommendedVideoFormatId: "process_avant_apres",
    environmentHint:
      "cabinet kiné ou plateau rééducation, bandes élastiques, vélo médical, marche réapprentissage, patient guidé",
    stylePlaceholder:
      "Ex. : rééducation genou post-op, lombalgie, épaule sport, rééducation vestibulaire, prescription 10 séances…",
    inspireContext:
      "limitation montrée, exercice thérapeutique, gain amplitude ou marche améliorée",
  },
  {
    label: "Diététicien",
    recommendedVideoFormatId: "humain_face_expert",
    environmentHint:
      "consultation bureau, balance, exemples repas équilibrés, courbe progression, échange bienveillant",
    stylePlaceholder:
      "Ex. : perte de poids durable, nutrition sportive, diabète type 2, bilan alimentaire enfant, reprise musculation…",
    inspireContext:
      "habitudes actuelles discutées, plan repas concret, assiette équilibrée présentée",
  },
  {
    label: "Yoga / pilates",
    recommendedVideoFormatId: "story_lifestyle",
    environmentHint:
      "studio lumineux, tapis, posture flow ou reformer pilates, groupe calme, respiration visible",
    stylePlaceholder:
      "Ex. : cours débutant yoga, pilates renforcement centre, prénatal, studio zen quartier, stage week-end…",
    inspireContext:
      "transition posture fluide, respiration, détente et alignement du groupe",
  },
  {
    label: "Arts martiaux",
    recommendedVideoFormatId: "process_demo_geste",
    environmentHint:
      "dojo ou club, tatami, kimono ou gants, enchaînement technique, coup pied poitrine, discipline",
    stylePlaceholder:
      "Ex. : cours enfants karaté, self-défense adulte, préparation grade ceinture, MMA fitness, essai gratuit…",
    inspireContext:
      "technique démontrée, travail avec partenaire, respect salut début fin",
  },
  {
    label: "Piscine & natation",
    recommendedVideoFormatId: "social_hook_educatif",
    environmentHint:
      "bassin 25 m, lignes d’eau, enfant ou adulte nage, maître-nageur au bord, planches et frites",
    stylePlaceholder:
      "Ex. : cours aquagym, apprentissage crawl enfant, stage vacances, natation compétition, horaires créneaux…",
    inspireContext:
      "exercice dans l’eau, correction gestuelle, nage fluide ou groupe qui progresse",
  },
];
