import { Link } from "react-router-dom";

function skipClientNavigation(e) {
  if (e.defaultPrevented) return true;
  if (e.button !== 0) return true;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return true;
  return false;
}

/** Lien de navigation unifié utilisé dans tout le layout. */
export default function LienNavSync({ to, children, className, onClick, ...rest }) {
  return (
    <Link
      to={to}
      className={className}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (skipClientNavigation(e)) return;
        if (e.currentTarget.getAttribute("target") === "_blank") return;
        // #region agent log
        fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'770227'},body:JSON.stringify({sessionId:'770227',runId:'run1',hypothesisId:'H1',location:'src/composants/disposition/LienNavSync.jsx:24',message:'nav_link_click_intercepted',data:{to,currentPath:window.location.pathname,defaultPrevented:e.defaultPrevented},timestamp:Date.now()})}).catch(()=>{});
        console.warn("[DBG H25] nav_click", {
          to,
          currentPath: window.location.pathname,
          defaultPrevented: e.defaultPrevented,
        });
        // #endregion
        // #region agent log
        fetch('http://127.0.0.1:7405/ingest/84f2a250-0990-480e-ba92-160ff926a4b7',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'770227'},body:JSON.stringify({sessionId:'770227',runId:'run1',hypothesisId:'H8',location:'src/composants/disposition/LienNavSync.jsx:28',message:'nav_browser_native_follow',data:{to,currentPathBeforeNativeNav:window.location.pathname},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }}
    >
      {children}
    </Link>
  );
}
