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
      }}
    >
      {children}
    </Link>
  );
}
