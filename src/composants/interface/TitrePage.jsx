export default function PageTitle({ green, white, subtitle, titleClassName = "", className = "" }) {
  return (
    <header className={`mb-8 ${className}`.trim()}>
      <h1 className={`text-3xl font-extrabold ${titleClassName}`.trim()}>
        <span className="text-accent/90">{green}</span>
        {white ? <span className="text-white"> · {white}</span> : null}
      </h1>

      {subtitle && (
        <p className="mt-2 text-gray-400 text-sm sm:text-base max-w-2xl">
          {subtitle}
        </p>
      )}
    </header>
  );
}
