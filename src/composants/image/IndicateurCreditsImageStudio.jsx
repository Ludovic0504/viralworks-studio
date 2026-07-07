import { getImageStudioQuotaState } from "@/bibliotheque/imageStudio/quotaAlerts";

const FRAME_CLASS =
  "flex flex-col items-center gap-0.5 rounded-lg border border-white/13 border-b-black/28 bg-white/[0.07] px-2 py-1.5";

const FRAME_STYLE = {
  boxShadow:
    "0 3px 0 rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.09)",
};

const SEGMENT_COUNT = 5;

function fillColorClass(percentage) {
  if (percentage > 60) return "bg-emerald-400";
  if (percentage >= 30) return "bg-yellow-400";
  return "bg-red-400";
}

function SegmentedPhoneBattery({ percentage, loading }) {
  const filledCount = loading
    ? 0
    : Math.min(SEGMENT_COUNT, Math.round((percentage / 100) * SEGMENT_COUNT));
  const fillClass = fillColorClass(percentage);

  return (
    <div className="flex items-center" aria-hidden>
      <div className="rounded-[3px] border border-white/40 bg-[#0a0a0a]/80 p-[1.5px] shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.42)]">
        <div className="flex h-[7px] w-[38px] gap-[1.5px]">
          {Array.from({ length: SEGMENT_COUNT }, (_, index) => {
            const isFilled = !loading && index < filledCount;
            return (
              <div
                key={index}
                className={`min-w-0 flex-1 rounded-[1.5px] transition-all duration-500 ${
                  loading
                    ? "animate-pulse bg-white/15"
                    : isFilled
                      ? fillClass
                      : "bg-white/[0.07]"
                }`}
              />
            );
          })}
        </div>
      </div>
      <div
        className={`ml-0.5 h-[4px] w-[2.5px] shrink-0 rounded-r-[1.5px] border border-l-0 border-white/40 bg-white/32 ${
          loading ? "opacity-50" : ""
        }`}
      />
    </div>
  );
}

export default function IndicateurCreditsImageStudio({ count, limit, loading, mode = "monthly" }) {
  if (loading) {
    return (
      <div
        className={FRAME_CLASS}
        style={FRAME_STYLE}
        aria-busy="true"
        aria-label="Chargement du quota d'images"
      >
        <SegmentedPhoneBattery loading percentage={0} />
        <span className="text-[10px] font-medium tabular-nums text-white/32">—</span>
      </div>
    );
  }

  const totalImages = Math.max(1, limit);
  const usedImages = Math.min(Math.max(0, count), totalImages);
  const imagesLeft = totalImages - usedImages;
  const percentage = Math.round((imagesLeft / totalImages) * 100);

  const state = getImageStudioQuotaState(count, limit);
  const imageWord = imagesLeft > 1 ? "images" : "image";

  const isTrial = mode === "trial";
  const periodLabel = isTrial ? "pendant l'essai" : "ce mois-ci";

  return (
    <div
      className={FRAME_CLASS}
      style={FRAME_STYLE}
      title={`${imagesLeft} ${imageWord} restante${imagesLeft > 1 ? "s" : ""} ${periodLabel}`}
      aria-label={`${state.remaining} images restantes sur ${state.limit}${isTrial ? " (essai)" : ""}`}
    >
      <SegmentedPhoneBattery percentage={percentage} loading={false} />
      <span className="text-[10px] font-medium tabular-nums text-white/42">
        {isTrial ? `${imagesLeft}/${totalImages}` : `${percentage}%`}
      </span>
    </div>
  );
}
