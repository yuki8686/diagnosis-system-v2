import { TYPE_IDS, type QuestionDefinition } from "./types";
import { EXPECTED_COUNTS, flattenQuestionBank, type QuestionBankSections } from "./data/question-bank-contract";

export interface ValidationIssue { severity: "error" | "warning"; code: string; message: string; questionId?: string; }

export function validateQuestionBank(bank: QuestionBankSections): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const all = flattenQuestionBank(bank);
  const ids = new Set<string>();

  for (const q of all) {
    if (ids.has(q.id)) issues.push({ severity: "error", code: "DUPLICATE_ID", message: `Duplicate question id: ${q.id}`, questionId: q.id });
    ids.add(q.id);
    if (q.version < 1) issues.push({ severity: "error", code: "INVALID_VERSION", message: "Question version must be >= 1", questionId: q.id });
    if (!q.prompt.trim()) issues.push({ severity: "error", code: "EMPTY_PROMPT", message: "Question prompt is empty", questionId: q.id });
    if (q.format === "likert-5" && q.options.length !== 5) issues.push({ severity: "error", code: "LIKERT_OPTION_COUNT", message: "Likert question must have five options", questionId: q.id });
    if (q.block === "common-type") {
      const mapped = q.options.map((o) => o.typeId).filter(Boolean);
      for (const typeId of TYPE_IDS) if (!mapped.includes(typeId)) issues.push({ severity: "error", code: "MISSING_TYPE_OPTION", message: `Common question lacks ${typeId}`, questionId: q.id });
      if (new Set(mapped).size !== 4) issues.push({ severity: "error", code: "DUPLICATE_TYPE_OPTION", message: "Common question must map exactly one option to each type", questionId: q.id });
    }
    if (q.block === "type-comparison") {
      const mapped = q.options.map((o) => o.typeId).filter(Boolean);
      if (q.options.length !== 2 || new Set(mapped).size !== 2) issues.push({ severity: "error", code: "INVALID_COMPARISON", message: "Comparison must contain two different type options", questionId: q.id });
    }
    if (q.block === "defense" && q.options.some((o) => !o.defenseCategory)) issues.push({ severity: "error", code: "MISSING_DEFENSE_MAPPING", message: "Every defense option needs a category", questionId: q.id });
    if (q.metric === "gap" && !q.pairId) issues.push({ severity: "error", code: "MISSING_PAIR_ID", message: "Gap item requires pairId", questionId: q.id });
  }

  const countChecks: Array<[string, number, number]> = [
    ["commonType", bank.commonType.length, EXPECTED_COUNTS.commonType],
    ["comparisons", Object.values(bank.comparisons).flat().length, EXPECTED_COUNTS.comparisons],
    ["defense", bank.defense.length, EXPECTED_COUNTS.defense],
    ["genericExpression", bank.genericExpression.length, EXPECTED_COUNTS.genericExpression],
    ["genericGap", bank.genericGap.length, EXPECTED_COUNTS.genericGap],
    ["physicalBankTotal", all.length, EXPECTED_COUNTS.physicalBankTotal],
  ];
  for (const [name, actual, expected] of countChecks) {
    if (actual !== expected) issues.push({ severity: "error", code: "COUNT_MISMATCH", message: `${name}: expected ${expected}, got ${actual}` });
  }

  for (const [pairKey, questions] of Object.entries(bank.comparisons)) {
    if (questions.length !== 4) issues.push({ severity: "error", code: "COMPARISON_PAIR_COUNT", message: `${pairKey}: expected 4 comparison items, got ${questions.length}` });
    const ids = questions.map((question) => question.id);
    if (!ids.every((id, index) => id.endsWith(`-${index + 1}`))) issues.push({ severity: "error", code: "COMPARISON_PAIR_SEQUENCE", message: `${pairKey}: comparison ids must end in -1 through -4` });
    const expectedTypes = questions[0]?.options.map((option) => option.typeId).filter((value): value is NonNullable<typeof value> => Boolean(value)).sort().join("|");
    const pairKeyTypes = pairKey.split("-").sort().join("|");
    if (expectedTypes !== pairKeyTypes) issues.push({ severity: "error", code: "COMPARISON_PAIR_KEY_TYPES", message: `${pairKey}: option types must match the pair key` });
    if (questions.some((question) => question.options.map((option) => option.typeId).filter((value): value is NonNullable<typeof value> => Boolean(value)).sort().join("|") !== expectedTypes)) {
      issues.push({ severity: "error", code: "COMPARISON_PAIR_TYPES", message: `${pairKey}: all four questions must compare the same two types` });
    }
    if (new Set(questions.map((question) => question.prompt)).size !== questions.length) issues.push({ severity: "error", code: "DUPLICATE_COMPARISON_PROMPT", message: `${pairKey}: comparison prompts must be distinct` });
  }

  for (const typeId of TYPE_IDS) {
    const section = bank.byType[typeId];
    const checks: Array<[string, number, number]> = [
      ["expression", section.expression.length, EXPECTED_COUNTS.typeSpecific.expressionPerType],
      ["gap", section.gap.length, EXPECTED_COUNTS.typeSpecific.gapPerType],
      ["utilization", section.utilization.length, EXPECTED_COUNTS.typeSpecific.utilizationPerType],
    ];
    for (const [name, actual, expected] of checks) {
      if (actual !== expected) issues.push({ severity: "error", code: "TYPE_COUNT_MISMATCH", message: `${typeId}.${name}: expected ${expected}, got ${actual}` });
    }
  }

  const gapItems = all.filter((q) => q.metric === "gap");
  const pairGroups = new Map<string, QuestionDefinition[]>();
  for (const q of gapItems) pairGroups.set(q.pairId!, [...(pairGroups.get(q.pairId!) ?? []), q]);
  for (const [pairId, items] of pairGroups) {
    if (items.length !== 2) issues.push({ severity: "error", code: "INCOMPLETE_GAP_PAIR", message: `${pairId}: expected 2 items, got ${items.length}` });
    const hasInner = items.some((q) => q.block === "gap-inner" || q.block === "generic-gap-inner");
    const hasPublic = items.some((q) => q.block === "gap-public" || q.block === "generic-gap-public");
    if (!hasInner || !hasPublic) issues.push({ severity: "error", code: "INVALID_GAP_PAIR", message: `${pairId}: inner/public pairing is invalid` });
  }

  return issues;
}
