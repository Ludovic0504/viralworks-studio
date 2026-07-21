import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  Crown,
  Coins,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";

function ProfilSection({ title, icon: Icon, iconClass = "text-emerald-400", action, children }) {
  return (
    <section className="profil-section">
      <div className="profil-section-head">
        <div className="profil-section-head-main">
          {Icon ? <Icon className={`profil-section-icon ${iconClass}`} strokeWidth={2} aria-hidden /> : null}
          <h3 className="profil-section-title">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function creditReasonLabel(reason) {
  switch (reason) {
    case "prompt_generation":
      return "Génération de prompt";
    case "image_generation":
      return "Génération d'image (workflow)";
    case "video_generation":
      return "Génération de vidéo";
    case "admin_manual":
      return "Ajout manuel";
    case "admin_manual_workflow_video":
      return "Admin — vidéos workflow";
    case "admin_manual_text_generation":
      return "Admin — quota texte";
    case "admin_manual_image_generation":
      return "Admin — quota image (génération)";
    case "admin_manual_image_modification":
      return "Admin — quota image (modification)";
    case "admin_manual_video_generation":
      return "Admin — quota vidéo";
    case "stripe_payment":
      return "Achat de vidéos";
    case "subscription_payment":
      return "Abonnement";
    case "subscription_renewal":
      return "Renouvellement abonnement";
    default:
      return reason || "Transaction";
  }
}

const VIDEO_TX_REASONS = new Set([
  "video_generation",
  "prompt_generation",
  "admin_manual",
  "admin_manual_workflow_video",
  "admin_manual_text_generation",
  "admin_manual_video_generation",
  "stripe_payment",
  "subscription_payment",
  "subscription_renewal",
]);

const IMAGE_CREDIT_TX_REASONS = new Set([
  "image_generation",
  "admin_manual_image_generation",
  "admin_manual_image_modification",
]);

function paymentStatusIcon(status) {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case "pending":
      return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-400" />;
    case "cancelled":
      return <XCircle className="w-4 h-4 text-gray-400" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
  }
}

function paymentStatusLabel(status) {
  switch (status) {
    case "completed":
      return "Payé";
    case "pending":
      return "En attente";
    case "failed":
      return "Échoué";
    case "cancelled":
      return "Annulé";
    default:
      return status;
  }
}

function paymentStatusColor(status) {
  switch (status) {
    case "completed":
      return "text-emerald-400";
    case "pending":
      return "text-yellow-400";
    case "failed":
      return "text-red-400";
    case "cancelled":
      return "text-gray-400";
    default:
      return "text-gray-400";
  }
}

function ExpandableList({ items, initial = 8, renderItem, emptyLabel, seeAllLabel, seeLessLabel }) {
  const [showAll, setShowAll] = useState(false);
  if (!items?.length) {
    return <div className="profil-empty">{emptyLabel}</div>;
  }
  const visible = showAll ? items : items.slice(0, initial);
  return (
    <>
      <div>{visible.map(renderItem)}</div>
      {items.length > initial ? (
        <button type="button" className="profil-expand-btn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" />
              {seeLessLabel}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              {seeAllLabel} ({items.length})
            </>
          )}
        </button>
      ) : null}
    </>
  );
}

/**
 * Espace de suivi / preuve : paiements, abonnement, crédits vidéo & image.
 */
