import Select from "@/composants/interface/Select";
import StudioFieldCard from "@/composants/studio/avatar/StudioFieldCard";
import { METIERS } from "@/bibliotheque/studio/avatarOptions";

/** Largeur mesurée Apparence/Tenue : 358px (viewport 390px − padding px-4) */
const fieldCardWrapClass =
  "studio-profession-field-card-wrap max-md:w-full max-md:max-w-[358px]";

export default function ProfessionPanel({ config, onChange }) {
  return (
    <div
      className="studio-profession-panel-mobile flex w-full min-w-0 flex-col gap-3 max-md:max-w-[358px] max-md:gap-3 md:max-w-none"
    >
      <div className={fieldCardWrapClass}>
        <StudioFieldCard label="Métier">
          <div className="studio-field-metier-select-wrap w-full min-w-0 max-w-full max-md:overflow-hidden max-md:[&_label]:hidden">
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
          <p className="mb-2 text-sm font-medium text-gray-300 hidden md:block">Accessoires</p>
          <div className="grid max-md:grid-cols-2 max-md:gap-2 md:flex md:gap-2">
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
                  className={`inline-flex items-center justify-center rounded-lg border px-4 py-1.5 text-xs font-medium transition-all max-md:w-full max-md:rounded-full max-md:py-2.5 max-md:text-sm ${
                    active
                      ? "max-md:border-[#2af598] max-md:bg-[rgba(42,245,152,0.1)] max-md:text-[#2af598] bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                      : "max-md:border-[#333] max-md:text-[#aaa] border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
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
