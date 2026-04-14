
import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/contexte/FournisseurAuth';

export default function LogoutRoute() {
  const { supabase } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    supabase.auth.signOut();
  }, [supabase]);

  return <div>Déconnexion…</div>;
}
