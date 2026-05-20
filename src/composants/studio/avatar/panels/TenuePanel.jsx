import OptionChips from "@/composants/studio/avatar/OptionChips";
import { COULEURS_DOMINANTES, STYLES_TENUE } from "@/bibliotheque/studio/avatarOptions";

export default function TenuePanel({ config, onChange }) {
  return (
    <>
      <OptionChips
        label="Style"
        options={STYLES_TENUE}
        value={config.styleTenue}
        onChange={(v) => onChange({ styleTenue: v })}
      />

      <OptionChips
        label="Couleur dominante"
        options={COULEURS_DOMINANTES}
        value={config.couleurDominante}
        onChange={(v) => onChange({ couleurDominante: v })}
        showSwatch
      />
    </>
  );
}
