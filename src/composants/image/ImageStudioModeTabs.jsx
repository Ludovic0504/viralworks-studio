export default function ImageStudioModeTabs({ activeTab, onChange, t }) {
  return (
    <div className="image-studio-mode-tabs" role="tablist" aria-label={t("imageStudio.tabsAria")}>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "generation"}
        className={`image-studio-mode-tab${activeTab === "generation" ? " is-active" : ""}`}
        onClick={() => onChange("generation")}
      >
        {t("imageStudio.tabGeneration")}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "projects"}
        className={`image-studio-mode-tab${activeTab === "projects" ? " is-active" : ""}`}
        onClick={() => onChange("projects")}
      >
        {t("imageStudio.tabProjects")}
      </button>
    </div>
  );
}
