import { AVATAR_CATEGORIES } from "@/bibliotheque/studio/avatarOptions";

export default function StudioCategorySidebar({ activeCategory, onCategoryChange }) {
  return (
    <aside className="studio-panel flex h-fit shrink-0 flex-col gap-1 self-start p-3 lg:w-48">
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-white/40">
        Personnalisation
      </h2>
      {AVATAR_CATEGORIES.map((cat) => {
        const active = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all ${
              active
                ? "card-vws-active text-emerald-300"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </aside>
  );
}
