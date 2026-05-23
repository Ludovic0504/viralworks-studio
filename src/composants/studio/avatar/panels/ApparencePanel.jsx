import OptionChips from "@/composants/studio/avatar/OptionChips";
import StudioFieldCard from "@/composants/studio/avatar/StudioFieldCard";
import { CARNATIONS, GENRES, MORPHOLOGIES } from "@/bibliotheque/studio/avatarOptions";

export default function ApparencePanel({ config, onChange }) {
  return (
    <>
      <StudioFieldCard label="Genre">
        <OptionChips
          label="Genre"
          options={GENRES}
          value={config.genre}
          onChange={(v) => onChange({ genre: v })}
          hideLabelOnMobile
        />
      </StudioFieldCard>

      <StudioFieldCard label="Morphologie">
        <OptionChips
          label="Morphologie"
          options={MORPHOLOGIES}
          value={config.morphologie}
          onChange={(v) => onChange({ morphologie: v })}
          hideLabelOnMobile
        />
      </StudioFieldCard>

      <StudioFieldCard label="Âge">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="avatar-age"
              className="text-sm font-medium text-gray-300 hidden lg:block"
            >
              Âge
            </label>
            <span className="text-sm font-semibold text-emerald-300 max-lg:ml-auto lg:ml-0">
              {config.age} ans
            </span>
          </div>
          <input
            id="avatar-age"
            type="range"
            min={20}
            max={65}
            step={1}
            value={config.age}
            onChange={(e) => onChange({ age: Number(e.target.value) })}
            onDragStart={(e) => e.preventDefault()}
            className="avatar-age-range w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-gray-500">
            <span>20</span>
            <span>65</span>
          </div>
        </div>
      </StudioFieldCard>

      <StudioFieldCard label="Carnation">
        <OptionChips
          label="Carnation"
          options={CARNATIONS}
          value={config.carnation}
          onChange={(v) => onChange({ carnation: v })}
          hideLabelOnMobile
        />
      </StudioFieldCard>
    </>
  );
}
