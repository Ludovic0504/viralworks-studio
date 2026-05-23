export default function OptionChips({
  label,
  options,
  value,
  onChange,
  showSwatch = false,
  hideLabelOnMobile = false,
}) {
  const labelHidden = hideLabelOnMobile ? "hidden md:block" : "";

  return (
    <div>
      {label ? (
        <p className={`mb-2 text-sm font-medium text-gray-300 ${labelHidden}`}>{label}</p>
      ) : null}
      <div
        className={`flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2 max-md:gap-2 md:flex md:flex-wrap`}
      >
        {options.map((opt, index) => {
          const active = value === opt.value;
          const isLastOfThree = options.length === 3 && index === 2;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all max-md:w-full max-md:justify-center max-md:rounded-full max-md:py-2.5 max-md:text-sm ${
                isLastOfThree ? "max-md:col-span-2" : ""
              } ${
                active
                  ? "max-md:border-[#2af598] max-md:bg-[rgba(42,245,152,0.1)] max-md:text-[#2af598] bg-emerald-500/20 text-emerald-300 border-emerald-500/50 md:bg-emerald-500/20 md:text-emerald-300 md:border-emerald-500/50"
                  : "max-md:border-[#333] max-md:text-[#aaa] border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200 md:border-white/10 md:text-gray-400"
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
