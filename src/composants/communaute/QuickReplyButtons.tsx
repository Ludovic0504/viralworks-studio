import { useEffect, useState } from "react";
import { resolveQuickReplyOptions } from "@/bibliotheque/community/onboarding";

type QuickReplyButtonsProps = {
  options: string[];
  disabled?: boolean;
  selectedLabel?: string | null;
  onSelect: (label: string) => boolean | void;
};

export default function QuickReplyButtons({
  options,
  disabled = false,
  selectedLabel = null,
  onSelect,
}: QuickReplyButtonsProps) {
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const effectiveSelected = selectedLabel || pendingLabel;

  useEffect(() => {
    if (selectedLabel) setPendingLabel(null);
  }, [selectedLabel]);

  useEffect(() => {
    if (!selectedLabel) setPendingLabel(null);
  }, [options, disabled, selectedLabel]);

  if (!options.length) return null;

  const hasSelection = Boolean(effectiveSelected);
  const isLocked = disabled || hasSelection;

  return (
    <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Réponses rapides">
      {options.map((label) => {
        const isSelected = effectiveSelected === label;
        return (
          <button
            key={label}
            type="button"
            disabled={disabled && !isSelected}
            aria-pressed={isSelected}
            aria-disabled={isLocked && !isSelected}
            onClick={() => {
              if (isLocked) return;
              const accepted = onSelect(label);
              if (accepted !== false) {
                setPendingLabel(label);
              }
            }}
            className={`rounded-md border px-3 py-2 text-xs font-medium shadow-sm transition-[transform,box-shadow] duration-150 active:scale-[0.98] ${
              isSelected
                ? "border-cyan-400 bg-cyan-500 text-white shadow-cyan-500/25 cursor-default"
                : isLocked
                  ? "border-white/15 bg-white/[0.04] text-gray-400 opacity-50 cursor-default pointer-events-none"
                  : "border-white/25 bg-white/[0.07] text-gray-100 hover:border-white/40 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-45"
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
