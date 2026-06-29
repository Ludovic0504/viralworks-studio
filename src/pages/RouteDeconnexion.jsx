import { useEffect, useRef } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";

export default function LogoutRoute() {
  const { signOut } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void signOut();
  }, [signOut]);

  return <div>Déconnexion…</div>;
}
