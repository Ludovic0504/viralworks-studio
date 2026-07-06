import { normalizeDisplayName } from "./normalize.ts";
import { getBadwordsSet, getToxicPersonalitiesSet } from "./load-lists.ts";

const MIN_SUBSTRING_BADWORD_LENGTH = 4;
const MIN_SUBSTRING_TOXIC_LENGTH = 4;

export type BlockedNameField = "firstName" | "lastName" | "both";

export type ValidateDisplayNamesResult =
  | { ok: true }
  | { ok: false; field: BlockedNameField };

function isBlockedNormalized(
  normalized: string,
  badwords: Set<string>,
  toxic: Set<string>,
): boolean {
  if (!normalized) return false;

  if (toxic.has(normalized) || badwords.has(normalized)) return true;

  for (const word of toxic) {
    if (word.length >= MIN_SUBSTRING_TOXIC_LENGTH && normalized.includes(word)) {
      return true;
    }
  }

  for (const word of badwords) {
    if (word.length >= MIN_SUBSTRING_BADWORD_LENGTH && normalized.includes(word)) {
      return true;
    }
    if (word.length < MIN_SUBSTRING_BADWORD_LENGTH && normalized === word) {
      return true;
    }
  }

  return false;
}

function isBlockedCandidate(
  candidate: string,
  badwords: Set<string>,
  toxic: Set<string>,
): boolean {
  const normalized = normalizeDisplayName(candidate);
  return isBlockedNormalized(normalized, badwords, toxic);
}

export function isBlockedTerm(
  candidate: string,
  badwords = getBadwordsSet(),
  toxic = getToxicPersonalitiesSet(),
): boolean {
  return isBlockedCandidate(candidate, badwords, toxic);
}

export function validateDisplayNames(
  firstName: string,
  lastName: string,
  badwords = getBadwordsSet(),
  toxic = getToxicPersonalitiesSet(),
): ValidateDisplayNamesResult {
  const first = firstName.trim();
  const last = lastName.trim();

  const firstBlocked = first ? isBlockedCandidate(first, badwords, toxic) : false;
  const lastBlocked = last ? isBlockedCandidate(last, badwords, toxic) : false;

  if (firstBlocked && lastBlocked) {
    return { ok: false, field: "both" };
  }
  if (firstBlocked) {
    return { ok: false, field: "firstName" };
  }
  if (lastBlocked) {
    return { ok: false, field: "lastName" };
  }

  if (first && last) {
    const combinedBlocked = isBlockedCandidate(`${first} ${last}`, badwords, toxic);
    if (combinedBlocked) {
      return { ok: false, field: "both" };
    }
  }

  return { ok: true };
}
