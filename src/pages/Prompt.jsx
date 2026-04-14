import { useMemo, useState, useRef, useEffect } from "react";
import { saveHistory as saveHistorySupabase, listHistory, deleteHistory, deleteAllHistory } from "@/bibliotheque/supabase/historique";
import { useAuth } from "@/contexte/FournisseurAuth";
import { generateResponse } from "@/bibliotheque/openai/chatgpt-client";
import {
  clampGeneratedPrompt,
  validateIdeaLength,
  PROMPT_GEN_MAX_COMPLETION_TOKENS,
  PROMPT_GEN_TEMPERATURE_CONSTRAINED,
  PROMPT_GEN_MAX_IDEA_CHARS,
} from "@/bibliotheque/promptGenerationLimits";
import {
  buildSoraStyleSystemPrompt,
  buildSoraStyleUserPrompt,
} from "@/bibliotheque/videoPromptSchema";
import { hasEnoughCredits, debitCredits, getUserCredits } from "@/bibliotheque/supabase/credits";
import PageTitle from "../composants/interface/TitrePage";
import { FileText, Sparkles, Copy, Trash2, Search, X, History, Wand2, Check, BookOpen, Zap, Eye } from "lucide-react";

const PROMPT_GENERATION_COST = 1;

/** Libellé affiché pour l’historique (évite d’exposer le nom technique du modèle côté script). */
function formatHistoryModelLabel(model) {
  const m = (model || "").toLowerCase();
  if (!m) return "";
  if (m === "sora2") return "Script";
  return model.toUpperCase();
}

const LS_KEY = "history_v2";
function loadHistory() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Impossible de charger l'historique local prompt:", err);
    return [];
  }
}
function saveLocalHistory(items) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("Impossible de sauvegarder l'historique local prompt:", err);
  }
}
function addHistoryEntry(entry) {
  const items = loadHistory();
  saveLocalHistory([{ ...entry, pinned: false }, ...items]);
}
function getPromptHistory() {
  return loadHistory().filter((i) => i.kind === "prompt");
}

async function loadPromptHistoryForSession(session, limit = 100) {
  if (session?.user?.id) {
    try {
      return await listHistory({ kind: "prompt", limit });
    } catch (err) {
      console.warn("Fallback historique prompt local:", err);
      return getPromptHistory();
    }
  }
  return getPromptHistory();
}

