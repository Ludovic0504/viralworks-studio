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
    <aside className="studio-panel flex w-full min-w-0 max-w-full max-md:h-auto max-md:shrink max-md:overflow-x-hidden max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none h-[560px] shrink-0 flex-col gap-3 max-md:gap-3 p-4 md:gap-4 lg:w-72">
      <h2 className="hidden text-sm font-semibold text-emerald-300/90 md:block">
        {labels[activeCategory] || "Options"}
      </h2>

      <div className="flex w-full min-w-0 max-w-full max-md:flex-none max-md:overflow-x-hidden flex-1 flex-col gap-3 max-md:gap-3 overflow-y-auto md:gap-4">
        {children}
      </div>

      <div className="mt-auto hidden border-t border-white/10 pt-4 md:block">
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
