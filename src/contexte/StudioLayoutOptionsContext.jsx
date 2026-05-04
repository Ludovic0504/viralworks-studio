import { createContext, useCallback, useContext, useMemo, useState } from "react";

const StudioLayoutOptionsContext = createContext({
  setStudioLayout: () => {},
  hideGlobalFooterOnMobile: false,
});

export function StudioLayoutOptionsProvider({ children }) {
  const [hideGlobalFooterOnMobile, setHide] = useState(false);
  const setStudioLayout = useCallback((opts) => {
    if (opts == null) {
      setHide(false);
      return;
    }
    if (typeof opts.hideGlobalFooterOnMobile === "boolean") {
      setHide(opts.hideGlobalFooterOnMobile);
    }
  }, []);
  const value = useMemo(
    () => ({ setStudioLayout, hideGlobalFooterOnMobile }),
    [setStudioLayout, hideGlobalFooterOnMobile]
  );
  return (
    <StudioLayoutOptionsContext.Provider value={value}>{children}</StudioLayoutOptionsContext.Provider>
  );
}

export function useStudioLayoutOptions() {
  return useContext(StudioLayoutOptionsContext);
}