export default function PromptAssistant({ initialIdea = "", sequenceType = "single_8s", dialogueEnabled = true, onScriptOutput }) {
  const [tab, setTab] = useState("script");
  const [showSystemVideo, setShowSystemVideo] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
      <PageTitle
        green="Prompts"
        white="Assistant"
          subtitle="Transforme tes idées en prompts détaillés pour la génération vidéo."
      />

      </div>

      {/* Barre de progression + boutons système / historique */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-300">Étape 1 sur 3 · Script gagnant</span>
          </div>
          <div className="w-full studio-step-rail">
            <div className="h-full w-1/3 studio-step-rail-fill" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSystemVideo(true)}
            className="studio-toolbar-btn"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            Explication du système
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className="studio-toolbar-btn"
          >
            <History className="w-3.5 h-3.5" />
            Historique
          </button>
        </div>
      </div>

      {tab === "history" ? (
        <PromptHistory />
      ) : (
        <ScriptPromptGenerator
          initialIdea={initialIdea}
          sequenceType={sequenceType}
          dialogueEnabled={dialogueEnabled}
          onScriptOutput={onScriptOutput}
        />
      )}

      {/* Pop-up explication du système */}
      {showSystemVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowSystemVideo(false)}
        >
          <div
            className="studio-panel max-w-3xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h2 className="text-base font-semibold text-gray-200">Explication du système</h2>
                <p className="text-xs text-gray-400 mt-1">
                  Cette courte vidéo t’explique à quoi sert cette page, comment bien utiliser les scripts,
                  et comment les exploiter ensuite pour créer tes visuels et ta vidéo finale.
                </p>
              </div>
              <button
                onClick={() => setShowSystemVideo(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="aspect-video w-full rounded-xl border border-white/10 bg-black/60 flex items-center justify-center text-xs text-gray-400">
                Vidéo explicative à intégrer ici
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 rounded-lg ${
        active
          ? "bg-cyan-500/20 text-cyan-100 border border-cyan-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] border border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

function VEO3Generator({ initialIdea = "" }) {
  const { session } = useAuth();
  const [idea, setIdea] = useState(initialIdea);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const disabled = useMemo(() => idea.trim().length < 8, [idea]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [credits, setCredits] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const outputRef = useRef(null);
  const prevOutputRef = useRef("");

  useEffect(() => {
    if (session) {
      loadCredits();
    }
  }, [session]);

  useEffect(() => {
    try {
      if (idea.trim()) return;
      const raw = localStorage.getItem("vws_brain_v2_last");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const seed = parsed?.brain?.scriptSeed;
      if (seed && !idea.trim()) {
        setIdea(seed);
      }
    } catch (err) {
      console.warn("Impossible de charger le cerveau VWS v2 pour le script:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCredits = async () => {
    const userCredits = await getUserCredits();
    setCredits(userCredits);
  };

  useEffect(() => {
    const refresh = async () => {
      setItems(await loadPromptHistoryForSession(session, 100));
    };
    refresh();
    window.addEventListener("onetool:history:changed", refresh);
    return () => window.removeEventListener("onetool:history:changed", refresh);
  }, [session]);

  useEffect(() => {
    if (output && output !== prevOutputRef.current) {
      prevOutputRef.current = output;
    }
  }, [output]);

  const reset = () => {
    setLoading(false);
    setIdea("");
    setOutput("");
    setCopied(false);
  };

  const copy = async () => {
    if (!renderedOutput) return;
    try {
      await navigator.clipboard.writeText(renderedOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Impossible de copier le prompt:", err);
      alert("Impossible de copier");
    }
  };

  const generate = async () => {
    if (disabled || loading) return;

    const lenCheck = validateIdeaLength(idea);
    if (!lenCheck.ok) {
      alert(lenCheck.message);
      return;
    }

    if (session) {
      const hasCredits = await hasEnoughCredits(PROMPT_GENERATION_COST);
      if (!hasCredits) {
        alert("Ton quota actuel ne permet pas de lancer une nouvelle génération. Mets à jour ton pack ou ton abonnement dans la Boutique.");
        return;
      }
    }

    setLoading(true);
    setOutput("");

    try {
      if (session) {
        console.log("💳 [Prompt VEO3] Début du débit des crédits...");
        const debitResult = await debitCredits(
          PROMPT_GENERATION_COST,
          "prompt_generation",
          { model: "veo3" }
        );
        
        console.log("💳 [Prompt VEO3] Résultat du débit:", debitResult);
        
        if (!debitResult.success) {
          const errorMsg = debitResult.error || "Erreur lors du débit des crédits";
          console.error("❌ [Prompt VEO3] Échec du débit:", errorMsg);
          alert("Une erreur est survenue lors de l’activation de cette génération. Réessaie dans quelques instants ou contacte le support si le problème persiste.");
          throw new Error(errorMsg);
        }
        
        if (debitResult.remainingCredits !== undefined) {
          setCredits(debitResult.remainingCredits);
          console.log("✅ [Prompt VEO3] Crédits mis à jour:", debitResult.remainingCredits);
        }
      }
      
      const systemPrompt = buildSoraStyleSystemPrompt("veo3");
      const userPrompt = buildSoraStyleUserPrompt(idea);

      console.log("🎬 [Prompt VEO3] Appel à generateResponse...");
      const generatedOutput = await generateResponse(userPrompt, systemPrompt, {
        model: "gpt-4o-mini",
        temperature: PROMPT_GEN_TEMPERATURE_CONSTRAINED,
        max_tokens: PROMPT_GEN_MAX_COMPLETION_TOKENS,
      });
      console.log("✅ [Prompt VEO3] Génération réussie");

      if (!generatedOutput || !generatedOutput.trim()) {
        throw new Error("Aucun prompt généré");
      }

      const safeOut = clampGeneratedPrompt(generatedOutput.trim());
      setOutput(safeOut);
      
      if (session?.user?.id) {
        try {
          await saveHistorySupabase({
            kind: "prompt",
            input: idea,
            output: safeOut,
            model: "veo3",
          });
        } catch (err) {
          console.warn("Erreur sauvegarde Supabase (non bloquant):", err);
        }
      } else {
        addHistoryEntry({
          id: crypto.randomUUID?.() || String(Date.now()),
          kind: "prompt",
          input: idea,
          output: safeOut,
          model: "veo3",
          createdAt: new Date().toISOString(),
        });
      }
      setItems(await loadPromptHistoryForSession(session, 100));
    } catch (err) {
      if (session) {
        await loadCredits();
      }
      console.error("❌ [Prompt VEO3] Erreur génération prompt:", err);
      
      if (err?.message?.includes("crédit") || err?.message?.includes("Crédits")) {
        alert("Ton quota ne permet pas de lancer cette génération. Tu peux ajuster ton offre dans la Boutique.");
        return;
      }
      console.error("❌ [Prompt VEO3] Détails:", {
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
      });
      let errorMessage = err?.message || "Erreur lors de la génération";
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("fetch")) {
        errorMessage = "Impossible de contacter le serveur. Vérifiez votre connexion internet et que la fonction Supabase 'openai-chat' est déployée et accessible.";
      } else if (errorMessage.includes("connecté") || errorMessage.includes("session")) {
        errorMessage = "Vous devez être connecté pour générer un prompt. Veuillez vous connecter.";
      } else if (errorMessage.includes("configuration serveur manquante") || errorMessage.includes("OPENAI_API_KEY")) {
        errorMessage = "Configuration serveur manquante. La clé OPENAI_API_KEY n'est pas configurée dans Supabase. Vérifiez le dashboard Supabase → Edge Functions → Secrets.";
      } else if (errorMessage.includes("VITE_SUPABASE_URL")) {
        errorMessage = "Configuration frontend manquante. Vérifiez que le fichier .env.local contient VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.";
      }
      
      const fullErrorMessage = `${errorMessage}\n\n💡 Pour plus de détails, ouvrez la console du navigateur (F12) et regardez les logs détaillés.`;
      alert(fullErrorMessage);
    } finally {
      setLoading(false);
    }
  };

  const removeOne = async (id) => {
    const item = items.find((i) => i.id === id);
    if (session?.user?.id && item?.user_id) {
      const result = await deleteHistory(id);
      if (!result.success) {
        alert("Erreur lors de la suppression");
        return;
      }
    } else {
      const all = loadHistory();
      saveLocalHistory(all.filter((i) => i.id !== id));
    }
    setItems(await loadPromptHistoryForSession(session, 100));
  };

  const renderedOutput = output;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="studio-panel p-5 sm:p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
  Ton idée (2–3 lignes)
</label>
<textarea
  value={idea}
  onChange={(e) => setIdea(e.target.value)}
            maxLength={PROMPT_GEN_MAX_IDEA_CHARS}
            className="w-full rounded-lg border border-white/10 p-4 min-h-[180px] text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none bg-white/5"
            placeholder="Ex : Un ado rentre sous la pluie, se parle à la caméra façon vlog, ambiance cinématique avec des reflets sur les vitres, musique douce en arrière-plan..."
/>
          <p className="mt-2 text-xs text-gray-400">
            {idea.length}/{PROMPT_GEN_MAX_IDEA_CHARS} caractères · décris ta scène de manière naturelle ; le modèle reste cantonné à ton idée et à des longueurs plafonnées.
          </p>
</div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="studio-panel inline-flex rounded-xl overflow-hidden p-1">
            <TabButton active={true}>
              <Zap className="w-3.5 h-3.5" />
              <span>VEO3</span>
            </TabButton>
          </div>
          <button
            onClick={generate}
            disabled={disabled || loading}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              disabled || loading || (session && credits !== null && credits < PROMPT_GENERATION_COST)
                ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10"
                : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white hover:from-emerald-400 hover:to-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95"
            }`}
        >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Générer le prompt
              </>
            )}
        </button>
        <button
          onClick={reset}
            className="px-4 py-3 rounded-lg font-medium bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-all active:scale-95"
        >
          Réinitialiser
        </button>
      </div>

        {output && (
          <div className="studio-panel p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Prompt généré (VEO3)
              </label>
  <button
    onClick={copy}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
    Copier
                  </>
                )}
  </button>
</div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <pre
                ref={outputRef}
                className="whitespace-pre-wrap text-gray-200 text-sm font-mono leading-relaxed"
              >
                {output}
              </pre>
            </div>
          </div>
        )}

        {!renderedOutput && !loading && (
          <div className="studio-panel p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Wand2 className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-sm text-gray-400">
              Saisis ton idée ci-dessus et génère ton prompt
            </p>
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <div className="studio-panel p-5 sm:p-6 sticky top-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Historique récent
            </h2>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-sm text-gray-400">
                Aucun prompt généré
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tes prompts apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {items.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-emerald-500/50 transition-all bg-white/5 p-3"
                >
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="w-full text-left"
                  >
                    <div className="text-xs font-medium text-gray-300 line-clamp-2 mb-2">
                      {item.input || item.output || "Sans titre"}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>
                        {new Date(item.created_at || item.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      {item.model && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                          {item.model.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOne(item.id);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    title="Supprimer"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de détails pour VEO3 */}
      {selectedItem && (
        <HistoryModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)}
          onLoadToEditor={(input, output) => {
            setIdea(input || "");
            setOutput(output || "");
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}

function HistoryModal({ item, onClose, onLoadToEditor }) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="studio-panel max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-200">Détails du prompt</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">
                  {new Date(item.created_at || item.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {formatHistoryModelLabel(item.model) && (
                  <>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-xs">
                      {formatHistoryModelLabel(item.model)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Input */}
          {item.input && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-300">Input (Idée originale)</span>
              </div>
              <div className="studio-inset p-4">
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{item.input}</p>
              </div>
            </div>
          )}

          {/* Output */}
          {item.output && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-300">Output (Prompt généré)</span>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(item.output);
                      alert("Copié dans le presse-papiers ✅");
                    } catch (err) {
                      console.warn("Impossible de copier le prompt:", err);
                      alert("Impossible de copier");
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all flex items-center gap-2 text-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copier
                </button>
              </div>
              <div className="studio-inset p-4">
                <p className="text-sm text-gray-200 whitespace-pre-wrap">{item.output}</p>
              </div>
            </div>
          )}

          {/* Si pas de contenu */}
          {!item.input && !item.output && (
            <div className="text-center py-12 text-gray-400">
              <p>Aucun contenu disponible</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
          {onLoadToEditor && (
            <button
              onClick={() => {
                onLoadToEditor(item.input, item.output);
              }}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Charger dans l'éditeur
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function PromptHistory() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    (async () => {
      if (session) {
        try {
        const rows = await listHistory({ kind: "prompt", limit: 50 });
        setItems(rows);
        } catch (err) {
          console.error("Erreur chargement historique:", err);
          setItems(getPromptHistory());
        }
      } else {
        setItems(getPromptHistory());
      }
      setLoading(false);
    })();
  }, [session]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const t = q.toLowerCase();
    return items.filter(
      (i) =>
        (i.input || "").toLowerCase().includes(t) ||
        (i.output || "").toLowerCase().includes(t)
    );
  }, [items, q]);

  const clearAll = async () => {
    if (!confirm("Supprimer tout l'historique ?")) return;
    
    if (session) {
      try {
        const result = await deleteAllHistory("prompt");
        if (!result.success) {
          console.error("Erreur suppression Supabase:", result.error);
          alert("Erreur lors de la suppression dans Supabase");
          return;
        }
      } catch (err) {
        console.error("Erreur suppression:", err);
        alert("Erreur lors de la suppression");
        return;
      }
    }
    
    const all = loadHistory();
    saveLocalHistory(all.filter((i) => i.kind !== "prompt" || i.pinned));
    
    if (session) {
      try {
        const rows = await listHistory({ kind: "prompt", limit: 50 });
        setItems(rows);
      } catch (err) {
        console.error("Erreur rechargement:", err);
        setItems(getPromptHistory());
      }
    } else {
      setItems(getPromptHistory());
    }
  };

  const viewDetails = (item) => {
    setSelectedItem(item);
  };

  const removeOne = async (id) => {
    if (session) {
      const item = items.find((i) => i.id === id);
      if (item && item.user_id) {
        try {
          const result = await deleteHistory(id);
          if (!result.success) {
            console.error("Erreur suppression Supabase:", result.error);
            alert("Erreur lors de la suppression");
            return;
          }
        } catch (err) {
          console.error("Erreur suppression:", err);
          alert("Erreur lors de la suppression");
          return;
        }
      }
    }
    
    const all = loadHistory();
    saveLocalHistory(all.filter((i) => i.id !== id));
    
    if (session) {
      try {
        const rows = await listHistory({ kind: "prompt", limit: 50 });
        setItems(rows);
      } catch (err) {
        console.error("Erreur rechargement:", err);
        setItems(getPromptHistory());
      }
    } else {
      setItems(getPromptHistory());
    }
  };

  return (
    <div className="space-y-4">
      <div className="studio-panel p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher dans l'historique…"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>
        {items.length > 0 && (
        <button
          onClick={clearAll}
            className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-red-500/10 hover:border-red-500/30 text-gray-300 hover:text-red-300 transition-all flex items-center gap-2"
            title="Effacer tout l'historique"
        >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Nettoyer</span>
        </button>
        )}
      </div>

      {loading ? (
        <div className="studio-panel p-12 text-center">
          <div className="w-8 h-8 mx-auto border-2 border-white/10 border-t-emerald-500/50 rounded-full animate-spin" />
          <p className="mt-4 text-sm text-gray-400">Chargement…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="studio-panel p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <History className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-sm text-gray-400">
            {q ? "Aucun résultat trouvé" : "Aucun prompt enregistré"}
          </p>
          {q && (
            <button
              onClick={() => setQ("")}
              className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
            >
              Effacer la recherche
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((i) => (
            <div
              key={i.id}
              className="studio-panel p-4 hover:border-cyan-500/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  onClick={() => viewDetails(i)}
                  className="flex-1 text-left hover:opacity-80 transition-opacity"
                  title="Voir les détails"
                >
                  <div className="text-sm font-medium text-gray-200 line-clamp-2 mb-2">
                    {i.output || i.input || "Sans titre"}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>
                      {new Date(i.created_at || i.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {formatHistoryModelLabel(i.model) && (
                      <>
                        <span>·</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">
                          {formatHistoryModelLabel(i.model)}
                        </span>
                      </>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => viewDetails(i)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-300"
                    title="Voir les détails"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeOne(i.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-300"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de détails */}
      {selectedItem && (
        <HistoryModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)}
          onLoadToEditor={(input, output) => {
            window.dispatchEvent(
              new CustomEvent("onetool:prompt:load", {
                detail: { input, output },
              })
            );
            setSelectedItem(null);
            alert("Chargé dans l'éditeur ✅ (onglet VEO3)");
          }}
        />
      )}
    </div>
  );
}

function ScriptPromptGenerator({ initialIdea = "", sequenceType = "single_8s", dialogueEnabled = true, onScriptOutput }) {
  const { session } = useAuth();
  const [idea, setIdea] = useState(initialIdea);
  const [output, setOutput] = useState("");
  const isMultiScene = sequenceType === "three_x_8s";
  const sceneLabels = ["Début", "Transformation", "Résultat"];
  const [activeScene, setActiveScene] = useState(0);
  const [sceneOutputs, setSceneOutputs] = useState(["", "", ""]);
  const [copied, setCopied] = useState(false);
  const disabled = useMemo(() => idea.trim().length < 8, [idea]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const outputRef = useRef(null);
  const prevOutputRef = useRef("");
  const prevInitialIdeaRef = useRef(initialIdea);
  const prevSequenceTypeRef = useRef(sequenceType);

  useEffect(() => {
    if (prevSequenceTypeRef.current === sequenceType) return;
    prevSequenceTypeRef.current = sequenceType;
    setOutput("");
    setSceneOutputs(["", "", ""]);
    setActiveScene(0);
    setCopied(false);
    onScriptOutput?.({
      mode: isMultiScene ? "multi" : "single",
      combined: "",
      scenes: ["", "", ""],
    });
  }, [sequenceType, isMultiScene, onScriptOutput]);

  useEffect(() => {
    if (prevInitialIdeaRef.current === initialIdea) return;
    prevInitialIdeaRef.current = initialIdea;
    setIdea(initialIdea ?? "");
    setOutput("");
    setSceneOutputs(["", "", ""]);
    setActiveScene(0);
    setCopied(false);
    prevOutputRef.current = "";
    onScriptOutput?.({
      mode: isMultiScene ? "multi" : "single",
      combined: "",
      scenes: ["", "", ""],
    });
  }, [initialIdea, isMultiScene, onScriptOutput]);

  useEffect(() => {
    const refresh = async () => {
      setItems(await loadPromptHistoryForSession(session, 100));
    };
    refresh();
    window.addEventListener("onetool:history:changed", refresh);
    return () => window.removeEventListener("onetool:history:changed", refresh);
  }, [session]);

  useEffect(() => {
    if (output && output !== prevOutputRef.current) {
      prevOutputRef.current = output;
    }
  }, [output]);

  const reset = () => {
    setLoading(false);
    setIdea("");
    setOutput("");
    setSceneOutputs(["", "", ""]);
    setActiveScene(0);
    setCopied(false);
    onScriptOutput?.({
      mode: isMultiScene ? "multi" : "single",
      combined: "",
      scenes: ["", "", ""],
    });
  };

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Impossible de copier le prompt:", err);
      alert("Impossible de copier");
    }
  };

  const generate = async () => {
    if (disabled || loading) return;

    const lenCheck = validateIdeaLength(idea);
    if (!lenCheck.ok) {
      alert(lenCheck.message);
      return;
    }

    if (session) {
      const hasCredits = await hasEnoughCredits(PROMPT_GENERATION_COST);
      if (!hasCredits) {
        alert("Ton quota actuel ne permet pas de lancer une nouvelle génération. Mets à jour ton pack ou ton abonnement dans la Boutique.");
        return;
      }
    }

    setLoading(true);
    setOutput("");

    try {
      if (session) {
        console.log("💳 [Prompt Script] Début du débit des crédits...");
        const debitResult = await debitCredits(
          PROMPT_GENERATION_COST,
          "prompt_generation",
          { model: "sora2" }
        );
        
        console.log("💳 [Prompt Script] Résultat du débit:", debitResult);
        
        if (!debitResult.success) {
          const errorMsg = debitResult.error || "Erreur lors du débit des crédits";
          console.error("❌ [Prompt Script] Échec du débit:", errorMsg);
          alert(`Erreur: ${errorMsg}`);
          throw new Error(errorMsg);
        }
      }
      
      const systemPrompt = buildSoraStyleSystemPrompt("sora2");
      const runOneScene = async (sceneLabel) => {
        const sceneContext = `\n\nContrainte multi-scènes: génère uniquement la scène "${sceneLabel}" en restant cohérent avec l'idée globale.`;
        const userPrompt = buildSoraStyleUserPrompt(`${idea}${sceneContext}`, { dialogueEnabled });
        const generatedOutput = await generateResponse(userPrompt, systemPrompt, {
          model: "gpt-4o-mini",
          temperature: PROMPT_GEN_TEMPERATURE_CONSTRAINED,
          max_tokens: PROMPT_GEN_MAX_COMPLETION_TOKENS,
        });
        if (!generatedOutput || !generatedOutput.trim()) {
          throw new Error(`Aucun prompt généré pour la scène ${sceneLabel}`);
        }
        return clampGeneratedPrompt(generatedOutput.trim());
      };

      let trimmed = "";
      if (isMultiScene) {
        const nextScenes = [];
        for (let i = 0; i < sceneLabels.length; i += 1) {
          setActiveScene(i);
          nextScenes.push(await runOneScene(sceneLabels[i]));
        }
        const combined = nextScenes.join("\n\n---\n\n");
        setSceneOutputs(nextScenes);
        setOutput(combined);
        onScriptOutput?.({
          mode: "multi",
          combined,
          scenes: nextScenes,
        });
      } else {
        const userPrompt = buildSoraStyleUserPrompt(idea, { dialogueEnabled });
        const generatedOutput = await generateResponse(userPrompt, systemPrompt, {
          model: "gpt-4o-mini",
          temperature: PROMPT_GEN_TEMPERATURE_CONSTRAINED,
          max_tokens: PROMPT_GEN_MAX_COMPLETION_TOKENS,
        });
        if (!generatedOutput || !generatedOutput.trim()) {
          throw new Error("Aucun prompt généré");
        }
        trimmed = clampGeneratedPrompt(generatedOutput.trim());
        setOutput(trimmed);
        onScriptOutput?.({
          mode: "single",
          combined: trimmed,
          scenes: [trimmed, "", ""],
        });
      }

      if (session?.user?.id) {
        try {
          await saveHistorySupabase({
            kind: "prompt",
            input: idea,
            output: trimmed,
            model: "sora2",
          });
        } catch (err) {
          console.warn("Erreur sauvegarde Supabase (non bloquant):", err);
        }
      } else {
        addHistoryEntry({
          id: crypto.randomUUID?.() || String(Date.now()),
          kind: "prompt",
          input: idea,
          output: trimmed,
          model: "sora2",
          createdAt: new Date().toISOString(),
        });
      }
      setItems(await loadPromptHistoryForSession(session, 100));
    } catch (err) {
      console.error("❌ [Prompt Script] Erreur génération prompt:", err);

      if (err?.message?.includes("crédit") || err?.message?.includes("Crédits")) {
        alert("Ton quota ne permet pas de lancer cette génération. Tu peux ajuster ton offre dans la Boutique.");
        return;
      }
      console.error("❌ [Prompt Script] Détails:", {
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
      });
      let errorMessage = err?.message || "Erreur lors de la génération";
      
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("fetch")) {
        errorMessage = "Impossible de contacter le serveur. Vérifiez votre connexion internet et que la fonction Supabase 'openai-chat' est déployée et accessible.";
      } else if (errorMessage.includes("connecté") || errorMessage.includes("session")) {
        errorMessage = "Vous devez être connecté pour générer un prompt. Veuillez vous connecter.";
      } else if (errorMessage.includes("configuration serveur manquante") || errorMessage.includes("OPENAI_API_KEY")) {
        errorMessage = "Configuration serveur manquante. La clé OPENAI_API_KEY n'est pas configurée dans Supabase. Vérifiez le dashboard Supabase → Edge Functions → Secrets.";
      } else if (errorMessage.includes("VITE_SUPABASE_URL")) {
        errorMessage = "Configuration frontend manquante. Vérifiez que le fichier .env.local contient VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.";
      }
      
      const fullErrorMessage = `${errorMessage}\n\n💡 Pour plus de détails, ouvrez la console du navigateur (F12) et regardez les logs détaillés.`;
      alert(fullErrorMessage);
    } finally {
      setLoading(false);
    }
  };

  const removeOne = async (id) => {
    const item = items.find((i) => i.id === id);
    if (session?.user?.id && item?.user_id) {
      const result = await deleteHistory(id);
      if (!result.success) {
        alert("Erreur lors de la suppression");
        return;
      }
    } else {
      const all = loadHistory();
      saveLocalHistory(all.filter((i) => i.id !== id));
    }
    setItems(await loadPromptHistoryForSession(session, 100));
  };
  const renderedOutput = isMultiScene ? sceneOutputs[activeScene] || "" : output;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="studio-panel p-5 sm:p-6">
          <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            Ton idée (2–3 lignes)
          </label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={PROMPT_GEN_MAX_IDEA_CHARS}
            className="w-full rounded-lg border border-white/10 p-4 min-h-[180px] text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none bg-white/5"
            placeholder="Ex : Un plan séquence dans un café parisien, caméra fluide, ambiance chaleureuse, lumière naturelle filtrée, style cinématographique..."
          />
          <p className="mt-2 text-xs text-gray-400">
            {idea.length}/{PROMPT_GEN_MAX_IDEA_CHARS} caractères · décris ta scène de manière naturelle ; le modèle reste cantonné à ton idée et à des longueurs plafonnées.
          </p>
        </div>

        {isMultiScene ? (
          <div className="studio-panel p-2 inline-flex gap-1 rounded-xl">
            {sceneLabels.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveScene(idx)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                  activeScene === idx
                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                    : "bg-white/5 text-gray-400 border-white/10 hover:text-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            onClick={generate}
            disabled={disabled || loading}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              disabled || loading
                ? "bg-white/5 text-gray-500 cursor-not-allowed border border-white/10"
                : "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white hover:from-emerald-400 hover:to-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-95"
            }`}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Génération en cours…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Générer le script
              </>
            )}
          </button>
          <button
            onClick={reset}
            className="px-4 py-3 rounded-lg font-medium bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition-all active:scale-95"
          >
            Réinitialiser
          </button>
        </div>

        {renderedOutput && (
          <div className="studio-panel p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                {isMultiScene ? `Prompt — ${sceneLabels[activeScene]}` : "Prompt généré"}
              </label>
              <button
                onClick={copy}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  copied
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copier
                  </>
                )}
              </button>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <pre
                ref={outputRef}
                className="whitespace-pre-wrap text-gray-200 text-sm font-mono leading-relaxed"
              >
                {renderedOutput}
              </pre>
            </div>
          </div>
        )}

        {!renderedOutput && !loading && (
          <div className="studio-panel p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Wand2 className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-sm text-gray-400">
              Saisis ton idée ci-dessus et génère ton script
            </p>
          </div>
        )}
      </div>

      <div className="lg:col-span-1">
        <div className="studio-panel p-5 sm:p-6 sticky top-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Historique récent
            </h2>
          </div>

          {items.filter(i => (i.model || "").toLowerCase() === "sora2").length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-sm text-gray-400">
                Aucun script enregistré
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Tes prompts apparaîtront ici
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {items
                .filter(i => (i.model || "").toLowerCase() === "sora2")
                .slice(0, 10)
                .map((item) => (
                  <div
                    key={item.id}
                    className="group relative overflow-hidden rounded-lg border border-white/10 hover:border-emerald-500/50 transition-all bg-white/5 p-3"
                  >
                    <button
                      onClick={() => setSelectedItem(item)}
                      className="w-full text-left"
                    >
                      <div className="text-xs font-medium text-gray-300 line-clamp-2 mb-2">
                        {item.input || item.output || "Sans titre"}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>
                          {new Date(item.created_at || item.createdAt).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                        {formatHistoryModelLabel(item.model) && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            {formatHistoryModelLabel(item.model)}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOne(item.id);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500/80 hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      title="Supprimer"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de détails (script gagnant) */}
      {selectedItem && (
        <HistoryModal 
          item={selectedItem} 
          onClose={() => setSelectedItem(null)}
          onLoadToEditor={(input, output) => {
            setIdea(input || "");
            setOutput(output || "");
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}
