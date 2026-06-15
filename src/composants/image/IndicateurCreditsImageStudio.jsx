import { getImageStudioQuotaState } from "@/bibliotheque/imageStudio/quotaAlerts";

function batteryTone(remainingPercent) {
  if (remainingPercent <= 10) return "critical";
  if (remainingPercent <= 30) return "low";
  return "ok";
}

export default function IndicateurCreditsImageStudio({ count, limit, loading }) {
  if (loading) {
    return (
      <div
        className="image-studio-credits-pill image-studio-credits-pill--loading"
        aria-busy="true"
        aria-label="Chargement des crédits"
      >
        <span className="image-studio-credits-pill-dot" />
      </div>
    );
  }

  const state = getImageStudioQuotaState(count, limit);
  const tone = batteryTone(state.remainingPercent);

  return (
    <div
      className={`image-studio-credits-pill image-studio-credits-pill--${tone}`}
      title={`${state.remaining} crédit${state.remaining > 1 ? "s" : ""} restant${state.remaining > 1 ? "s" : ""} ce mois-ci`}
      aria-label={`${state.remaining} crédits image restants sur ${state.limit}`}
    >
      <span className="image-studio-credits-battery" aria-hidden>
        <span
          className="image-studio-credits-battery-fill"
          style={{ width: `${state.remainingPercent}%` }}
        />
      </span>
      <span className="image-studio-credits-pill-text">
        {state.remaining}
        <span className="image-studio-credits-pill-muted"> / {state.limit}</span>
      </span>
    </div>
  );
}
