export default function StudioFieldCard({ label, children }) {
  return (
    <div className="w-full min-w-0 max-w-full max-lg:space-y-3 max-lg:rounded-2xl max-lg:bg-[#1c1c2e] max-lg:p-5 lg:contents">
      {label ? (
        <p className="max-lg:text-[11px] max-lg:font-semibold max-lg:uppercase max-lg:tracking-wider max-lg:text-[#888] lg:hidden">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}
