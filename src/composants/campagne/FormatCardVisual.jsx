import { useEffect, useState } from "react";
import { getCachedPexelsMediumUrl, hasPexelsApiKey } from "@/bibliotheque/pexelsFormatImages";
import { FormatCardVisualSvg } from "./FormatCardVisualSvg.jsx";

/**
 * Zone visuelle carte format : photo Pexels (medium) ou illustration SVG de secours.
 */
export default function FormatCardVisual({ formatId, categoryId, pexelsQuery, pexelsPhotoIndex = 0 }) {
  const query = (pexelsQuery || "").trim();
  const photoIdx = Math.max(0, Math.floor(Number(pexelsPhotoIndex) || 0));
  const [photoUrl, setPhotoUrl] = useState(null);
  const [showSvg, setShowSvg] = useState(() => !query || !hasPexelsApiKey());

  useEffect(() => {
    let alive = true;

    if (!query || !hasPexelsApiKey()) {
      setPhotoUrl(null);
      setShowSvg(true);
      return undefined;
    }

    setShowSvg(false);
    setPhotoUrl(null);

    void getCachedPexelsMediumUrl(query, photoIdx).then((url) => {
      if (!alive) return;
      if (url) setPhotoUrl(url);
      else setShowSvg(true);
    });

    return () => {
      alive = false;
    };
  }, [query, photoIdx]);

  const loading = hasPexelsApiKey() && query && !photoUrl && !showSvg;

  return (
    <div className="relative aspect-square w-full max-h-[104px] overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#141414]">
      {loading ? (
        <div className="absolute inset-0 bg-[#1a1a1a]" aria-hidden />
      ) : null}

      {photoUrl && !showSvg ? (
        <>
          <img
            src={photoUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => {
              setPhotoUrl(null);
              setShowSvg(true);
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[20%] bg-gradient-to-t from-black/80 via-black/35 to-transparent"
            aria-hidden
          />
        </>
      ) : null}

      {showSvg ? (
        <div className="relative z-[1] h-full w-full">
          <FormatCardVisualSvg formatId={formatId} categoryId={categoryId} />
        </div>
      ) : null}
    </div>
  );
}
