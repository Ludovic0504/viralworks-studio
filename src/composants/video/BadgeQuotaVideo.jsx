import { Zap } from "lucide-react";

export default function BadgeQuotaVideo({
  remaining,
  limit,
  loading = false,
  title = "Vidéos restantes ce mois-ci",
}) {
  const exhausted = !loading && limit > 0 && remaining <= 0;

  return (
    <span
      className={`vws-video-quota-pill${exhausted ? " vws-video-quota-pill--exhausted" : ""}`}
      title={title}
    >
      <Zap className="h-3 w-3" strokeWidth={2} aria-hidden />
      {loading ? (
        <span className="tabular-nums">…</span>
      ) : (
        <span className="tabular-nums">
          {remaining} / {limit} vidéo
        </span>
      )}
    </span>
  );
}
