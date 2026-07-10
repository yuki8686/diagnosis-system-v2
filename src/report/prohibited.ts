import type { ProhibitedCategory, ProhibitedFinding } from "../types";

const RULES: Array<{ category: ProhibitedCategory; pattern: RegExp }> = [
  { category: "inner_truth", pattern: /あなたの本心は|本当のあなたは/g },
  { category: "causal_history", pattern: /幼少期に|過去のトラウマ|トラウマが原因/g },
  { category: "medical", pattern: /脳の構造|心理疾患|治療が必要|医学的に診断/g },
  { category: "deterministic_future", pattern: /必ず成功する|恋愛では必ず|絶対に|100\s*%/g },
  { category: "relationship_mindreading", pattern: /相手はあなたを|この関係は/g },
  { category: "type_superiority", pattern: /最も優れたタイプ|他のタイプより上|劣ったタイプ|タイプの頂点/g },
];

export function detectProhibitedExpressions(text: string): ProhibitedFinding[] {
  const findings: ProhibitedFinding[] = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) findings.push({ category: rule.category, matchedText: match[0], pattern: rule.pattern.source });
  }
  return findings;
}
