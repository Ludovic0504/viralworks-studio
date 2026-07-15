export type SiteLocale = "fr" | "en" | "es" | "de" | "pt" | "it";

export type MessageTree = {
  [key: string]: string | MessageTree;
};

export type TranslateVars = Record<string, string | number>;
