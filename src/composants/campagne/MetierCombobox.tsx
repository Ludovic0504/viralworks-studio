import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { METIERS_CATEGORIES } from "@/bibliotheque/metiersCategories";
import { getIntentFromSecteur } from "@/bibliotheque/sectorDefaults";
import { capturePostHog } from "@/bibliotheque/posthog/client";
import { updateUserProfile } from "@/bibliotheque/supabase/profil";
import { useProfilStudio } from "@/contexte/FournisseurProfilStudio";

export interface MetierComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-describedby"?: string;
}

function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function itemMatchesQuery(label: string, query: string): boolean {
  return normalizeSearch(label).includes(query);
}

export default function MetierCombobox({
  value,
  onChange,
  placeholder = "Rechercher un métier…",
  id: idProp,
  className = "",
  "aria-describedby": ariaDescribedBy,
}: MetierComboboxProps) {
  const { profile, refreshProfile } = useProfilStudio();
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const listboxId = `${inputId}-listbox`;

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedQuery = normalizeSearch(query);
  const canOpen = normalizedQuery.length >= 1;

  const filteredGroups = useMemo(() => {
    if (!canOpen) return [];
    return METIERS_CATEGORIES.map((category) => {
      const categoryMatch = itemMatchesQuery(category.label, normalizedQuery);
      const items = category.items.filter(
        (label) => categoryMatch || itemMatchesQuery(label, normalizedQuery)
      );
      return { ...category, items };
    }).filter((g) => g.items.length > 0);
  }, [canOpen, normalizedQuery]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const selectLabel = useCallback(
    (label: string) => {
      onChange(label);
      if (profile?.user_intent == null) {
        const intent = getIntentFromSecteur(label);
        void updateUserProfile({ user_intent: intent }).then((res) => {
          if (res.success) void refreshProfile();
        });
        capturePostHog("intent_selected", {
          intent,
          source: "first_metier",
        });
      }
      close();
      inputRef.current?.blur();
    },
    [onChange, close, profile?.user_intent, refreshProfile]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  const displayValue = open ? query : value;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setQuery(next);
    setOpen(normalizeSearch(next).length >= 1);
    if (!next) onChange("");
  };

  const handleFocus = () => {
    if (value && !query) {
      setQuery(value);
      setOpen(normalizeSearch(value).length >= 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && canOpen && filteredGroups.length > 0;

  return (
    <div ref={rootRef} className={`vws-metier-combobox ${className}`.trim()}>
      <div className="vws-metier-combobox__input-wrap">
        <Search
          className="vws-metier-combobox__icon"
          size={18}
          strokeWidth={2}
          aria-hidden
        />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-autocomplete="list"
          aria-describedby={ariaDescribedBy}
          className="vws-campagne-field vws-campagne-field--touch vws-metier-combobox__input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>

      {showDropdown ? (
        <div className="vws-metier-combobox__dropdown" role="presentation">
          <ul id={listboxId} role="listbox" className="vws-metier-combobox__list">
            {filteredGroups.map((group) => (
              <li key={group.id} role="presentation" className="vws-metier-combobox__group">
                <div className="vws-metier-combobox__group-label" role="presentation">
                  {group.label}
                </div>
                <ul role="group" aria-label={group.label} className="vws-metier-combobox__options">
                  {group.items.map((label) => (
                    <li key={label} role="option" aria-selected={value === label}>
                      <button
                        type="button"
                        className={`vws-metier-combobox__option${
                          value === label ? " vws-metier-combobox__option--selected" : ""
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectLabel(label)}
                      >
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
