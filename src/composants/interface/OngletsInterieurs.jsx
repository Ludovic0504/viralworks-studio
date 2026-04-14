export default function InnerTabs({ tabs, active, onChange }) {
  return (
    <div className="flex overflow-x-auto gap-2 border-b pb-1">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 rounded-t-xl font-medium shrink-0
            ${active === t.id ? "bg-white border border-b-0" : "text-gray-500 hover:text-black"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
