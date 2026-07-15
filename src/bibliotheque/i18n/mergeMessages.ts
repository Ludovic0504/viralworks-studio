import type { MessageTree } from "./types";

export function mergeMessages(...trees: MessageTree[]): MessageTree {
  const out: MessageTree = {};
  for (const tree of trees) {
    for (const [key, value] of Object.entries(tree)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const existing = out[key];
        out[key] =
          existing && typeof existing === "object" && !Array.isArray(existing)
            ? mergeMessages(existing as MessageTree, value as MessageTree)
            : { ...(value as MessageTree) };
      } else {
        out[key] = value;
      }
    }
  }
  return out;
}
