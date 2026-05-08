import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { anthropicMessages } from "@/bibliotheque/anthropic/anthropicMessages";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import { CAMPAGNE_VWS_EXPLICATION_SYS } from "./campagneVwsExplicationSysPrompt";
import "./CampagneVwsExplicationSheet.css";

const TAB_LABELS = [
  "Vue d'ensemble",
  "Format de vidéo",
  "Ton métier",
  "Durée & lieu",
  "La scène",
  "Ce que ça envoie",
  "Questions IA",
];

const QUICK_QUESTIONS = [
  "Quel format de vidéo choisir si je débute ?",
  "Mon métier n'est pas dans la liste, que faire ?",
  "Pourquoi l'idée de scène est si importante ?",
  "Je peux changer mes choix après avoir validé ?",
];

const CHEVRON_RIGHT = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const CHEVRON_LEFT = (
  <svg viewBox="0 0 24 24" aria-hidden>
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

function NavPrimary({ children, onClick }) {
  return (
    <button type="button" className="cvws-ex-nav-btn cvws-ex-nav-btn--primary" onClick={onClick}>
      {children}
    </button>
  );
}

function NavSecondary({ children, onClick }) {
  return (
    <button type="button" className="cvws-ex-nav-btn cvws-ex-nav-btn--secondary" onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Bottom sheet « Explication du système » — Étape 1 Campagne VWS uniquement.
 */
export default function CampagneVwsExplicationSheet({ open, onClose }) {
  const { runWithAuth } = useRequireAuthAction();
  const overlayRef = useRef(null);
  const pbRef = useRef(null);
  const ciRef = useRef(null);
  const loadingRef = useRef(false);
  const currentPageRef = useRef(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [threadMessages, setThreadMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hiddenQuick, setHiddenQuick] = useState(() => new Set());
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false
  );

  /** Sur mobile le pied « pose une question » bouffe la hauteur utile et Safari peut défiler vers le bas ; on le masque hors onglet Questions IA. */
  const showChatFooter = !isMobileViewport || currentPage === 6;

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

  /** Ouverture / iOS : forcer le haut du contenu visible (évite scroll implicite vers le champ du bas). */
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
    if (n === 6) {
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
      setThreadMessages([]);
      setHiddenQuick(new Set());
      setLoading(false);
      loadingRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open || currentPage !== 6) return;
    const el = pbRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [threadMessages, loading, open, currentPage]);

  const aResize = useCallback((el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, []);

  const handleChatSend = useCallback(async () => {
    if (loadingRef.current) return;
    const txt = ciRef.current?.value?.trim() ?? "";
    if (!txt) return;

    if (currentPageRef.current !== 6) {
      goPage(6);
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
        system: CAMPAGNE_VWS_EXPLICATION_SYS,
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
  }, [goPage]);

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
      goPage(6);
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
    <div
      ref={overlayRef}
      className="cvws-ex-overlay"
      onClick={handleBackdrop}
      role="presentation"
    >
      <div
        className="cvws-ex-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cvws-ex-heading"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cvws-ex-ph">
          <div className="cvws-ex-ph-left">
            <div className="cvws-ex-step-badge">
              <div className="cvws-ex-step-num">1</div>
              Campagne VWS
            </div>
            <div>
              <div id="cvws-ex-heading" className="cvws-ex-ph-title">
                Explication du système
              </div>
              <div className="cvws-ex-ph-sub">Comment remplir cet onglet</div>
            </div>
          </div>
          <button type="button" className="cvws-ex-close-btn" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="cvws-ex-progress-bar">
          {TAB_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`cvws-ex-ptab ${currentPage === i ? "cvws-ex-ptab--active" : ""}`}
              onClick={() => goPage(i)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          ref={pbRef}
          className={`cvws-ex-pb${isMobileViewport && currentPage !== 6 ? " cvws-ex-pb--mobile-chat-hidden" : ""}`}
        >
          {/* PAGE 0 */}
          <div className={`cvws-ex-page ${currentPage === 0 ? "cvws-ex-page--active" : ""}`}>
            <div className="cvws-ex-hero">
              <div className="cvws-ex-hero-eyebrow">Étape 1 sur 3</div>
              <div className="cvws-ex-hero-title">
                Tu poses les <em>fondations</em> de ta vidéo.
              </div>
              <div className="cvws-ex-hero-body">
                Cet onglet, c&apos;est le brief que tu donnes à l&apos;IA. Tout ce que tu remplis ici va alimenter les
                deux étapes suivantes — le visuel d&apos;accroche et la vidéo virale. Plus tu es précis ici, meilleur sera
                le résultat final.
              </div>
            </div>
            <div className="cvws-ex-field-card">
              <div className="cvws-ex-fc-body cvws-ex-fc-body--tight">
                <div className="cvws-ex-fc-how-label">Ce que tu vas remplir dans cet onglet</div>
                <div className="cvws-ex-flow-list">
                  <div className="cvws-ex-flow-item">
                    <div className="cvws-ex-flow-item-dot cvws-ex-flow-item-dot--teal" />
                    <p>
                      <strong>Le format de vidéo</strong> — Choisi dans le catalogue (bouton « Changer » ou « Choisir un
                      format »)
                    </p>
                  </div>
                  <div className="cvws-ex-flow-item">
                    <div className="cvws-ex-flow-item-dot cvws-ex-flow-item-dot--teal" />
                    <p>
                      <strong>Ton métier</strong> — Pour que l&apos;ambiance visuelle soit cohérente
                    </p>
                  </div>
                  <div className="cvws-ex-flow-item">
                    <div className="cvws-ex-flow-item-dot cvws-ex-flow-item-dot--teal" />
                    <p>
                      <strong>La durée et le lieu</strong> — Pour calibrer le format et le décor principal
                    </p>
                  </div>
                  <div className="cvws-ex-flow-item">
                    <div className="cvws-ex-flow-item-dot cvws-ex-flow-item-dot--teal" />
                    <p>
                      <strong>L&apos;idée principale de la scène</strong> (« Ta scène » sur mobile) — Le cœur de ta
                      vidéo
                    </p>
                  </div>
                  <div className="cvws-ex-flow-item">
                    <div className="cvws-ex-flow-item-dot cvws-ex-flow-item-dot--teal" />
                    <p>
                      <strong>Précisions optionnelles</strong> — Ambiance, lumière, style…
                    </p>
                  </div>
                  <div className="cvws-ex-flow-item">
                    <div className="cvws-ex-flow-item-dot cvws-ex-flow-item-dot--teal" />
                    <p>
                      <strong>Dialogue activé</strong> — Interrupteur (modifiable aussi dans Vidéo virale)
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="cvws-ex-nav-row">
              <span className="cvws-ex-page-indicator">1 / 7</span>
              <NavPrimary onClick={() => goPage(1)}>
                Commencer {CHEVRON_RIGHT}
              </NavPrimary>
            </div>
          </div>

          {/* PAGE 1 */}
          <div className={`cvws-ex-page ${currentPage === 1 ? "cvws-ex-page--active" : ""}`}>
            <div className="cvws-ex-field-card">
              <div className="cvws-ex-fc-header">
                <div className="cvws-ex-fc-icon cvws-ex-fc-icon--teal">
                  <svg viewBox="0 0 24 24">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                </div>
                <div className="cvws-ex-fc-meta">
                  <div className="cvws-ex-fc-name">Format de vidéo</div>
                  <div className="cvws-ex-fc-tag">Le catalogue ViralWorks</div>
                </div>
                <div className="cvws-ex-fc-importance cvws-ex-fc-importance--key">Essentiel</div>
              </div>
              <div className="cvws-ex-fc-body">
                <div className="cvws-ex-fc-what">
                  C&apos;est le choix le plus important de cet onglet. Il dit à l&apos;IA{" "}
                  <em style={{ color: "var(--teal)", fontStyle: "normal" }}>quelle intention</em> tu as derrière ta vidéo
                  — mise en avant produit, avant/après, tutoriel, témoignage, etc.
                </div>
                <div className="cvws-ex-fc-how">
                  <div className="cvws-ex-fc-how-label">Comment choisir ?</div>
                  <p>
                    Clique sur <strong style={{ color: "var(--text)" }}>&quot;Changer&quot;</strong> à droite du format
                    affiché (ou sur <strong>&quot;Choisir un format&quot;</strong> si rien n&apos;est sélectionné). Une
                    liste de formats du catalogue s&apos;ouvre — choisis celui qui correspond à ce que tu veux montrer.
                  </p>
                </div>
                <div className="cvws-ex-fc-tips">
                  <div className="cvws-ex-tip-chip">
                    <span>🎬</span> Publicité produit
                  </div>
                  <div className="cvws-ex-tip-chip">
                    <span>✅</span> Avant / Après
                  </div>
                  <div className="cvws-ex-tip-chip">
                    <span>📝</span> Démonstration produit
                  </div>
                  <div className="cvws-ex-tip-chip">
                    <span>🎓</span> Tutoriel / éducatif
                  </div>
                  <div className="cvws-ex-tip-chip">
                    <span>💬</span> Témoignage client
                  </div>
                </div>
              </div>
            </div>
            <div className="cvws-ex-nav-row">
              <NavSecondary onClick={() => goPage(0)}>
                {CHEVRON_LEFT} Retour
              </NavSecondary>
              <span className="cvws-ex-page-indicator">2 / 7</span>
              <NavPrimary onClick={() => goPage(2)}>
                Suivant {CHEVRON_RIGHT}
              </NavPrimary>
            </div>
          </div>

          {/* PAGE 2 */}
          <div className={`cvws-ex-page ${currentPage === 2 ? "cvws-ex-page--active" : ""}`}>
            <div className="cvws-ex-field-card">
              <div className="cvws-ex-fc-header">
                <div className="cvws-ex-fc-icon cvws-ex-fc-icon--amber">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div className="cvws-ex-fc-meta">
                  <div className="cvws-ex-fc-name">Ton métier</div>
                  <div className="cvws-ex-fc-tag">Le contexte visuel de ta vidéo</div>
                </div>
                <div className="cvws-ex-fc-importance cvws-ex-fc-importance--key">Important</div>
              </div>
              <div className="cvws-ex-fc-body">
                <div className="cvws-ex-fc-what">
                  Ce champ définit l&apos;
                  <em style={{ color: "var(--amber)", fontStyle: "normal" }}>ambiance visuelle</em> que l&apos;IA va
                  suggérer pour ta scène. Un électricien n&apos;a pas le même décor qu&apos;un chef cuisinier ou un coach
                  sportif.
                </div>
                <div className="cvws-ex-fc-how">
                  <div className="cvws-ex-fc-how-label" style={{ color: "var(--amber)" }}>
                    Comment choisir ?
                  </div>
                  <p>
                    Sélectionne ton métier dans le menu déroulant. Une fois choisi, une ambiance typique peut
                    s&apos;afficher sous le champ pour t&apos;aider à imaginer la scène — c&apos;est le contexte visuel
                    utilisé par la suite du studio.
                  </p>
                </div>
                <div className="cvws-ex-field-card cvws-ex-field-card--nested-amber">
                  <div className="cvws-ex-fc-body cvws-ex-fc-body--compact">
                    <div className="cvws-ex-fc-how-label" style={{ color: "var(--amber)" }}>
                      Exemple concret
                    </div>
                    <p className="cvws-ex-example-p">
                      Tu sélectionnes <strong style={{ color: "var(--text)" }}>Électricien</strong> → l&apos;IA
                      comprend : tableau électrique, câblage, EPI, éclairage technique — sans que tu aies tout à décrire
                      mot pour mot.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="cvws-ex-nav-row">
              <NavSecondary onClick={() => goPage(1)}>
                {CHEVRON_LEFT} Retour
              </NavSecondary>
              <span className="cvws-ex-page-indicator">3 / 7</span>
              <NavPrimary onClick={() => goPage(3)}>
                Suivant {CHEVRON_RIGHT}
              </NavPrimary>
            </div>
          </div>

          {/* PAGE 3 */}
          <div className={`cvws-ex-page ${currentPage === 3 ? "cvws-ex-page--active" : ""}`}>
            <div className="cvws-ex-field-card">
              <div className="cvws-ex-fc-header">
                <div className="cvws-ex-fc-icon cvws-ex-fc-icon--blue">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="cvws-ex-fc-meta">
                  <div className="cvws-ex-fc-name">Durée de la vidéo</div>
                  <div className="cvws-ex-fc-tag">Une scène courte ou plusieurs moments</div>
                </div>
                <div className="cvws-ex-fc-importance cvws-ex-fc-importance--normal">Standard</div>
              </div>
              <div className="cvws-ex-fc-body">
                <div className="cvws-ex-fc-what">
                  Ce choix indique à l&apos;IA si tu veux un contenu{" "}
                  <em style={{ color: "#58a6ff", fontStyle: "normal" }}>très court (8 secondes)</em> ou un format plus
                  développé avec <strong style={{ color: "var(--text)" }}>plusieurs moments à la suite</strong>. Ça
                  influence la structure du script à l&apos;étape 3.
                </div>
                <div className="cvws-ex-fc-how">
                  <div className="cvws-ex-fc-how-label" style={{ color: "#58a6ff" }}>
                    Comment choisir ?
                  </div>
                  <p>
                    &quot;Une courte vidéo (8 secondes)&quot; pour un impact très rapide. &quot;Une vidéo plus longue
                    (plusieurs moments à la suite)&quot; pour raconter plusieurs étapes ou angles. En cas de doute,
                    commence par le format court — tu peux toujours ajuster.
                  </p>
                </div>
              </div>
            </div>
            <div className="cvws-ex-field-card cvws-ex-mt2">
              <div className="cvws-ex-fc-header">
                <div className="cvws-ex-fc-icon cvws-ex-fc-icon--purple">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div className="cvws-ex-fc-meta">
                  <div className="cvws-ex-fc-name">Où se passe la vidéo ?</div>
                  <div className="cvws-ex-fc-tag">L&apos;environnement principal de la scène</div>
                </div>
                <div className="cvws-ex-fc-importance cvws-ex-fc-importance--normal">Standard</div>
              </div>
              <div className="cvws-ex-fc-body">
                <div className="cvws-ex-fc-what">
                  C&apos;est le{" "}
                  <em style={{ color: "var(--purple)", fontStyle: "normal" }}>décor officiel</em> utilisé dans la
                  génération : chez un particulier (domicile, jardin, chantier), dans l&apos;établissement du
                  professionnel, ou lieu neutre / extérieur.
                </div>
                <div className="cvws-ex-fc-how">
                  <div className="cvws-ex-fc-how-label" style={{ color: "var(--purple)" }}>
                    Important à savoir
                  </div>
                  <p>
                    Ce lieu pose le cadre général. L&apos;idée de scène que tu écris juste après peut enrichir avec des
                    détails précis — tu n&apos;as pas besoin de tout dire ici.
                  </p>
                </div>
              </div>
            </div>
            <div className="cvws-ex-nav-row">
              <NavSecondary onClick={() => goPage(2)}>
                {CHEVRON_LEFT} Retour
              </NavSecondary>
              <span className="cvws-ex-page-indicator">4 / 7</span>
              <NavPrimary onClick={() => goPage(4)}>
                Suivant {CHEVRON_RIGHT}
              </NavPrimary>
            </div>
          </div>

          {/* PAGE 4 */}
          <div className={`cvws-ex-page ${currentPage === 4 ? "cvws-ex-page--active" : ""}`}>
            <div className="cvws-ex-field-card cvws-ex-field-card--accent-teal">
              <div className="cvws-ex-fc-header">
                <div className="cvws-ex-fc-icon cvws-ex-fc-icon--teal">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <div className="cvws-ex-fc-meta">
                  <div className="cvws-ex-fc-name">Idée principale de la scène</div>
                  <div className="cvws-ex-fc-tag">Sur mobile : « Ta scène »</div>
                </div>
                <div className="cvws-ex-fc-importance cvws-ex-fc-importance--key">Crucial</div>
              </div>
              <div className="cvws-ex-fc-body">
                <div className="cvws-ex-fc-what">
                  C&apos;est le <em style={{ color: "var(--teal)", fontStyle: "normal" }}>cœur de ta vidéo</em>. Tu
                  décris qui fait quoi, dans quel contexte, avec quel objectif visible à l&apos;écran. L&apos;IA
                  s&apos;appuie surtout sur ce texte pour le visuel d&apos;accroche et le script.
                </div>
                <div className="cvws-ex-fc-how">
                  <div className="cvws-ex-fc-how-label">Comment bien le remplir ?</div>
                  <p>
                    Formule efficace : <strong style={{ color: "var(--text)" }}>[Qui] + [fait quoi] + [avec quoi ou pourquoi]</strong>
                    . Tu peux cliquer sur <strong style={{ color: "var(--teal)" }}>&quot;M&apos;inspirer →&quot;</strong>{" "}
                    pour une proposition cohérente avec ton métier et ton lieu.
                  </p>
                </div>
                <div className="cvws-ex-field-card cvws-ex-field-card--nested">
                  <div className="cvws-ex-fc-body cvws-ex-fc-body--compact">
                    <div className="cvws-ex-fc-how-label">Exemple réel</div>
                    <p className="cvws-ex-example-p">
                      <strong style={{ color: "var(--text)" }}>Bon :</strong> &quot;L&apos;électricien démonte un vieux
                      disjoncteur défectueux en montrant clairement les fils endommagés, puis le remplace par un modèle
                      moderne.&quot;
                    </p>
                    <p className="cvws-ex-example-p">
                      <strong style={{ color: "var(--muted2)" }}>Pas assez précis :</strong> &quot;Montrer mon travail
                      d&apos;électricien.&quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="cvws-ex-field-card">
              <div className="cvws-ex-fc-header">
                <div className="cvws-ex-fc-icon cvws-ex-fc-icon--teal">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                  </svg>
                </div>
                <div className="cvws-ex-fc-meta">
                  <div className="cvws-ex-fc-name">Précisions (ambiance, lumière, style…)</div>
                  <div className="cvws-ex-fc-tag">Optionnel mais puissant</div>
                </div>
                <div className="cvws-ex-fc-importance cvws-ex-fc-importance--normal">Optionnel</div>
              </div>
              <div className="cvws-ex-fc-body">
                <div className="cvws-ex-fc-what">
                  Champ <em style={{ color: "var(--teal)", fontStyle: "normal" }}>facultatif</em> pour affiner
                  l&apos;ambiance : lumière, style de prise de vue, détail technique, référence visuelle.
                </div>
                <div className="cvws-ex-fc-how">
                  <div className="cvws-ex-fc-how-label">Exemples</div>
                  <p>
                    Lumière naturelle froide, style documentaire, plan serré sur les mains, couleurs désaturées, mise
                    aux normes…
                  </p>
                </div>
              </div>
            </div>
            <div className="cvws-ex-nav-row">
              <NavSecondary onClick={() => goPage(3)}>
                {CHEVRON_LEFT} Retour
              </NavSecondary>
              <span className="cvws-ex-page-indicator">5 / 7</span>
              <NavPrimary onClick={() => goPage(5)}>
                Suivant {CHEVRON_RIGHT}
              </NavPrimary>
            </div>
          </div>

          {/* PAGE 5 */}
          <div className={`cvws-ex-page ${currentPage === 5 ? "cvws-ex-page--active" : ""}`}>
            <div className="cvws-ex-flow-box">
              <div className="cvws-ex-flow-title">Ce que Campagne VWS transmet aux autres onglets</div>
              <div className="cvws-ex-flow-row">
                <div className="cvws-ex-flow-source">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  Campagne VWS
                </div>
                <div className="cvws-ex-flow-arrow">→</div>
                <div className="cvws-ex-flow-targets">
                  <div className="cvws-ex-flow-target cvws-ex-flow-target--t1">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                    Visuel d&apos;accroche
                  </div>
                  <div className="cvws-ex-flow-target cvws-ex-flow-target--t2">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" />
                    </svg>
                    Vidéo virale
                  </div>
                </div>
              </div>
              <div className="cvws-ex-flow-items cvws-ex-flow-items--more">
                <div className="cvws-ex-flow-item">
                  <div className="cvws-ex-flow-item-dot cvws-ex-flow-item-dot--amber" />
                  <p>
                    <strong>Visuel d&apos;accroche (étape 2)</strong> reçoit le format, le métier, le lieu et
                    l&apos;idée de scène pour la miniature et le texte d&apos;accroche.
                  </p>
                </div>
                <div className="cvws-ex-flow-item">
                  <div className="cvws-ex-flow-item-dot cvws-ex-flow-item-dot--purple" />
                  <p>
                    <strong>Vidéo virale (étape 3)</strong> reçoit tout le contexte pour le script et le montage, en
                    accord avec la durée choisie.
                  </p>
                </div>
                <div className="cvws-ex-flow-item">
                  <div className="cvws-ex-flow-item-dot cvws-ex-flow-item-dot--teal" />
                  <p>
                    <strong>Si tu modifies cet onglet</strong> après avoir avancé, les étapes suivantes peuvent être
                    recalculées.
                  </p>
                </div>
              </div>
            </div>
            <div className="cvws-ex-hero cvws-ex-resume" style={{ background: "linear-gradient(135deg,rgba(0,229,160,.04),rgba(0,229,160,.01))" }}>
              <div className="cvws-ex-hero-eyebrow">En résumé</div>
              <div className="cvws-ex-hero-body">
                Cet onglet, c&apos;est ton brief. Le bouton{" "}
                <strong style={{ color: "var(--teal)" }}>&quot;Préparer ma vidéo&quot;</strong> lance la préparation pour
                la suite du studio (selon les validations en haut de page).
              </div>
            </div>
            <div className="cvws-ex-nav-row">
              <NavSecondary onClick={() => goPage(4)}>
                {CHEVRON_LEFT} Retour
              </NavSecondary>
              <span className="cvws-ex-page-indicator">6 / 7</span>
              <NavPrimary onClick={() => goPage(6)}>
                Questions IA {CHEVRON_RIGHT}
              </NavPrimary>
            </div>
          </div>

          {/* PAGE 6 */}
          <div className={`cvws-ex-page ${currentPage === 6 ? "cvws-ex-page--active" : ""}`}>
            <div className="cvws-ex-ai-div">
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Une question ? L&apos;IA répond
              </span>
            </div>
            <div className="cvws-ex-quick-qs">
              {QUICK_QUESTIONS.map((q) =>
                hiddenQuick.has(q) ? null : (
                  <button key={q} type="button" className="cvws-ex-qq" onClick={() => askQ(q)}>
                    {q}
                  </button>
                )
              )}
            </div>
            <div className="cvws-ex-chat-msgs">
              {threadMessages.map((m, idx) => (
                <div
                  key={`${idx}-${m.role}`}
                  className={`cvws-ex-msg ${m.role === "user" ? "cvws-ex-msg--user" : "cvws-ex-msg--ai"}`}
                >
                  {m.content}
                </div>
              ))}
              {loading ? (
                <div className="cvws-ex-msg cvws-ex-msg--typing" aria-live="polite">
                  <div className="cvws-ex-tdots">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="cvws-ex-nav-row">
              <NavSecondary onClick={() => goPage(5)}>
                {CHEVRON_LEFT} Retour
              </NavSecondary>
              <span className="cvws-ex-page-indicator">7 / 7</span>
            </div>
          </div>
        </div>

        {showChatFooter ? (
          <div className="cvws-ex-pf">
            <div className="cvws-ex-input-row">
              <textarea
                ref={ciRef}
                className="cvws-ex-ci"
                placeholder="Une question sur cet onglet…"
                rows={1}
                onKeyDown={onCiKeyDown}
                onInput={(e) => aResize(e.currentTarget)}
              />
              <button type="button" className="cvws-ex-sb" disabled={loading} onClick={send} aria-label="Envoyer">
                <svg viewBox="0 0 24 24">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
