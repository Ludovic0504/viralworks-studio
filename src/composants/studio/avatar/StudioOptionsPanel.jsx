import Button from "@/composants/interface/Bouton";

export default function StudioOptionsPanel({
  activeCategory,
  children,
  onGenerateFace,
  onSubscriptionRequired,
  hasActiveSubscription = false,
  subscriptionLoading = false,
  canGenerateFace,
  generatingFace,
}) {
  const handleGenerateClick = () => {
    if (subscriptionLoading) return;
    if (!hasActiveSubscription) {
      onSubscriptionRequired?.();
      return;
    }
    onGenerateFace?.();
  };
  const labels = {
    apparence: "Apparence",
    tenue: "Tenue",
    profession: "Profession",
  };

  return (
    <aside className="studio-panel flex w-full min-w-0 max-w-full max-lg:h-auto max-lg:shrink max-lg:overflow-x-hidden max-lg:border-0 max-lg:bg-transparent max-lg:p-0 max-lg:shadow-none h-[560px] shrink-0 flex-col gap-3 max-lg:gap-3 p-4 lg:gap-4 lg:w-72">
      <h2 className="hidden text-sm font-semibold text-emerald-300/90 lg:block">
        {labels[activeCategory] || "Options"}
      </h2>

      <div className="flex w-full min-w-0 max-w-full max-lg:flex-none max-lg:overflow-x-hidden flex-1 flex-col gap-3 max-lg:gap-3 overflow-y-auto lg:gap-4">
        {children}
      </div>

      <div className="mt-auto hidden border-t border-white/10 pt-4 lg:block">
        <Button
          variant="primary"
          onClick={handleGenerateClick}
          disabled={!canGenerateFace || subscriptionLoading}
          loading={generatingFace}
          className="w-full"
        >
          Générer mon avatar
        </Button>
      </div>
    </aside>
  );
}