export default function SectionTransactionsProfil({
  payments = [],
  transactions = [],
  imageStudioHistory = [],
  imageStudioHistoryLoading = false,
  subscription,
  subscriptionPlanName,
  subscriptionPlanKey,
  cancellingSubscription = false,
  onCancelSubscription,
  openBoutiqueModal,
  formatDate,
  t,
}) {
  const videoTx = (transactions || []).filter(
    (tx) => !tx.reason || VIDEO_TX_REASONS.has(tx.reason),
  );
  const imageCreditTx = (transactions || []).filter((tx) =>
    IMAGE_CREDIT_TX_REASONS.has(tx.reason),
  );

  const imageStudioRows = (imageStudioHistory || []).map((item) => {
    const urls = Array.isArray(item?.metadata?.urls) ? item.metadata.urls : [];
    const qty = Math.max(1, urls.length || (item?.output ? 1 : 1));
    const model = item?.metadata?.imageStudioModel || item?.model || "Image Studio";
    const ratio = item?.metadata?.aspectRatio || null;
    return {
      id: item.id,
      created_at: item.created_at,
      label: ratio ? `Image Studio · ${model} · ${ratio}` : `Image Studio · ${model}`,
      qty,
    };
  });

  return (
    <div className="dash-transactions">
      <header className="dash-transactions-intro">
        <h2 className="dash-transactions-title">Transactions</h2>
        <p className="dash-transactions-desc">
          Historique complet des paiements, de l’abonnement et des consommations de crédits — utile pour
          vérifier un paiement, une consommation ou un remboursement.
        </p>
      </header>

      <div className="profil-section-stack">
        <ProfilSection title="Historique des paiements" icon={CreditCard}>
          <ExpandableList
            items={payments}
            emptyLabel="Aucun paiement"
            seeAllLabel={t?.("profile.seeAll") || "Voir tout"}
            seeLessLabel={t?.("profile.seeLess") || "Voir moins"}
            renderItem={(payment) => (
              <div
                key={payment.id}
                className="profil-list-row flex-col sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {paymentStatusIcon(payment.status)}
                    <p className="text-sm font-medium text-gray-200">
                      {Number(payment.amount).toFixed(2)} €
                    </p>
                    <span className={`text-xs font-medium ${paymentStatusColor(payment.status)}`}>
                      {paymentStatusLabel(payment.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {formatDate(payment.created_at)}
                    {payment.metadata?.credits ? ` · ${payment.metadata.credits} vidéos` : ""}
                    {payment.id ? ` · réf. ${String(payment.id).slice(0, 8)}` : ""}
                  </p>
                </div>
              </div>
            )}
          />
        </ProfilSection>

        <ProfilSection title={t?.("profile.mySubscription") || "Mon abonnement"} icon={Crown} iconClass="text-violet-400">
          {subscription ? (
            <div className="profil-subpanel profil-subpanel--violet">
              <div className="mb-3">
                <span className="text-sm font-semibold text-violet-300">
                  {subscriptionPlanName ?? "Abonnement actif"}
                </span>
                {subscriptionPlanKey ? (
                  <span className="ml-2 text-[11px] text-violet-400/80">({subscriptionPlanKey})</span>
                ) : null}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span className="shrink-0 text-gray-400">Statut</span>
                  <span className="font-medium capitalize text-emerald-400 sm:text-right">
                    {subscription.status}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="shrink-0 text-gray-400">Période actuelle</span>
                  <span className="min-w-0 break-words text-gray-200 sm:text-right">
                    {new Date(subscription.current_period_start).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    –{" "}
                    {new Date(subscription.current_period_end).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {subscription.cancel_at_period_end ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-400" />
                    <div className="flex-1">
                      <p className="mb-1 text-xs font-medium text-yellow-300">Abonnement annulé</p>
                      <p className="text-xs text-yellow-400">
                        Actif jusqu’au{" "}
                        {new Date(subscription.current_period_end).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        .
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {!subscription.cancel_at_period_end && onCancelSubscription ? (
                <button
                  type="button"
                  onClick={onCancelSubscription}
                  disabled={cancellingSubscription}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 font-medium text-red-300 transition-all hover:bg-red-500/20 disabled:opacity-50"
                >
                  {cancellingSubscription ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-300 border-t-transparent" />
                      Annulation…
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Annuler l&apos;abonnement
                    </>
                  )}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="profil-empty">
              <Crown className="mx-auto mb-2 h-8 w-8 text-gray-600" />
              <p className="mb-3">Vous n&apos;avez pas d&apos;abonnement actif</p>
              {openBoutiqueModal ? (
                <button
                  type="button"
                  onClick={() => openBoutiqueModal("subscription")}
                  className="inline-flex items-center gap-2 rounded-md border border-[#2e2840] bg-[#1a1724] px-3 py-1.5 text-sm font-medium text-violet-300 transition-colors hover:bg-[#211c2c]"
                >
                  <Crown className="h-4 w-4" />
                  Voir les abonnements
                </button>
              ) : null}
            </div>
          )}
        </ProfilSection>

        <ProfilSection title="Transactions vidéo" icon={Coins}>
          <ExpandableList
            items={videoTx}
            emptyLabel="Aucune transaction vidéo"
            seeAllLabel={t?.("profile.seeAll") || "Voir tout"}
            seeLessLabel={t?.("profile.seeLess") || "Voir moins"}
            renderItem={(tx) => (
              <div key={tx.id} className="profil-list-row items-start justify-between sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium text-gray-200">
                    {creditReasonLabel(tx.reason)}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                </div>
                <div
                  className={`shrink-0 text-sm font-semibold ${
                    tx.amount > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount}
                </div>
              </div>
            )}
          />
        </ProfilSection>

        <ProfilSection title="Transactions image" icon={ImageIcon} iconClass="text-violet-400">
          {imageStudioHistoryLoading ? (
            <div className="profil-empty">Chargement…</div>
          ) : (
            <>
              {imageCreditTx.length > 0 ? (
                <div className="mb-3">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Crédits image (workflow)
                  </p>
                  <ExpandableList
                    items={imageCreditTx}
                    initial={5}
                    emptyLabel="—"
                    seeAllLabel={t?.("profile.seeAll") || "Voir tout"}
                    seeLessLabel={t?.("profile.seeLess") || "Voir moins"}
                    renderItem={(tx) => (
                      <div
                        key={tx.id}
                        className="profil-list-row items-start justify-between sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium text-gray-200">
                            {creditReasonLabel(tx.reason)}
                          </p>
                          <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                        </div>
                        <div
                          className={`shrink-0 text-sm font-semibold ${
                            tx.amount > 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount}
                        </div>
                      </div>
                    )}
                  />
                </div>
              ) : null}

              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Image Studio (quota mensuel)
              </p>
              <ExpandableList
                items={imageStudioRows}
                emptyLabel="Aucune génération Image Studio"
                seeAllLabel={t?.("profile.seeAll") || "Voir tout"}
                seeLessLabel={t?.("profile.seeLess") || "Voir moins"}
                renderItem={(row) => (
                  <div key={row.id} className="profil-list-row items-start justify-between sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-gray-200">{row.label}</p>
                      <p className="text-xs text-gray-400">{formatDate(row.created_at)}</p>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-red-400">−{row.qty}</div>
                  </div>
                )}
              />
              <p className="mt-2 text-[11px] text-gray-500">
                Chaque ligne correspond à une consommation du quota Image Studio.{" "}
                <Link to="/galerie" className="text-emerald-400/90 hover:text-emerald-300">
                  Voir la galerie
                </Link>
              </p>
            </>
          )}
        </ProfilSection>
      </div>
    </div>
  );
}
