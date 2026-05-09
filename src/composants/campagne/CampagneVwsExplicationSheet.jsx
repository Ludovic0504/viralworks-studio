import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { anthropicMessages } from "@/bibliotheque/anthropic/anthropicMessages";
import { useRequireAuthAction } from "@/contexte/ActionAuthModalContext";
import "./CampagneVwsExplicationSheet.css";

const QUICK_QUESTIONS = [
  "Quel format de vidéo choisir si je débute ?",
  "Mon métier n'est pas dans la liste, que faire ?",
  "Je peux changer mes choix après avoir validé ?",
  "Pourquoi l'idée de scène est si importante ?",
];

const TAB_LABELS = ["Aperçu", "Les champs", "Ce que ça envoie", "Questions IA"];

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

  const SYS = useMemo(
    () => `Tu es l'assistant intégré de ViralWorks Studio, app qui aide les créateurs à produire des vidéos virales avec l'IA.

L'utilisateur est sur l'Étape 1 – Campagne VWS. Les champs de cet onglet :
1. Format de vidéo : format de la vidéo (publicité produit, test/review, avant-après, éducatif, témoignage…). Bouton "Changer" / "Choisir un format" pour le modifier.
2. Ton métier : définit l'ambiance visuelle automatiquement.
3. Durée de la vidéo : court (TikTok/Reels) ou long (plusieurs moments).
4. Où se passe la vidéo ? : décor principal (chez le pro, chez le client, extérieur…).
5. Idée principale de la scène : sur mobile le libellé est "Ta scène". Décris qui fait quoi. Formule = [Qui] + [fait quoi] + [pourquoi/avec quoi]. Bouton "M'inspirer →" disponible.
6. Précisions : optionnel, pour l'ambiance.
7. Dialogue activé : toggle (modifiable dans Vidéo virale).

Tout ça alimente les étapes 2 (Visuel d'accroche) et 3 (Vidéo virale).
Réponds en français, concis, max 2-3 phrases.`,
    []
  );

  /** Sur mobile le pied « pose une question » bouffe la hauteur utile ; on le masque hors onglet Questions IA. */
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
    if (n === 3) {
      requestAnimationFrame(() => ciRef.current?.focus());
    }
  }, []);

  const handleBackdrop = useCallback(
    (e) => {
      if (e.target === overlayRef.current) {
        onClose?.();
      }
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
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
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
    <div ref={overlayRef} className={`overlay${open ? " open" : ""}`} onClick={handleBackdrop} role="presentation">
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="cvws-ex-heading" onClick={(e) => e.stopPropagation()}>
        <div className="ph">
          <div className="ph-left">
            <div className="step-pill">
              <div className="step-n">1</div>Campagne VWS
            </div>
            <div>
              <div id="cvws-ex-heading" className="ph-title">
                Comment ça marche
              </div>
              <div className="ph-sub">Étape 1 sur 3</div>
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

        <div ref={pbRef} className="pb" id="pb">
          {/* PAGE 0 : APERÇU */}
          <div className={`page${currentPage === 0 ? " on" : ""}`} id="p0">
            <div className="hero">
              <div className="hero-eye">Étape 1 sur 3</div>
              <div className="hero-title">
                Tu poses les <em>fondations</em> de ta vidéo.
              </div>
              <div className="hero-body">
                Tout ce que tu remplis ici alimente les deux étapes suivantes — le visuel d&apos;accroche et la vidéo
                virale. Plus tu es précis, meilleur sera le résultat.
              </div>
            </div>

            <div className="field-list">
              <div className="fl-item">
                <div className="fl-ico t">
                  <svg viewBox="0 0 24 24">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                </div>
                <div className="fl-text">
                  <div className="fl-name">Format de vidéo</div>
                  <div className="fl-desc">Quel format de vidéo tu veux créer</div>
                </div>
                <div className="fl-badge key">Essentiel</div>
              </div>

              <div className="fl-item">
                <div className="fl-ico a">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div className="fl-text">
                  <div className="fl-name">Ton métier</div>
                  <div className="fl-desc">Définit l&apos;ambiance visuelle automatiquement</div>
                </div>
                <div className="fl-badge key">Important</div>
              </div>

              <div className="fl-item">
                <div className="fl-ico b">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="fl-text">
                  <div className="fl-name">Durée de la vidéo</div>
                  <div className="fl-desc">Format court (Reels) ou long (plusieurs séquences)</div>
                </div>
                <div className="fl-badge opt">Standard</div>
              </div>

              <div className="fl-item">
                <div className="fl-ico p">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div className="fl-text">
                  <div className="fl-name">Où se passe la vidéo ?</div>
                  <div className="fl-desc">Le décor principal de la scène</div>
                </div>
                <div className="fl-badge opt">Standard</div>
              </div>

              <div className="fl-item" style={{ borderTop: "1px solid rgba(0,229,160,.12)" }}>
                <div className="fl-ico t">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <div className="fl-text">
                  <div className="fl-name">Idée principale de la scène</div>
                  <div className="fl-desc">Le cœur de ta vidéo — le champ le plus important</div>
                </div>
                <div className="fl-badge key" style={{ background: "rgba(0,229,160,.15)" }}>
                  ⭐ Crucial
                </div>
              </div>

              <div className="fl-item">
                <div className="fl-ico t">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                  </svg>
                </div>
                <div className="fl-text">
                  <div className="fl-name">Précisions</div>
                  <div className="fl-desc">Ambiance, lumière, style — optionnel</div>
                </div>
                <div className="fl-badge opt">Optionnel</div>
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

          {/* PAGE 1 : LES CHAMPS */}
          <div className={`page${currentPage === 1 ? " on" : ""}`} id="p1">
            <div className="fc">
              <div className="fc-top">
                <div className="fc-ico t">
                  <svg viewBox="0 0 24 24">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fc-name">Format de vidéo</div>
                  <div className="fc-tag">Le format de ta vidéo</div>
                </div>
              </div>
              <div className="fc-body">
                <div className="fc-line">
                  Clique sur <strong>&quot;Changer&quot;</strong> (ou <strong>&quot;Choisir un format&quot;</strong>) pour
                  voir les formats disponibles. Ce choix oriente l&apos;IA sur <em>ton intention</em> : vendre, éduquer,
                  montrer un résultat.
                </div>
                <div className="hint">
                  <div className="hint-dot" style={{ background: "var(--teal)" }} />
                  <p>
                    Si tu es prestataire → <strong>Avant / Après</strong> ou <strong>Test / Review</strong>. Si tu vends
                    un produit → <strong>Publicité produit</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="fc">
              <div className="fc-top">
                <div className="fc-ico a">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fc-name">Ton métier</div>
                  <div className="fc-tag">L&apos;ambiance visuelle automatique</div>
                </div>
              </div>
              <div className="fc-body">
                <div className="fc-line">
                  Sélectionne ton métier dans le menu. L&apos;IA l&apos;utilise pour imaginer le décor, le matériel, les
                  gestes typiques — <em>sans que tu aies à tout décrire</em>.
                </div>
                <div className="ex-box">
                  <div className="ex-label">Exemple</div>
                  <div className="ex-text">
                    Électricien → tableau électrique, câblage apparent, EPI visibles — tout ça est compris
                    automatiquement.
                  </div>
                </div>
              </div>
            </div>

            <div className="fc">
              <div className="fc-top">
                <div className="fc-ico b">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fc-name">Durée · Lieu</div>
                  <div className="fc-tag">Format et décor de la vidéo</div>
                </div>
              </div>
              <div className="fc-body">
                <div className="fc-line">
                  <strong>Durée :</strong> format court pour TikTok / Reels, long pour une présentation complète.{" "}
                  <strong>Lieu :</strong> le décor principal — chez toi, chez le client, en extérieur.
                </div>
                <div className="hint">
                  <div className="hint-dot" style={{ background: "var(--blue)" }} />
                  <p>
                    En cas de doute sur la durée, commence par le <strong>format court</strong> — tu peux relancer à
                    tout moment.
                  </p>
                </div>
              </div>
            </div>

            <div className="fc" style={{ borderColor: "var(--teal-mid)" }}>
              <div className="fc-top" style={{ background: "rgba(0,229,160,0.04)" }}>
                <div className="fc-ico t">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fc-name">Idée principale de la scène ⭐</div>
                  <div className="fc-tag">Le champ le plus important du studio</div>
                </div>
              </div>
              <div className="fc-body">
                <div className="fc-line">
                  Décris <em>qui fait quoi</em> dans ta vidéo. Formule simple :{" "}
                  <strong>[Qui] + [fait quoi] + [pourquoi / avec quoi]</strong>. Ou clique{" "}
                  <strong>&quot;M&apos;inspirer →&quot;</strong> pour une idée générée automatiquement.
                </div>
                <div className="ex-box">
                  <div className="ex-label">Bon exemple</div>
                  <div className="ex-text">
                    &quot;L&apos;électricien démonte un vieux disjoncteur défectueux en montrant les fils endommagés, puis le
                    remplace par un modèle moderne.&quot;
                  </div>
                </div>
              </div>
            </div>

            <div className="fc">
              <div className="fc-top">
                <div className="fc-ico t">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fc-name">Précisions</div>
                  <div className="fc-tag">Optionnel — pour affiner l&apos;ambiance</div>
                </div>
              </div>
              <div className="fc-body">
                <div className="fc-line">
                  Lumière, style de tournage, détail technique spécifique. Laisse vide si tu n&apos;as pas de préférence —
                  l&apos;IA gère seule.
                </div>
              </div>
            </div>

            <div className="fc">
              <div className="fc-top">
                <div className="fc-ico t">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2a10 10 0 1 0 10 10" />
                    <path d="M12 2v10h10" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fc-name">Dialogue activé</div>
                  <div className="fc-tag">Option de dialogue dans la vidéo</div>
                </div>
              </div>
              <div className="fc-body">
                <div className="fc-line">
                  Active si tu veux des phrases prononcées (dialogue / voice-over). Tu peux le modifier plus tard dans{" "}
                  <strong>Vidéo virale</strong>.
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

          {/* PAGE 2 : CE QUE ÇA ENVOIE */}
          <div className={`page${currentPage === 2 ? " on" : ""}`} id="p2">
            <div className="flow-card">
              <div className="flow-title">Ce que cette étape transmet à la suite</div>
              <div className="flow-row">
                <div className="flow-src">
                  <svg viewBox="0 0 24 24">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  Campagne VWS
                </div>
                <div className="flow-arr">→</div>
                <div className="flow-tgts">
                  <div className="flow-tgt a">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                    Visuel d&apos;accroche
                  </div>
                  <div className="flow-tgt p">
                    <svg viewBox="0 0 24 24">
                      <polygon points="23 7 16 12 23 17 23 7" />
                      <rect x="1" y="5" width="15" height="14" rx="2" />
                    </svg>
                    Vidéo virale
                  </div>
                </div>
              </div>
              <div className="flow-items">
                <div className="fi">
                  <div className="fi-dot a" />
                  <p>
                    <strong>Visuel d&apos;accroche</strong> reçoit le format de vidéo, le métier, le lieu et l&apos;idée de
                    scène pour générer la miniature.
                  </p>
                </div>
                <div className="fi">
                  <div className="fi-dot p" />
                  <p>
                    <strong>Vidéo virale</strong> reçoit le contexte complet pour construire le script et les
                    indications de tournage.
                  </p>
                </div>
                <div className="fi">
                  <div className="fi-dot t" />
                  <p>
                    Si tu modifies cet onglet après avoir avancé, les deux étapes suivantes sont{" "}
                    <strong>recalculées automatiquement</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="summary">
              Le bouton <strong>&quot;Préparer ma vidéo&quot;</strong> en bas de l&apos;onglet valide tout ça et lance la
              génération. Tu peux revenir modifier à tout moment.
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

          {/* PAGE 3 : QUESTIONS IA */}
          <div className={`page${currentPage === 3 ? " on" : ""}`} id="p3">
            <div className="ai-div">
              <span>
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Une question ? L&apos;IA répond
              </span>
            </div>

            <div className="qqs" id="qqs">
              {QUICK_QUESTIONS.map((q) =>
                hiddenQuick.has(q) ? null : (
                  <button key={q} type="button" className="qq" onClick={() => askQ(q)}>
                    {q}
                  </button>
                )
              )}
            </div>

            <div className="chat-msgs" id="msgs">
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
    </div>,
    document.body
  );
}
