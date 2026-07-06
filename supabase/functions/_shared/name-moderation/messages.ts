import type { BlockedNameField } from "./validate.ts";

export const SUPPORT_EMAIL = "contact@viralworks-studio.com";

const SUPPORT_SUFFIX = `Si vous pensez qu'il s'agit d'une erreur, contactez-nous à ${SUPPORT_EMAIL}.`;

export const BLOCKED_FIRST_NAME_MESSAGE = `Ce prénom n'est pas autorisé. ${SUPPORT_SUFFIX}`;
export const BLOCKED_LAST_NAME_MESSAGE = `Ce nom n'est pas autorisé. ${SUPPORT_SUFFIX}`;
export const BLOCKED_DISPLAY_NAME_MESSAGE = `Ce prénom/nom n'est pas autorisé. ${SUPPORT_SUFFIX}`;

export function blockedDisplayNameMessage(field: BlockedNameField): string {
  if (field === "firstName") return BLOCKED_FIRST_NAME_MESSAGE;
  if (field === "lastName") return BLOCKED_LAST_NAME_MESSAGE;
  return BLOCKED_DISPLAY_NAME_MESSAGE;
}
