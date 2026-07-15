import type { LocaleBundle } from "./ui";

const playbookFr = {
  pageTitle: "Playbook",
  intro:
    "Ce que j'ai appris en créant du contenu IA — condensé en guides courts, directs, utilisables tout de suite.",
  back: "← Playbook",
  readSuffix: "de lecture",
  nextGuide: "Guide suivant →",
  backToPlaybook: "← Retour au Playbook",
  guideCount: "{count} guide",
  guideCountPlural: "{count} guides",
  heroKicker: "Retour d'expérience",
  sections: {
    social: "Réseaux sociaux",
    creation: "Création IA",
    avatar: "Avatar & Produit",
    montage: "Montage & Voix",
  },
  viewLabels: {
    social: "RÉSEAUX SOCIAUX",
    creation: "CRÉATION IA",
    avatar: "AVATAR & PRODUIT",
    montage: "MONTAGE & VOIX",
  },
  heroStats: {
    views: "vues / vidéo",
    beforeMillion: "avant le million",
    formats: "formats testés",
  },
};

const playbookEn = {
  pageTitle: "Playbook",
  intro:
    "What I learned creating AI content — condensed into short, direct guides you can use right away.",
  back: "← Playbook",
  readSuffix: "read",
  nextGuide: "Next guide →",
  backToPlaybook: "← Back to Playbook",
  guideCount: "{count} guide",
  guideCountPlural: "{count} guides",
  heroKicker: "Field notes",
  sections: {
    social: "Social media",
    creation: "AI creation",
    avatar: "Avatar & Product",
    montage: "Editing & Voice",
  },
  viewLabels: {
    social: "SOCIAL MEDIA",
    creation: "AI CREATION",
    avatar: "AVATAR & PRODUCT",
    montage: "EDITING & VOICE",
  },
  heroStats: {
    views: "views / video",
    beforeMillion: "before the million",
    formats: "formats tested",
  },
};

const playbookEs = {
  pageTitle: "Guía",
  intro:
    "Lo que aprendí creando contenido con IA — condensado en guías cortas, directas y listas para usar.",
  back: "← Guía",
  readSuffix: "de lectura",
  nextGuide: "Siguiente guía →",
  backToPlaybook: "← Volver a la guía",
  guideCount: "{count} guía",
  guideCountPlural: "{count} guías",
  heroKicker: "Experiencia real",
  sections: {
    social: "Redes sociales",
    creation: "Creación IA",
    avatar: "Avatar y producto",
    montage: "Montaje y voz",
  },
  viewLabels: {
    social: "REDES SOCIALES",
    creation: "CREACIÓN IA",
    avatar: "AVATAR Y PRODUCTO",
    montage: "MONTAJE Y VOZ",
  },
  heroStats: {
    views: "vistas / vídeo",
    beforeMillion: "antes del millón",
    formats: "formatos probados",
  },
};

const playbookDe = {
  pageTitle: "Leitfaden",
  intro:
    "Was ich beim Erstellen von KI-Content gelernt habe — komprimiert in kurze, direkte Guides zum sofortigen Einsatz.",
  back: "← Leitfaden",
  readSuffix: "Lesezeit",
  nextGuide: "Nächster Guide →",
  backToPlaybook: "← Zurück zum Leitfaden",
  guideCount: "{count} Guide",
  guideCountPlural: "{count} Guides",
  heroKicker: "Praxiserfahrung",
  sections: {
    social: "Soziale Netzwerke",
    creation: "KI-Erstellung",
    avatar: "Avatar & Produkt",
    montage: "Schnitt & Stimme",
  },
  viewLabels: {
    social: "SOZIALE NETZWERKE",
    creation: "KI-ERSTELLUNG",
    avatar: "AVATAR & PRODUKT",
    montage: "SCHNITT & STIMME",
  },
  heroStats: {
    views: "Aufrufe / Video",
    beforeMillion: "vor der Million",
    formats: "getestete Formate",
  },
};

const playbookPt = {
  pageTitle: "Guia",
  intro:
    "O que aprendi criando conteúdo com IA — condensado em guias curtos, diretos e prontos a usar.",
  back: "← Guia",
  readSuffix: "de leitura",
  nextGuide: "Próximo guia →",
  backToPlaybook: "← Voltar ao guia",
  guideCount: "{count} guia",
  guideCountPlural: "{count} guias",
  heroKicker: "Experiência real",
  sections: {
    social: "Redes sociais",
    creation: "Criação IA",
    avatar: "Avatar e produto",
    montage: "Montagem e voz",
  },
  viewLabels: {
    social: "REDES SOCIAIS",
    creation: "CRIAÇÃO IA",
    avatar: "AVATAR E PRODUTO",
    montage: "MONTAGEM E VOZ",
  },
  heroStats: {
    views: "visualizações / vídeo",
    beforeMillion: "antes do milhão",
    formats: "formatos testados",
  },
};

const playbookIt = {
  pageTitle: "Guida",
  intro:
    "Cosa ho imparato creando contenuti IA — condensato in guide brevi, dirette e subito utilizzabili.",
  back: "← Guida",
  readSuffix: "di lettura",
  nextGuide: "Guida successiva →",
  backToPlaybook: "← Torna alla guida",
  guideCount: "{count} guida",
  guideCountPlural: "{count} guide",
  heroKicker: "Esperienza sul campo",
  sections: {
    social: "Social media",
    creation: "Creazione IA",
    avatar: "Avatar e prodotto",
    montage: "Montaggio e voce",
  },
  viewLabels: {
    social: "SOCIAL MEDIA",
    creation: "CREAZIONE IA",
    avatar: "AVATAR E PRODOTTO",
    montage: "MONTAGGIO E VOCE",
  },
  heroStats: {
    views: "visualizzazioni / video",
    beforeMillion: "prima del milione",
    formats: "formati testati",
  },
};

export const playbookBundle: LocaleBundle = {
  fr: { playbook: playbookFr },
  en: { playbook: playbookEn },
  es: { playbook: playbookEs },
  de: { playbook: playbookDe },
  pt: { playbook: playbookPt },
  it: { playbook: playbookIt },
};
