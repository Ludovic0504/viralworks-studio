import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useState } from "react";

/**
 * Message d'alerte réutilisable
 */
export default function Message({
  type = "info",
  children,
  onClose,
  className = "",
}) {
  const [visible, setVisible] = useState(true);
  
  if (!visible) return null;
  
  const types = {
    success: {
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      text: "text-emerald-300",
      icon: CheckCircle2,
    },
    error: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-300",
      icon: AlertCircle,
    },
    warning: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      text: "text-yellow-300",
      icon: AlertTriangle,
    },
    info: {
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      text: "text-cyan-300",
      icon: Info,
    },
  };
  
  const config = types[type] || types.info;
  const Icon = config.icon;
  
  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };
  
  return (
    <div
      className={`${config.bg} ${config.border} border rounded-lg p-4 ${config.text} text-sm flex items-start gap-3 ${className}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">{children}</div>
      {onClose && (
        <button
          onClick={handleClose}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

