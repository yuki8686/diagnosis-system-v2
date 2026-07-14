import type { ProhibitedCategory, ProhibitedFinding } from "../types";

const RULES: Array<{ category: ProhibitedCategory; pattern: RegExp }> = [
  { category: "inner_truth", pattern: /あなたの本心は|本当のあなたは|本当のあなた|根底では|あなたの心の奥では/g },
  { category: "causal_history", pattern: /生まれつき|幼少期|過去の経験(?:が|により)原因|過去のトラウマ|トラウマ(?:が原因|によって)?/g },
  { category: "medical", pattern: /脳の構造|脳構造|心理疾患|精神疾患|治療が必要|医学的に診断/g },
  { category: "deterministic_future", pattern: /あなたは必ず|必ず成功する|恋愛では必ず|絶対に|100\s*%|確実に成功/g },
  { category: "relationship_mindreading", pattern: /相手は[^。\n]{0,24}(?:と感じる|と思っている)|この関係(?:の未来|は)(?:[^。\n]{0,24})(?:安泰|続く|終わる|確実)/g },
  { category: "type_superiority", pattern: /最も優れたタイプ|他のタイプより上|劣ったタイプ|タイプの頂点|上位タイプ|下位タイプ/g },
];

export function detectProhibitedExpressions(text: string): ProhibitedFinding[] {
  const findings: ProhibitedFinding[] = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) findings.push({ category: rule.category, matchedText: match[0], pattern: rule.pattern.source });
  }
  return findings;
}
