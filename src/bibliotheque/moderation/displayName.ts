import { getBrowserSupabase } from "@/bibliotheque/supabase/client-navigateur";

const SUPPORT_EMAIL = "contact@viralworks-studio.com";
const SUPPORT_SUFFIX = `Si vous pensez qu'il s'agit d'une erreur, contactez-nous à ${SUPPORT_EMAIL}.`;

export const BLOCKED_FIRST_NAME_MESSAGE = `Ce prénom n'est pas autorisé. ${SUPPORT_SUFFIX}`;
export const BLOCKED_LAST_NAME_MESSAGE = `Ce nom n'est pas autorisé. ${SUPPORT_SUFFIX}`;
export const BLOCKED_DISPLAY_NAME_MESSAGE = `Ce prénom/nom n'est pas autorisé. ${SUPPORT_SUFFIX}`;

export type BlockedNameField = "firstName" | "lastName" | "both";

export function blockedDisplayNameMessage(field: BlockedNameField): string {
  if (field === "firstName") return BLOCKED_FIRST_NAME_MESSAGE;
  if (field === "lastName") return BLOCKED_LAST_NAME_MESSAGE;
  return BLOCKED_DISPLAY_NAME_MESSAGE;
}

export function inferBlockedNameFieldFromMessage(message: string): BlockedNameField {
  const normalized = message.toLowerCase();
  if (normalized.includes("prénom/nom") || normalized.includes("prenom/nom")) {
    return "both";
  }
  if (normalized.startsWith("ce prénom") || normalized.startsWith("ce prenom")) {
    return "firstName";
  }
  if (normalized.startsWith("ce nom")) {
    return "lastName";
  }
  return "both";
}

export type ValidateDisplayNameResult =
  | { ok: true }
  | { ok: false; error: string; field: BlockedNameField };

function isBlockedNameField(value: unknown): value is BlockedNameField {
  return value === "firstName" || value === "lastName" || value === "both";
}

type ParsedInvokeError = {
  error: string;
  field: BlockedNameField;
};

function parseInvokeErrorPayload(parsed: {
  error?: string;
  field?: unknown;
}): ParsedInvokeError | null {
  const field = isBlockedNameField(parsed.field) ? parsed.field : "both";
  if (typeof parsed.error === "string" && parsed.error.trim()) {
    return {
      error: blockedDisplayNameMessage(field),
      field,
    };
  }
  return null;
}

async function parseInvokeErrorBody(error: unknown): Promise<ParsedInvokeError | null> {
  if (!error || typeof error !== "object") return null;

  const ctx = (error as { context?: unknown }).context;
  if (!ctx) return null;

  try {
    // supabase-js v2+ : context est un objet Response (fetch)
    if (
      typeof ctx === "object" &&
      ctx !== null &&
      "json" in ctx &&
      typeof (ctx as Response).json === "function"
    ) {
      const parsed = (await (ctx as Response).clone().json()) as {
        error?: string;
        field?: unknown;
      };
      return parseInvokeErrorPayload(parsed);
    }

    // Ancien format : context.body en chaîne JSON
    const body = (ctx as { body?: string }).body;
    if (typeof body === "string") {
      const parsed = JSON.parse(body) as { error?: string; field?: unknown };
      return parseInvokeErrorPayload(parsed);
    }
  } catch {
    // ignore JSON parse errors
  }
  return null;
}

function parseSuccessBody(data: unknown): ValidateDisplayNameResult | null {
  if (!data || typeof data !== "object") return null;
  const body = data as { ok?: boolean; error?: string; field?: unknown };
  if (body.ok === false) {
    const field = isBlockedNameField(body.field) ? body.field : "both";
    return {
      ok: false,
      error: blockedDisplayNameMessage(field),
      field,
    };
  }
  return null;
}

export function isBlockedDisplayNameError(message: string | null | undefined): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("pas autorisé") || normalized.includes("pas autorise");
}

/** Vérifie prénom/nom via la Edge Function (liste côté serveur). */
export async function validateDisplayNamesRemote(
  firstName: string,
  lastName: string,
): Promise<ValidateDisplayNameResult> {
  const supabase = getBrowserSupabase();
  const { data, error } = await supabase.functions.invoke("validate-display-name", {
    body: { firstName, lastName },
  });

  const fromData = parseSuccessBody(data);
  if (fromData) return fromData;

  const parsedBodyError = await parseInvokeErrorBody(error);
  if (parsedBodyError) {
    return { ok: false, error: parsedBodyError.error, field: parsedBodyError.field };
  }

  if (error) {
    return { ok: false, error: blockedDisplayNameMessage("both"), field: "both" };
  }

  return { ok: true };
}
