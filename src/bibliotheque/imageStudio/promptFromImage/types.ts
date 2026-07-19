/** Contexte interne « Prompt depuis image » — ne jamais exposer ce nom dans l’UI. */

export const MAX_CLOTHING_REFS = 4;

export type PersonGender = "homme" | "femme";

export type ClothingPieceType = "haut" | "bas" | "chaussures" | "tenue_entiere";

export type ClothingRefScope = "piece" | "full_outfit";

export type ClothingRefSource = "image" | "text";

export type PersonTraits = {
  gender: PersonGender;
  /** Ex. "20-25", "30s" */
  ageRange: string;
  /** Teint / cheveux / traits utiles au prompt */
  colors: string;
  /** Description physique courte en anglais pour les assembleurs */
  physiquePrompt: string;
  /** true si l’utilisateur a confirmé manuellement (fallback vision) */
  fromFallback?: boolean;
};

export type ClothingRefItem = {
  id: string;
  source: ClothingRefSource;
  /** URL data ou publique si image */
  imageUrl?: string | null;
  /** Description texte si source text, ou focus sur une pièce */
  text?: string | null;
  pieceType?: ClothingPieceType | null;
  /** Si tenue_entiere détectée : pièce précise vs tenue complète */
  scope?: ClothingRefScope | null;
};

export type ClothingDecision =
  | { mode: "keep_avatar_outfit" }
  | {
      mode: "change";
      refs: ClothingRefItem[];
      /** Remplir le reste de la tenue au hasard */
      restRandom: boolean;
      /** Notes texte libres agrégées */
      notes: string;
    };

export type PromptFromImageContext = {
  avatarUrl: string;
  source: "project";
  personTraits: PersonTraits | null;
  clothing: ClothingDecision | null;
};

export type ClothingInterviewStep =
  | "analyzing_person"
  | "fallback_gender"
  | "fallback_age_colors"
  | "keep_or_change"
  | "await_clothing_input"
  | "analyzing_clothing_ref"
  | "fallback_piece_type"
  | "full_outfit_scope"
  | "rest_of_outfit"
  | "pick_chatbot"
  | "done";
