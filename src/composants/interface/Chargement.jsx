/**
 * Composant de chargement réutilisable
 */
export default function Loading({
  size = "md",
  text,
  fullScreen = false,
  className = "",
}) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };
  
  const spinner = (
    <div className={`${fullScreen ? "min-h-screen flex items-center justify-center" : "flex items-center justify-center"} ${className}`}>
      <div className="text-center">
        <div className={`${sizes[size]} border-2 border-white/10 border-t-emerald-500/50 rounded-full animate-spin mx-auto`} />
        {text && (
          <p className="mt-4 text-sm text-gray-400">{text}</p>
        )}
      </div>
    </div>
  );
  
  return spinner;
}

