// NOTE: Ce fichier est pour Next.js. Pour Vite, utilisez client-navigateur.ts
// Ce fichier n'est pas utilisé dans l'application Vite actuelle.
// Si vous avez besoin d'un client serveur pour Vite, créez une nouvelle implémentation.

import { createServerClient } from '@supabase/ssr';

// Cette fonction nécessite un environnement Next.js avec cookies() et headers()
// Pour Vite, utilisez getBrowserSupabase() depuis client-navigateur.ts
export function getServerSupabase() {
  // ⚠️ Cette fonction nécessite Next.js et n'est pas compatible avec Vite
  // Utilisez getBrowserSupabase() depuis client-navigateur.ts à la place
  throw new Error('getServerSupabase() nécessite Next.js. Utilisez getBrowserSupabase() pour Vite.');
}