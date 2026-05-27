import Button from "@/composants/interface/Bouton";

export default function StudioOptionsPanel({
  activeCategory,
  children,
  onGenerate,
  onSubscriptionRequired,
  hasActiveSubscription = false,
  subscriptionLoading = false,
  canGenerate,
  generating,
}) {
  const handleGenerateClick = () => {
    if (subscriptionLoading) return;
    if (!hasActiveSubscription) {
      onSubscriptionRequired?.();
      return;
    }
    onGenerate?.();
  };
  const labels = {
    apparence: "Apparence",
    tenue: "Tenue",
    profession: "Profession",
  };

  return (
    <aside className="studio-panel flex h-full min-h-0 w-full min-w-0 max-w-full max-lg:h-auto max-lg:shrink max-lg:overflow-x-hidden max-lg:border-0 max-lg:bg-transparent max-lg:p-0 max-lg:shadow-none shrink-0 flex-col gap-3 max-lg:gap-3 p-4 lg:gap-4 lg:w-72">
      <h2 className="hidden text-sm font-semibold text-emerald-300/90 lg:block">
        {labels[activeCategory] || "Options"}
      </h2>

      <div className="flex w-full min-w-0 max-w-full max-lg:flex-none max-lg:overflow-visible flex-1 flex-col gap-3 max-lg:gap-3 lg:overflow-y-auto lg:gap-4">
        {children}
      </div>

      <div className="mt-auto hidden border-t border-white/10 pt-4 lg:block">
        <Button
          variant="primary"
          onClick={handleGenerateClick}
          disabled={!canGenerate || subscriptionLoading}
          loading={generating}
          className="w-full"
        >
          Générer mon avatar
        </Button>
      </div>
    </aside>
  );
}
