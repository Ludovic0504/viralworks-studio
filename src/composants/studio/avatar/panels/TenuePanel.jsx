import OptionChips from "@/composants/studio/avatar/OptionChips";
import StudioFieldCard from "@/composants/studio/avatar/StudioFieldCard";
import { COULEURS_DOMINANTES, STYLES_TENUE } from "@/bibliotheque/studio/avatarOptions";

export default function TenuePanel({ config, onChange }) {
  return (
    <>
      <StudioFieldCard label="Style">
        <OptionChips
          label="Style"
          options={STYLES_TENUE}
          value={config.styleTenue}
          onChange={(v) => onChange({ styleTenue: v })}
          hideLabelOnMobile
        />
      </StudioFieldCard>

      <StudioFieldCard label="Couleur dominante">
        <OptionChips
          label="Couleur dominante"
          options={COULEURS_DOMINANTES}
          value={config.couleurDominante}
          onChange={(v) => onChange({ couleurDominante: v })}
          showSwatch
          hideLabelOnMobile
        />
      </StudioFieldCard>
    </>
  );
}
