const LEET_MAP: Record<string, string> = {
  "1": "i",
  "3": "e",
  "0": "o",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
};

/** Normalise un prénom/nom avant comparaison aux listes. */
export function normalizeDisplayName(input: string): string {
  let value = input.trim().toLowerCase();
  if (!value) return "";

  value = value.normalize("NFD").replace(/\p{M}/gu, "");
  value = value.replace(/[\s.\-_']/g, "");
  value = value.replace(/[13045o7@]/g, (char) => LEET_MAP[char] ?? char);

  return value;
}
