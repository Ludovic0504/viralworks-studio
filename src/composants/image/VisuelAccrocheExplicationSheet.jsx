import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { anthropicMessages } from "@/bibliotheque/anthropic/anthropicMessages";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import "./VisuelAccrocheExplicationSheet.css";

const TAB_LABELS = ["Aperçu", "Les champs", "Ce que ça envoie", "Questions IA"];

const QUICK_QUESTIONS = [
  "Quelle différence entre les variantes ?",
  "L'image ne ressemble pas à ma scène",
  "À quoi sert l'image de référence ?",
  "Je peux changer l'image après l'étape 3 ?",
];

/**
 * Bottom sheet « Explication du système » — Étape 2 Visuel d'accroche.
 * CSS scopé sous `.vwa-ex-host` pour éviter les collisions avec Campagne VWS.
 */
export default function VisuelAccrocheExplicationSheet({ open, onClose }) {
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

  const SYS = useMemo(
    () => `Tu es l'assistant intégré de ViralWorks Studio.

L'utilisateur est sur l'Étape 2 – Visuel d'accroche. Les champs :
1. Format : YouTube (16:9), TikTok (9:16), Carré (1:1).
2. Variantes : 1 à 4 images générées en parallèle.
3. Image générée : générée automatiquement depuis la campagne. Boutons 1/2/3/4 pour naviguer entre les variantes.
4. Champ texte principal : avant génération, libellé « Décrire le visuel d'accroche (première image) » (raccourci mobile « Décrire le visuel d'accroche ») ; après génération, « Modifier l'image sélectionnée » pour affiner en langage naturel.
5. Recharger l'idée de la campagne : resynchronise depuis l'étape 1 si elle a été modifiée (libellé court « Recharger l'idée » sur mobile).
6. Options avancées : prompt complet modifiable, image de référence, modèle d'image (valeur affichée dans cette section). Réservé aux utilisateurs expérimentés.
7. Réinitialiser cette étape : repart de zéro après confirmation ; les images non enregistrées sont perdues.
8. Bouton « Utiliser cette image » avec mention « Étape 3 : vidéo → » : valide et envoie l'image à la Vidéo virale.

L'image sélectionnée devient la première frame de la vidéo à l'étape 3.
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
    <div className="vwa-ex-host">
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
          aria-labelledby="vwa-ex-heading"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ph">
            <div className="ph-left">
              <div className="step-pill">
                <div className="step-n">2</div>
                Visuel d&apos;accroche
              </div>
              <div>
                <div id="vwa-ex-heading" className="ph-title">
                  Comment ça marche
                </div>
                <div className="ph-sub">Étape 2 sur 3</div>
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
                <div className="hero-eye">Étape 2 sur 3</div>
                <div className="hero-title">
                  L&apos;image qui <em>stoppe le scroll</em>.
                </div>
                <div className="hero-body">
                  ViralWorks génère automatiquement le visuel d&apos;accroche à partir de ta campagne. Tu choisis la
                  meilleure variante, tu affines si besoin, et tu passes à la vidéo.
                </div>
              </div>

              <div className="field-list">
                <div className="fl-item">
                  <div className="fl-ico a">
                    <svg viewBox="0 0 24 24">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div className="fl-text">
                    <div className="fl-name">Format</div>
                    <div className="fl-desc">Le ratio selon ta plateforme — TikTok, YouTube, Carré</div>
                  </div>
                  <div className="fl-badge key">Important</div>
                </div>
                <div className="fl-item">
                  <div className="fl-ico b">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </div>
                  <div className="fl-text">
                    <div className="fl-name">Variantes</div>
                    <div className="fl-desc">1 à 4 images générées en parallèle</div>
                  </div>
                  <div className="fl-badge opt">Standard</div>
                </div>
                <div className="fl-item" style={{ borderTop: "1px solid rgba(240,160,48,.12)" }}>
                  <div className="fl-ico a">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <div className="fl-text">
                    <div className="fl-name">Image générée</div>
                    <div className="fl-desc">Le résultat IA — tu navigues entre variantes et tu choisis</div>
                  </div>
                  <div className="fl-badge key" style={{ background: "rgba(240,160,48,.15)" }}>
                    ⭐ Clé
                  </div>
                </div>
                <div className="fl-item">
                  <div className="fl-ico p">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </div>
                  <div className="fl-text">
                    <div className="fl-name">Modifier l&apos;image</div>
                    <div className="fl-desc">Affiner en langage naturel la variante sélectionnée</div>
                  </div>
                  <div className="fl-badge opt">Optionnel</div>
                </div>
                <div className="fl-item">
                  <div className="fl-ico t">
                    <svg viewBox="0 0 24 24">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 .49-5" />
                    </svg>
                  </div>
                  <div className="fl-text">
                    <div className="fl-name">Recharger l&apos;idée de la campagne</div>
                    <div className="fl-desc">Resynchronise si tu as modifié l&apos;étape 1</div>
                  </div>
                  <div className="fl-badge opt">Utile</div>
                </div>
                <div className="fl-item">
                  <div className="fl-ico b">
                    <svg viewBox="0 0 24 24">
                      <polyline points="4 17 10 11 4 5" />
                      <line x1="12" y1="19" x2="20" y2="19" />
                    </svg>
                  </div>
                  <div className="fl-text">
                    <div className="fl-name">Options avancées</div>
                    <div className="fl-desc">Prompt complet · Image de référence · Modèle IA</div>
                  </div>
                  <div className="fl-badge exp">Expert</div>
                </div>
                <div className="fl-item">
                  <div className="fl-ico b">
                    <svg viewBox="0 0 24 24">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </div>
                  <div className="fl-text">
                    <div className="fl-name">Réinitialiser cette étape</div>
                    <div className="fl-desc">Repart de zéro après confirmation — images non enregistrées perdues</div>
                  </div>
                  <div className="fl-badge opt">Utile</div>
                </div>
              </div>

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
              <div className="fc">
                <div className="fc-top">
                  <div className="fc-ico a">
                    <svg viewBox="0 0 24 24">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Format</div>
                    <div className="fc-tag">Le ratio de l&apos;image selon ta plateforme</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="format-row">
                    <div className="fmt">
                      <div className="fmt-thumb yt" />
                      <div className="fmt-lbl">YouTube</div>
                      <div className="fmt-ratio">16:9</div>
                    </div>
                    <div className="fmt sel">
                      <div className="fmt-thumb tt" />
                      <div className="fmt-lbl">TikTok</div>
                      <div className="fmt-ratio">9:16</div>
                    </div>
                    <div className="fmt">
                      <div className="fmt-thumb sq" />
                      <div className="fmt-lbl">Carré</div>
                      <div className="fmt-ratio">1:1</div>
                    </div>
                  </div>
                  <div className="hint">
                    <div className="hint-dot" style={{ background: "var(--amber)" }} />
                    <p>
                      TikTok &amp; Reels → vertical. YouTube → horizontal. En cas de doute, <strong>TikTok</strong> est
                      le plus universel sur mobile.
                    </p>
                  </div>
                </div>
              </div>

              <div className="fc">
                <div className="fc-top">
                  <div className="fc-ico b">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="14" y="14" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Variantes</div>
                    <div className="fc-tag">Nombre d&apos;images générées en parallèle</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    Chaque variante interprète ta scène différemment —{" "}
                    <em className="b">angles, lumières, compositions</em>. Tu choisis ensuite celle qui te convient.
                  </div>
                  <div className="hint">
                    <div className="hint-dot" style={{ background: "var(--blue)" }} />
                    <p>
                      Commence avec <strong>2 variantes</strong> pour voir la diversité sans surcharger. Monte à 4 si tu
                      veux plus de choix.
                    </p>
                  </div>
                </div>
              </div>

              <div className="fc" style={{ borderColor: "var(--amber-mid)" }}>
                <div className="fc-top" style={{ background: "rgba(240,160,48,0.04)" }}>
                  <div className="fc-ico a">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Image générée ⭐</div>
                    <div className="fc-tag">Le résultat de la génération IA</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    Générée automatiquement depuis ta campagne. Clique sur les boutons <strong>1 / 2 / 3 / 4</strong> en
                    haut pour naviguer entre les variantes, puis sélectionne celle que tu préfères.
                  </div>
                  <div className="hint">
                    <div className="hint-dot" style={{ background: "var(--amber)" }} />
                    <p>
                      Le résultat ne te convient pas ? <strong>Modifie l&apos;image</strong> ci-dessous, ou{" "}
                      <strong>recharge l&apos;idée de la campagne</strong> pour repartir de ta description initiale.
                    </p>
                  </div>
                </div>
              </div>

              <div className="fc">
                <div className="fc-top">
                  <div className="fc-ico p">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Décrire ou modifier le visuel</div>
                    <div className="fc-tag">Un seul champ, deux rôles selon l&apos;étape</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    <strong>Avant génération</strong> : libellé « Décrire le visuel d&apos;accroche (première image) » —
                    décris ce que tu veux voir. <strong>Après génération</strong> : « Modifier l&apos;image sélectionnée
                    » — l&apos;IA modifie <em className="p">uniquement ce que tu demandes</em> en conservant le reste.
                  </div>
                  <div className="ex-box" style={{ borderLeftColor: "var(--purple)" }}>
                    <div className="ex-label" style={{ color: "var(--purple)" }}>
                      Bonne formulation
                    </div>
                    <div className="ex-text">
                      &quot;Ajoute un câblage visible au premier plan&quot;
                      <br />
                      &quot;Change l&apos;arrière-plan pour un atelier plus sombre&quot;
                    </div>
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
                    <div className="fc-tag">Réservé aux utilisateurs expérimentés</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    <strong>Prompt complet</strong> — le texte brut envoyé au modèle, modifiable manuellement.{" "}
                    <strong>Image de référence</strong> — si tu veux partir d&apos;une de tes propres photos, tu peux
                    l&apos;uploader ici et <em className="b">l&apos;IA la modifiera à ta convenance</em> selon ta
                    description. Le <strong>modèle d&apos;image</strong> est indiqué dans cette section.
                  </div>
                </div>
              </div>

              <div className="fc">
                <div className="fc-top">
                  <div className="fc-ico t">
                    <svg viewBox="0 0 24 24">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="fc-name">Réinitialiser cette étape</div>
                    <div className="fc-tag">Repartir de zéro sur le visuel d&apos;accroche</div>
                  </div>
                </div>
                <div className="fc-body">
                  <div className="fc-line">
                    Disponible via <strong>Réinitialiser cette étape</strong> : une confirmation s&apos;affiche avant de
                    tout effacer. Les images non enregistrées dans l&apos;historique du studio seront perdues.
                  </div>
                  <div className="hint">
                    <div className="hint-dot" style={{ background: "var(--amber)" }} />
                    <p>
                      Utilise cette action si tu veux repartir sur une base propre sans recharger toute la campagne.
                    </p>
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
              <div className="flow-card">
                <div className="flow-title">Ce que cette étape transmet à la suite</div>
                <div className="flow-row">
                  <div className="flow-src">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    Visuel d&apos;accroche
                  </div>
                  <div className="flow-arr">→</div>
                  <div className="flow-tgt p">
                    <svg viewBox="0 0 24 24">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" />
                    </svg>
                    Vidéo virale
                  </div>
                </div>
                <div className="flow-items">
                  <div className="fi">
                    <div className="fi-dot p" />
                    <p>
                      <strong>L&apos;image sélectionnée</strong> devient la première frame de ta vidéo virale —
                      c&apos;est le point de départ visuel du montage.
                    </p>
                  </div>
                  <div className="fi">
                    <div className="fi-dot p" />
                    <p>
                      <strong>Le style visuel</strong> de l&apos;image informe l&apos;IA sur l&apos;ambiance à conserver
                      sur toute la vidéo.
                    </p>
                  </div>
                  <div className="fi">
                    <div className="fi-dot t" />
                    <p>
                      Tu peux <strong>revenir changer d&apos;image</strong> après être passé à l&apos;étape 3 — il suffit
                      de re-sélectionner et re-valider.
                    </p>
                  </div>
                </div>
              </div>

              <div className="summary">
                Le bouton <strong>&quot;Utiliser cette image&quot;</strong> avec la mention{" "}
                <strong>&quot;Étape 3 : vidéo →&quot;</strong> valide ton choix et passe à la Vidéo virale.
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
              <div className="nav" style={{ marginTop: "4px" }}>
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
