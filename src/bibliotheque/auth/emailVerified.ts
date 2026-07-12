import type { User } from "@supabase/supabase-js";

/** Compte email/password avec email confirmé, ou OAuth (Google, etc.). */
export function isAccountEmailVerified(user: User | null | undefined): boolean {
  if (!user?.email) return false;
  if (user.email_confirmed_at) return true;

  const identities = user.identities ?? [];
  if (identities.some((identity) => identity.provider && identity.provider !== "email")) {
    return true;
  }

  const provider = String(user.app_metadata?.provider || "").toLowerCase();
  if (provider && provider !== "email") return true;

  return false;
}
