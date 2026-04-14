
import { Link } from "react-router-dom";
import PageTitle from "../composants/interface/TitrePage";
import { ArrowLeft, Shield, FileText, Mail, Building2, Globe } from "lucide-react";

export default function MentionsLegales() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="glass-strong rounded-2xl border border-white/10 p-8 space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-400" />
            Hébergement
          </h2>
          <div className="space-y-2 text-sm text-gray-300">
            <p>
              Ce site est hébergé par des services cloud modernes, garantissant une disponibilité optimale et une sécurité renforcée.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            Protection des données personnelles
          </h2>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition aux données personnelles vous concernant.
            </p>
            <p>
              Les données collectées sont utilisées uniquement dans le cadre du fonctionnement de la plateforme et ne font l'objet d'aucune utilisation commerciale ou de cession à des tiers.
            </p>
            <p>
              Pour exercer vos droits, vous pouvez nous contacter via votre profil utilisateur ou supprimer votre compte à tout moment.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            Cookies
          </h2>
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              Ce site utilise des cookies techniques nécessaires au fonctionnement de la plateforme et à l'authentification des utilisateurs. Ces cookies ne sont pas utilisés à des fins de tracking ou de publicité.
            </p>
            <p>
              En utilisant ce site, vous acceptez l'utilisation de ces cookies techniques.
            </p>
          </div>
        </section>

        <div className="pt-6 border-t border-white/10">
          <p className="text-xs text-gray-500">
            Dernière mise à jour : {new Date().toLocaleDateString("fr-FR", { 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

