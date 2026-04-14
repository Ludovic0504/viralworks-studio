import { Loader2 } from "lucide-react";

/**
 * Bouton réutilisable avec variantes
 */
export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  onClick,
  type = "button",
  className = "",
  icon: Icon,
  ...props
}) {
  const baseClasses = "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white hover:from-emerald-400 hover:to-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95",
    secondary: "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20 active:scale-95",
    danger: "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 hover:border-red-500/50 active:scale-95",
    ghost: "text-gray-400 hover:text-gray-200 hover:bg-white/5 active:scale-95",
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
    </button>
  );
}

