import { BATIMENT_METIER_PROFILES } from "./batiment";
import { SECOND_OEUVRE_METIER_PROFILES } from "./secondOeuvre";
import { TECHNIC_METIER_PROFILES } from "./technic";
import { ESPACE_VERT_METIER_PROFILES } from "./espaceVert";
import { AUTO_METIER_PROFILES } from "./auto";
import { SERVICE_METIER_PROFILES } from "./service";
import { RESTAURATION_METIER_PROFILES } from "./restauration";
import { BEAUTE_METIER_PROFILES } from "./beaute";
import { SANTE_SPORT_METIER_PROFILES } from "./santeSport";
import { IMMO_METIER_PROFILES } from "./immo";
import type { VwsMetierProfile } from "./types";

/** 106 profils — 10 catégories (ordre = metiersCategories). */
export const VWS_METIER_PROFILES_COMBINED: VwsMetierProfile[] = [
  ...BATIMENT_METIER_PROFILES,
  ...SECOND_OEUVRE_METIER_PROFILES,
  ...TECHNIC_METIER_PROFILES,
  ...ESPACE_VERT_METIER_PROFILES,
  ...AUTO_METIER_PROFILES,
  ...SERVICE_METIER_PROFILES,
  ...RESTAURATION_METIER_PROFILES,
  ...BEAUTE_METIER_PROFILES,
  ...SANTE_SPORT_METIER_PROFILES,
  ...IMMO_METIER_PROFILES,
];
