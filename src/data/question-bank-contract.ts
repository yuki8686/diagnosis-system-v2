import type { QuestionDefinition, TypeId } from "../types";

export interface QuestionBankSections {
  commonType: QuestionDefinition[];
  comparisons: Record<string, QuestionDefinition[]>;
  defense: QuestionDefinition[];
  genericExpression: QuestionDefinition[];
  genericGap: QuestionDefinition[];
  byType: Record<TypeId, {
    expression: QuestionDefinition[];
    gap: QuestionDefinition[];
    utilization: QuestionDefinition[];
  }>;
}

/**
 * 質問バンクの物理総数。
 * 133問という旧集計は、確認質問と汎用フォールバックの一部を混在して除外していた。
 * v1.0実装では、通常出題・条件付き確認・低確信度専用をすべて別IDで保持するため151問となる。
 */
export const EXPECTED_COUNTS = {
  commonType: 12,
  comparisons: 12,
  defense: 7,
  genericExpression: 4,
  genericGap: 12,
  typeSpecific: {
    expressionPerType: 6,
    gapPerType: 12,
    utilizationPerType: 8,
  },
  physicalBankTotal: 151,
  // 通常確定ルートで必ず使う基本問数。確認質問は含めない。
  resolvedRouteBase: 39,
  lowConfidenceRouteBase: 39,
} as const;

export function flattenQuestionBank(bank: QuestionBankSections): QuestionDefinition[] {
  return [
    ...bank.commonType,
    ...Object.values(bank.comparisons).flat(),
    ...bank.defense,
    ...bank.genericExpression,
    ...bank.genericGap,
    ...Object.values(bank.byType).flatMap((section) => [...section.expression, ...section.gap, ...section.utilization]),
  ];
}
