import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { anthropicMessages } from "@/bibliotheque/anthropic/anthropicMessages";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import "./VideoViraleExplicationSheet.css";

const TAB_LABELS = ["Aperçu", "Les champs", "La génération", "Questions IA"];

const QUICK_QUESTIONS = [
  "Quelle différence entre 8s et 24s ?",
  "Pourquoi mon visuel d'accroche n'apparaît pas ?",
  "Je peux changer le script technique sans casser la vidéo ?",
  "Quelle différence entre VEO3 et Kling ?",
];

/**
 * Bottom sheet « Explication du système » — Étape 3 Vidéo virale.
 * CSS scopé sous `.vvv-ex-host`.
 */
export default function VideoViraleExplicationSheet({ open, onClose }) {
  const { runWithAuth } = useRequireAuthAction();
  const overlayRef = useRef(null);
  const pbRef = useRef(null);
  const ciRef = useRef(null);
  const loadingRef = useRef(false);
  const currentPageRef = useRef(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [previewFormat, setPreviewFormat] = useState(8);
  const [threadMessages, setThreadMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hiddenQuick, setHiddenQuick] = useState(() => new Set());
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false
  );

  const SYS = useMemo(
    () => `Tu es l'assistant intégré de ViralWorks Studio.

L'utilisateur est sur l'Étape 3 – Vidéo virale. Contenu de l'onglet :

DEUX FORMATS :
- Vidéo 8s : 1 moment, 1 clip généré, pas d'assemblage FFmpeg.
- Vidéo 24s (parcours studio 3 scènes) : 3 moments Début / Transformation / Résultat — pipeline diagnostic en 6 étapes numérotées dans l'UI : (1) Génération Veo 8 s… (2) Extraction de la dernière image… (3) Préparation image initiale (segment 2)… puis Génération Veo 8 s (segment 2)… (4) Extraction de la dernière image (segment 2)… (5) Préparation image initiale (segment 3)… puis Génération Veo 8 s (segment 3)… (6) Assemblage des trois clips (FFmpeg)…
- Si durée 24s sans les 3 scènes studio, l'app peut n'enchaîner que 2 étapes (1 clip 8s + extraction) — moins que le parcours complet.

CHAMPS :
1. Sources : « Ce que montre la scène » (texte depuis la campagne) + visuel d'accroche étape 2 ; en 24s le hook image est surtout sur le moment Début. Option « Utiliser ma propre image ».
2. Format vidéo : souvent déduit du visuel (ex. vertical 9:16).
3. Durée : 8s ou 24s.
4. Dialogue : activable ; voix off générée si activé.
5. Options avancées : durée, format, dialogue, script technique (prompts Veo par moment, modifiables).
6. Moteur : VEO3 par défaut ; « Réglages avancés — moteur de génération » en bas de page (VEO3 / Kling quand disponible).
7. Historique / panneau latéral : générations VEO3 passées.

APRÈS GÉNÉRATION : « Générer une nouvelle version » ou « Faire une autre vidéo ».

Réponds en français, concis, max 2-3 phrases.`,
    []
  );

  const showChatFooter = !isMobileViewport || currentPage === 3;

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const scrollPbTop = useCallback(() => {
    const el = pbRef.current;
    if (el) el.scrollTop = 0;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    scrollPbTop();
  }, [open, scrollPbTop]);

  useEffect(() => {
    if (!open) return;
    const t0 = window.setTimeout(scrollPbTop, 0);
    const t1 = window.setTimeout(scrollPbTop, 100);
    const t2 = window.setTimeout(scrollPbTop, 400);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, scrollPbTop]);

  const goPage = useCallback((n) => {
    currentPageRef.current = n;
    setCurrentPage(n);
    requestAnimationFrame(() => {
      if (pbRef.current) pbRef.current.scrollTop = 0;
    });
    if (n === 3) {
      requestAnimationFrame(() => ciRef.current?.focus());
    }
  }, []);

  const handleBackdrop = useCallback(
    (e) => {
      if (e.target === overlayRef.current) onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      currentPageRef.current = 0;
      setCurrentPage(0);
      setPreviewFormat(8);
      setThreadMessages([]);
      setHiddenQuick(new Set());
      setLoading(false);
      loadingRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || currentPage !== 3) return;
    const el = pbRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [threadMessages, loading, open, currentPage]);

  const aResize = useCallback((el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, []);

  const handleChatSend = useCallback(async () => {
    if (loadingRef.current) return;
    const txt = ciRef.current?.value?.trim() ?? "";
    if (!txt) return;

    if (currentPageRef.current !== 3) {
      goPage(3);
    }

    const inp = ciRef.current;
    if (inp) {
      inp.value = "";
      inp.style.height = "auto";
    }

    let messagesForApi = null;
    setThreadMessages((prev) => {
      messagesForApi = [...prev, { role: "user", content: txt }];
      return messagesForApi;
    });

    setLoading(true);
    loadingRef.current = true;
    try {
      const reply = await anthropicMessages({
        system: SYS,
        messages: messagesForApi,
        max_tokens: 1000,
        model: "claude-sonnet-4-20250514",
      });
      const text = reply || "Réessaie dans un instant.";
      setThreadMessages((prev) => [...prev, { role: "assistant", content: text }]);
    } catch {
      setThreadMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Une erreur est survenue. Vérifie ta connexion ou reconnecte-toi.",
        },
      ]);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      requestAnimationFrame(() => ciRef.current?.focus());
    }
  }, [SYS, goPage]);

  const send = useCallback(() => {
    void runWithAuth(handleChatSend);
  }, [runWithAuth, handleChatSend]);

  const onCiKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send]
  );

  const askQ = useCallback(
    (text) => {
      setHiddenQuick((prev) => new Set(prev).add(text));
      goPage(3);
      requestAnimationFrame(() => {
        if (ciRef.current) {
          ciRef.current.value = text;
          aResize(ciRef.current);
        }
        void runWithAuth(handleChatSend);
      });
    },
    [aResize, goPage, runWithAuth, handleChatSend]
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="vvv-ex-host">
      <div
        ref={overlayRef}
        className={`overlay${open ? " open" : ""}`}
        onClick={handleBackdrop}
        role="presentation"
      >
        <div
          className="panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vvv-ex-heading"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ph">
            <div className="ph-left">
              <div className="step-pill">
                <div className="step-n">3</div>
                Vidéo virale
              </div>
              <div>
                <div id="vvv-ex-heading" className="ph-title">
                  Comment ça marche
                </div>
                <div className="ph-sub">Étape 3 sur 3</div>
              </div>
            </div>
            <button type="button" className="x" onClick={onClose} aria-label="Fermer">
              ×
            </button>
          </div>

          <div className="tabs">
            {TAB_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                className={`tab${currentPage === i ? " on" : ""}`}
                onClick={() => goPage(i)}
              >
                {label}
              </button>
            ))}
          </div>

          <div ref={pbRef} className="pb">
            {/* PAGE 0 */}
            <div className={`page${currentPage === 0 ? " on" : ""}`}>
              <div className="hero">
                <div className="hero-eye">Étape 3 sur 3</div>
                <div className="hero-title">
                  L&apos;IA génère ta vidéo <em>clip par clip</em>.
                </div>
                <div className="hero-body">
                  Tout ce que tu as configuré dans les étapes 1 et 2 est utilisé ici. Tu choisis la durée, tu lances la
                  génération, et ViralWorks assemble ta vidéo finale automatiquement quand tu es en 24s (3 moments).
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>
                  Deux formats disponibles dans cet onglet
                </div>
                <div className="format-toggle">
                  <button
                    type="button"
                    className={`ft-opt${previewFormat === 8 ? " on" : ""}`}
                    onClick={() => setPreviewFormat(8)}
                  >
                    Vidéo 8s — 1 moment
                  </button>
                  <button
                    type="button"
                    className={`ft-opt${previewFormat === 24 ? " on" : ""}`}
                    onClick={() => setPreviewFormat(24)}
                  >
                    Vidéo 24s — 3 moments
                  </button>
                </div>
              </div>

              {previewFormat === 8 ? (
                <div className="field-list">
                  <div className="fl-item">
                    <div className="fl-ico p">
                      <svg viewBox="0 0 24 24">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" />
                      </svg>
                    </div>
                    <div className="fl-text">
                      <div className="fl-name">1 moment unique</div>
                      <div className="fl-desc">1 clip de 8s généré directement depuis ta scène</div>
                    </div>
                    <div className="fl-badge key">Simple</div>
                  </div>
                  <div className="fl-item">
                    <div className="fl-ico a">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div className="fl-text">
                      <div className="fl-name">Visuel d&apos;accroche</div>
                      <div className="fl-desc">L&apos;image de l&apos;étape 2 utilisée comme première frame</div>
                    </div>
                    <div className="fl-badge auto">Auto</div>
                  </div>
                  <div className="fl-item">
                    <div className="fl-ico t">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="fl-text">
                      <div className="fl-name">Format déduit automatiquement</div>
                      <div className="fl-desc">Vertical 9:16 si visuel TikTok, sinon vertical par défaut</div>
                    </div>
                    <div className="fl-badge auto">Auto</div>
                  </div>
                  <div className="fl-item">
                    <div className="fl-ico g">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                    </div>
                    <div className="fl-text">
                      <div className="fl-name">Modèle VEO3</div>
                      <div className="fl-desc">Génération vidéo IA — moteur modifiable dans les réglages avancés</div>
                    </div>
                    <div className="fl-badge opt">Expert</div>
                  </div>
                </div>
              ) : (
                <div className="field-list">
                  <div className="fl-item">
                    <div className="fl-ico p">
                      <svg viewBox="0 0 24 24">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" />
                      </svg>
                    </div>
                    <div className="fl-text">
                      <div className="fl-name">3 moments enchaînés</div>
                      <div className="fl-desc">Début · Transformation · Résultat — chacun devient un clip 8s</div>
                    </div>
                    <div className="fl-badge key">Structure</div>
                  </div>
                  <div className="fl-item" style={{ borderTop: "1px solid rgba(167,139,250,.12)" }}>
                    <div className="fl-ico a">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                    <div className="fl-text">
                      <div className="fl-name">Visuel d&apos;accroche sur le Début</div>
                      <div className="fl-desc">L&apos;image étape 2 n&apos;est attachée qu&apos;au premier moment</div>
                    </div>
                    <div className="fl-badge auto">Auto</div>
                  </div>
                  <div className="fl-item">
                    <div className="fl-ico t">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="fl-text">
                      <div className="fl-name">Format déduit automatiquement</div>
                      <div className="fl-desc">Vertical 9:16 depuis le visuel d&apos;accroche ou par défaut</div>
                    </div>
                    <div className="fl-badge auto">Auto</div>
                  </div>
                  <div className="fl-item">
                    <div className="fl-ico b">
                      <svg viewBox="0 0 24 24">
                        <polyline points="4 17 10 11 4 5" />
                        <line x1="12" y1="19" x2="20" y2="19" />
                      </svg>
                    </div>
                    <div className="fl-text">
                      <div className="fl-name">Assemblage FFmpeg</div>
                      <div className="fl-desc">Les 3 clips sont assemblés automatiquement en ~24s</div>
                    </div>
                    <div className="fl-badge auto">Auto</div>
                  </div>
                </div>
              )}

              <div className="nav">
                <span className="nav-ind">1 / 4</span>
                <button type="button" className="btn pri" onClick={() => goPage(1)}>
                  Voir les champs{" "}
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* PAGE 1 */}
            <div className={`page${currentPage === 1 ? " on" : ""}`}>
              <div className="fc" style={{ borderColor: "var(--purple-mid)" }}>
                <div className="fc-top" style={{ background: "rgba(167,139,250,0.04)" }}>
                  <div className="fc-ico p">
                    <svg viewBox="0 0 24 24">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Sources de la vidéo ⭐</div>
                    <div className="fc-tag">Les scènes générées par l&apos;IA</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    Chaque moment affiche <strong>&quot;Ce que montre la scène&quot;</strong> — la description depuis ta
                    campagne — et le <strong>visuel d&apos;accroche</strong> de l&apos;étape 2 (uniquement sur le moment
                    Début pour les vidéos 24s).
                  </div>
                  <div className="moments-row">
                    <div className="moment-tile active">
                      <div className="moment-n">1</div>
                      <div className="moment-label">Début</div>
                      <div className="moment-sub">Avec visuel d&apos;accroche</div>
                    </div>
                    <div className="moment-tile">
                      <div className="moment-n">2</div>
                      <div className="moment-label">Transformation</div>
                      <div className="moment-sub">Script seul</div>
                    </div>
                    <div className="moment-tile">
                      <div className="moment-n">3</div>
                      <div className="moment-label">Résultat</div>
                      <div className="moment-sub">Script seul</div>
                    </div>
                  </div>
                  <div className="hint">
                    <div className="hint-dot" style={{ background: "var(--teal)" }} />
                    <p>
                      Tu peux utiliser <strong>&quot;Utiliser ma propre image&quot;</strong> si tu veux remplacer le
                      visuel d&apos;accroche par une photo personnelle pour ce moment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="fc">
                <div className="fc-top">
                  <div className="fc-ico p">
                    <svg viewBox="0 0 24 24">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Dialogue</div>
                    <div className="fc-tag">Voix off générée automatiquement</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    Quand activé, l&apos;IA génère un dialogue parlé en cohérence avec ta scène. Tu peux le désactiver
                    dans les <em>Options avancées</em> si tu veux une vidéo sans voix.
                  </div>
                </div>
              </div>

              <div className="fc">
                <div className="fc-top">
                  <div className="fc-ico b">
                    <svg viewBox="0 0 24 24">
                      <polyline points="4 17 10 11 4 5" />
                      <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Options avancées</div>
                    <div className="fc-tag">Durée · Format · Dialogue · Script technique</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    <strong>Durée</strong> — 8s ou 24s. <strong>Format</strong> — souvent déduit du visuel.{" "}
                    <strong>Script technique</strong> — les prompts exacts envoyés à VEO3,{" "}
                    <em className="b">modifiables</em> pour un contrôle total sur chaque moment.
                  </div>
                  <div className="hint">
                    <div className="hint-dot" style={{ background: "var(--blue)" }} />
                    <p>
                      Le script technique est réservé aux utilisateurs expérimentés. Dans la plupart des cas,{" "}
                      <strong>les champs de l&apos;étape 1 suffisent</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="fc">
                <div className="fc-top">
                  <div className="fc-ico g">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Modèle &amp; moteur de génération</div>
                    <div className="fc-tag">VEO3 par défaut · Kling en option</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    Le modèle utilisé est <strong>VEO3</strong>. Tu peux changer le moteur dans{" "}
                    <em className="g">&quot;Réglages avancés — moteur de génération&quot;</em> en bas de page (VEO3 /
                    Kling). Laisse VEO3 par défaut sauf besoin spécifique.
                  </div>
                </div>
              </div>

              <div className="fc">
                <div className="fc-top">
                  <div className="fc-ico t">
                    <svg viewBox="0 0 24 24">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 .49-5" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Historique VEO3</div>
                    <div className="fc-tag">Toutes tes générations précédentes</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    Le panneau à droite garde en mémoire tes vidéos générées. Tu peux les rechercher, les relancer ou les
                    comparer sans repasser par les étapes 1 et 2.
                  </div>
                </div>
              </div>

              <div className="nav">
                <button type="button" className="btn sec" onClick={() => goPage(0)}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <polyline points="15 18 9 12 15 6" />
                  </svg>{" "}
                  Retour
                </button>
                <span className="nav-ind">2 / 4</span>
                <button type="button" className="btn pri" onClick={() => goPage(2)}>
                  Suivant{" "}
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* PAGE 2 */}
            <div className={`page${currentPage === 2 ? " on" : ""}`}>
              <div className="fc">
                <div className="fc-top">
                  <div className="fc-ico p">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Ce qui se passe pendant la génération</div>
                    <div className="fc-tag">Automatique — tu n&apos;as rien à faire</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    Une fois que tu cliques sur <strong>&quot;Générer la vidéo&quot;</strong>, ViralWorks enchaîne les
                    étapes automatiquement. Pour une vidéo <em>24s</em> en parcours studio 3 moments, l&apos;interface
                    affiche <strong>6 étapes</strong> (1/6 … 6/6) :
                  </div>
                  <div className="steps-grid">
                    <div className="step-tile">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <p>
                        <strong>1/6 — Clip Début</strong> — Génération Veo 8 s…
                      </p>
                    </div>
                    <div className="step-tile">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <p>
                        <strong>2/6 — Frame fin clip 1</strong> — Extraction de la dernière image…
                      </p>
                    </div>
                    <div className="step-tile">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <p>
                        <strong>3/6 — Clip Transformation</strong> — Préparation image (seg. 2) puis Génération Veo 8 s
                        (segment 2)…
                      </p>
                    </div>
                    <div className="step-tile">
                      <svg viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <p>
                        <strong>4/6 — Frame fin clip 2</strong> — Extraction de la dernière image (segment 2)…
                      </p>
                    </div>
                    <div className="step-tile">
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <p>
                        <strong>5/6 — Clip Résultat</strong> — Préparation (seg. 3) puis Génération Veo 8 s (segment 3)…
                      </p>
                    </div>
                    <div className="step-tile last">
                      <svg viewBox="0 0 24 24">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                      <p>
                        <strong>6/6 — Assemblage FFmpeg</strong> — Assemblage des trois clips (FFmpeg)… → vidéo ~24s
                      </p>
                    </div>
                  </div>
                  <div className="hint">
                    <div className="hint-dot" style={{ background: "var(--purple)" }} />
                    <p>
                      Pour une vidéo <strong>8s</strong>, un seul clip est généré — pas d&apos;assemblage multi-clips.
                      Si tu choisis <strong>24s</strong> sans les 3 scènes studio, le flux peut n&apos;afficher que{" "}
                      <strong>2 étapes</strong> (un clip + extraction) au lieu de 6.
                    </p>
                  </div>
                </div>
              </div>

              <div className="result-box">
                <div className="result-eye">Résultat final</div>
                <div className="result-line">
                  Tu obtiens ta vidéo finale téléchargeable. Tu peux ensuite{" "}
                  <strong>&quot;Générer une nouvelle version&quot;</strong> pour relancer avec les mêmes paramètres, ou{" "}
                  <strong>&quot;Faire une autre vidéo&quot;</strong> pour repartir de zéro.
                </div>
              </div>

              <div className="summary">
                Le bouton <strong>&quot;Générer la vidéo&quot;</strong> lance tout le processus. La durée dépend du
                modèle et de la longueur — compte quelques minutes pour une vidéo 24s complète.
              </div>

              <div className="nav">
                <button type="button" className="btn sec" onClick={() => goPage(1)}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <polyline points="15 18 9 12 15 6" />
                  </svg>{" "}
                  Retour
                </button>
                <span className="nav-ind">3 / 4</span>
                <button type="button" className="btn pri" onClick={() => goPage(3)}>
                  Questions IA{" "}
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* PAGE 3 */}
            <div className={`page${currentPage === 3 ? " on" : ""}`}>
              <div className="ai-div">
                <span>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Une question ? L&apos;IA répond
                </span>
              </div>
              <div className="qqs">
                {QUICK_QUESTIONS.map((q) =>
                  hiddenQuick.has(q) ? null : (
                    <button key={q} type="button" className="qq" onClick={() => askQ(q)}>
                      {q}
                    </button>
                  )
                )}
              </div>
              <div className="chat-msgs">
                {threadMessages.map((m, idx) => (
                  <div key={`${idx}-${m.role}`} className={`msg ${m.role === "user" ? "u" : "a"}`}>
                    {m.content}
                  </div>
                ))}
                {loading ? (
                  <div className="msg ty" aria-live="polite">
                    <div className="tdots">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="nav" style={{ marginTop: 4 }}>
                <button type="button" className="btn sec" onClick={() => goPage(2)}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <polyline points="15 18 9 12 15 6" />
                  </svg>{" "}
                  Retour
                </button>
                <span className="nav-ind">4 / 4</span>
              </div>
            </div>
          </div>

          {showChatFooter ? (
            <div className="pf">
              <div className="irow">
                <textarea
                  ref={ciRef}
                  className="ci"
                  placeholder="Une question sur cet onglet…"
                  rows={1}
                  onKeyDown={onCiKeyDown}
                  onInput={(e) => aResize(e.currentTarget)}
                />
                <button type="button" className="sb" disabled={loading} onClick={send} aria-label="Envoyer">
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
