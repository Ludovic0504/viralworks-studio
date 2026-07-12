import { Turnstile } from "@marsidev/react-turnstile";

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim();

export function isTurnstileEnabled() {
  return SITE_KEY.length > 0;
}

export default function TurnstileWidget({ onToken, onExpire, onError }) {
  if (!isTurnstileEnabled()) return null;

  return (
    <div className="flex justify-center py-1">
      <Turnstile
        siteKey={SITE_KEY}
        onSuccess={(token) => onToken?.(token)}
        onExpire={() => onExpire?.()}
        onError={() => onError?.()}
        options={{
          theme: "dark",
          size: "normal",
        }}
      />
    </div>
  );
}
