/**
 * Composant d'onglets réutilisable
 */
export default function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = "",
}) {
  return (
    <div className={`glass-strong inline-flex rounded-lg overflow-hidden border border-white/10 p-1 ${className}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.value;
        
        return (
          <button
            key={tab.value}
            onClick={() => onChange?.(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 rounded-md ${
              isActive
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

