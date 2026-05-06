/**
 * Découpe un script campagne en 3 prompts séquentiels pour le pipeline 24 s (3 × 8 s).
 * Ordre : **OpenAI** (`openai-chat`) → découpage texte.
 */
import { chatCompletion, type ChatMessage } from "./openai/chatgpt-client";

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
    content: `Tu découpes un script vidéo unique en exactement 3 segments narratifs cohérents pour une vidéo enchaînée en trois clips de 8 secondes chacun (début, milieu, fin du récit visuel).
Réponds UNIQUEMENT par un JSON compact, sans markdown ni texte avant ou après :
{"part1":"...","part2":"...","part3":"..."}
- part1 = ce qui se passe au début (premier tiers narratif / mise en place filmable).
- part2 = développement central (milieu).
- part3 = conclusion ou résolution visuelle (fin).
Chaque chaîne est un prompt vidéo autonome (français ou anglais selon la source), avec continuité visuelle et narrative entre les segments. Minimum ~40 caractères par part si le script est assez long. Pas d'autres clés.`,
  },
];

async function splitWithOpenAi(src: string): Promise<[string, string, string] | null> {
  try {
    const messages: ChatMessage[] = [
      ...OPENAI_SYSTEM_MESSAGES(),
      {
        role: "user",
        content: `Script campagne à répartir en trois segments (début / milieu / fin), trois clips de 8 secondes :\n\n${src.slice(0, 12000)}`,
      },
    ];
    const res = await chatCompletion(messages, {
      model: "gpt-4o-mini",
      temperature: 0.45,
      max_tokens: 1024,
    });
    const raw = res?.choices?.[0]?.message?.content ?? "";
    return parseThreeFromJson(raw);
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
    const [a, b, c] = roughSplitThree(src);
    return [
      a || src.slice(0, Math.max(8, Math.ceil(src.length / 3))),
      b || src.slice(Math.ceil(src.length / 3), Math.ceil((2 * src.length) / 3)),
      c || src.slice(Math.ceil((2 * src.length) / 3)),
    ];
  }

  const openAiParsed = await splitWithOpenAi(src);
  if (openAiParsed) return openAiParsed;

  return roughSplitThree(src);
}
