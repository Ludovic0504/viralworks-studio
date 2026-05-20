export default function OptionChips({ label, options, value, onChange, showSwatch = false }) {
  return (
    <div>
      {label ? (
        <p className="mb-2 text-sm font-medium text-gray-300">{label}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                  : "border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
              }`}
            >
              {showSwatch && opt.swatch ? (
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                  style={{ backgroundColor: opt.swatch }}
                  aria-hidden
                />
              ) : null}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
