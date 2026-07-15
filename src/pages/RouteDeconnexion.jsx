import { useEffect, useRef } from "react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useT } from "@/contexte/FournisseurLocale";

export default function LogoutRoute() {
  const t = useT();
  const { signOut } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void signOut();
  }, [signOut]);

  return <div>{t("auth.disconnecting")}</div>;
}
