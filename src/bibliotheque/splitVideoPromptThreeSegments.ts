/**
 * Découpe un script campagne en 3 prompts séquentiels pour le pipeline 24 s (3 × 8 s).
 * Ordre : **OpenAI** (`openai-chat`) → découpage texte.
 */
import { chatCompletion, type ChatMessage } from "./openai/chatgpt-client";

/** Pour scripts sources longs : rejette une réponse si une part est trop courte (segments factuels courts acceptés). */
const MIN_PART_LENGTH_FOR_LONG_SRC = 28;

function normalizeForDupCheck(text: string): string {
  return String(text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function areThreeDistinct(a: string, b: string, c: string): boolean {
  const na = normalizeForDupCheck(a);
  const nb = normalizeForDupCheck(b);
  const nc = normalizeForDupCheck(c);
  if (!na || !nb || !nc) return false;
  return na !== nb && nb !== nc && na !== nc;
}

function ensureDistinctSplit(src: string, parts: [string, string, string]): [string, string, string] {
  const [a, b, c] = parts;
  if (areThreeDistinct(a, b, c)) return parts;
  // Fallback deterministic char split to force differences.
  const t = String(src || "").trim();
  const len = t.length;
  const third = Math.max(1, Math.ceil(len / 3));
  const out: [string, string, string] = [
    t.slice(0, third).trim(),
    t.slice(third, third * 2).trim(),
    t.slice(third * 2).trim(),
  ];
  return out;
}

function roughSplitThree(text: string): [string, string, string] {
  const t = String(text || "").trim();
  if (!t) return ["", "", ""];
  const paras = t.split(/\n\n+/).filter(Boolean);
  if (paras.length >= 3) {
    const n = paras.length;
    const a = Math.ceil(n / 3);
    const b = Math.ceil((2 * n) / 3);
    return [
      paras.slice(0, a).join("\n\n"),
      paras.slice(a, b).join("\n\n"),
      paras.slice(b).join("\n\n"),
    ];
  }
  const len = t.length;
  const third = Math.ceil(len / 3);
  return [t.slice(0, third), t.slice(third, third * 2), t.slice(third * 2)];
}

function parseThreeFromJson(raw: string): [string, string, string] | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Record<string, unknown>;
    const p1 = String(o.part1 ?? o.segment1 ?? o.p1 ?? "").trim();
    const p2 = String(o.part2 ?? o.segment2 ?? o.p2 ?? "").trim();
    const p3 = String(o.part3 ?? o.segment3 ?? o.p3 ?? "").trim();
    if (p1.length >= 8 && p2.length >= 8 && p3.length >= 8) return [p1, p2, p3];
  } catch {
    return null;
  }
  return null;
}

const OPENAI_SYSTEM_MESSAGES = (): ChatMessage[] => [
  {
    role: "system",
    content: `Tu répartis un script unique en exactement 3 résumés FACTUELS et COURTS, dans l’ordre chronologique (début, milieu, fin du récit). Chaque résumé doit répondre uniquement à : **qui fait quoi, avec quoi, et où** — rien de plus. Ce sont des lignes utiles à la visualisation, pas un brief artistique.

Réponds UNIQUEMENT par un JSON compact, sans markdown ni texte avant ou après :
{"part1":"...","part2":"...","part3":"..."}
- part1 / part2 / part3 : une étape successive du récit (première phase, puis milieu, puis fin).

Pour chaque chaîne, intègre **seulement ce qui est dans le script ou directement déductible du métier décrit** :
- **Qui** : rôle ou personne (ex. jardinier, artisan).
- **Quoi** : action concrète (ex. tailler des haies).
- **Avec quoi** : outil, équipement ou marque si le script les nomme (ex. taille-haie électrique Stihl).
- **Où** : lieu utile à la scène si présent ou évident (ex. jardin privatif chez un client, chantier, intérieur d’une maison, atelier). Si le script ne donne aucun lieu, omettre ou rester minimal — ne pas inventer un décor.

INTERDIT (ne pas ajouter, même pour « enrichir ») : lumière, heure, météo, émotions, atmosphère, métaphores, style cinéma, couleurs, musique, formulations poétiques ou marketing, détails décoratifs inventés.

Si une info manque, ne pas inventer : phrase plus courte ou générique, sans combler par de l’imaginaire.

Contraintes CRITIQUES :
- Les 3 champs doivent être DISTINCTS (pas de copier-coller identique).
- Chaque part couvre un moment différent (début / milieu / fin).
- Une phrase courte par part si possible (français ou anglais selon la source).
- Ne répète pas la même phrase dans part1/part2/part3. Pas d’autres clés.`,
  },
];

