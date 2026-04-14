export default function PageTitle({ green, white, subtitle }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-extrabold">
        <span className="text-accent/90">{green}</span>
        <span className="text-white"> · {white}</span>
      </h1>

      {subtitle && (
        <p className="mt-2 text-gray-400 text-sm sm:text-base max-w-2xl">
          {subtitle}
        </p>
      )}
    </header>
  );
}
