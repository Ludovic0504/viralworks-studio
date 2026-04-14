import { forwardRef } from "react";

/**
 * Select réutilisable avec label et erreur
 */
const Select = forwardRef(function Select({
  label,
  error,
  icon: Icon,
  options = [],
  className = "",
  ...props
}, ref) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all ${
          error ? "border-red-500/50 focus:ring-red-500/50" : "border-white/10"
        } ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-[#0C1116]"
          >
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
});

export default Select;

