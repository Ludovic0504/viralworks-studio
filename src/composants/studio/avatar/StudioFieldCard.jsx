export default function StudioFieldCard({ label, children }) {
  return (
    <div className="w-full min-w-0 max-w-full max-md:space-y-3 max-md:rounded-2xl max-md:bg-[#1c1c2e] max-md:p-5 md:contents">
      {label ? (
        <p className="max-md:text-[11px] max-md:font-semibold max-md:uppercase max-md:tracking-wider max-md:text-[#888] md:hidden">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
}
