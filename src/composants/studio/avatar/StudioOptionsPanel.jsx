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
    <aside className="studio-panel flex h-[560px] shrink-0 flex-col gap-4 p-4 lg:w-72">
      <h2 className="text-sm font-semibold text-emerald-300/90">
        {labels[activeCategory] || "Options"}
      </h2>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto">{children}</div>

      <div className="mt-auto border-t border-white/10 pt-4">
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
