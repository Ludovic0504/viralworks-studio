const MIRROR_PROPERTIES = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "whiteSpace",
  "wordBreak",
  "wordWrap",
] as const;

export function getTextareaCaretClientRect(
  textarea: HTMLTextAreaElement,
  caretIndex: number,
): DOMRect | null {
  if (typeof document === "undefined") return null;

  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = style.whiteSpace === "break-spaces" ? "pre-wrap" : style.whiteSpace;
  mirror.style.wordWrap = style.wordWrap;
  mirror.style.overflow = "hidden";

  for (const prop of MIRROR_PROPERTIES) {
    mirror.style[prop] = style[prop];
  }

  const value = textarea.value.slice(0, caretIndex);
  mirror.textContent = value;

  const marker = document.createElement("span");
  marker.textContent = textarea.value.slice(caretIndex) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  const textareaRect = textarea.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  document.body.removeChild(mirror);

  const left = textareaRect.left + (markerRect.left - mirrorRect.left) - textarea.scrollLeft;
  const top = textareaRect.top + (markerRect.top - mirrorRect.top) - textarea.scrollTop;

  return new DOMRect(left, top, 0, parseFloat(style.lineHeight) || 20);
}
