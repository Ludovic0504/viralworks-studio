import { AVATAR_CATEGORIES } from "@/bibliotheque/studio/avatarOptions";

export default function StudioCategoryTabs({ activeCategory, onCategoryChange }) {
  return (
    <nav
      className="studio-tabs-scroll lg:hidden sticky top-0 z-20 -mx-4 px-4 py-2 backdrop-blur-md bg-[#050810]/80"
      aria-label="Sections de personnalisation"
    >
      <div className="flex gap-4 overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        {AVATAR_CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              aria-current={active ? "true" : undefined}
              className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-all ${
                active
                  ? "bg-[rgba(42,245,152,0.12)] text-[#2af598]"
                  : "bg-transparent text-[#888]"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
