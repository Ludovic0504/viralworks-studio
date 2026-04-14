
import { useState } from "react";
import { 
  Video, 
  Image as ImageIcon, 
  FileText, 
  Zap, 
  TrendingUp, 
  Lightbulb,
  Target,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

const SECTIONS = [
  {
    id: "prompts",
    icon: FileText,
    title: "Création de prompts",
    color: "cyan",
    gradient: "from-cyan-500/20 to-cyan-400/10",
    border: "border-cyan-500/30",
    items: [
      {
        title: "Structure efficace",
        content: "Commence par définir le contexte, puis l'action principale, et termine par le style souhaité. Exemple : 'Un développeur dans un bureau moderne, en train de coder sur un écran lumineux, style cinématique avec éclairage dramatique'.",
        example: "Contexte → Action → Style"
      },
      {
        title: "Détails techniques",
        content: "Spécifie la caméra, l'éclairage et le ton. Pour VEO3, utilise les paramètres Scene, Style, Camera, Lighting et Tone pour un contrôle précis du rendu final.",
        example: "Camera: close-up | Lighting: golden hour"
      },
      {
        title: "Dialogues en français",
        content: "Pour les vidéos avec dialogues, indique clairement les répliques en français. Le système traduira et adaptera automatiquement la prononciation.",
        example: "Dialogue: 'Bonjour, comment allez-vous ?'"
      }
    ]
  },
  {
    id: "images",
    icon: ImageIcon,
    title: "Génération d'images",
    color: "violet",
    gradient: "from-violet-500/20 to-violet-400/10",
    border: "border-violet-500/30",
    items: [
      {
        title: "Descriptions précises",
        content: "Plus ta description est détaillée, meilleur sera le résultat. Mentionne la composition, les couleurs, l'ambiance et le style artistique souhaité.",
        example: "Portrait d'une femme, style réaliste, éclairage doux, fond flou"
      },
      {
        title: "Personnages de référence",
        content: "Utilise l'option de personnage de référence pour maintenir la cohérence visuelle dans une série d'images. Idéal pour créer des personnages récurrents.",
        example: "Même personnage, différentes poses"
      },
      {
        title: "Formats adaptés",
        content: "Choisis le format selon l'usage : carré pour Instagram, paysage pour bannières, portrait pour stories. Chaque format a son impact visuel.",
        example: "16:9 pour vidéos | 1:1 pour posts"
      }
    ]
  },
  {
    id: "workflow",
    icon: Zap,
    title: "Workflow optimisé",
    color: "yellow",
    gradient: "from-yellow-500/20 to-yellow-400/10",
    border: "border-yellow-500/30",
    items: [
      {
        title: "Organisation par projets",
        content: "Regroupe tes créations par projet pour garder une vue d'ensemble. Un projet peut contenir plusieurs prompts, images et vidéos liés.",
        example: "Projet 'Campagne Marketing' → 5 prompts, 10 images"
      },
      {
        title: "Historique intelligent",
        content: "Tous tes contenus sont sauvegardés automatiquement. Tu peux retrouver, modifier et réutiliser n'importe quelle création précédente.",
        example: "Accès rapide aux dernières créations"
      },
      {
        title: "Itérations rapides",
        content: "Teste plusieurs variations en ajustant légèrement tes prompts. Les meilleurs résultats viennent souvent de petites modifications successives.",
        example: "Version 1 → Ajustement → Version 2 → Final"
      }
    ]
  },
  {
    id: "tips",
    icon: Lightbulb,
    title: "Conseils pratiques",
    color: "emerald",
    gradient: "from-emerald-500/20 to-emerald-400/10",
    border: "border-emerald-500/30",
    items: [
      {
        title: "Commence simple",
        content: "Pour tes premiers essais, utilise des prompts courts et clairs. Une fois que tu maîtrises, tu peux ajouter plus de détails et de complexité.",
        example: "Simple: 'Un chat dans un jardin' → Avancé: 'Un chat persan orange dans un jardin japonais, style photographie macro, éclairage naturel matinal'"
      },
      {
        title: "Expérimente les styles",
        content: "N'hésite pas à tester différents styles artistiques : réaliste, cartoon, cinématique, abstrait. Chaque style apporte une émotion différente.",
        example: "Même sujet, styles différents = résultats uniques"
      },
      {
        title: "Sauvegarde tes favoris",
        content: "Quand tu trouves un prompt qui fonctionne bien, sauvegarde-le comme modèle. Tu pourras le réutiliser et l'adapter pour d'autres créations.",
        example: "Modèles réutilisables dans l'historique"
      }
    ]
  }
];

function SectionCard({ section, isExpanded, onToggle }) {
  const Icon = section.icon;
  
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-white/20">
      <button
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg bg-gradient-to-br ${section.gradient} ${section.border} border`}>
            <Icon className={`w-6 h-6 ${
              section.color === 'cyan' ? 'text-cyan-300' :
              section.color === 'violet' ? 'text-violet-300' :
              section.color === 'yellow' ? 'text-yellow-300' :
              'text-emerald-300'
            }`} />
          </div>
          <h2 className="text-lg font-semibold text-white">{section.title}</h2>
        </div>
        <ArrowRight 
          className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} 
        />
      </button>
      
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4 animate-fadeIn">
          {section.items.map((item, index) => (
            <div 
              key={index}
              className="p-4 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start gap-3 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed mb-3">{item.content}</p>
                  {item.example && (
                    <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20">
                      <p className="text-xs text-cyan-300 font-mono">{item.example}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Asavoir() {
  const [expandedSections, setExpandedSections] = useState([]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <main className="min-h-full relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <header className="mb-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white mb-3">
              <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-cyan-200 bg-clip-text text-transparent">
                Informations utiles
              </span>
            </h1>
            <p className="text-slate-400 text-base max-w-2xl">
              Guide pratique pour tirer le meilleur parti de ViralWorks Studio. Découvre les meilleures pratiques, astuces et workflows pour créer du contenu de qualité.
            </p>
          </div>
        </header>

        <div className="space-y-4">
        {SECTIONS.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            isExpanded={expandedSections.includes(section.id)}
            onToggle={() => toggleSection(section.id)}
          />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </main>
  );
}
