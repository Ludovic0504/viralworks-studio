import Select from "@/composants/interface/Select";
import StudioFieldCard from "@/composants/studio/avatar/StudioFieldCard";
import { METIERS } from "@/bibliotheque/studio/avatarOptions";

/** Largeur mesurée Apparence/Tenue : 358px (viewport 390px − padding px-4) */
const fieldCardWrapClass =
  "studio-profession-field-card-wrap max-lg:w-full max-lg:max-w-[358px]";

export default function ProfessionPanel({ config, onChange }) {
  return (
    <div
      className="studio-profession-panel-mobile flex w-full min-w-0 flex-col gap-3 max-lg:max-w-[358px] max-lg:gap-3 lg:max-w-none"
    >
      <div className={fieldCardWrapClass}>
        <StudioFieldCard label="Métier">
          <div className="studio-field-metier-select-wrap w-full min-w-0 max-w-full max-lg:overflow-hidden max-lg:[&_label]:hidden">
            <Select
              label="Métier"
              value={config.metier}
              onChange={(e) => onChange({ metier: e.target.value })}
              options={[
                { value: "", label: "Sélectionnez un métier…" },
                ...METIERS.map((m) => ({ value: m.value, label: m.label })),
              ]}
              className="studio-avatar-metier-select min-w-0 max-w-full"
            />
          </div>
        </StudioFieldCard>
      </div>

      <div className={fieldCardWrapClass}>
        <StudioFieldCard label="Accessoires">
          <p className="mb-2 text-sm font-medium text-gray-300 hidden lg:block">Accessoires</p>
          <div className="grid max-lg:grid-cols-2 max-lg:gap-2 lg:flex lg:gap-2">
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
                  className={`inline-flex items-center justify-center rounded-lg border px-4 py-1.5 text-xs font-medium transition-all max-lg:w-full max-lg:rounded-full max-lg:py-2.5 max-lg:text-sm ${
                    active
                      ? "max-lg:border-[#2af598] max-lg:bg-[rgba(42,245,152,0.1)] max-lg:text-[#2af598] bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                      : "max-lg:border-[#333] max-lg:text-[#aaa] border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </StudioFieldCard>
      </div>
    </div>
  );
}
