import type { BlockedNameField } from "../name-moderation/validate.ts";

export type SignupBlockReason =
  | "missing_names"
  | "disposable_email"
  | "invalid_email"
  | "gibberish_first_name"
  | "gibberish_last_name"
  | "blocked_name";

export function signupBlockedMessage(reason: SignupBlockReason, field?: BlockedNameField): string {
  switch (reason) {
    case "missing_names":
      return "Le prénom et le nom sont obligatoires pour créer un compte.";
    case "disposable_email":
      return "Les adresses email temporaires ou jetables ne sont pas acceptées.";
    case "invalid_email":
      return "Adresse email invalide.";
    case "gibberish_first_name":
      return "Ce prénom ne semble pas valide. Utilise ton vrai prénom.";
    case "gibberish_last_name":
      return "Ce nom ne semble pas valide. Utilise ton vrai nom.";
    case "blocked_name":
      if (field === "firstName") return "Ce prénom n'est pas autorisé.";
      if (field === "lastName") return "Ce nom n'est pas autorisé.";
      return "Ce prénom/nom n'est pas autorisé.";
    default:
      return "Inscription refusée.";
  }
}
