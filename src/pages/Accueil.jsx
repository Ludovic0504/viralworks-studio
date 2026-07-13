import { useMemo, useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import LienNavSync from "@/composants/disposition/LienNavSync";
import AccueilDemoVideo from "@/composants/accueil/AccueilDemoVideo";
import { PROMO_ACQUISITION_IMAGES } from "@/bibliotheque/promo/imagesPromo";

function subscribeMobileMax767(cb) {
  const mq = window.matchMedia("(max-width: 767px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getMobileMax767Snapshot() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function getMobileMax767ServerSnapshot() {
  return true;
}

function blockMediaSave(event) {
  event.preventDefault();
}

function AccueilPromoImageCard({ src, alt, className }) {
  return (
    <div className={className}>
      <img
        src={src}
        alt={alt}
        className="accueil-vcard-media h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </div>
  );
}

export default function Accueil() {
  const isMobileLayout = useSyncExternalStore(
    subscribeMobileMax767,
    getMobileMax767Snapshot,
    getMobileMax767ServerSnapshot
  );

  const demoVideoChantierUrl = (import.meta.env.VITE_DEMO_VIDEO_CHANTIER_URL || "").trim();
  const demoVideoMoteurUrl = (import.meta.env.VITE_DEMO_VIDEO_MOTEUR_URL || "").trim();
  const demoVideoYachtUrl = (import.meta.env.VITE_DEMO_VIDEO_YACHT_URL || "").trim();

  const demoVideos = useMemo(
    () => [
      { src: demoVideoChantierUrl || "/videos/chantier.mp4", label: "Artisan" },
      { src: demoVideoMoteurUrl || "/videos/moteur.mp4", label: "E-commerçant" },
      { src: demoVideoYachtUrl || "/videos/yacht.mp4", label: "UGC" },
    ],
    [demoVideoChantierUrl, demoVideoMoteurUrl, demoVideoYachtUrl]
  );

  const preloadSide = isMobileLayout ? "none" : "metadata";
  const preloadCenter = isMobileLayout ? "metadata" : "auto";

  return (
    <div className="relative flex w-full min-w-0 flex-col">
      <div className="relative z-[1] flex w-full min-w-0 flex-col">
        <section className="accueil-section relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden max-md:pt-[calc(var(--promo-images-banner-height,0px)+2.75rem)] md:justify-center md:pt-[var(--promo-images-banner-height,0px)] pb-12 max-md:pb-10 md:pb-16">
          <div className="accueil-inner relative z-10 mx-auto flex min-h-0 w-full min-w-0 max-w-[1100px] flex-1 flex-col px-6 sm:px-8 md:justify-center md:gap-3 md:px-12 xl:px-16">
            <div className="flex min-h-0 w-full min-w-0 flex-col md:flex-1 md:flex-row md:items-center md:gap-10 md:py-2">
              <div className="relative z-20 w-full min-w-0 shrink-0 text-left max-[580px]:text-center md:flex-[1.1] md:pr-2 xl:pr-6">
                <div className="accueil-fade-up accueil-fade-up-d1 mb-2 inline-flex max-md:mb-1.5 max-[580px]:mx-auto max-[580px]:w-full max-[580px]:justify-center md:mb-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5">
                    <span className="accueil-badge-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[#34d399]" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-emerald-300/90">
                      Vidéos IA · TikTok · Reels · Shorts
                    </span>
                  </div>
                </div>

                <h1 className="accueil-fade-up accueil-fade-up-d2 mb-2 font-black tracking-tight text-white/[0.93] max-md:text-[clamp(24px,7.2vw,32px)] max-md:leading-[0.92] text-[clamp(30px,5.2vw,52px)] leading-[0.9] md:mb-3">
                  <span className="block">Créez des vidéos</span>
                  <span className="block">qui attirent</span>
                  <span className="block bg-gradient-to-br from-[#21f3b9] from-0% via-[#818cf8] via-[42%] to-[#facc15] to-100% bg-clip-text text-transparent">
                    l'attention.
                  </span>
                </h1>

                <p className="accueil-fade-up accueil-fade-up-d3 mb-3 max-w-[440px] max-md:mb-2 max-md:text-[12px] max-md:leading-snug text-sm leading-relaxed text-white/[0.36] max-[580px]:mx-auto md:mb-4">
                  L&apos;outil IA des entrepreneurs qui veulent publier tous les jours sur TikTok, Reels et Shorts —{" "}
                  <strong className="font-medium text-white/[0.58]">sans y passer des heures.</strong>
                </p>

                <div className="accueil-fade-up accueil-fade-up-d4 relative z-20 mb-2 flex flex-wrap items-center gap-2 max-md:mb-1.5 max-md:gap-2 md:mb-3 md:gap-2.5 max-[580px]:justify-center">
                  <LienNavSync
                    to="/viralworks"
                    className="group inline-flex items-center gap-2 rounded-[11px] bg-[#21f3b9] px-5 py-3 text-sm font-extrabold text-[#07090f] shadow-[0_0_28px_rgba(33,243,185,0.26)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_0_44px_rgba(33,243,185,0.42)] max-md:px-4 max-md:py-2.5 max-md:text-[13px]"
                  >
                    <span>Créer ma vidéo</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </LienNavSync>
                  <LienNavSync
                    to="/lab"
                    className="relative z-20 inline-flex items-center rounded-[11px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] font-semibold text-white/35 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/60 max-md:px-3.5 max-md:py-2.5 max-md:text-xs"
                  >
                    Voir les nouveautés
                  </LienNavSync>
                </div>

                <div className="accueil-fade-up accueil-fade-up-d4 mb-2 flex flex-wrap items-center gap-2 text-[10px] font-medium text-white/25 max-md:mb-0 max-[580px]:justify-center md:mb-0 md:gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[#21f3b9]">✓</span> Sans abonnement caché
                  </span>
                  <span className="hidden h-2.5 w-px bg-white/10 sm:block" aria-hidden />
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[#21f3b9]">✓</span> Prêt en 60 secondes
                  </span>
                  <span className="hidden h-2.5 w-px bg-white/10 sm:block" aria-hidden />
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[#21f3b9]">✓</span> Qualité pro
                  </span>
                </div>
              </div>
              <div
                className="accueil-videos-slot accueil-fade-up accueil-fade-up-d5 pointer-events-none flex w-full min-h-0 min-w-0 max-md:-mt-28 max-md:shrink-0 max-md:items-center max-md:justify-center max-md:overflow-hidden md:mt-0 md:flex-1 md:items-center md:justify-end"
                onContextMenu={blockMediaSave}
              >
                <div className="accueil-hero-videos-shift w-full">
                <div className="accueil-videos-frame relative mx-auto aspect-[260/340] w-auto max-w-full shrink-0 overflow-hidden md:h-[clamp(200px,min(34dvh,38vh),440px)] md:max-w-[min(96vw,400px)] md:overflow-visible">
                  <div
                    className="pointer-events-none absolute left-1/2 z-[2] -translate-x-1/2 rounded-full bg-[rgba(33,243,185,0.08)] blur-[clamp(18px,4vw,28px)] max-md:blur-[14px]"
                    style={{
                      bottom: "-2.35%",
                      width: "50%",
                      height: "64.7%",
                    }}
                    aria-hidden
                  />
                  {demoVideos[0] ? (
                    <AccueilDemoVideo
                      src={demoVideos[0].src}
                      preload={preloadSide}
                      label={demoVideos[0].label}
                      className="accueil-vcard accueil-vcard-l group absolute z-[1] h-[45.882%] w-[33.846%] overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
                    />
                  ) : null}
                  {demoVideos[1] ? (
                    <AccueilDemoVideo
                      src={demoVideos[1].src}
                      preload={preloadCenter}
                      label={demoVideos[1].label}
                      className="accueil-vcard accueil-vcard-c group absolute bottom-0 z-[3] h-[57.647%] w-[42.308%] overflow-hidden rounded-2xl border border-[rgba(33,243,185,0.13)] shadow-[0_24px_65px_rgba(0,0,0,0.75)]"
                    />
                  ) : null}
                  {demoVideos[2] ? (
                    <AccueilDemoVideo
                      src={demoVideos[2].src}
                      preload={preloadSide}
                      label={demoVideos[2].label}
                      className="accueil-vcard accueil-vcard-r group absolute z-[1] h-[45.882%] w-[33.846%] overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
                    />
                  ) : null}
                </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div
        className="relative z-[1] px-6 sm:px-8 md:px-12 xl:px-16"
        aria-hidden
      >
        <div className="mx-auto h-px w-full max-w-[1100px] bg-white/[0.08]" />
      </div>

      <section
        className="accueil-image-promo-section relative z-[1] py-12 sm:py-14"
        aria-labelledby="accueil-image-promo-title"
      >
        <div className="accueil-inner relative z-10 mx-auto flex min-h-0 w-full min-w-0 max-w-[1100px] flex-1 flex-col px-6 sm:px-8 md:justify-center md:gap-3 md:px-12 xl:px-16">
          <div className="accueil-promo-grid flex min-h-0 w-full min-w-0 flex-col gap-8 sm:gap-10 md:py-2">
            <div className="accueil-fade-up accueil-fade-up-d3 accueil-promo-images-slot pointer-events-none flex w-full min-h-0 min-w-0 shrink-0 max-md:items-center max-md:justify-center max-md:overflow-hidden md:items-center md:justify-start">
              <div className="accueil-promo-images-shift w-full">
              <div className="accueil-videos-frame relative mx-auto aspect-[260/340] w-auto max-w-full shrink-0 overflow-hidden md:mx-0 md:h-[clamp(200px,min(34dvh,38vh),440px)] md:max-w-[min(96vw,400px)] md:overflow-visible">
                <div
                  className="pointer-events-none absolute left-1/2 z-[2] -translate-x-1/2 rounded-full bg-[rgba(33,243,185,0.08)] blur-[clamp(18px,4vw,28px)] max-md:blur-[14px]"
                  style={{
                    bottom: "-2.35%",
                    width: "50%",
                    height: "64.7%",
                  }}
                  aria-hidden
                />
                {PROMO_ACQUISITION_IMAGES[0] ? (
                  <AccueilPromoImageCard
                    src={PROMO_ACQUISITION_IMAGES[0].src}
                    alt={PROMO_ACQUISITION_IMAGES[0].alt}
                    className="accueil-vcard accueil-vcard-l group absolute z-[1] h-[45.882%] w-[33.846%] overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
                  />
                ) : null}
                {PROMO_ACQUISITION_IMAGES[1] ? (
                  <AccueilPromoImageCard
                    src={PROMO_ACQUISITION_IMAGES[1].src}
                    alt={PROMO_ACQUISITION_IMAGES[1].alt}
                    className="accueil-vcard accueil-vcard-c group absolute bottom-0 z-[3] h-[57.647%] w-[42.308%] overflow-hidden rounded-2xl border border-[rgba(33,243,185,0.13)] shadow-[0_24px_65px_rgba(0,0,0,0.75)]"
                  />
                ) : null}
                {PROMO_ACQUISITION_IMAGES[2] ? (
                  <AccueilPromoImageCard
                    src={PROMO_ACQUISITION_IMAGES[2].src}
                    alt={PROMO_ACQUISITION_IMAGES[2].alt}
                    className="accueil-vcard accueil-vcard-r group absolute z-[1] h-[45.882%] w-[33.846%] overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
                  />
                ) : null}
              </div>
              </div>
            </div>

            <div className="flex w-full min-w-0 flex-col justify-center self-center text-left">
              <h2
                id="accueil-image-promo-title"
                className="accueil-fade-up accueil-fade-up-d1 mb-3 text-left font-black tracking-tight text-white/[0.93] text-[clamp(22px,4.5vw,36px)] leading-[1.05] md:mb-4"
              >
                Génère des visuels produits avec NanaBanana Pro
              </h2>
              <p className="accueil-fade-up accueil-fade-up-d2 mb-8 max-w-[560px] text-left text-sm leading-relaxed text-white/[0.36] sm:mb-10 sm:text-[15px] md:mb-8">
                7 jours gratuits — 30 images offertes, puis 150 / mois. E-commerce, UGC, artisans.
              </p>

              <div className="accueil-fade-up accueil-fade-up-d4 flex justify-start">
                <LienNavSync
                  to="/image-studio"
                  className="group inline-flex items-center gap-2 rounded-[11px] bg-[#21f3b9] px-5 py-3 text-sm font-extrabold text-[#07090f] shadow-[0_0_28px_rgba(33,243,185,0.26)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_0_44px_rgba(33,243,185,0.42)] max-md:px-4 max-md:py-2.5 max-md:text-[13px]"
                >
                  <span>Démarrer l&apos;essai gratuit →</span>
                </LienNavSync>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes accueilFadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes accueilBadgePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .accueil-fade-up {
          opacity: 0;
          transform: translateY(16px);
          animation: accueilFadeUp 0.7s ease forwards;
        }
        .accueil-fade-up-d1 { animation-delay: 0.05s; }
        .accueil-fade-up-d2 { animation-delay: 0.18s; }
        .accueil-fade-up-d3 { animation-delay: 0.32s; }
        .accueil-fade-up-d4 { animation-delay: 0.46s; }
        .accueil-fade-up-d5 { animation-delay: 0.58s; }
        .accueil-badge-dot {
          animation: accueilBadgePulse 2s ease-in-out infinite;
        }
        .accueil-vcard {
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s ease;
        }
        .accueil-vcard:hover {
          border-color: rgba(255, 255, 255, 0.2);
        }
        .accueil-demo-video,
        .accueil-demo-video-source {
          -webkit-user-drag: none;
          user-select: none;
          pointer-events: none;
        }
        .accueil-demo-video-source {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          overflow: hidden;
          clip: rect(0 0 0 0);
          clip-path: inset(50%);
          white-space: nowrap;
        }
        .accueil-vcard-media {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          -webkit-user-drag: none;
          user-select: none;
          pointer-events: none;
        }
        .accueil-vcard-l {
          bottom: 8.235%;
          left: 1.538%;
          transform: rotate(-5deg) scale(0.87) translateX(-6px);
        }
        .accueil-vcard-l:hover {
          transform: rotate(-3deg) scale(0.9) translateX(-6px);
        }
        .accueil-vcard-c {
          left: 50%;
          bottom: 0;
          transform: translateX(-50%);
        }
        .accueil-vcard-c:hover {
          transform: translateX(-50%) translateY(-5px) scale(1.03);
        }
        .accueil-vcard-r {
          bottom: 8.235%;
          right: 1.538%;
          transform: rotate(5deg) scale(0.87) translateX(6px);
        }
        .accueil-vcard-r:hover {
          transform: rotate(3deg) scale(0.9) translateX(6px);
        }
        @media (min-width: 768px) {
          .accueil-promo-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4rem;
            align-items: center;
          }
          .accueil-hero-videos-shift,
          .accueil-promo-images-shift {
            transform: translateY(-5rem);
          }
        }
        @media (max-width: 767px) {
          .accueil-videos-slot {
            width: 100%;
          }
          .accueil-videos-frame {
            height: clamp(280px, min(50lvh, 520px), 560px);
          }
          .accueil-image-promo-section {
            padding-top: 0.5rem;
          }
          .accueil-promo-images-slot {
            margin-top: -2.75rem;
          }
          .accueil-promo-images-shift {
            transform: translateY(-4.25rem);
          }
          .accueil-vcard-l {
            transform: rotate(-5deg) scale(0.87) translateX(-2px);
          }
          .accueil-vcard-l:hover {
            transform: rotate(-3deg) scale(0.9) translateX(-2px);
          }
          .accueil-vcard-r {
            transform: rotate(5deg) scale(0.87) translateX(2px);
          }
          .accueil-vcard-r:hover {
            transform: rotate(3deg) scale(0.9) translateX(2px);
          }
        }
      `}</style>
    </div>
  );
}
