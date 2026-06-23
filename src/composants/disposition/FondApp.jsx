export default function FondApp({ fixed = false, className = "" }) {
  const positionClass = fixed ? "fixed" : "absolute";

  return (
    <div
      className={`pointer-events-none inset-0 z-0 ${positionClass} ${className}`}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-[#07090f]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.042) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />
      <div
        className="absolute -top-20 left-[25%] hidden h-[420px] w-[420px] rounded-full opacity-100 md:block"
        style={{
          background: "rgba(33,243,185,0.055)",
          filter: "blur(100px)",
        }}
      />
      <div
        className="absolute top-[15%] -right-[60px] hidden h-[340px] w-[340px] rounded-full opacity-100 md:block"
        style={{
          background: "rgba(129,140,248,0.07)",
          filter: "blur(90px)",
        }}
      />
    </div>
  );
}
