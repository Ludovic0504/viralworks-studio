/**
 * Carte réutilisable avec effet glass
 */
export default function Card({
  children,
  className = "",
  hover = false,
  padding = true,
  ...props
}) {
  return (
    <div
      className={`glass-strong rounded-xl border border-white/10 transition-all ${
        hover ? "hover:border-white/20 hover:bg-white/5" : ""
      } ${padding ? "p-6" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

