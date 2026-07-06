export function extractNameFields(metadata: Record<string, unknown> | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const meta = metadata ?? {};

  const directFirst = typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  const directLast = typeof meta.last_name === "string" ? meta.last_name.trim() : "";
  if (directFirst || directLast) {
    return { firstName: directFirst, lastName: directLast };
  }

  const given = typeof meta.given_name === "string" ? meta.given_name.trim() : "";
  const family = typeof meta.family_name === "string" ? meta.family_name.trim() : "";
  if (given || family) {
    return { firstName: given, lastName: family };
  }

  const fullNameRaw =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    "";

  if (!fullNameRaw) {
    return { firstName: "", lastName: "" };
  }

  const parts = fullNameRaw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}
