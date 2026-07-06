import { resolveQuickReplyOptions } from "@/bibliotheque/community/onboarding";

type QuickReplyButtonsProps = {
  options: string[];
  disabled?: boolean;
  selectedLabel?: string | null;
  onSelect: (label: string) => void;
};

export default function QuickReplyButtons({
  options,
  disabled = false,
  selectedLabel = null,
  onSelect,
}: QuickReplyButtonsProps) {
  if (!options.length) return null;

  const hasSelection = Boolean(selectedLabel);
  const allDisabled = disabled || hasSelection;

  return (
    <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Réponses rapides">
      {options.map((label) => {
        const isSelected = selectedLabel === label;
        return (
          <button
            key={label}
            type="button"
            disabled={allDisabled}
            aria-pressed={isSelected}
            onClick={() => onSelect(label)}
            className={`rounded-md border px-3 py-2 text-xs font-medium shadow-sm transition-colors active:scale-[0.98] disabled:cursor-not-allowed ${
              isSelected
                ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-50"
                : "border-white/25 bg-white/[0.07] text-gray-100 hover:border-white/40 hover:bg-white/[0.12] disabled:opacity-45"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function shouldShowMessageQuickReplies(
  msg: {
    id: string;
    userId: string;
    content?: string;
    quickReplyOptions?: string[];
    quickRepliesClosedAt?: string | null;
    quickReplySelected?: string | null;
    onboardingStep?: number | null;
    isSupport?: boolean;
    isOnboardingAnswer?: boolean;
  },
  messages: Array<{ id: string; userId: string }>,
  myUserId: string,
  viewerOptions?: { viewerIsSupport?: boolean },
): boolean {
  if (viewerOptions?.viewerIsSupport) return false;
  if (msg.isOnboardingAnswer) return false;
  const quickOptions = resolveQuickReplyOptions(msg);
  if (!quickOptions?.length) return false;
  if (msg.userId === myUserId) return false;
  if (msg.quickReplySelected) return true;
  if (msg.quickRepliesClosedAt) return false;

  const msgIndex = messages.findIndex((item) => item.id === msg.id);
  if (msgIndex < 0) return false;

  const hasUserReplyAfter = messages
    .slice(msgIndex + 1)
    .some((item) => item.userId === myUserId);

  return !hasUserReplyAfter;
}
