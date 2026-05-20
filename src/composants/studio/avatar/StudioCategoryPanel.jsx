import ApparencePanel from "@/composants/studio/avatar/panels/ApparencePanel";
import TenuePanel from "@/composants/studio/avatar/panels/TenuePanel";
import ProfessionPanel from "@/composants/studio/avatar/panels/ProfessionPanel";

const PANELS = {
  apparence: ApparencePanel,
  tenue: TenuePanel,
  profession: ProfessionPanel,
};

export default function StudioCategoryPanel({ activeCategory, config, onChange }) {
  const Panel = PANELS[activeCategory];
  if (!Panel) return null;
  return <Panel config={config} onChange={onChange} />;
}
