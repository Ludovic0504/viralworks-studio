
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
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Mode sécurisé: session navigateur uniquement (pas de persistance longue).
      storage: window.sessionStorage,
    },
  })

  globalThis.__supabase__ = client
  
  return client
}

export const getRedirectTo = () => {
  // Canonical production callback used for all email auth links.
  // This avoids legacy Netlify preview/custom aliases leaking through env configuration.
  return "https://viralworks-studio.netlify.app/auth/callback";
}
