
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

declare global {
  var __supabase__: SupabaseClient | undefined
  var __supabase_placeholder__: SupabaseClient | undefined
}

export function getBrowserSupabase(opts: { remember?: boolean } = {}): SupabaseClient {
  void opts
  // Un seul client auth navigateur pour éviter tout conflit.
  if (globalThis.__supabase__) {
    return globalThis.__supabase__
  }

  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  if (!url || !key || url === 'https://placeholder.supabase.co' || key === 'placeholder-key') {
    console.error('[Supabase] Variables d\'environnement manquantes. Vérifiez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY')
    
    // Utiliser le placeholder en cache s'il existe (pour éviter les instances multiples)
    if (globalThis.__supabase_placeholder__) {
      return globalThis.__supabase_placeholder__
    }
    
    // Créer un client placeholder qui affichera des erreurs claires lors des tentatives d'authentification
    const placeholderClient = createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: window.sessionStorage,
      },
    })
    
    // Mettre en cache le placeholder pour éviter les instances multiples
    globalThis.__supabase_placeholder__ = placeholderClient
    return placeholderClient
  }

  const client = createClient(url, key, {
    auth: {
      storage: localStorage,
      persistSession: true,
      detectSessionInUrl: true,
      autoRefreshToken: true,
    },
  })

  globalThis.__supabase__ = client
  
  return client
}

/**
 * URL de callback email / OAuth (Supabase).
 * - Définir VITE_AUTH_REDIRECT_URL en build si tu veux forcer une URL (ex. https://tondomaine.fr/auth/callback).
 * - Sinon, en navigateur : origine actuelle (adapté OVH, préprod, etc.).
 * - Fallback : domaine de production (sans `window`, ex. tests).
 */
export const getRedirectTo = (): string => {
  const explicit = String(import.meta.env.VITE_AUTH_REDIRECT_URL ?? "").trim()
  if (explicit) return explicit

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/callback`
  }

  return "https://viralworks-studio.com/auth/callback"
}

/** Liens utiles du dashboard Supabase (dérivés de VITE_SUPABASE_URL) pour configurer SMTP et Redirect URLs. */
export type SupabaseDashboardAuthUrls = {
  projectRef: string
  smtp: string
  urlConfiguration: string
  orgTeam: string
  docsSmtp: string
  docsCaptcha: string
}

export function getSupabaseDashboardAuthUrls(): SupabaseDashboardAuthUrls | null {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim()
  try {
    const host = new URL(url).hostname
    const ref = host.split(".")[0]
    if (!ref || ref === "placeholder") return null
    return {
      projectRef: ref,
      smtp: `https://supabase.com/dashboard/project/${ref}/auth/smtp`,
      urlConfiguration: `https://supabase.com/dashboard/project/${ref}/auth/url-configuration`,
      orgTeam: "https://supabase.com/dashboard/org/_/team",
      docsSmtp: "https://supabase.com/docs/guides/auth/auth-smtp",
      docsCaptcha: "https://supabase.com/docs/guides/auth/auth-captcha",
    }
  } catch {
    return null
  }
}
