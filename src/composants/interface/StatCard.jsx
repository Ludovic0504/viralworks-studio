/**
 * Carte de statistique réutilisable
 */
export default function StatCard({
  icon: Icon,
  value,
  label,
  color = "emerald",
  trend,
  className = "",
}) {
  const colors = {
    emerald: {
      bg: "bg-emerald-500/20",
      border: "border-emerald-500/30",
      text: "text-emerald-400",
    },
    cyan: {
      bg: "bg-cyan-500/20",
      border: "border-cyan-500/30",
      text: "text-cyan-400",
    },
    violet: {
      bg: "bg-violet-500/20",
      border: "border-violet-500/30",
      text: "text-violet-400",
    },
    yellow: {
      bg: "bg-yellow-500/20",
      border: "border-yellow-500/30",
      text: "text-yellow-400",
    },
  };
  
  const colorConfig = colors[color] || colors.emerald;
  
  return (
    <div className={`glass-strong rounded-xl border border-white/10 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 rounded-lg ${colorConfig.bg} ${colorConfig.border} border flex items-center justify-center`}>
          {Icon && <Icon className={`w-5 h-5 ${colorConfig.text}`} />}
        </div>
        {trend && (
          <span className="text-xs text-gray-400">{trend}</span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-200">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}

