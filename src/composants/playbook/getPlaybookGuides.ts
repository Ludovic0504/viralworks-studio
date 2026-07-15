import type { SiteLocale } from "@/bibliotheque/i18n/types";

export type PlaybookGuide = {
  id: number;
  cat: string;
  cl: string;
  label: string;
  type: string;
  featured?: boolean;
  title: string;
  desc: string;
  read: string;
  contentHtml: string;
};

function normalizeGuide(g: PlaybookGuide): PlaybookGuide {
  return {
    ...g,
    featured: Boolean(g.featured),
    type: g.type ?? "ext",
  };
}

const GUIDE_FILES = import.meta.glob<PlaybookGuide[]>("./playbookGuides*.json", {
  eager: true,
  import: "default",
}) as Record<string, PlaybookGuide[]>;

function guidesFromFile(filename: string): PlaybookGuide[] | undefined {
  const guides = GUIDE_FILES[`./${filename}`];
  return Array.isArray(guides) && guides.length > 0 ? guides.map(normalizeGuide) : undefined;
}

const LOCALE_FILES: Record<SiteLocale, string[]> = {
  fr: ["playbookGuides.json"],
  en: ["playbookGuides.en.json", "playbookGuides.json"],
  es: ["playbookGuides.es.json", "playbookGuides.en.json", "playbookGuides.json"],
  de: ["playbookGuides.de.json", "playbookGuides.en.json", "playbookGuides.json"],
  pt: ["playbookGuides.pt.json", "playbookGuides.en.json", "playbookGuides.json"],
  it: ["playbookGuides.it.json", "playbookGuides.en.json", "playbookGuides.json"],
};

export function getPlaybookGuides(locale: SiteLocale): PlaybookGuide[] {
  for (const file of LOCALE_FILES[locale]) {
    const guides = guidesFromFile(file);
    if (guides) return guides;
  }
  return guidesFromFile("playbookGuides.json") ?? [];
}
