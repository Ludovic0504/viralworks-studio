import { useEffect } from "react";
import { useParams } from "react-router-dom";
import Loading from "@/composants/interface/Chargement";
import { useT } from "@/contexte/FournisseurLocale";
import { isLinkClickSource, logLinkClick } from "@/bibliotheque/linkClickGoRedirect";

/**
 * Route /go/:source — log clic puis redirection accueil (SPA).
 */
export default function GoRedirect({ source: sourceProp }) {
  const t = useT();
  const { source: sourceParam } = useParams();
  const source = String(sourceProp ?? sourceParam ?? "").trim().toLowerCase();

  console.log("[go] GoRedirect monté — source=", source, "| pathname=", window.location.pathname);

  useEffect(() => {
    (async () => {
      if (isLinkClickSource(source)) {
        const result = await logLinkClick(source);

        console.log("[go] config", {
          url: result.debug.url,
          supabaseUrl: result.debug.supabaseUrl,
          anonKeyPresent: result.debug.anonKeyPresent,
          anonKeyRef: result.debug.anonKeyRef,
          anonKeyMatchesProject: result.debug.anonKeyMatchesProject,
        });

        if (result.error) {
          console.error("[go] fetch erreur", result.error);
        } else {
          console.log("[go] fetch réponse", {
            ok: result.ok,
            status: result.status,
            statusText: result.statusText,
            body: result.body,
          });
          if (!result.ok) {
            console.warn(
              "[go] échec HTTP — vérifie le déploiement: npm run supabase:deploy:go-redirect"
            );
          }
        }
      } else {
        console.warn("[go] source invalide, pas de log:", source);
      }

      window.location.href = "/";
    })();
  }, [source]);

  return <Loading fullScreen text={t("redirect.loading")} />;
}
