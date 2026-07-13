import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Upload } from "lucide-react";
import {
  filterMentionOptions,
  getMentionAssetAvailability,
  PROMPT_MENTION_OPTIONS,
  splitPromptForMentionHighlight,
} from "@/bibliotheque/imageStudio/promptMentions";
import { getTextareaCaretClientRect } from "@/bibliotheque/imageStudio/textareaCaret";
import {
  detectPromptAssistSlash,
  stripPromptAssistSlash,
} from "@/bibliotheque/imageStudio/promptAssistSlash";

const MENTION_MENU_GAP_PX = 6;

function detectMentionQuery(value, caretIndex) {
  const before = value.slice(0, caretIndex);
  const match = before.match(/@(\w*)$/);
  if (!match) return null;
  return {
    query: match[1] ?? "",
    replaceStart: caretIndex - match[0].length,
  };
}

export default function ImageStudioPromptInput({
  value,
  onChange,
  onSubmit,
  disabled,
  inputRef,
  assets,
  onOpenAvatarPicker,
  onOpenProductPicker,
  onOpenImage1Upload,
  onOpenPromptAssist,
  onResize,
}) {
  const mentionMenuRef = useRef(null);
  const promptAssistChipRef = useRef(null);
  const highlightRef = useRef(null);
  const [mentionState, setMentionState] = useState(null);
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const [menuStyle, setMenuStyle] = useState(null);
  const [promptAssistChipStyle, setPromptAssistChipStyle] = useState(null);
  const [promptAssistSlash, setPromptAssistSlash] = useState(null);

  const availability = useMemo(() => getMentionAssetAvailability(assets), [assets]);

  const highlightParts = useMemo(
    () => splitPromptForMentionHighlight(value, assets),
    [value, assets],
  );

  const syncHighlightScroll = useCallback(() => {
    const input = inputRef.current;
    const highlight = highlightRef.current;
    if (!input || !highlight) return;
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  }, [inputRef]);

  const filteredOptions = useMemo(() => {
    if (!mentionState) return [];
    return filterMentionOptions(mentionState.query);
  }, [mentionState]);

  const syncMentionMenu = useCallback(() => {
    const el = inputRef.current;
    if (!el) {
      setMentionState(null);
      setPromptAssistSlash(null);
      return;
    }

    const caret = el.selectionStart ?? el.value.length;
    const next = detectMentionQuery(el.value, caret);
    setMentionState(next);
    setMentionHighlight(0);
    setPromptAssistSlash(next ? null : detectPromptAssistSlash(el.value, caret));
  }, [inputRef]);

  useLayoutEffect(() => {
    if (!mentionState || filteredOptions.length === 0) {
      setMenuStyle(null);
      return;
    }

    const el = inputRef.current;
    if (!el) return;

    const caretRect = getTextareaCaretClientRect(el, mentionState.replaceStart);
    if (!caretRect) return;

    const menuWidth = mentionMenuRef.current?.offsetWidth ?? 220;
    const viewportPadding = 12;
    let left = caretRect.left;
    const maxLeft = window.innerWidth - menuWidth - viewportPadding;
    left = Math.min(Math.max(viewportPadding, left), Math.max(viewportPadding, maxLeft));

    setMenuStyle({
      position: "fixed",
      left: `${left}px`,
      top: `${Math.max(viewportPadding, caretRect.top - MENTION_MENU_GAP_PX)}px`,
      transform: "translateY(-100%)",
      zIndex: 220,
    });
  }, [mentionState, filteredOptions.length, value, inputRef]);

  const syncPromptAssistChipPosition = useCallback(() => {
    if (!promptAssistSlash) {
      setPromptAssistChipStyle(null);
      return;
    }

    const el = inputRef.current;
    if (!el) return;

    const startRect = getTextareaCaretClientRect(el, promptAssistSlash.replaceStart);
    const endRect = getTextareaCaretClientRect(el, promptAssistSlash.replaceEnd);
    if (!startRect || !endRect) return;

    const chipWidth = promptAssistChipRef.current?.offsetWidth ?? 120;
    const viewportPadding = 12;
    const halfWidth = chipWidth / 2;
    const commandCenterX = (startRect.left + endRect.left) / 2;
    const clampedCenterX = Math.min(
      Math.max(viewportPadding + halfWidth, commandCenterX),
      window.innerWidth - viewportPadding - halfWidth,
    );

    setPromptAssistChipStyle({
      position: "fixed",
      left: `${clampedCenterX}px`,
      top: `${Math.max(viewportPadding, startRect.top - 4)}px`,
      transform: "translate(-50%, -100%)",
      zIndex: 220,
    });
  }, [inputRef, promptAssistSlash]);

  useLayoutEffect(() => {
    syncPromptAssistChipPosition();
    if (!promptAssistSlash) return undefined;

    const frame = window.requestAnimationFrame(() => {
      syncPromptAssistChipPosition();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [syncPromptAssistChipPosition, value, promptAssistSlash]);

  useEffect(() => {
    const onDown = (event) => {
      const inInput = inputRef.current?.contains(event.target);
      const inMenu = mentionMenuRef.current?.contains(event.target);
      const inPromptAssistChip = promptAssistChipRef.current?.contains(event.target);

      if (mentionState && !inMenu && !inInput) {
        setMentionState(null);
      }
      if (promptAssistSlash && !inPromptAssistChip && !inInput) {
        setPromptAssistSlash(null);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [mentionState, promptAssistSlash, inputRef]);

  const openPromptAssist = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    const caret = el.selectionStart ?? value.length;
    const slashMatch = detectPromptAssistSlash(value, caret) ?? promptAssistSlash;
    if (slashMatch) {
      const nextValue = stripPromptAssistSlash(value, slashMatch);
      onChange(nextValue);
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(slashMatch.replaceStart, slashMatch.replaceStart);
        onResize?.();
      });
    }

    setPromptAssistSlash(null);
    setMentionState(null);
    onOpenPromptAssist?.();
  }, [inputRef, onChange, onOpenPromptAssist, onResize, promptAssistSlash, value]);

  const insertMentionToken = useCallback(
    (token, replaceState = mentionState) => {
      const el = inputRef.current;
      if (!el) return;

      const caret = el.selectionStart ?? value.length;
      const replaceStart = replaceState?.replaceStart ?? caret;
      const nextValue = `${value.slice(0, replaceStart)}${token} ${value.slice(caret)}`;
      onChange(nextValue);

      const nextCaret = replaceStart + token.length + 1;
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
        setMentionState(null);
        onResize?.();
      });
    },
    [inputRef, mentionState, onChange, onResize, value],
  );

  const insertMentionAtCursor = useCallback(
    (token) => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const caret =
        document.activeElement === el
          ? (el.selectionStart ?? value.length)
          : value.length;
      const nextValue = `${value.slice(0, caret)}${token} ${value.slice(caret)}`;
      onChange(nextValue);
      const nextCaret = caret + token.length + 1;
      window.requestAnimationFrame(() => {
        el.setSelectionRange(nextCaret, nextCaret);
        onResize?.();
      });
    },
    [inputRef, onChange, onResize, value],
  );

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.insertMentionAtCursor = insertMentionAtCursor;
    return () => {
      if (inputRef.current) {
        delete inputRef.current.insertMentionAtCursor;
      }
    };
  }, [inputRef, insertMentionAtCursor]);

  useEffect(() => {
    syncHighlightScroll();
  }, [value, highlightParts, syncHighlightScroll]);

  const handleMentionPick = useCallback(
    (option) => {
      const isAvailable = availability[option.kind];
      if (!isAvailable) {
        setMentionState(null);
        if (option.kind === "Avatar") onOpenAvatarPicker?.();
        else if (option.kind === "Produit") onOpenProductPicker?.();
        else onOpenImage1Upload?.();
        return;
      }
      insertMentionToken(option.token);
    },
    [
      availability,
      insertMentionToken,
      onOpenAvatarPicker,
      onOpenImage1Upload,
      onOpenProductPicker,
    ],
  );

  const handleChange = (event) => {
    onChange(event.target.value);
    window.requestAnimationFrame(() => {
      syncMentionMenu();
      syncHighlightScroll();
    });
  };

  const handleScroll = () => {
    syncHighlightScroll();
    syncPromptAssistChipPosition();
  };

  const handleSelect = () => {
    syncMentionMenu();
  };

  const handleKeyDown = (event) => {
    if (promptAssistSlash && onOpenPromptAssist) {
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        openPromptAssist();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setPromptAssistSlash(null);
        return;
      }
    }

    if (mentionState && filteredOptions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionHighlight((current) => (current + 1) % filteredOptions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionHighlight(
          (current) => (current - 1 + filteredOptions.length) % filteredOptions.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        handleMentionPick(filteredOptions[mentionHighlight] ?? filteredOptions[0]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionState(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit?.();
    }
  };

  const showMentionMenu = Boolean(mentionState && filteredOptions.length > 0);
  const showPromptAssistChip = Boolean(promptAssistSlash && onOpenPromptAssist);

  const mentionMenu = showMentionMenu ? (
    <div
      ref={mentionMenuRef}
      className="image-studio-mention-menu"
      style={menuStyle ?? undefined}
      role="listbox"
      aria-label="Mentions disponibles"
    >
      {filteredOptions.map((option, index) => {
        const isAvailable = availability[option.kind];
        const isHighlighted = index === mentionHighlight;
        return (
          <button
            key={option.kind}
            type="button"
            role="option"
            aria-selected={isHighlighted}
            className={`image-studio-mention-option${isHighlighted ? " is-highlighted" : ""}${isAvailable ? "" : " is-unavailable"}`}
            onMouseDown={(event) => {
              event.preventDefault();
              handleMentionPick(option);
            }}
          >
            <span className="image-studio-mention-option-copy">
              <span className="image-studio-mention-option-label">{option.token}</span>
              <span className="image-studio-mention-option-desc">
                {isAvailable ? option.description : "Cliquer pour sélectionner ou importer"}
              </span>
            </span>
          </button>
        );
      })}

      {!availability.Image1 ? (
        <button
          type="button"
          className="image-studio-mention-upload"
          onMouseDown={(event) => {
            event.preventDefault();
            setMentionState(null);
            onOpenImage1Upload?.();
          }}
        >
          <Upload className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          <span>Importer une image (@Image1)</span>
        </button>
      ) : null}
    </div>
  ) : null;

  const promptAssistChip = showPromptAssistChip ? (
    <div
      ref={promptAssistChipRef}
      className="image-studio-prompt-assist-chip-bar"
      style={promptAssistChipStyle ?? undefined}
      role="listbox"
      aria-label="Commandes disponibles"
    >
      <button
        type="button"
        role="option"
        aria-selected="true"
        className="image-studio-prompt-assist-chip"
        onMouseDown={(event) => {
          event.preventDefault();
          openPromptAssist();
        }}
      >
        PromptAssists
      </button>
    </div>
  ) : null;

  return (
    <>
      <div className="image-studio-prompt-input-wrap min-w-0 flex-1">
        <div
          ref={highlightRef}
          className="image-studio-prompt-highlight py-1 leading-relaxed"
          aria-hidden="true"
        >
          {highlightParts.map((part, index) => {
            if (part.type === "mention" && part.resolved) {
              return (
                <span key={`${index}-${part.value}`} className="image-studio-prompt-mention is-resolved">
                  {part.value}
                </span>
              );
            }
            if (part.type === "mention") {
              return (
                <span key={`${index}-${part.value}`} className="image-studio-prompt-mention is-unresolved">
                  {part.value}
                </span>
              );
            }
            return <span key={`${index}-text`}>{part.value}</span>;
          })}
        </div>

        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onSelect={handleSelect}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onClick={syncMentionMenu}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Décrivez l'image à générer… (tapez @ pour mentionner)"
          aria-label="Prompt de génération"
          rows={1}
          className="image-studio-prompt-input image-studio-prompt-input--overlay min-w-0 flex-1 resize-none py-1 leading-relaxed disabled:opacity-50"
        />
      </div>

      {mentionMenu && menuStyle ? createPortal(mentionMenu, document.body) : null}
      {promptAssistChip && promptAssistChipStyle
        ? createPortal(promptAssistChip, document.body)
        : null}
    </>
  );
}

export function insertPromptMentionAtCursor(inputRef, token) {
  inputRef.current?.insertMentionAtCursor?.(token);
}

export { PROMPT_MENTION_OPTIONS };
