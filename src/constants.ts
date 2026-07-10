import type { DefenseCategory, TypeId } from "./types";

export const ENGINE_VERSION = "1.1.0";
export const SCORING_VERSION = "1.1.0";
export const QUESTION_BANK_VERSION = "1.1.0";

export const TYPE_LABELS: Record<TypeId, string> = {
  win: "勝ち筋タイプ",
  connect: "つながりタイプ",
  analyze: "読み解きタイプ",
  axis: "軸タイプ",
};

export const TYPE_PURPOSES: Record<TypeId, string> = {
  win: "立場・形勢・結果を動かす",
  connect: "関係の温度と反応を動かす",
  analyze: "情報・構造・理解可能性を整える",
  axis: "意味・理想・価値との一致へ近づける",
};

export const EXPRESSION_LABELS = {
  outward: "打ち出す型",
  inward: "内に燃やす型",
  adaptive: "使い分け型",
} as const;

export const DEFENSE_LABELS: Record<DefenseCategory, string> = {
  counterattack: "反撃する",
  prove: "挽回・証明へ向かう",
  distance: "距離を取る",
  "self-efface": "自分を引いて合わせる",
  analyze: "分析する",
  "self-blame": "自分へ矛先を向ける",
  numb: "感情を切り離す",
  freeze: "固まる",
};

export const LIMITS = {
  userFacingDuration: "約10分前後",
  minimumQuestions: 39,
  operationalMaximumQuestions: 47,
  hardMaximumQuestions: 48,
  resumeDays: 14,
} as const;

export const THRESHOLDS = {
  type: {
    flatTopMax: 4,
    clusterTopToThirdMax: 2,
    clearMarginMin: 3,
    secondaryDisplayMin: 3,
  },
  expression: {
    outwardMin: 12,
    inwardMax: 7,
  },
  reliability: {
    medianFastResponseMs: 1500,
    positionRunLength: 8,
    likertRunLength: 8,
  },
  utilization: {
    highMin: 4,
    middleMin: 3,
  },
} as const;
