export default function OptionChips({
  label,
  options,
  value,
  onChange,
  showSwatch = false,
  hideLabelOnMobile = false,
}) {
  const labelHidden = hideLabelOnMobile ? "hidden lg:block" : "";

  return (
    <div>
      {label ? (
        <p className={`mb-2 text-sm font-medium text-gray-300 ${labelHidden}`}>{label}</p>
      ) : null}
      <div
        className={`flex flex-wrap gap-2 max-lg:grid max-lg:grid-cols-2 max-lg:gap-2 lg:flex lg:flex-wrap`}
      >
        {options.map((opt, index) => {
          const active = value === opt.value;
          const isLastOfThree = options.length === 3 && index === 2;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all max-lg:w-full max-lg:justify-center max-lg:rounded-full max-lg:py-2.5 max-lg:text-sm ${
                isLastOfThree ? "max-lg:col-span-2" : ""
              } ${
                active
                  ? "max-lg:border-[#2af598] max-lg:bg-[rgba(42,245,152,0.1)] max-lg:text-[#2af598] bg-emerald-500/20 text-emerald-300 border-emerald-500/50 lg:bg-emerald-500/20 lg:text-emerald-300 lg:border-emerald-500/50"
                  : "max-lg:border-[#333] max-lg:text-[#aaa] border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200 lg:border-white/10 lg:text-gray-400"
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