async function splitWithOpenAi(src: string): Promise<[string, string, string] | null> {
  try {
    const messages: ChatMessage[] = [
      ...OPENAI_SYSTEM_MESSAGES(),
      {
        role: "user",
        content: `Script campagne à découper en trois résumés séquentiels (début / milieu / fin). Chaque résumé : qui fait quoi, avec quoi, où — tiré du texte ci-dessous uniquement :\n\n${src.slice(0, 12000)}`,
      },
    ];
    const res = await chatCompletion(messages, {
      model: "gpt-4o-mini",
      temperature: 0.15,
      max_tokens: 1024,
    });
    const raw = res?.choices?.[0]?.message?.content ?? "";
    const parsed = parseThreeFromJson(raw);
    if (parsed) {
      const [p1, p2, p3] = parsed;
      // Reject duplicate-like splits even if JSON is valid.
      if (!areThreeDistinct(p1, p2, p3)) {
        if (import.meta.env.DEV) {
          console.debug("[24s diag] splitWithOpenAi rejected (duplicate parts)", {
            lens: [p1.length, p2.length, p3.length],
            eq01: normalizeForDupCheck(p1) === normalizeForDupCheck(p2),
            eq12: normalizeForDupCheck(p2) === normalizeForDupCheck(p3),
            eq02: normalizeForDupCheck(p1) === normalizeForDupCheck(p3),
            heads: [p1.slice(0, 80), p2.slice(0, 80), p3.slice(0, 80)],
          });
        }
        return null;
      }
      // Si le script source est long, éviter des réponses trivialement vides tout en acceptant des phrases factuelles courtes.
      if (
        src.length >= 240 &&
        (p1.length < MIN_PART_LENGTH_FOR_LONG_SRC ||
          p2.length < MIN_PART_LENGTH_FOR_LONG_SRC ||
          p3.length < MIN_PART_LENGTH_FOR_LONG_SRC)
      ) {
        if (import.meta.env.DEV) {
          console.debug("[24s diag] splitWithOpenAi rejected (too short segments for long src)", {
            srcLength: src.length,
            minLen: MIN_PART_LENGTH_FOR_LONG_SRC,
            lens: [p1.length, p2.length, p3.length],
          });
        }
        return null;
      }
    }
    if (import.meta.env.DEV) {
      console.debug("[24s diag] splitWithOpenAi", {
        rawLength: raw.length,
        rawFull: raw,
        parsedNull: parsed === null,
        parsedLens: parsed ? [parsed[0].length, parsed[1].length, parsed[2].length] : null,
        parsedEq01: parsed ? parsed[0] === parsed[1] : null,
        parsedEq12: parsed ? parsed[1] === parsed[2] : null,
        parsedEq02: parsed ? parsed[0] === parsed[2] : null,
        parsedHeads: parsed
          ? [parsed[0].slice(0, 80), parsed[1].slice(0, 80), parsed[2].slice(0, 80)]
          : null,
      });
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Découpe le script principal en trois parties cohérentes pour Veo (8 s chacune enchaînées).
 */
export async function splitCampaignPromptIntoThreeVideoSegments(
  combinedCampaignScript: string
): Promise<[string, string, string]> {
  const src = String(combinedCampaignScript || "").trim();
  if (src.length < 24) {
    if (import.meta.env.DEV) {
      console.debug("[24s diag] splitCampaignPromptIntoThreeVideoSegments branch", {
        branch: "short_src_lt_24",
        srcLength: src.length,
      });
    }
    const [a, b, c] = roughSplitThree(src);
    const out: [string, string, string] = [
      a || src.slice(0, Math.max(8, Math.ceil(src.length / 3))),
      b || src.slice(Math.ceil(src.length / 3), Math.ceil((2 * src.length) / 3)),
      c || src.slice(Math.ceil((2 * src.length) / 3)),
    ];
    if (import.meta.env.DEV) {
      console.debug("[24s diag] roughSplitThree result (short src)", {
        outLens: [out[0].length, out[1].length, out[2].length],
        eq01: out[0] === out[1],
        eq12: out[1] === out[2],
      });
    }
    return ensureDistinctSplit(src, out);
  }

  const openAiParsed = await splitWithOpenAi(src);
  if (openAiParsed) {
    if (import.meta.env.DEV) {
      console.debug("[24s diag] splitCampaignPromptIntoThreeVideoSegments branch", {
        branch: "openai_ok",
        srcLength: src.length,
      });
    }
    return ensureDistinctSplit(src, openAiParsed);
  }

  const rough = roughSplitThree(src);
  if (import.meta.env.DEV) {
    console.debug("[24s diag] splitCampaignPromptIntoThreeVideoSegments branch", {
      branch: "openai_fallback_rough",
      srcLength: src.length,
    });
    console.debug("[24s diag] roughSplitThree result (openai fallback)", {
      outLens: [rough[0].length, rough[1].length, rough[2].length],
      eq01: rough[0] === rough[1],
      eq12: rough[1] === rough[2],
    });
  }
  return ensureDistinctSplit(src, rough);
}
