type PrivateMessagePreviewBubbleProps = {
  senderName: string;
  preview: string;
  isSupport?: boolean;
  onOpen: () => void;
};

export default function PrivateMessagePreviewBubble({
  senderName,
  preview,
  isSupport = false,
  onOpen,
}: PrivateMessagePreviewBubbleProps) {
  const displayName = isSupport ? "Support" : senderName;
  const shortPreview =
    preview.length > 56 ? `${preview.slice(0, 56).trim()}…` : preview;

  return (
    <div
      className="private-message-preview-bubble absolute right-0 top-[calc(100%+0.35rem)] z-[70] w-[min(13rem,calc(100vw-3rem))]"
      role="status"
      aria-live="polite"
      style={{ animation: "private-preview-in 280ms ease-out" }}
    >
      <div className="relative rounded-xl border border-cyan-400/40 bg-[#0c1424]/95 px-2.5 py-2 shadow-lg shadow-black/40 backdrop-blur-md">
        <span
          className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-cyan-400/40 bg-[#0c1424]/95"
          aria-hidden
        />
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <p className="truncate text-xs font-medium text-cyan-100">{displayName}</p>
          <p className="mt-0.5 truncate text-[11px] text-gray-400">{shortPreview}</p>
        </button>
      </div>
    </div>
  );
}
