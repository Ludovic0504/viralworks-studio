import { useMemo, useSyncExternalStore } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexte/FournisseurAuth";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import LienNavSync from "@/composants/disposition/LienNavSync";

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

export default function Accueil() {
  const { session } = useAuth();
  const { openAuthModal } = useRequireAuthAction();
  const hasSession = Boolean(session?.user?.id);

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
      { src: demoVideoChantierUrl || "/videos/chantier.mp4", label: "Chantier · Architecte" },
      { src: demoVideoMoteurUrl || "/videos/moteur.mp4", label: "Assemblage · Moteur" },
      { src: demoVideoYachtUrl || "/videos/yacht.mp4", label: "Yacht · Pub" },
    ],
    [demoVideoChantierUrl, demoVideoMoteurUrl, demoVideoYachtUrl]
  );

  const preloadSide = isMobileLayout ? "none" : "metadata";
  const preloadCenter = isMobileLayout ? "metadata" : "auto";

  return (
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-[#07090f] md:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0">
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

      <div className="relative z-[1] flex min-h-0 w-full min-w-0 flex-1 flex-col max-md:min-h-[min(100%,calc(100svh-4rem))] max-md:overflow-x-hidden md:overflow-hidden">
        <section className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col items-center max-md:justify-start max-md:overflow-x-hidden md:justify-center md:overflow-hidden">
          <div className="relative z-10 mx-auto flex w-full min-w-0 max-w-[1100px] flex-col items-center gap-3 px-6 sm:px-8 md:gap-4 md:px-12 xl:px-16">
            <div className="flex min-h-0 w-full min-w-0 flex-col items-center gap-0 md:flex-row md:items-center md:gap-12">
              <div className="w-full min-w-0 flex-[1.1] max-md:flex-none text-left max-[580px]:text-center md:pr-2 xl:pr-6">
                <div className="accueil-fade-up accueil-fade-up-d1 mb-3 inline-flex max-md:mb-2 max-[580px]:mx-auto max-[580px]:w-full max-[580px]:justify-center md:mb-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5">
                    <span className="accueil-badge-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[#34d399]" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-emerald-300/90">
                      Vidéos IA · TikTok · Reels · Shorts
                    </span>
                  </div>
                </div>

                <h1 className="accueil-fade-up accueil-fade-up-d2 mb-3 font-black tracking-tight text-white/[0.93] max-md:text-[clamp(26px,8vw,34px)] max-md:leading-[0.92] text-[clamp(34px,6vw,58px)] leading-[0.9] md:mb-4">
                  <span className="block">Créez des vidéos</span>
                  <span className="block">qui attirent</span>
                  <span className="block bg-gradient-to-br from-[#21f3b9] from-0% via-[#818cf8] via-[42%] to-[#facc15] to-100% bg-clip-text text-transparent">
                    l'attention.
                  </span>
                </h1>

                <p className="accueil-fade-up accueil-fade-up-d3 mb-4 max-w-[440px] max-md:mb-3 max-md:text-[13px] max-md:leading-snug text-sm leading-relaxed text-white/[0.36] max-[580px]:mx-auto md:mb-5">
                  L&apos;outil IA des entrepreneurs qui veulent publier tous les jours sur TikTok, Reels et Shorts —{" "}
                  <strong className="font-medium text-white/[0.58]">sans y passer des heures.</strong>
                </p>

                <div className="accueil-fade-up accueil-fade-up-d4 mb-3 flex flex-wrap items-center gap-2 max-md:mb-2 max-md:gap-2 md:mb-4 md:gap-2.5 max-[580px]:justify-center">
                  {session ? (
                    <LienNavSync
                      to="/viralworks"
                      className="group inline-flex items-center gap-2 rounded-[11px] bg-[#21f3b9] px-6 py-3.5 text-sm font-extrabold text-[#07090f] shadow-[0_0_28px_rgba(33,243,185,0.26)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_0_44px_rgba(33,243,185,0.42)]"
                    >
                      <span>Créer ma vidéo</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </LienNavSync>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openAuthModal?.()}
                      className="group inline-flex items-center gap-2 rounded-[11px] bg-[#21f3b9] px-6 py-3.5 text-sm font-extrabold text-[#07090f] shadow-[0_0_28px_rgba(33,243,185,0.26)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_0_44px_rgba(33,243,185,0.42)]"
                    >
                      <span>Se connecter</span>
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </button>
                  )}
                  <LienNavSync
                    to="/lab"
                    className="inline-flex items-center rounded-[11px] border border-white/[0.08] bg-white/[0.03] px-[18px] py-3.5 text-[13px] font-semibold text-white/35 transition-all duration-200 hover:bg-white/[0.06] hover:text-white/60"
                  >
                    Voir les nouveautés
                  </LienNavSync>
                </div>

                <div className="accueil-fade-up accueil-fade-up-d4 mb-2 flex flex-wrap items-center gap-2 text-[10px] font-medium text-white/25 max-md:-mb-2 max-[580px]:justify-center md:mb-0 md:gap-3">
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

              <div className="accueil-fade-up accueil-fade-up-d5 flex w-full min-w-0 max-md:-mt-10 max-md:flex-none max-md:items-center max-md:justify-start max-md:py-0 max-md:overflow-hidden md:mt-0 md:flex-1 md:items-center md:justify-end">
                <div className="relative mx-auto aspect-[260/340] max-md:h-[clamp(280px,min(50lvh,520px),560px)] w-auto max-w-full shrink-0 overflow-hidden md:h-[clamp(240px,min(48vw,44vh),520px)] md:max-w-[min(96vw,440px)] md:overflow-visible">
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
                    <div
                      className="accueil-vcard accueil-vcard-l group absolute z-[1] h-[45.882%] w-[33.846%] overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
                    >
                      <video
                        src={demoVideos[0].src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload={preloadSide}
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 text-center text-[8px] font-bold uppercase tracking-widest text-white/45">
                        {demoVideos[0].label}
                      </div>
                    </div>
                  ) : null}
                  {demoVideos[1] ? (
                    <div
                      className="accueil-vcard accueil-vcard-c group absolute bottom-0 z-[3] h-[57.647%] w-[42.308%] overflow-hidden rounded-2xl border border-[rgba(33,243,185,0.13)] shadow-[0_24px_65px_rgba(0,0,0,0.75)]"
                    >
                      <video
                        src={demoVideos[1].src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload={preloadCenter}
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 text-center text-[8px] font-bold uppercase tracking-widest text-white/45">
                        {demoVideos[1].label}
                      </div>
                    </div>
                  ) : null}
                  {demoVideos[2] ? (
                    <div
                      className="accueil-vcard accueil-vcard-r group absolute z-[1] h-[45.882%] w-[33.846%] overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
                    >
                      <video
                        src={demoVideos[2].src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload={preloadSide}
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-8 text-center text-[8px] font-bold uppercase tracking-widest text-white/45">
                        {demoVideos[2].label}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="relative z-[1] mx-auto flex w-full shrink-0 items-center gap-3.5 pb-4 pt-1 max-md:mt-7 max-md:pt-3 md:mt-0 md:pt-1">
              <div
                className="div-line-accueil-l h-px max-w-[90px] flex-1"
                style={{
                  background: "linear-gradient(to right, transparent, rgba(255,255,255,0.1))",
                }}
              />
              <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em] text-white/15">
                Propulsé par l&apos;IA générative
              </span>
              <div
                className="div-line-accueil-r h-px max-w-[90px] flex-1"
                style={{
                  background: "linear-gradient(to left, transparent, rgba(255,255,255,0.1))",
                }}
              />
            </div>
          </div>
        </section>
      </div>

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
        @media (max-width: 767px) {
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
