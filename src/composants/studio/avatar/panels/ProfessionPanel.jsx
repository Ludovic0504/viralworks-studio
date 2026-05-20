import Select from "@/composants/interface/Select";
import { METIERS } from "@/bibliotheque/studio/avatarOptions";

export default function ProfessionPanel({ config, onChange }) {
  return (
    <>
      <Select
        label="Métier"
        value={config.metier}
        onChange={(e) => onChange({ metier: e.target.value })}
        options={[
          { value: "", label: "Sélectionnez un métier…" },
          ...METIERS.map((m) => ({ value: m.value, label: m.label })),
        ]}
      />

      <div>
        <p className="mb-2 text-sm font-medium text-gray-300">Accessoires</p>
        <div className="flex gap-2">
          {[
            { value: false, label: "Non" },
            { value: true, label: "Oui" },
          ].map((opt) => {
            const active = config.accessoires === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onChange({ accessoires: opt.value })}
                className={`rounded-lg border px-4 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                    : "border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
