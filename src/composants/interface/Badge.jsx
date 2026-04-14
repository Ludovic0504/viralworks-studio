/**
 * Badge réutilisable avec variantes de couleur
 */
export default function Badge({
  children,
  variant = "default",
  className = "",
  ...props
}) {
  const variants = {
    default: "bg-white/10 border-white/10 text-gray-300",
    success: "bg-emerald-500/20 border-emerald-500/30 text-emerald-300",
    warning: "bg-yellow-500/20 border-yellow-500/30 text-yellow-300",
    danger: "bg-red-500/20 border-red-500/30 text-red-300",
    info: "bg-cyan-500/20 border-cyan-500/30 text-cyan-300",
    violet: "bg-violet-500/20 border-violet-500/30 text-violet-300",
  };
  
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

