import { forwardRef } from "react";

/**
 * Input réutilisable avec label et erreur
 */
const Input = forwardRef(function Input({
  label,
  error,
  icon: Icon,
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
      <div className="relative">
        <input
          ref={ref}
          className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all ${
            error ? "border-red-500/50 focus:ring-red-500/50" : "border-white/10"
          } ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
});

export default Input;

